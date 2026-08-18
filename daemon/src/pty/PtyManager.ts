import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import * as pty from 'node-pty';
import { ROSTER } from '@bharat-ai-office/shared';
import { env } from '../env';
import * as hive from '../hive/hive';
import { commitAgentWork } from '../git/gitModule';
import { buildRolePrompt } from './rolePrompts';

// Convention employees are instructed (rolePrompts.ts) to print on their
// last line: "TASK_DONE: <summary>" on success, "ESCALATE: <reason>" when
// blocked. This is the "task-complete marker" the PRD flags as a starting
// point to validate against real `claude -p` output — see PRD section 11.
const TASK_DONE_RE = /TASK_DONE:\s*(.+)/;
const ESCALATE_RE = /ESCALATE:\s*(.+)/;

export interface PtyOutputEvent {
  agentId: string;
  taskId: string;
  chunk: string;
}

export interface PtyExitEvent {
  agentId: string;
  taskId: string;
  exitCode: number;
}

interface RunningProcess {
  agentId: string;
  taskId: string;
  proc: pty.IPty;
  outputBuffer: string;
  escalated: boolean;
}

export const ptyEvents = new EventEmitter();

class PtyManager {
  private processes = new Map<string, RunningProcess>();

  agentWorkdir(agentId: string): string {
    return path.join(env.PROJECT_WORKDIR, agentId);
  }

  isBusy(agentId: string): boolean {
    return this.processes.has(agentId);
  }

  /** Spawns `claude -p` as employee `agentId` to work `taskId`, streaming output over ptyEvents. */
  startTask(agentId: string, taskId: string): { agentId: string; taskId: string; pid: number } {
    if (this.processes.has(agentId)) {
      throw new Error(`agent ${agentId} already has a running task`);
    }
    const agent = ROSTER.find((a) => a.id === agentId);
    if (!agent) throw new Error(`unknown agent: ${agentId}`);
    const task = hive.getTask(taskId);
    if (!task) throw new Error(`unknown task: ${taskId}`);

    const workdir = this.agentWorkdir(agentId);
    fs.mkdirSync(workdir, { recursive: true });

    const systemPrompt = buildRolePrompt(agent, workdir);
    const taskPrompt = `Task: ${task.title}\n\n${task.description}`;

    hive.updateTaskStatus(taskId, 'working');

    // Employees run fully unattended (no human is watching this PTY to
    // click through tool-use prompts), so a blanket permission bypass is
    // deliberately avoided. Instead: --permission-mode dontAsk means an
    // unlisted tool call is denied outright rather than hanging on a
    // prompt nobody can answer; --allowedTools pre-approves only the
    // tools employees actually need; --disallowedTools explicitly blocks
    // git (gitModule.ts is the sole committer — see rolePrompts.ts),
    // outbound fetches, and spawning further agents. --add-dir scopes
    // file-tool access to the employee's own subdirectory. Anything
    // destructive/scope-changing/spend-related still must go through an
    // ESCALATE: marker per the role prompt.
    const proc = pty.spawn(
      'claude',
      [
        '-p',
        taskPrompt,
        '--append-system-prompt',
        systemPrompt,
        '--add-dir',
        workdir,
        '--permission-mode',
        'dontAsk',
        '--allowedTools',
        'Read',
        'Edit',
        'Write',
        'Bash',
        'Glob',
        'Grep',
        '--disallowedTools',
        'Bash(git *)',
        'WebFetch',
        'Agent',
      ],
      {
        name: 'xterm-color',
        cols: 120,
        rows: 40,
        cwd: workdir,
        env: process.env as Record<string, string>,
      }
    );

    const entry: RunningProcess = { agentId, taskId, proc, outputBuffer: '', escalated: false };
    this.processes.set(agentId, entry);

    proc.onData((chunk) => {
      entry.outputBuffer += chunk;
      const event: PtyOutputEvent = { agentId, taskId, chunk };
      ptyEvents.emit('output', event);
      this.scanForEscalation(entry);
    });

    proc.onExit(({ exitCode }) => {
      this.processes.delete(agentId);
      void this.handleExit(entry, exitCode);
    });

    return { agentId, taskId, pid: proc.pid };
  }

  write(agentId: string, data: string): void {
    const entry = this.processes.get(agentId);
    if (!entry) throw new Error(`no running process for agent ${agentId}`);
    entry.proc.write(data);
  }

  kill(agentId: string): void {
    const entry = this.processes.get(agentId);
    if (!entry) return;
    entry.proc.kill();
    this.processes.delete(agentId);
  }

  private scanForEscalation(entry: RunningProcess) {
    if (entry.escalated) return;
    const match = entry.outputBuffer.match(ESCALATE_RE);
    if (match) {
      entry.escalated = true;
      // Sent to Nova rather than raised directly: an employee flagging
      // something doesn't mean it belongs on the human's Approvals Dock —
      // Nova triages it against the hard policy first (see nova/nova.ts)
      // and only escalates the subset that's actually spend/destructive/
      // scope-change, resolving everything else itself.
      hive.sendMessage({ fromAgent: entry.agentId, toAgent: 'nova', type: 'escalation', body: match[1].trim() });
    }
  }

  private async handleExit(entry: RunningProcess, exitCode: number) {
    const { agentId, taskId, outputBuffer } = entry;
    const event: PtyExitEvent = { agentId, taskId, exitCode };
    ptyEvents.emit('exit', event);

    const doneMatch = outputBuffer.match(TASK_DONE_RE);

    if (doneMatch && exitCode === 0) {
      const summary = doneMatch[1].trim();
      try {
        await commitAgentWork(agentId, `${agentId}: ${summary}`.slice(0, 200));
      } catch (err) {
        console.error(`[pty] commit failed for ${agentId}`, err);
      }
      hive.sendMessage({ fromAgent: agentId, toAgent: 'nova', type: 'report', body: summary });
      hive.updateTaskStatus(taskId, 'done');
      return;
    }

    hive.updateTaskStatus(taskId, 'blocked');
    if (!entry.escalated) {
      // A daemon-detected operational failure (crash, no completion
      // signal), not a policy judgment call an employee raised — this
      // goes straight to the human rather than through Nova's triage.
      hive.raiseEscalation({
        agentId,
        description: `Task "${taskId}" exited without a TASK_DONE marker (exit code ${exitCode}). Needs review.`,
      });
    }
  }
}

export const ptyManager = new PtyManager();
