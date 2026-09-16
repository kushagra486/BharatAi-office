# Bharat AI Office

A local-first multi-agent harness that turns a single project brief into a
fully staffed AI office — 10 employee agents coordinated by an orchestrator
(Nova), visualized as a living 3D office floor.

See [`BHARAT_AI_OFFICE_PRD.md`](./BHARAT_AI_OFFICE_PRD.md) for the full
product spec, including the v2 addendum describing the architecture below.

## Two-process architecture (read this before you deploy anywhere)

This is **not** a typical Next.js app you can drop on Vercel as-is. It is
two cooperating processes:

1. **`/daemon`** — a Node.js/TypeScript process that:
   - runs Nova and all 10 employees as LLM-driven agents, each with a
     hand-rolled tool-use loop (read/write files, run shell commands,
     mark a task done, or escalate) sandboxed to its own subdirectory —
     see `daemon/src/agents/AgentRunner.ts`
   - routes every agent's LLM calls through a multi-provider router
     (`daemon/src/llm/router.ts`) spanning **NVIDIA NIM**, **Groq**, and
     **OpenRouter** — each of the 11 seats is assigned a distinct
     provider+model (`daemon/src/llm/assignments.ts`) so 11 agents working
     concurrently spread across many separate rate-limit buckets instead of
     clogging one, with automatic fallback if a provider is rate-limited or
     down
   - owns the Hive (a local SQLite database: tasks, messages, memory,
     escalations)
   - is the sole process that ever runs `git`, against a single checked-out
     repo at `PROJECT_WORKDIR` (single-committer pattern — avoids
     `.git/index.lock` corruption under concurrency)
   - broadcasts Hive state changes over a WebSocket to the frontend
2. **`/frontend`** — a Next.js app that renders the office floor, side
   panel, and approvals dock, and talks to the daemon over that WebSocket
   (plus a small REST surface for briefs/approvals/recall).

The daemon is a small always-on Node service, not a fit for classic
request/response serverless functions: it holds a long-lived WebSocket to
the frontend, owns a local SQLite file, and runs `git` against a real
working-tree checkout. Both processes run side by side; `npm run electron`
(see below) packages both into one native desktop app (Phase 7 in the PRD).

## Getting started

```bash
cp .env.example .env
# fill in at least one of NVIDIA_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY,
# and PROJECT_WORKDIR

npm install

# run both processes together
npm run dev

# or separately, in two terminals
npm run dev:daemon
npm run dev:frontend
```

The daemon listens on `DAEMON_PORT` (default `4317`) for both the REST API
and the WebSocket. The frontend runs at `localhost:3000` and connects to
the daemon at `ws://localhost:4317`.

`PROJECT_WORKDIR` is the directory employee agents actually work in. Each
employee gets its own subdirectory (`PROJECT_WORKDIR/{agentId}/`) that its
tool calls (`read_file`/`write_file`/`list_directory`/`run_command`) are
sandboxed to — see the PRD's sandboxing note in section 11 and the v2
addendum. Only the daemon ever runs `git`; employees have no git tool at
all, and `run_command` denylists git/network/sudo invocations as a second
line of defense.

### Desktop app

`npm run electron` runs both processes inside one native window instead of
two terminals + a browser tab:

```bash
npm run build       # daemon + frontend production builds
npm run electron    # spawns both, opens a window once the frontend answers
```

`electron/main.js` is intentionally minimal — it just spawns `npm start` in
`daemon/` and `frontend/` and points a `BrowserWindow` at the result. Closing
the window stops both processes.

### Getting API keys

- **NVIDIA NIM**: create a free key at [build.nvidia.com](https://build.nvidia.com) — one key gives access to a large catalog of hosted models.
- **Groq**: free key at [console.groq.com](https://console.groq.com/keys).
- **OpenRouter**: free key at [openrouter.ai/keys](https://openrouter.ai/keys) — many free-tier models available.

You only need one configured to run at all; more configured providers means
more rate-limit headroom since each agent's assignment has fallbacks on the
*other* providers (see `daemon/src/llm/assignments.ts`).

## Workspaces

| Path | What it is |
|---|---|
| `/shared` | Hive types, the agent roster, and design tokens — imported by both `/daemon` and `/frontend` so the schema and visuals never drift apart |
| `/daemon` | AgentRunner (tool-use loop), the multi-provider LLM router, Hive (SQLite), Nova, WebSocket bridge, REST endpoints |
| `/frontend` | Next.js office floor UI |
| `/electron` | Native desktop wrapper (`npm run electron`) — spawns the daemon + frontend and shows the frontend in a window |
