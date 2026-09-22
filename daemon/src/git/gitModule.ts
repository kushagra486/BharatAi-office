import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { env } from '../env';

const execFileAsync = promisify(execFile);

// Single-committer pattern (PRD section 6): only this module ever runs git,
// and only against PROJECT_WORKDIR. Employee `claude` processes never touch
// git directly (see rolePrompts.ts), so concurrent employees can never race
// on .git/index.lock. Calls are additionally serialized through `queue` as
// a second line of defense.
const FORBIDDEN_ARGS = ['--force', '-f', '--force-with-lease', 'push'];

function assertSafeArgs(args: string[]) {
  for (const arg of args) {
    if (FORBIDDEN_ARGS.includes(arg)) {
      throw new Error(`gitModule: refusing to run git with forbidden arg "${arg}" (destructive/push ops are out of scope for v1)`);
    }
  }
}

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.catch(() => undefined);
  return result;
}

async function run(args: string[]): Promise<{ stdout: string; stderr: string }> {
  assertSafeArgs(args);
  return execFileAsync('git', args, { cwd: env.PROJECT_WORKDIR });
}

export async function ensureRepo(): Promise<void> {
  return enqueue(async () => {
    if (!fs.existsSync(env.PROJECT_WORKDIR)) {
      fs.mkdirSync(env.PROJECT_WORKDIR, { recursive: true });
    }
    const gitDir = `${env.PROJECT_WORKDIR}/.git`;
    if (!fs.existsSync(gitDir)) {
      await run(['init']);
      await run(['config', 'user.email', 'nova@bharat-ai-office.local']);
      await run(['config', 'user.name', 'Nova (Bharat AI Office)']);
    }
  });
}

export async function commitAgentWork(agentId: string, message: string): Promise<{ committed: boolean; changedFiles: string[] }> {
  return enqueue(async () => {
    await run(['add', agentId]);
    const { stdout } = await run(['status', '--porcelain', '--', agentId]);
    if (!stdout.trim()) {
      return { committed: false, changedFiles: [] };
    }
    await run(['commit', '-m', message]);
    // Repo-root-relative paths (so already "{agentId}/relative/path"), used
    // by AgentRunner to mirror just what changed into Supabase Storage
    // instead of re-uploading the agent's whole workdir on every commit.
    const { stdout: diffOutput } = await run(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
    const changedFiles = diffOutput
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
    return { committed: true, changedFiles };
  });
}

export async function repoStatus(): Promise<string> {
  return enqueue(async () => {
    const { stdout } = await run(['status', '--porcelain']);
    return stdout;
  });
}

/**
 * Wipes every agent's workdir + the local git repo and starts fresh — used
 * when dispatch.ts notices a new project has started (the `brief` row's
 * created_at changed) so the previous project's files don't leak into it.
 * Enqueued like every other git op here so it can't race a commit that's
 * still in flight for the project that's being cleared out.
 */
export async function resetWorkdir(): Promise<void> {
  return enqueue(async () => {
    if (fs.existsSync(env.PROJECT_WORKDIR)) {
      fs.rmSync(env.PROJECT_WORKDIR, { recursive: true, force: true });
    }
  });
}
