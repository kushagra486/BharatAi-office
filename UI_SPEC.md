# Bharat AI Office — Complete UI Spec

This is the full frontend spec for **Bharat AI Office**: everything needed to design/rebuild the UI from scratch in another tool (e.g. Claude Design) and hand back a frontend that plugs into the existing, already-working backend.

**How to use this doc:** Design freely — restyle, re-layout, replace the pixel-art look with something else, whatever you want. The one hard constraint is the **data contract** in section 3: whatever you build needs to fetch/display these exact shapes and call these exact endpoints, because a real Node daemon (already built, already running) serves this data over REST + WebSocket. If you hand back a static HTML/CSS/JS mockup (interactivity stubbed with placeholder handlers/fake data) that's completely fine — I'll port it into the Next.js app and wire it to the real backend myself, the same way I already did for a couple of earlier UI passes in this project. You do not need to write data-fetching code.

---

## 1. What this product is

You give the office one project brief. **Nova** (an LLM orchestrator) breaks it into a task graph and assigns work to 10 specialist AI employees — each a real LLM-driven agent with its own tool-use loop (file read/write, shell commands) doing actual file edits and commits, not a simulation. Every agent's calls run through a multi-provider LLM router (NVIDIA NIM, Groq, OpenRouter), each assigned a distinct provider+model so concurrent agents don't clog one API. You watch it happen on a 2D office floor: agents' status animates as they work, they walk to a review table to hand off finished work, small message "envelopes" fly between agents for status updates, and an approvals dock surfaces only the decisions that need a human (spend, destructive ops, scope changes) — everything else Nova resolves itself.

**This is a dashboard for watching/directing autonomous AI agents, not a multiplayer virtual office.** There is no human-controlled avatar, no free navigation, no video calls, no chat between human coworkers. The only human-in-the-loop actions are: submit a brief, approve/deny an escalation, search memory, and click an agent to inspect it.

### Non-goals (do not design for these)
- No multi-user/multi-tenant anything — single local operator.
- No player-controlled avatar walking around the floor.
- No video/voice calls, no "invite" flow, no workspace switcher.
- No chat *between humans* — the only "chat"-like surface is the read-only feed of messages *between AI agents* (see Team Activity, section 6.7).

---

## 2. Tech context (informational — doesn't constrain your design)

Existing stack: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, a Node/Fastify daemon with SQLite + WebSocket, PixiJS for the current office-floor canvas. You don't need to match this stack to design in Claude Design — just match the data contract below when it's time to integrate.

---

## 3. Data contract (exact shapes — this is what the backend actually sends)

### 3.1 Core types

```ts
type TaskStatus = 'idle' | 'working' | 'blocked' | 'done';
type MessageType = 'task' | 'handoff' | 'escalation' | 'report';
type EscalationResolution = 'pending' | 'approved' | 'denied';

interface Agent {
  id: string;            // 'nova' | 'kael' | 'priya' | ... (see roster, section 4)
  name: string;           // 'Nova', 'Kael', ...
  role: string;            // 'Orchestrator', 'Solutions Architect', ...
  dept: string;            // 'orchestrator' | 'eng' | 'design' | 'data' | 'ops'
  color: string;           // '--cyan' | '--violet' | '--amber' | '--magenta' | '--green'
  shape: 'hex' | 'diamond' | 'circle' | 'rounded-sq' | 'octagon';
  home_x: number;          // 0-100, percentage position on the floor
  home_y: number;          // 0-100
}

interface Task {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  depends_on: string[];    // other task ids
  created_at: string;      // ISO timestamp
  updated_at: string;
}

interface HiveMessage {
  id: number;
  from_agent: string;      // agent id, or 'nova'
  to_agent: string;
  type: MessageType;
  body: string;
  created_at: string;
}

interface Escalation {
  id: number;
  agent_id: string;
  description: string;
  resolution: EscalationResolution;
  created_at: string;
  resolved_at: string | null;
}

interface MemoryEntry {
  id: number;
  agent_id: string;
  tag: string;
  content: string;
  created_at: string;
}

interface BriefRecord {
  brief: string;
  etaMinutes: number | null;
  status: string;          // 'planning' | 'in_progress' | 'complete'
}
```

### 3.2 REST API (base URL from `NEXT_PUBLIC_DAEMON_HTTP_URL`, default `http://localhost:4317`)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok: true }` |
| GET | `/api/agents` | — | `Agent[]` (always 11: Nova + 10 employees) |
| GET | `/api/tasks` | — | `Task[]` |
| GET | `/api/messages` | — | `HiveMessage[]` (latest 200) |
| GET | `/api/brief` | — | `BriefRecord \| null` |
| POST | `/api/brief` | `{ brief: string }` | `{ taskCount: number, tasks: Task[] }` — kicks off Nova's decomposition |
| GET | `/api/escalations` | — | `Escalation[]` |
| POST | `/api/escalations/:id/approve` | — | updated `Escalation` |
| POST | `/api/escalations/:id/deny` | — | updated `Escalation` |
| GET | `/api/memory/search?q=...` | — | `MemoryEntry[]` (empty `q` returns recent entries) |

Errors return `{ error: string }` with a non-2xx status.

### 3.3 WebSocket (`NEXT_PUBLIC_DAEMON_WS_URL`, default `ws://localhost:4317/ws`)

One socket, JSON text frames, each shaped `{ type: string, payload: ... }`:

| `type` | `payload` | When |
|---|---|---|
| `snapshot` | `{ agents: Agent[], tasks: Task[], messages: HiveMessage[], escalations: Escalation[], brief: BriefRecord \| null }` | Sent once immediately on connect — full state |
| `task:update` | `Task` | A task's status changed |
| `message:new` | `HiveMessage` | A new agent-to-agent message |
| `escalation:new` | `Escalation` | A new pending escalation |
| `escalation:resolved` | `Escalation` | An escalation was approved/denied |
| `memory:new` | `MemoryEntry` | An agent wrote to shared memory |
| `brief:update` | `BriefRecord` | Brief status changed (planning → in_progress → complete) |
| `agent:output` | `{ agentId: string, taskId: string, chunk: string }` | A step-log chunk from an employee's tool-use loop (model reasoning, then each tool call + result) — append to a per-agent text buffer |
| `agent:exit` | `{ agentId: string, taskId: string, exitCode: number }` | That agent's loop finished (the corresponding `task:update` already reflects the outcome — no UI action needed beyond that) |

Reconnect behavior: on close, retry after ~2s; mark UI as "disconnected" in the meantime (see HudBar, section 6.1).

---

## 4. The agent roster (fixed — 11 seats, never changes at runtime)

| Agent | Role | Dept | Shape | Color token | Position (x%, y%) |
|---|---|---|---|---|---|
| Nova | Orchestrator | orchestrator | octagon | `--violet` | 50, 12 |
| Kael | Solutions Architect | eng | hex | `--cyan` | 14, 30 |
| Priya | Backend Developer | eng | hex | `--violet` | 30, 30 |
| Devraj | Frontend Developer | eng | hex | `--green` | 46, 30 |
| Simran | UI/UX Designer | design | diamond | `--amber` | 62, 30 |
| Arjun | QA Engineer | eng | hex | `--magenta` | 78, 30 |
| Meera | Data/Analytics | data | circle | `--cyan` | 14, 62 |
| Raghav | Security Reviewer | eng | hex | `--violet` | 30, 62 |
| Tanya | Technical Writer | data | circle | `--green` | 46, 62 |
| Farhan | DevOps Engineer | ops | rounded-sq | `--amber` | 62, 62 |
| Isha | Project Coordinator | ops | rounded-sq | `--magenta` | 78, 62 |

**Review Table** (where agents "hand off" finished work) sits at position **(50, 46)**.

Shape encodes department (hex=eng, diamond=design, circle=data, rounded-square=ops, octagon=orchestrator); color is per-agent identity. Keep this legend somewhere discoverable if you keep the floor-map visualization — it's how a user reads the floor at a glance.

---

## 5. Design tokens

### 5.1 Colors (hex)

| Token | Value | Meaning |
|---|---|---|
| `void` | `#06090D` | Base page background |
| `panel` | `#0E141C` | Card/panel background |
| `line` | `#1D2836` | Borders, grid lines |
| `cyan` | `#2FE6D2` | Status: working; primary accent |
| `violet` | `#8B7CF6` | Orchestrator; message type: task |
| `amber` | `#FFB454` | Approvals/escalations; review table; message type: handoff |
| `magenta` | `#FF4D6D` | Status: blocked; message type: escalation |
| `green` | `#4ADE80` | Status: done; message type: report |
| `saffron` | `#FF9933` | Bharat brand accent — **HUD/logo chrome only**, never status |
| `india-green` | `#138808` | Bharat brand accent — **HUD/logo chrome only**, never status |
| idle gray | `#6B7686` | Status: idle; secondary/muted text throughout |

Status color map: `working → cyan (pulsing)`, `idle → gray`, `blocked → magenta (pulsing)`, `done → green`.
Message-type color map: `task → violet`, `handoff → amber`, `escalation → magenta`, `report → green`.

**The saffron/india-green pair is intentionally restrained** — 2-3 small dots or accents on the brand mark only, so it never collides with the functional status palette (cyan/violet/amber/magenta/green mean specific things everywhere else in the UI).

### 5.2 Typography

- **Monospace everywhere** (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) — this is an instrument-panel/HUD aesthetic, not a marketing page. All labels, data, status text, timestamps use mono.
- Sans-serif fallback stack exists (`ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`) but is barely used — mono carries almost everything.
- Sizing skews small: most UI text is 10-12px, uppercase with wide letter-spacing for labels (e.g. `text-[10px] uppercase tracking-wider`).

### 5.3 Motion

- **Idle bob**: subtle 3px vertical oscillation, ~2.4s ease-in-out loop, on agent avatars at rest.
- **Pulse dot**: opacity 1→0.55 + scale 1→1.25, ~1.6s ease-in-out loop, on `working`/`blocked` status dots only (not idle/done).
- **Walk transition**: an agent's avatar animates from its home desk to the review table and back over ~3.2s total (out ~1.4s, brief dwell, back ~1.4s), triggered by a real task status transition to `done` — **never a timer**.
- **Envelope flight**: a small colored dot flies in a straight line from one agent's position to another's over ~1.6s, fading in/out at the ends, triggered by `message:new`, colored by message type.

---

## 6. Screen layout & components

Overall structure, top to bottom:

```
┌─────────────────────────────────────────────────────────────┐
│ HudBar (sticky top)                                           │
├─────────────────────────────────────────────────────────────┤
│ BriefStrip                                                     │
├───────────────────────────────────────────────┬───────────────┤
│                                                  │               │
│  Office Floor (canvas/map)                      │  TeamRoster   │
│                                                  │  (right rail) │
│                                                  │               │
├───────────────────────────────────────────────┴───────────────┤
│ TeamActivity (bottom drawer, fixed height, scrolling feed)      │
├─────────────────────────────────────────────────────────────┤
│ ApprovalsDock (sticky bottom, horizontal scroll of cards)       │
└─────────────────────────────────────────────────────────────┘

Overlays: MemoryRecallPanel (modal), EmployeeSidePanel (right slide-over, covers TeamRoster when open)
```

Responsive note: TeamRoster can hide below a medium breakpoint (it's a nice-to-have side panel, not core), everything else should stay usable down to a laptop-width viewport. This is a desktop-first internal tool, not a mobile app — no need to design a phone layout.

### 6.1 HudBar (sticky header)

**Purpose:** brand + global status + global actions.

**Contents, left to right:**
- Brand mark: small 3-dot tricolor (saffron / white / india-green) + wordmark "BHARAT AI OFFICE", uppercase, mono, letter-spaced.
- A live clock (HH:MM) and date pill, ticking every second, client-side only.
- (right side) A session id label (e.g. `OFFICE-001`) with a small connection dot — green when the WebSocket is connected, magenta/red when not.
- "⌕ Recall" button → opens MemoryRecallPanel.
- "⚑ Approvals" button → jumps to the ApprovalsDock; shows a small badge with the pending-escalation count when > 0.

**Data needed:** `connected: boolean`, `pendingApprovals: number`, a session id string.

### 6.2 BriefStrip (below header)

**Purpose:** the primary way the human "talks to Nova," and shows the current project's status.

**Two states:**
1. **No brief active, or last one shipped** — a single-line text input ("Give the office a brief…") + a "Send to Nova" button. `POST /api/brief`. Show a loading state while sending, an inline error if it fails. If the *previous* brief just shipped, show a small "✓ Shipped —" prefix before the composer reappears.
2. **Brief active** (`planning` / `in_progress`) — a compact status pill (`Nova is planning…` / `In progress`) + the brief text (truncated) + an ETA in minutes if known. No input in this state.

**Data needed:** `brief: BriefRecord | null`, and a submit handler.

### 6.3 Office Floor (center, the visual centerpiece)

**Purpose:** at-a-glance view of what all 11 agents are doing right now.

**Current implementation:** a pixel-art 2D scene (PixiJS canvas) — a tilemap floor with desk tiles at each agent's `(home_x%, home_y%)` position, a review-table tile at (50%, 46%), wall trim around the edges, dashed "wire" lines from each desk to the review table. Each agent renders as a small sprite, tinted to their color, with:
- A department badge (small shape icon matching the roster's `shape` field) near the sprite.
- A status dot (color from the status map, pulsing for working/blocked).
- Idle-bob animation at rest; a walking animation toward the review table and back when their task completes.
- Click → selects that agent (opens EmployeeSidePanel).

**You are free to redesign this visually** (different art style, isometric, simpler flat shapes, whatever) as long as it preserves the *functional* requirements:
- All 11 agents visible simultaneously, positioned by their `home_x`/`home_y` percentages (or your own equivalent layout).
- A clear visual distinction between: idle / working / blocked / done (color + a pulsing cue for the two "active" states is enough).
- A clear "review table" landmark.
- Two distinct handoff signals that must stay visually distinct because they mean different things: **an agent physically moving to the review table** (real work handed off) vs. **a small flying token/particle between two agents** (a status message, no physical handoff). Don't conflate these into one animation.
- Clicking an agent selects it.
- Shape-encodes-department / color-encodes-agent-identity (or your own legend) should stay legible.

**IP note:** if you keep a pixel-art direction, all art must be original — no traced references, no stock/licensed sprite packs. (There's already a from-scratch pixel-art generator and asset set in the current build — see appendix, section 8 — you can reuse, restyle, or ignore it.)

**Data needed:** `agents: Agent[]`, `tasks: Task[]` (to derive each agent's current status — see 6.3.1), `messages: HiveMessage[]` (to trigger envelope flights on new ones), and an `onSelectAgent(agentId)` callback.

**6.3.1 Deriving an agent's status from tasks:**
```
blocked  if any of the agent's tasks has status 'blocked'
working  else if any has status 'working'
done     else if the agent has ≥1 task and all are 'done'
idle     otherwise (including Nova, who is always shown idle — she never has tasks assigned to her directly)
```

### 6.4 TeamRoster (right sidebar)

**Purpose:** a scannable directory of all 11 agents as an alternative to hunting for them on the floor.

**Contents:** header "TEAM (11)" + a live "N working" indicator when > 0. Below, one row per agent: status dot, name (bold), status label (IDLE/WORKING/BLOCKED/DONE), role or current task title as a secondary line. Clicking a row calls the same `onSelectAgent` as clicking the agent on the floor. Highlight the currently-selected agent's row.

**Data needed:** `agents: Agent[]`, `tasks: Task[]`, `selectedAgentId: string | null`, `onSelectAgent(agentId)`.

### 6.5 EmployeeSidePanel (right slide-over, overlays TeamRoster when open)

**Purpose:** deep-dive on one agent, opened by clicking them (on the floor or in the roster).

**Contents, top to bottom:**
- Header: agent name + role, close button.
- "Current task" block: the task they're actively working (or most recent one), title + description, or "Idle — no task assigned."
- "Live terminal" block: a scrolling monospace `<pre>`-style panel showing that agent's tool-use loop as it runs, appended incrementally as `agent:output` chunks arrive (reasoning text, then each tool call + result — a step-by-step log, not literal token streaming). Show "(no output yet)" when empty.
- "Activity log" block: the last ~30 messages involving this agent (either `from_agent` or `to_agent` matches), each showing time, `from→to`, and body text.

**Data needed:** `agent: Agent | null` (null = closed), `tasks: Task[]`, `messages: HiveMessage[]`, `terminalBuffer: string` (that agent's accumulated pty output), `onClose()`.

### 6.6 ApprovalsDock (sticky bottom bar)

**Purpose:** the only place the human is asked to make a decision — Nova has already filtered everything else out.

**Contents:** a horizontally-scrolling row of cards. Left: "⚑ Approvals" label + pending count. Then:
- **Pending cards**: agent id, the escalation description, Approve/Deny buttons (green/magenta). Calls `POST /api/escalations/:id/approve` or `/deny`.
- **Resolved cards** (last ~8): faded (50% opacity), show agent id + resolution (approved/denied) + description, no buttons. **These stay visible rather than disappearing — it's an audit trail, not a queue.**
- Empty state: "Nothing needs you right now."

**Data needed:** `escalations: Escalation[]`, `onApprove(id)`, `onDeny(id)`.

### 6.7 TeamActivity (bottom drawer, above ApprovalsDock)

**Purpose:** a live, read-only feed of the actual agent-to-agent mailbox — the closest thing to a "chat log" in this product, but nobody types into it as a human; it's a transcript of real AI-to-AI communication.

**Contents:** fixed-height (~160px) scrolling list, "TEAM ACTIVITY · live mailbox" header. Each row: a small dot colored by message type, `from_agent → to_agent`, message body. New messages append at the bottom; auto-scroll to newest. Empty state: "No activity yet — nothing sent between agents."

**Data needed:** `messages: HiveMessage[]`.

### 6.8 MemoryRecallPanel (modal, opened from HudBar)

**Purpose:** full-text search over everything agents have written to shared memory.

**Contents:** centered modal, backdrop click-to-close. Single search input, autofocused, placeholder "⌕ Recall memory…". Below: a scrolling result list — while the query is empty, show the live/recent memory feed; once typing, debounce ~250ms then call `GET /api/memory/search?q=...` and show those results (with a brief "Searching…" state). Each result: agent id + tag (small caps, violet) + content text. Empty state: "No matches."

**Data needed:** `open: boolean`, `onClose()`, `memories: MemoryEntry[]` (live feed for the empty-query state).

---

## 7. Interaction summary (state machine view)

| User action | Effect |
|---|---|
| Type + submit a brief | `POST /api/brief` → Nova decomposes it into tasks (async; brief status flips to `in_progress`, tasks start appearing/updating over the socket) |
| Click an agent (floor or roster) | Opens EmployeeSidePanel for that agent |
| Click the panel's ✕ / click outside a modal | Closes it |
| Click "⌕ Recall" | Opens MemoryRecallPanel |
| Click "⚑ Approvals" | Scrolls/focuses the ApprovalsDock |
| Click Approve/Deny on a pending card | `POST /api/escalations/:id/approve\|deny` → card moves to resolved (faded), the human never has to refresh — it comes back over the socket |
| (system) A task flips to `done` | That agent's avatar walks to the review table and back |
| (system) A new message is sent between agents | A colored dot flies between their two positions; if it involves the currently-open EmployeeSidePanel's agent, it also appears in that panel's activity log |
| (system) An escalation is raised | New card appears (pending) in ApprovalsDock, badge count increments on the HUD |

---

## 8. Appendix: current pixel-art asset spec (only relevant if you keep/extend that direction)

If you want to reuse or build on the existing pixel-art system rather than starting fresh:

- Character sprite sheet: one base rig, 24 frames — `idle_{down,up,left,right}_{0,1}` (2-frame bob loop × 4 directions) and `walk_{down,up,left,right}_{0,1,2,3}` (4-frame cycle × 4 directions), 32×32px per frame. Drawn in **grayscale** (near-black outline/eyes, mid-gray shadow, light-gray base, white highlight) so a runtime color-multiply ("tint") reproduces each agent's exact color with real shading — the same sheet serves all 11 agents.
- Tileset: 6 tiles, 32×32px each — `floor_a`, `floor_b`, `wall_edge`, `desk`, `review_table`, `nova_office`. These are **not** tinted, so they're drawn directly in the real brand colors.
- Both exist today as generated PNG + JSON atlas pairs, produced by a small from-scratch Python script (no external art, no stock assets, no traced references) — happy to share exact files/generator if useful, or you can ignore this entirely and design your own visual language for the floor.

---

## 9. What to hand back

Whatever format is easiest for you — a single HTML/CSS/JS file (like a Claude Design export), a set of React components, or just high-fidelity screens/specs if you'd rather I do the implementation. The only thing that actually matters for integration is that the **shapes of data and actions in section 3 and 6 are all accounted for somewhere** in what you hand back — I'll wire it to the real daemon (already built and running) on my end.
