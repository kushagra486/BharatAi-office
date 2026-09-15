# Bharat AI Office — Deep Frontend Design Exploration

This is a companion to `UI_SPEC.md`. That file is the **contract** — what
must exist for the frontend to work against the real backend. This file is
the **exploration** — the bigger, more ambitious direction you asked about
(Minecraft-style avatars, a fuller office environment, agent controls,
token counters, work summaries, "manager rounds," a task-dependency graph,
motion design) with honest trade-offs, not a locked-in spec. Nothing here
is built yet; treat it as a menu to pick from.

---

## 1. The avatar question: "Minecraft-like boys" vs. the current pixel art

This is the biggest fork, so it goes first.

### What exists today
`frontend/components/office-pixel/` — a PixiJS (2D WebGL canvas) scene.
Characters are flat top-down sprites: a rounded head+body silhouette, 32×32px,
drawn in grayscale and tinted per-agent at runtime (see
`daemon`-adjacent... actually `frontend/scripts/generate-pixel-art.py`).
4-directional idle/walk animation. This is a **2D top-down** style —
think classic 16-bit RPG, not blocky/voxel.

### What "Minecraft-like" actually means as a design target
A few distinct things could be meant, and they're very different builds:

| Interpretation | What it looks like | Effort vs. today |
|---|---|---|
| **A. Literal voxel/blocky 3D** | Real 3D cubes for head/torso/limbs, a free-orbiting camera, like an actual Minecraft skin rig | Large — needs a 3D engine (Three.js / react-three-fiber), 3D character rigging, lighting, a real 3D office model. Different rendering stack entirely from the current PixiJS 2D canvas. |
| **B. Isometric "faux-3D" blocky look, still 2D-rendered** | Blocky proportions (big square head, rectangular body, no curves) drawn as flat isometric sprites, camera fixed at an angle — reads as "blocky/cute" without being real 3D | Moderate — stays inside PixiJS, just a different sprite-authoring style (blockier silhouettes instead of the current rounded ones) |
| **C. Keep top-down, just make the silhouette blockier** | Same camera angle as today, but square-edged bodies instead of rounded ones — the "Minecraft feel" comes from the blocky *shape*, not perspective | Smallest — literally editing `generate-pixel-art.py`'s pixel grid, same architecture, same file |

**My recommendation: start with C, treat B as the real target if you want the isometric feel, and only reach for A if you specifically want a literal 3D world.** Here's why: the PixiJS + tilemap architecture already built is a real, working, tested investment (rendering, tinting, animation state machine, click-to-select, WebSocket-driven state). Options B and C keep that investment; A discards it for a genuinely different engineering project (3D asset pipelines, camera controls, lighting, a much bigger performance/complexity budget for what's fundamentally a dashboard, not a game). Given this is a tool for *watching AI agents work*, not a game you navigate, the payoff of real 3D is low relative to its cost — the "Minecraft" appeal is almost certainly the **visual language** (blocky, chunky, toy-like, friendly) rather than literally wanting 3D navigation.

**Concretely, for option C/B**: redesign the character rig as square-headed, rectangular-bodied, thicker outlines, flatter color blocks (Minecraft's actual look is: big flat color faces, hard black outlines, no gradients/shading beyond simple light/dark faces per cube side). This is very achievable inside the existing `generate-pixel-art.py` pipeline — I'd redraw the base rig's pixel grid with square proportions instead of rounded ones, and could add a "top face is lighter, side face is darker" 2-tone block-shading trick that mimics a cube's lit top surface without needing real 3D.

### IP note (carries over from the original PRD)
"Minecraft-like" as a *style influence* (blocky proportions, chunky avatars) is fine and matches the project's "original art only" rule the same way "pixel-art RPG-like" was fine — you're not allowed to use actual Minecraft textures/skins/assets, but a blocky-avatar aesthetic as a genre isn't ownable. Worth stating explicitly since Mojang assets are trademarked/copyrighted and it'd be easy to accidentally cross from "inspired by" into "recognizably Minecraft's actual skin format."

---

## 2. A fuller, more "real" office environment

Today's floor is minimal: a checkerboard tile floor, wall trim, one desk
tile per employee, one review-table tile, one Nova-office tile. If you want
it to read as a real office rather than an abstract grid, the tileset needs
more variety and more *zones*, not just more polish on what exists:

- **Distinct rooms/zones** rather than one open floor: an engineering pod (Kael/Priya/Devraj/Arjun/Raghav's desks clustered), a design corner (Simran), a data nook (Meera/Tanya), an ops/infra corner (Farhan/Isha), Nova's office as an actual enclosed room (walls + door), and the review table as a proper meeting room with chairs around it.
- **Set dressing tiles**: plants, windows (with a subtle light-glow), a water cooler, a printer, bookshelves, a rug under the review table, ceiling light fixtures (drawn as floor-adjacent glow tiles since it's top-down). These are purely decorative — no data binding needed, just more tiles in `tileset.json`/`tools.ts`'s tile-drawing logic.
- **Department color-coding on the floor itself**: right now department is only encoded in the character's small badge icon. You could extend it to the floor tiles too — e.g. a subtly different floor tint per department zone — so the "engineering pod" reads as a zone even from a screenshot, not just from clicking each avatar.
- **Depth cues**: subtle drop-shadows under desks/furniture (already present in the tile art), and optionally a very light vignette/gradient across the whole floor so it doesn't read as a flat, infinite grid.

None of this requires new architecture — it's purely `generate-pixel-art.py` growing its tile catalog and `pixiScene.ts`'s tilemap-building logic placing more tile types in a more deliberate layout instead of a uniform checkerboard.

---

## 3. Color theme — recap and how it interacts with a blockier look

The existing system (documented fully in `UI_SPEC.md` §5.1) is a dark
HUD palette: void/panel/line for structure, cyan/violet/amber/magenta/green
as a **functional** status language (working/orchestrator/review-escalation/
blocked/done), and saffron/india-green as a restrained brand accent on the
logo only.

**The tension to resolve if you lean into "Minecraft-like":** Minecraft's
own palette is grass-green, dirt-brown, sky-blue, stone-gray — an outdoor,
natural palette. If you pulled that in literally, it would collide with
the existing status-color language (green already means "done," for
instance) and dilute the brand. **Recommendation: keep the existing
cyan/violet/amber/magenta/green functional palette exactly as-is — it's
already doing real semantic work — and let "Minecraft-like" express itself
through *shape and shading* (blocky, chunky, hard-outlined) rather than
through a *different color palette*.** This is the same principle already
applied once in this project (the saffron/india-green Bharat accent
deliberately stays off the status colors so meanings never collide) —
extending it to "don't let a new visual style collide with existing color
meaning" is consistent with that precedent.

---

## 4. Full feature inventory (current + proposed)

A clean list, split by what's real today vs. what you're asking to add:

### Built and working today
- Brief submission → Nova decomposes into a task graph → tasks dispatch to employees
- Office floor: all 11 agents visible, status-driven animation (idle/working/blocked/done), walk-to-review-table on task completion, envelope flights on inter-agent messages
- Team roster (right sidebar): live status + current task per agent, click to inspect
- Employee side panel: current task, live step-by-step activity log (was a raw terminal, now a synthesized tool-use log per the recent migration), message history
- Team Activity feed: live agent-to-agent mailbox, chat-log styled
- Approvals Dock: pending/resolved escalations, audit trail
- Memory Recall: full-text search over shared agent memory
- Multi-provider LLM backend (NVIDIA NIM/Groq/OpenRouter) with per-agent usage tracking at `GET /api/llm/usage` — **built, but has no frontend surface yet** (see §6 below)

### Proposed, not built
- Per-agent token/usage counters in the UI (§6)
- Per-agent lifetime work summaries (§7)
- "Manager rounds" — Nova periodically checking in on each employee (§8)
- Task dependency graph visualization (§9)
- Richer office environment (§2)
- Blockier/Minecraft-influenced avatar style (§1)
- Agent-level controls: pause, retry, reassign, kill (§5)

---

## 5. Agentic controls — what's missing and worth adding

Right now the human's only controls are: submit a brief, approve/deny an
escalation, search memory. There's no way to intervene on a *specific*
agent mid-task. Worth considering, roughly in order of how contained the
change is:

1. **Kill/stop a running task** — a button in the EmployeeSidePanel that calls a new `POST /api/agents/:id/stop`, which would call `agentRunner.kill(agentId)` (already exists internally, just not exposed over REST) and mark the task blocked. Small, safe, high-value — lets a human interrupt a runaway or clearly-wrong agent immediately instead of waiting for the 10-minute cap.
2. **Manual reassignment of a blocked task** — today a denied escalation leaves a task permanently blocked until a human/Nova reassigns it, but there's no UI for that at all (mentioned as a known v1 gap in the PRD). A small "reassign to..." dropdown on a blocked task in the roster/side panel would close that gap.
3. **Retry a task** — re-queue a `blocked` or `failed` task as `idle` without going through the escalation flow, for the "the model just had a bad run" case.
4. **Pause/resume the whole office** — a global toggle that stops Nova's dispatch loop from starting new tasks (existing in-flight tasks finish naturally). Useful before you want to inspect state without new work starting mid-inspection.

All four are additive REST endpoints + small UI affordances — none require touching the Hive schema or the core architecture.

---

## 6. Token counters — the natural next UI, since the backend already exists

The multi-provider migration (just shipped) added `GET /api/llm/usage`,
returning per-agent `{ provider, model, calls, approxTokens, lastCallAt }`.
This has zero frontend surface right now. Natural places to put it:

- **A compact badge in TeamRoster** next to each agent's status dot — a small `⚡ 1.2k` token count, updated on a light poll (usage doesn't need to be real-time/WebSocket-pushed; a 5-10s poll of `/api/llm/usage` is plenty).
- **A dedicated section in EmployeeSidePanel** — "Provider: nvidia · meta/llama-3.3-70b-instruct · 14 calls · ~3,200 tokens · last call 2m ago." This is genuinely useful for understanding *why* an agent might be slow (which provider it landed on after a fallback) as well as for the "token control" visibility you asked for originally.
- **An office-wide summary strip** — total tokens/calls across all 11 agents, maybe broken down by provider (a small 3-segment bar: NVIDIA/Groq/OpenRouter), giving an at-a-glance sense of load distribution — directly visualizes whether the "spread load across providers" goal is actually working.

---

## 7. Work summaries

Two different timescales worth distinguishing:

- **Per-task summary** — already exists: the `report` message an employee sends on `mark_task_done`, shown in the activity log/Team Activity feed. Nothing new needed here.
- **Lifetime/cumulative summary per agent** — doesn't exist yet. Would need a lightweight aggregation (tasks completed, tasks blocked/escalated, total tokens used, "employed since" if you track session start) either computed on-the-fly from existing Hive tables (`tasks`/`messages` filtered by `agent_id`) or maintained incrementally. Given the data already exists in SQLite, this is a read-only aggregation query, not a schema change — a good candidate for a new `GET /api/agents/:id/summary` endpoint feeding a "stats" tab in the EmployeeSidePanel.

---

## 8. "Manager rounds"

Interpreting this as: **Nova periodically visiting/checking each employee**,
rather than only reacting to messages/escalations. A few ways to realize it,
increasing in ambition:

1. **Cosmetic only**: Nova's avatar periodically "walks" to each employee's desk on a timer (independent of the real walk-to-review-table trigger, which stays task-driven) — purely a visual "she's doing rounds" cue, no new backend logic.
2. **Functional, lightweight**: Nova's poll loop (already runs every 4s) periodically checks for agents that have been `working` far longer than their task's typical duration and proactively logs a memory note or nudges — a real "management" behavior, not just cosmetic.
3. **Functional, fuller**: an explicit periodic "status round" where Nova calls the LLM router once per employee with a short prompt like "here's this employee's current task and recent activity — flag anything that looks stuck or concerning," writing findings to memory. This is genuinely new agentic behavior (not just UI), and would consume real LLM calls on a timer, so it should be rate-considered against the same multi-provider budget everything else shares.

Recommend starting with (1) for the visual/product feel, and only building (2)/(3) if you want Nova to actually behave more proactively, since those are new backend logic, not frontend.

---

## 9. Task dependency graph — a real, currently-missing visualization

This is probably the single most concretely valuable addition on this list.
Every `Task` already has a `depends_on: string[]` field (see
`shared/src/hive-types.ts`) — Nova builds a real DAG when decomposing a
brief — but **nothing in the UI shows the graph shape at all today**. The
office floor shows *where* agents are and *what status* their task is in,
but not *how tasks relate to each other* or *what's blocking what upstream*.

Proposed: a new view (could be a MemoryRecallPanel-style modal, or a tab
next to the office floor) rendering the task graph as an actual node/edge
diagram — nodes colored by status (the existing status palette), edges
showing `depends_on` relationships, laid out top-to-bottom or left-to-right
by dependency depth. This directly answers "what's the critical path right
now" and "why hasn't task X started yet" (because its dependency isn't
`done`) — genuinely useful, not just decorative. Implementation-wise this
is a good fit for a small dedicated graph-layout approach (e.g. a simple
DAG layout algorithm computing x/y from dependency depth, rendered as SVG
or a second lightweight Pixi/canvas layer) — doesn't need a heavy graph
library given the graph is small (typically 6-14 nodes per brief, per the
PRD's own sizing guidance).

---

## 10. Motion graphics & animation language

What exists today (from `UI_SPEC.md` §5.3): idle bob, pulse-dot for
working/blocked, walk-to-review-table tween, envelope flights. That's a
solid but minimal set. If you want the frontend to feel more like a "living"
modern product rather than a static dashboard with a few animated bits,
here's where motion could extend, organized by how much it costs:

**Cheap, high-value (CSS/Tailwind-level, no new libraries):**
- Micro-interactions on every interactive element: buttons/cards get a subtle scale/brightness shift on hover and an active-press feedback, not just a color change (currently most buttons only change border/background color on hover — adding a 1.02x scale + shadow lift makes the whole UI feel more responsive).
- Staggered entrance animations when the TeamRoster or ApprovalsDock populates (each row fading/sliding in with a slight delay per index) rather than popping in all at once.
- A token-counter "tick-up" animation (numbers counting up rather than jumping) whenever usage updates — small, but reads as "alive."
- Skeleton/shimmer loading states instead of blank space while the initial WebSocket snapshot is still arriving.

**Moderate (worth a small animation library like Framer Motion for React, since Tailwind alone gets clunky for orchestrated multi-element sequences):**
- The task-graph view (§9) animating nodes/edges appearing as Nova actually creates them in real time, rather than popping in fully-formed.
- A genuine "handoff" animation when a task moves from one agent to another (not just the existing envelope flight, but a visual package/baton actually traveling with a trail).
- Page-level transitions when opening the EmployeeSidePanel or MemoryRecallPanel — currently a straightforward slide/fade; could add a subtle blur-in on the backdrop and a slight spring/overshoot on the panel itself for a more "native app" feel.

**Bigger swings (only worth it if you want this to feel like a flagship product, not incremental polish):**
- Ambient background motion on the floor itself — subtle particle drift, a very slow parallax on the floor texture, animated light flicker on desk monitor-glow tiles — the kind of "always slightly alive" ambient detail that makes a dashboard feel premium rather than static.
- Sound design (optional, often skipped for tools like this, but a very quiet UI chime on task-done/escalation-raised is a common "modern SaaS" touch).

**On "motion-based web design and modern frontend architecture" generally**: the current stack (Next.js 14 App Router, Tailwind, a WebSocket-driven client state hook) is already a reasonably modern foundation. If you want to lean further into current frontend trends specifically: view-transitions API for route-level transitions (Next.js has some support), CSS `@starting-style`/`allow-discrete` for exit animations without a JS library, and container queries for the roster/side-panel to adapt more gracefully at different widths. None of these require a rebuild — they layer onto the existing components incrementally.

---

## 11. How this all fits together (suggested prioritization)

If you want a rough order of "what to actually build next" purely by
value-vs-effort, independent of the Minecraft-avatar question (which is
really its own decision, not a prerequisite for the rest):

1. **Token counters in the UI** (§6) — backend already exists, this is pure frontend, immediately useful.
2. **Task dependency graph** (§9) — genuinely missing capability, data already exists, moderate effort.
3. **Kill/retry agent controls** (§5, items 1 & 3) — small, high-value, closes a real gap.
4. **Richer office environment tiles** (§2) — pure art/content work inside the existing pipeline, no architecture change.
5. **Blockier avatar restyle** (§1, option C) — a `generate-pixel-art.py` redesign, contained to that one file.
6. Everything else (manager rounds, lifetime summaries, moderate/big motion work, isometric or 3D avatars) — bigger or more speculative, worth revisiting once 1-5 are in and you've seen how the office actually feels to use.

Let me know which of these you want to actually build, and I'll plan and implement it the same way as the previous phases.
