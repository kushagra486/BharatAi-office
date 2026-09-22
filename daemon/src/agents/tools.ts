import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ChatCompletionMessageToolCall, ChatCompletionTool } from 'openai/resources/chat/completions';

const execAsync = promisify(exec);

const COMMAND_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 4000;

// No git tool: gitModule.ts is the sole committer (single-committer pattern,
// same rule as when employees ran on Claude Code — see rolePrompts.ts). No
// network tool: employees have no outbound-fetch capability, matching the
// old --disallowedTools WebFetch restriction.
//
// run_command's `cwd: workdir` does NOT contain the shell by itself — it
// only sets the starting directory; `cat ../otherAgent/secret`, `cd .. &&
// rm -rf *`, or an absolute path all still work unless blocked explicitly.
// Verified this empirically before adding the traversal/absolute-path/home
// patterns below. This is still a denylist, not real OS sandboxing (a
// sufficiently obfuscated command — e.g. base64-decoding ".." at runtime —
// could still get around it), but it closes the straightforward escapes.
const DENIED_COMMAND_PATTERNS = [
  /\bgit\b/,
  /\bsudo\b/,
  /\bcurl\b/,
  /\bwget\b/,
  /\bssh\b/,
  /rm\s+-rf\s+\/(?!\S)/,
  /(^|[\s"'(])\.\.(?=$|[\s"'/)])/, // ".." as its own path segment (cd .., ../x, etc.)
  /(^|\s)~(?=$|[\s/])/, // ~ / ~/x home-directory expansion
  /(^|\s)\/(?!dev\/(null|stdout|stderr)\b)\S*/, // absolute paths (incl. bare "/"), except common /dev redirects
];

export const TOOL_SCHEMAS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: "Read a text file's contents from your working directory.",
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path relative to your working directory.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write (create or overwrite) a text file in your working directory. Creates parent directories as needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to your working directory.' },
          content: { type: 'string', description: 'Full file contents to write.' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and subdirectories at a path within your working directory.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: "Path relative to your working directory. Defaults to '.'." } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in your working directory (e.g. run tests, install a package). No git or network commands — those are not permitted.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'The shell command to run.' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_task_done',
      description: 'Call this when your task is complete. Ends your turn.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string', description: 'A short summary of what you produced.' } },
        required: ['summary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate',
      description:
        'Call this if you are blocked or need a decision outside your role\'s authority (spend, destructive operations, scope changes). Ends your turn — do not guess or proceed.',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string', description: 'One-sentence description of what needs a decision.' } },
        required: ['reason'],
      },
    },
  },
];

export type ToolOutcome =
  | { kind: 'ok'; content: string }
  | { kind: 'done'; summary: string }
  | { kind: 'escalate'; reason: string };

function resolveInWorkdir(workdir: string, requestedPath: string): string {
  const resolved = path.resolve(workdir, requestedPath || '.');
  const root = path.resolve(workdir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`path "${requestedPath}" escapes your working directory — not allowed`);
  }
  return resolved;
}

// resolveInWorkdir only checks path *text* — a symlink planted inside the
// workdir by run_command (e.g. `ln -s / evil`) resolves to a string that
// passes that check but points the real file operation outside it. This
// re-checks the *real* (symlink-resolved) path. Walks up to the nearest
// existing ancestor so it also covers a write_file target that doesn't
// exist yet (its containing directory does, since writeFile mkdir's it first).
async function assertRealContainment(workdir: string, target: string): Promise<void> {
  const root = await fs.realpath(workdir);
  let probe = target;
  while (true) {
    try {
      const real = await fs.realpath(probe);
      const realTarget = probe === target ? real : path.join(real, path.relative(probe, target));
      if (realTarget !== root && !realTarget.startsWith(root + path.sep)) {
        throw new Error('path escapes your working directory (symlink) — not allowed');
      }
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      const parent = path.dirname(probe);
      if (parent === probe) throw err; // reached filesystem root without finding an existing ancestor
      probe = parent;
    }
  }
}

function truncate(text: string): string {
  return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n…(truncated)` : text;
}

async function readFile(workdir: string, args: { path: string }): Promise<string> {
  const target = resolveInWorkdir(workdir, args.path);
  await assertRealContainment(workdir, target);
  return truncate(await fs.readFile(target, 'utf-8'));
}

async function writeFile(workdir: string, args: { path: string; content: string }): Promise<string> {
  const target = resolveInWorkdir(workdir, args.path);
  await assertRealContainment(workdir, target);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await assertRealContainment(workdir, target); // mkdir can itself create/traverse through a symlinked parent — recheck after
  await fs.writeFile(target, args.content, 'utf-8');
  return `wrote ${args.content.length} bytes to ${args.path}`;
}

async function listDirectory(workdir: string, args: { path?: string }): Promise<string> {
  const target = resolveInWorkdir(workdir, args.path ?? '.');
  await assertRealContainment(workdir, target);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n') || '(empty directory)';
}

async function runCommand(workdir: string, args: { command: string }): Promise<string> {
  if (DENIED_COMMAND_PATTERNS.some((re) => re.test(args.command))) {
    return `command rejected: "${args.command}" matches a disallowed pattern (no git/network/sudo commands — the daemon handles git for you).`;
  }
  try {
    const { stdout, stderr } = await execAsync(args.command, {
      cwd: workdir,
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    return truncate([stdout, stderr].filter(Boolean).join('\n').trim() || '(no output)');
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    return truncate(`command failed: ${e.message}\n${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim());
  }
}

/** Executes one tool call, sandboxed to `workdir`. Never throws for tool-usage errors — those come back as a string result so the model can react. */
export async function executeToolCall(workdir: string, toolCall: ChatCompletionMessageToolCall): Promise<ToolOutcome> {
  const name = toolCall.function.name;
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return { kind: 'ok', content: `invalid JSON arguments for ${name}` };
  }

  try {
    switch (name) {
      case 'read_file':
        return { kind: 'ok', content: await readFile(workdir, args as { path: string }) };
      case 'write_file':
        return { kind: 'ok', content: await writeFile(workdir, args as { path: string; content: string }) };
      case 'list_directory':
        return { kind: 'ok', content: await listDirectory(workdir, args as { path?: string }) };
      case 'run_command':
        return { kind: 'ok', content: await runCommand(workdir, args as { command: string }) };
      case 'mark_task_done':
        return { kind: 'done', summary: String((args as { summary?: string }).summary ?? 'Task complete.') };
      case 'escalate':
        return { kind: 'escalate', reason: String((args as { reason?: string }).reason ?? 'Blocked — no reason given.') };
      default:
        return { kind: 'ok', content: `unknown tool "${name}"` };
    }
  } catch (err) {
    return { kind: 'ok', content: `error: ${(err as Error).message}` };
  }
}
