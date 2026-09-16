import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Agent, Task } from '@bharat-ai-office/shared';
import { llmRouter, supabaseHive as hive } from '@bharat-ai-office/shared/server';
import { env } from '../env';
import { commitAgentWork } from '../git/gitModule';
import { publishAgentEvent } from '../realtimeBroadcast';
import { buildRolePrompt } from './rolePrompts';
import { executeToolCall, TOOL_SCHEMAS } from './tools';

// Replaces the Claude Code CLI era's PtyManager: instead of spawning a real
// `claude -p` process, this owns a hand-rolled tool-use loop against
// whichever provider+model llm/assignments.ts gives this agent. See the
// migration plan's "key trade-offs" for why (no more Claude Code permission
// engine — our own sandboxing in tools.ts does that job now).
//
// This is the one piece of the original daemon that stays a real
// always-on process (PRD §5.1) rather than moving to serverless: it does
// real file edits in PROJECT_WORKDIR/{agentId}/ and real git commits,
// neither of which survive a stateless function invocation.
const MAX_TURNS = 25;
const WALL_CLOCK_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

export interface AgentOutputEvent {
  agentId: string;
  taskId: string;
  chunk: string;
}

export interface AgentExitEvent {
  agentId: string;
  taskId: string;
  exitCode: number; // 0 = done, 1 = blocked/escalated/failed — kept for parity with the old PTY exit-code shape
}

type Outcome = { kind: 'done'; summary: string } | { kind: 'escalate'; reason: string } | { kind: 'failed'; reason: string };

interface RunningState {
  agentId: string;
  taskId: string;
  cancelled: boolean;
}

// Kept as a local bus (in addition to the Supabase Realtime broadcast in
// publishAgentEvent) purely so this module stays independently testable
// without a live network call for every emitted line.
export const agentEvents = new EventEmitter();

class AgentRunner {
  private running = new Map<string, RunningState>();

  agentWorkdir(agentId: string): string {
    return path.join(env.PROJECT_WORKDIR, agentId);
  }

  isBusy(agentId: string): boolean {
    return this.running.has(agentId);
  }

  activeCount(): number {
    return this.running.size;
  }

  atCapacity(): boolean {
    return this.running.size >= env.MAX_CONCURRENT_SESSIONS;
  }

  /** Starts the tool-use loop for `agent` working `task`. Returns immediately; the loop runs async. Caller (dispatch.ts) already has both loaded from its own poll, so no re-fetch here. */
  startTask(agent: Agent, task: Task): void {
    if (this.running.has(agent.id)) {
      throw new Error(`agent ${agent.id} already has a running task`);
    }
    if (this.atCapacity()) {
      throw new Error(`at MAX_CONCURRENT_SESSIONS (${env.MAX_CONCURRENT_SESSIONS}) — task stays idle until a slot frees up`);
    }

    const workdir = this.agentWorkdir(agent.id);
    fs.mkdirSync(workdir, { recursive: true });

    const state: RunningState = { agentId: agent.id, taskId: task.id, cancelled: false };
    this.running.set(agent.id, state);

    void this.runLoop(state, agent, task, workdir);
  }

  kill(agentId: string): void {
    const state = this.running.get(agentId);
    if (state) state.cancelled = true;
    this.running.delete(agentId);
  }

  private emit(agentId: string, taskId: string, chunk: string): void {
    const event: AgentOutputEvent = { agentId, taskId, chunk: chunk.endsWith('\n') ? chunk : `${chunk}\n` };
    agentEvents.emit('output', event);
    void publishAgentEvent('output', event);
  }

  private async runLoop(state: RunningState, agent: Agent, task: Task, workdir: string): Promise<void> {
    const { agentId, taskId } = state;
    await hive.updateTaskStatus(taskId, 'working');

    const startedAt = Date.now();
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: buildRolePrompt(agent, workdir) },
      { role: 'user', content: `Task: ${task.title}\n\n${task.description}` },
    ];

    this.emit(agentId, taskId, `[${agent.name}] starting task "${task.title}"`);

    let outcome: Outcome | null = null;
    // Self-Refine / Reflexion-lite (Madaan et al. 2023 / Shinn et al. 2023;
    // open, model-agnostic techniques): don't finalize on the *first*
    // mark_task_done — ask the model to re-check its own work once, then
    // finalize on the next mark_task_done. Bounded to exactly one extra
    // turn (this flips true and never back), so it can't loop forever; the
    // existing MAX_TURNS/WALL_CLOCK_LIMIT caps still bound the worst case.
    let verificationRequested = false;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (state.cancelled) return;
      if (Date.now() - startedAt > WALL_CLOCK_LIMIT_MS) {
        outcome = { kind: 'failed', reason: 'exceeded the 10-minute time limit without finishing' };
        break;
      }

      let completion;
      try {
        completion = await llmRouter.chatComplete(agentId, { messages, tools: TOOL_SCHEMAS });
      } catch (err) {
        outcome = { kind: 'failed', reason: `LLM call failed: ${(err as Error).message}` };
        break;
      }

      const message = completion.choices[0]?.message;
      if (!message) {
        outcome = { kind: 'failed', reason: 'model returned no message' };
        break;
      }

      messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls });
      if (message.content) this.emit(agentId, taskId, message.content);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        // No tool call and no explicit completion signal — nudge forward
        // once rather than silently spinning; the turn cap bounds this.
        messages.push({
          role: 'user',
          content: 'Continue the task. Call a tool to make progress, or mark_task_done / escalate if you are finished or blocked.',
        });
        continue;
      }

      let stop = false;
      for (const toolCall of message.tool_calls) {
        const result = await executeToolCall(workdir, toolCall);
        if (result.kind === 'done') {
          if (!verificationRequested) {
            verificationRequested = true;
            this.emit(agentId, taskId, `… verifying: "${result.summary}"`);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content:
                'Before this is finalized: briefly re-check that summary against the task description above. ' +
                'If it fully satisfies the task, call mark_task_done again to confirm as-is. If you spot a real ' +
                'gap, fix it first with your tools, then call mark_task_done when actually done.',
            });
          } else {
            this.emit(agentId, taskId, `✓ mark_task_done (confirmed): ${result.summary}`);
            outcome = { kind: 'done', summary: result.summary };
            stop = true;
          }
        } else if (result.kind === 'escalate') {
          this.emit(agentId, taskId, `⚑ escalate: ${result.reason}`);
          outcome = { kind: 'escalate', reason: result.reason };
          stop = true;
        } else {
          this.emit(agentId, taskId, `→ ${toolCall.function.name}(${toolCall.function.arguments})\n${result.content}`);
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result.content });
        }
      }
      if (stop) break;
    }

    this.running.delete(agentId);
    await this.finish(agentId, taskId, outcome ?? { kind: 'failed', reason: `did not finish within ${MAX_TURNS} turns` });
  }

  private async finish(agentId: string, taskId: string, outcome: Outcome): Promise<void> {
    if (outcome.kind === 'done') {
      try {
        await commitAgentWork(agentId, `${agentId}: ${outcome.summary}`.slice(0, 200));
      } catch (err) {
        console.error(`[agent-runner] commit failed for ${agentId}`, err);
      }
      await hive.sendMessage({ fromAgent: agentId, toAgent: 'nova', type: 'report', body: outcome.summary });
      await hive.updateTaskStatus(taskId, 'done');
      agentEvents.emit('exit', { agentId, taskId, exitCode: 0 } satisfies AgentExitEvent);
      void publishAgentEvent('exit', { agentId, taskId, exitCode: 0 });
      return;
    }

    await hive.updateTaskStatus(taskId, 'blocked');
    if (outcome.kind === 'escalate') {
      // Sent to Nova for policy triage — an employee flagging something
      // doesn't automatically belong on the human's Approvals Dock.
      await hive.sendMessage({ fromAgent: agentId, toAgent: 'nova', type: 'escalation', body: outcome.reason });
    } else {
      // A worker-detected operational failure, not a policy judgment call —
      // goes straight to the human.
      await hive.raiseEscalation({ agentId, description: `Task "${taskId}" ${outcome.reason}. Needs review.` });
    }
    agentEvents.emit('exit', { agentId, taskId, exitCode: 1 } satisfies AgentExitEvent);
    void publishAgentEvent('exit', { agentId, taskId, exitCode: 1 });
  }
}

export const agentRunner = new AgentRunner();
