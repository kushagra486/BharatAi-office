# BHARAT AI OFFICE — Product Requirements Document

**Owner:** Kushagra Gupta
**Status:** Draft v1.0 — ready for Claude Code
**One-liner:** A local-first multi-agent harness that turns a single project brief into a fully staffed AI office — 10 employee agents (real Claude Code sessions) coordinated by an orchestrator, visualized as a living 2D office floor you can watch and inspect.

---

## 1. Vision

You give the office one brief. **Nova**, the orchestrator, breaks it into a task graph and assigns work to 10 specialist employees. Each employee is a **real spawned Claude Code CLI session** — not a simulation — doing actual file edits, running commands, and committing to git. You watch it all happen on an animated office floor: agents walk to the review table to hand off work, envelopes fly for message-only handoffs, and a live approvals dock surfaces only the decisions that actually need you. Click any desk to see that employee's live terminal, task, activity log, and output.

## 2. Design origin & IP note

Conceptually inspired by the "GOD orchestrator + office floor" pattern seen in local multi-agent harness projects (e.g. Electron + Pixi.js implementations with a hive/mailbox layer). **Bharat AI Office does not reuse any of that prior art's code, assets, or character sprites** — every visual element (avatar shapes, color tokens, animations, layout) is original, built in-house, and safe to license/commercialize freely. Keep it that way: no imported tilesets, no recolored third-party sprite sheets, ever.

## 3. Non-goals (v1)

- No multi-tenant / multi-user cloud version — this is a local-first tool for one operator.
- No mobile app.
- No fully autonomous unattended runs — the escalation/approvals system is mandatory, not optional.
- No support for CLI tools other than `claude` in v1 (architecture should allow swapping later, but don't build that abstraction yet).

---

## 4. Core Concept — How a Project Flows

```
 You ──(brief)──► Nova (Orchestrator)
                     │
                     ├─ decomposes brief into a task graph (DAG, not a flat list)
                     ├─ assigns tasks to employees by role + dependency order
                     ├─ escalates ONLY: spend, destructive ops, scope changes → Approvals Dock
                     └─ merges + QA's outputs before shipping

 Employees (10 spawned `claude` CLI sessions, each with a role + working directory)
   ├─ read assigned task from the Hive (shared task ledger)
   ├─ do real work: edit files, run commands, commit to git
   ├─ write status + output back to the Hive
   └─ "walk" to the Review Table (UI) when handing off; envelope flies for pure messages

 Review Table ──► Nova QA pass ──► Shipped deliverable to you
```

Two distinct handoff signals in the UI (keep both, they mean different things):
- **Walking** = an employee is physically delivering completed work to the review table.
- **Flying envelope** = a message/status update between agents that doesn't require leaving the desk.

---

## 5. Architecture

### 5.1 Why this can't be pure serverless

Employees are **real `claude` CLI processes** with file/git access via `node-pty`. This requires a persistent local process host — it cannot run inside Vercel serverless functions (no long-lived PTYs, no filesystem access, no git). The architecture is therefore **local-first**, matching the deployment decision below.

### 5.2 Component diagram

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend — Next.js (React)               │
│   Office floor scene · Side panel · Approvals dock         │
│   Memory recall · HUD                                      │
│   Runs at localhost:3000 in dev; Electron-wrapped in Phase 2│
└───────────────────────▲─────────────────────────────────┘
                         │ WebSocket (real-time agent state)
┌───────────────────────┴─────────────────────────────────┐
│               Local Agent Daemon — Node.js/TS              │
│  ┌───────────┐  ┌───────────┐  ┌────────────────────┐    │
│  │ PtyManager │  │   Hive    │  │  Nova (Orchestrator) │   │
│  │ node-pty   │  │ SQLite:   │  │  Groq Llama 3.3 70B  │   │
│  │ spawns/    │  │ tasks,    │  │  task decomposition, │   │
│  │ tracks     │  │ messages, │  │  routing, escalation │   │
│  │ `claude`   │  │ memory,   │  │  policy, QA pass      │   │
│  │ sessions   │  │ escalations│ │                       │   │
│  └───────────┘  └───────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────┘
            │ spawns                        │ reads/writes
            ▼                                ▼
   10x `claude` CLI processes         Project working directory
   (real file edits + git)            (the actual codebase being built)
```

### 5.3 Why Groq + Claude Code together

- **Nova (orchestrator) runs on Groq Llama 3.3 70B** — fast, free, good enough for task decomposition, routing decisions, status summarization, and escalation triage. This is a lightweight reasoning role, not code generation.
- **Employees run on Claude Code itself** — the actual coding/file work is done by the spawned `claude` CLI sessions using your existing Claude Code auth. Groq is never used for the real work; it only powers Nova's coordination layer. Don't conflate the two — this is the single most important architectural fact for whoever (including future-you) reads this PRD.

### 5.4 Hive schema (SQLite, local-first — no Supabase dependency for v1)

```sql
-- agents: static roster
CREATE TABLE agents (
  id TEXT PRIMARY KEY, name TEXT, role TEXT, dept TEXT,
  color TEXT, shape TEXT, home_x REAL, home_y REAL
);

-- tasks: the DAG
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, agent_id TEXT, title TEXT, description TEXT,
  status TEXT CHECK(status IN ('idle','working','blocked','done')),
  depends_on TEXT,        -- JSON array of task ids
  created_at TEXT, updated_at TEXT
);

-- messages: mailbox between agents (drives envelope animation)
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_agent TEXT, to_agent TEXT, type TEXT CHECK(type IN ('task','handoff','escalation','report')),
  body TEXT, created_at TEXT
);

-- memory: shared semantic recall (start simple — full text search is enough for v1)
CREATE TABLE memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT, tag TEXT, content TEXT, created_at TEXT
);

-- escalations: the approvals dock feed
CREATE TABLE escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT, description TEXT,
  resolution TEXT CHECK(resolution IN ('pending','approved','denied')) DEFAULT 'pending',
  created_at TEXT, resolved_at TEXT
);
```

### 5.5 Escalation policy (hard rule for Nova's prompt)

Only these route to the Approvals Dock — everything else Nova resolves autonomously:
1. Anything involving spend (API calls beyond a budget, paid services).
2. Destructive operations (force-push, dropping data, deleting files outside the task scope).
3. Scope changes (a task that expands beyond what the brief implied).

---

## 6. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | Next.js (React, TypeScript) | matches your standard pattern |
| Styling | Tailwind CSS + custom design tokens | see §7 |
| Realtime transport | WebSocket (`ws` package) between daemon and frontend | no external service needed, local-first |
| Backend daemon | Node.js + TypeScript, Express or Fastify | hosts PtyManager, Hive, Nova |
| Terminal wrapping | `node-pty` | spawns real `claude` CLI sessions |
| Local storage | SQLite (`better-sqlite3`) | Hive tables from §5.4 |
| Orchestrator LLM | Groq API, `llama-3.3-70b-versatile` | task decomposition, routing, escalation triage, QA summaries |
| Employee execution | Claude Code CLI (`claude`), one process per employee | real file/git work |
| Packaging (Phase 2) | Electron | wraps the same Next.js + daemon for a native desktop build |
| Version control safety | Single-committer pattern — only the daemon touches git, never an employee process directly | avoids `.git/index.lock` corruption under concurrency |

**Environment variables needed:**
```
GROQ_API_KEY=            # Nova's orchestration brain
DAEMON_PORT=4317          # local WebSocket/HTTP port
HIVE_DB_PATH=./hive.db    # SQLite file
PROJECT_WORKDIR=          # the directory employees actually work in
```

---

## 7. UI Specification

### 7.1 Design tokens

| Token | Value | Use |
|---|---|---|
| `--void` | `#06090D` | base background |
| `--panel` | `#0E141C` | glass panels |
| `--line` | `#1D2836` | borders, grid |
| `--cyan` | `#2FE6D2` | working status, primary accent |
| `--violet` | `#8B7CF6` | orchestrator, task messages |
| `--amber` | `#FFB454` | escalations, review table |
| `--magenta` | `#FF4D6D` | blocked status, security flags |
| `--green` | `#4ADE80` | done status, reports |
| `--saffron` | `#FF9933` | **Bharat accent** — used sparingly on the HUD mark / brand chrome only |
| `--india-green` | `#138808` | **Bharat accent** — paired with saffron on brand chrome only, never on status colors |

Typography: system UI sans for body, a monospace face (`ui-monospace`) for all data/status/terminal text — this is a HUD, not a marketing page, so mono carries the "instrument panel" feel throughout.

### 7.2 Screen layout

1. **HUD bar** (sticky top): brand mark, session id, "⌕ RECALL" button, "⚑ APPROVALS" button with live pending-count badge.
2. **Brief strip**: current project brief + ETA.
3. **Office floor scene**: full-width panel, fixed aspect ratio, absolute-positioned desk slots around a central Review Table and Nova's office at top-center. SVG wire overlay (viewBox `0 0 100 100` matching the percentage coordinate system used for desk/avatar positioning).
4. **Walker avatars**: role-shaped tokens (hexagon = engineering, diamond = design, circle = data, rounded-square = ops), idle bob animation, walk to Review Table on a randomized interval when `status === 'working'`, direction-flip via `scaleX(-1)`, status dot bottom-corner (cyan pulse = working, gray = idle, magenta pulse = blocked, green = done).
5. **Approvals dock**: fixed bottom bar, one card per pending escalation, Approve/Deny buttons, resolved cards fade and move to a resolved state rather than disappearing (audit trail visible).
6. **Memory recall panel**: modal, single search input, filters a list of tagged memory snippets in real time.
7. **Employee side panel**: slides from the right on desk/avatar click — live terminal feed (typewriter-animated), current task, timestamped activity log, latest output block.

---

## 8. Agent Roster

| Agent | Role | Dept (shape) | Color | Responsibilities |
|---|---|---|---|---|
| **Nova** | Orchestrator | — (octagon) | `--violet` | Decompose brief → task graph, assign, route, escalate per policy, final QA + merge |
| **Kael** | Solutions Architect | eng (hex) | `--cyan` | System design, DB schema, API contracts |
| **Priya** | Backend Developer | eng (hex) | `--violet` | Server implementation, endpoints, business logic |
| **Devraj** | Frontend Developer | eng (hex) | `--green` | UI implementation from design spec |
| **Simran** | UI/UX Designer | design (diamond) | `--amber` | Design tokens, component states, UX flows |
| **Arjun** | QA Engineer | eng (hex) | `--magenta` | Test plans, execution, bug reports |
| **Meera** | Data/Analytics | data (circle) | `--cyan` | Queries, metrics, aggregation logic |
| **Raghav** | Security Reviewer | eng (hex) | `--violet` | Auth review, vulnerability flags |
| **Tanya** | Technical Writer | data (circle) | `--green` | Docs, READMEs, onboarding guides |
| **Farhan** | DevOps Engineer | ops (rounded-sq) | `--amber` | CI/CD, deploy pipelines, infra |
| **Isha** | Project Coordinator | ops (rounded-sq) | `--magenta` | Task breakdown assist, dependency mapping, timeline |

---

## 9. Build Phases

| Phase | Deliverable |
|---|---|
| **0 — Scaffold** | Monorepo: `/frontend` (Next.js) + `/daemon` (Node/TS). Shared types package for Hive schema. |
| **1 — Hive** | SQLite schema (§5.4) + a small data-access module (`hive.ts`) with typed CRUD for tasks/messages/memory/escalations. |
| **2 — PtyManager** | `node-pty`-based spawner: launch a `claude` process per employee with the role prompt (§8.1), stream output, detect task-complete markers to update Hive status. |
| **3 — Nova** | Groq-backed orchestrator module: brief → task graph → assignments written to Hive; escalation triage loop; QA pass on completion. |
| **4 — Realtime bridge** | WebSocket server broadcasting Hive state changes (task status, new messages, new escalations) to the frontend. |
| **5 — Frontend** | React components wired to the WebSocket feed — walker movement triggered by real task status transitions, not the timer-based demo loop. |
| **6 — Approvals + Recall** | Wire the Approvals Dock to real escalations table; wire Memory Recall to a full-text search over the `memory` table. |
| **7 — Electron wrap** | Package frontend + daemon into a single Electron app for native desktop distribution. |

---

## 11. Open risks / questions to revisit

- **Concurrency limits**: 10 simultaneous `claude` CLI sessions may hit rate limits depending on your Claude Code plan — confirm before running a full 10-agent brief; consider a queue that caps concurrent active sessions.
- **Sandboxing**: employees have real file/git access — scope each to its own subdirectory (`PROJECT_WORKDIR/{agentId}/`) and never let an employee process run `git push --force` or operate outside its directory; the single-committer daemon-side git module is the enforcement point.
- **Task-complete detection**: the `TASK_DONE:` marker convention is a starting point — Claude Code's actual output format should be tested early to confirm a reliable parse signal exists.
- **Cost**: Groq calls for Nova are free-tier; the real cost driver is Claude Code session usage across 10 concurrent employees — worth tracking from day one.
