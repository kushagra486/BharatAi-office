# Bharat AI Office

A local-first multi-agent harness that turns a single project brief into a
fully staffed AI office — 10 employee agents (real `claude` CLI sessions)
coordinated by an orchestrator (Nova), visualized as a living 2D office
floor.

See [`BHARAT_AI_OFFICE_PRD.md`](./BHARAT_AI_OFFICE_PRD.md) for the full
product spec.

## Two-process architecture (read this before you deploy anywhere)

This is **not** a typical Next.js app you can drop on Vercel. It is two
cooperating local processes:

1. **`/daemon`** — a Node.js/TypeScript process that:
   - spawns real `claude` CLI processes per employee via `node-pty`
     (persistent PTYs with live file/git access to your project directory)
   - owns the Hive (a local SQLite database: tasks, messages, memory,
     escalations)
   - runs Nova, the orchestrator, backed by the Groq API
   - broadcasts Hive state changes over a WebSocket to the frontend
2. **`/frontend`** — a Next.js app that renders the office floor, side
   panel, and approvals dock, and talks to the daemon over that WebSocket
   (plus a small REST surface for approvals/recall).

The daemon **cannot** run on serverless hosting (Vercel functions, etc.):
it needs long-lived PTY processes and direct filesystem/git access to the
project the employees are actually working on. Both processes must run
locally, side by side, on the same machine. A future Electron build
(Phase 7 in the PRD) packages both into one native app — it's a packaging
layer on top of this same architecture, not a replacement for it.

## Getting started

```bash
cp .env.example .env
# fill in GROQ_API_KEY and PROJECT_WORKDIR

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
employee gets its own subdirectory (`PROJECT_WORKDIR/{agentId}/`) — see
the PRD's sandboxing note in section 11. Only the daemon ever runs `git`
directly; employee processes never push or force-push.

## Workspaces

| Path | What it is |
|---|---|
| `/shared` | Hive types, the agent roster, and design tokens — imported by both `/daemon` and `/frontend` so the schema and visuals never drift apart |
| `/daemon` | PtyManager, Hive (SQLite), Nova (Groq orchestrator), WebSocket bridge, REST endpoints |
| `/frontend` | Next.js office floor UI |
