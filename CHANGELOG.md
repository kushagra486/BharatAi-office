# Changelog

All notable changes to Bharat AI Office are recorded here, newest first.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

- Full visual/UX redesign across every page (Office, Dashboard, Status,
  Login) — a "Claude/Gemini/ChatGPT hybrid" pass, keeping every existing
  panel, hook, and data flow untouched and changing presentation only.
  Added layered surface tokens (`surface`/`surface-2`), promoted text
  tokens (`ink`/`ink-muted`/`ink-faint`), and an `elevated`/`glow-violet`
  shadow scale to `tailwind.config.ts`; self-hosted Inter (`next/font/google`)
  as the primary sans typeface, with mono now reserved for genuinely
  technical readouts (timestamps, token counts, model/provider tags, the
  live terminal feed) instead of every label and button. New shared
  primitives in `frontend/components/ui/` (`Button`, `Card`, `Badge`)
  replace duplicated ad-hoc className strings with consistent hover/focus/
  disabled states and 44px-minimum touch targets. Accessibility fixes
  bundled into the same pass: `aria-label`s on every icon-only button,
  visible `focus-visible` rings on inputs and controls, and a
  `prefers-reduced-motion` guard in `globals.css` that nothing previously
  respected. The brief composer now reads as a chat-style pill input with
  an inline send button. Out of scope: the Three.js office scene itself
  (`components/office-3d/**`), which already had its own dedicated visual
  pass.
- Speed/brevity pass: capped every LLM call at 4096 output tokens (generous
  enough not to truncate a real file-write tool call, tight enough to bound
  a reasoning model rambling for thousands of tokens before it ever acts —
  that's what actually costs wall-clock time per turn) and added explicit
  concision guidance to every agent's system prompt (one-sentence Thoughts,
  1-2 sentence completion summaries — the code is the deliverable, not
  narration about it). Also reordered the "code" tier pool fastest-first
  (Groq's hardware, then each provider's own speed-optimized "flash"
  variant, then the larger/shared-infra models last) — this is the actual
  tie-break order in effect today, since every candidate still shares the
  same cold-start latency default until real samples accumulate.
- Fixed a real gap in token accounting: `llm_usage` is keyed by agent alone,
  so switching an agent's model (routine now under dynamic routing)
  silently relabeled that agent's entire historical token count onto
  whichever model became current — it could never actually answer "how
  many tokens has model X used." Added `llm_usage_by_model`, keyed by
  (agent, provider, model), so every model keeps its own real running
  total; `record_llm_usage` now updates both tables atomically. New
  dashboard panel shows the breakdown per model, not just per provider.

- Added Gemini and Hugging Face as 4th/5th LLM providers (via Google's
  OpenAI-compatibility shim and Hugging Face's Inference Providers router
  respectively — not the `transformers` Python library, which runs models
  locally and doesn't fit this project at all). Both went through the same
  live tool-calling verification bar as every other model here before being
  added to the "code" tier pool: `gemini-flash-latest` and
  `deepseek-ai/DeepSeek-V3.1` both make real tool calls, not fabricated
  ones. Also added `poolside/laguna-s-2.1:free` (OpenRouter, already
  configured) to the "light" tier after the same check.
  `nvidia/nemotron-3-ultra-550b-a55b:free` and `qwen/qwen3-coder:free` were
  tested too and rejected — the former fabricates tool calls, the latter
  no longer exists under the tested account.
  Rate limits for both new providers are conservative placeholders, not
  verified published numbers — Google no longer publishes a fixed
  free-tier figure (it's account-specific, AI Studio dashboard only), and
  Hugging Face's router is credit-limited rather than request-limited.
  Skipped Mistral's `codestral-latest` despite it also passing verification
  — it isn't a free-tier model and would likely bill the account; every
  other model in this system runs on a real free tier.

- Surfaced a real bug found while verifying the dynamic routing above: model
  latency isn't being recorded from the live worker despite the DB-side
  function and every read/write path checking out fine when tested directly
  over HTTP — root cause still unconfirmed (no Railway log access to pin it
  down further). It was silently swallowed before; now a failure shows up
  as an amber-highlighted warning line in the Automation panel's live feed
  instead, so it's visible without needing worker logs at all.

- Complexity-aware dynamic model routing: 7 of 11 employees (the heavier
  "code" tier) and 3 (the lighter "light" tier) now resolve their model
  once per task from a shared pool spanning all 3 configured providers,
  ranked by live rate-limit headroom and observed latency
  (`model_latency_stats`, a simple exponential moving average recorded
  after every real call) — instead of a single model fixed at deploy time.
  Picked once per task (not per turn) to keep one task's tool-calling
  behavior consistent across all its turns; falls back to the static
  assignment for any read failure or for Nova (kept on its fixed
  assignment deliberately — single-shot JSON calls, not a multi-turn loop,
  don't benefit from per-task pinning the same way). Only the
  already-verified 8 models are in a pool today — Gemini/SambaNova/
  Qwen3-Coder are real candidates once a key exists and each passes the
  same live tool-calling verification, not before.

- Automation panel: a live cross-agent activity feed (every agent's tool
  calls in one chronological stream, not just whichever one is currently
  selected in the side panel — reuses the same Realtime broadcast channel
  that already fed that side panel) plus a diff preview per completed task.
  Diffs are captured from the actual git commit (`git diff-tree -p`) and
  stored in a separate "project-diffs" Storage bucket, keyed by task id —
  kept separate from the Files tab's bucket since a diff isn't a
  deliverable and would otherwise masquerade as a fake agent folder in that
  listing. "Abandon project" now clears this bucket too.

- Cancel/reset button for a stuck or unwanted active project
- Token usage breakdown by provider/model in the UI (not just a per-agent total)
- Files tab: every file an agent commits is now mirrored into Supabase
  Storage (upload-on-commit, keyed by "{agentId}/relative/path") and shown
  in a new dashboard panel with per-file download via a short-lived signed
  URL. This was the top item on the roadmap — actual deliverables were
  previously only reachable by SSHing into the worker's filesystem.
- Fixed the workdir-reset gap noted above: the worker now detects a new
  project (the `brief` row's `created_at` changes — it's a singleton row
  deleted and re-created fresh per project) on its next dispatch poll and
  wipes its local git workdir before starting on it, so a second project's
  agents never inherit the first one's files. Deferred if an agent is still
  actively running (narrow race guard, shouldn't normally trigger). No new
  channel to the worker was needed — it already polls the `tasks` table
  every few seconds, so this just piggybacks on that same poll.
- Tokens-per-minute (TPM) rate limiting, not just requests-per-minute/day —
  Groq's real per-model TPM budget (8,000) is far tighter than its RPM limit
  and could 429 well before request-count limits ever would. Pre-call token
  estimate + post-call reconciliation against real usage, checked atomically
  alongside the existing RPM/RPD budgets in one Postgres function
  (`acquire_rate_limit_full`) so a partial pass/fail can't double-spend budget
  on retry
- Rebalanced agent→LLM model assignments: NVIDIA had 5 of 11 primary slots
  (only 3 verified models), including two agents with a completely identical
  primary+fallback chain. Redistributed to 3/4/4 across Groq/NVIDIA/OpenRouter
  and made sure every pair still forced to share a primary has a fully
  disjoint fallback chain, so a rate limit on one agent doesn't also strand
  its collision partner
- Fixed a real crash risk: the worker had no way to notice a task's row was
  deleted out from under it (e.g. by the "Abandon project" button while that
  task was actively running) — it would try to update a row that no longer
  existed and throw an unhandled rejection, which could take the whole
  worker process down with every other agent's in-flight work. AgentRunner
  now checks the task is still live once per turn and stops cleanly if not,
  and the final status/message writes are no longer allowed to crash the
  process if that race still slips through

## v1.1.0 — 2026-09-22

- Rewrote `README.md`: live Vercel/Netlify demo links, real screenshots from
  the live deployment, Mermaid architecture + task-lifecycle diagrams, agent
  roster table, corrected setup/deploy instructions
- Fixed the Vercel project's `vercel.json` location to match its configured
  Root Directory (was being silently ignored, causing empty-env-var build
  failures)
- Merged the long-open PR #1 into `main`, consolidating everything below

## v1.0.0 — 2026-09-16 to 2026-09-17 — Serverless migration

The big architectural shift: off a single local SQLite daemon + raw
WebSocket server, onto Supabase (Postgres + Realtime) with the frontend
split into serverless API routes and one small persistent worker for the
real file/git work.

- Migrated the backend to Supabase Postgres + Realtime, replacing local
  SQLite and the hand-rolled WebSocket bridge
- Split `/shared` into client-safe and server-only entry points so the
  Next.js client bundle never pulls in `node:crypto` or Postgres clients
- Converted the Fastify daemon's HTTP surface into Next.js API routes
- Deployed the frontend to Netlify, then migrated hosting to **Vercel**
  (primary) with Netlify kept as a mirror, after diagnosing Netlify's
  build-minute usage
- Deployed the persistent worker (real file edits + git commits) to
  **Railway** via Docker; bumped the image to Node 22 after finding
  `@supabase/supabase-js` crashes on Node 20's missing native `WebSocket`
- Converted Nova's periodic reasoning (escalation triage + QA pass) into
  a scheduled `/api/cron/nova-tick` endpoint, pinged by a GitHub Actions
  5-minute schedule since Vercel's free-tier cron is daily-only
- Replaced every stale/retired LLM model slug across Groq, NVIDIA NIM, and
  OpenRouter with live-verified ones (JSON mode + tool-calling both
  confirmed per model before shipping)
- Fixed a real rate-limiter bucketing bug and added an OpenRouter daily cap
- Fixed a sandboxing escape in `run_command` and closed a symlink bypass
- Added a hard cap on concurrent active employee sessions
- Added an optional single-password login screen
- Added the Dashboard and Job Suggestions/Status pages
- Surfaced live per-agent LLM provider/model everywhere token counts show
- Fixed Netlify's CDN edge-caching a stale empty response on data routes
- Fixed mobile nav and a hidden team roster panel

## v0.3.0 — 2026-09-16 — 3D office rebuild

- Rebuilt the office floor as a real-time Three.js 3D scene using the
  team's actual character models, with an orthographic camera to keep the
  flat, readable look
- Added an extensible 3D prop library (desk, chairs, printer, scanner,
  locker, wall light, review table, plants) — new items need one `.glb`
  plus a manifest entry, no code branching
- Agents now physically walk to a colleague's or manager's desk when they
  communicate, instead of an abstract flying-dot effect
- Added a minimal Electron desktop wrapper (`npm run electron`)
- Fixed a mobile layout bug where hidden-sidebar containers still
  force-filled the viewport height
- Removed the now-unused 2D PixiJS office floor and the `pixi.js` dependency

## v0.2.0 — 2026-09-15 to 2026-09-16 — Multi-provider agents + pixel office

- Replaced Claude Code CLI-spawned employees with a custom multi-provider
  LLM agent loop (NVIDIA NIM, Groq, OpenRouter) — the architecture this
  project has run on ever since
- Built the live token counters UI
- Built the pixel-art office floor (PixiJS) with department zones and
  set-dressing, later superseded by the 3D rebuild above

## v0.1.0 — 2026-08-18 to 2026-08-19 — Original PRD phases

- Phase 1: Hive SQLite layer
- Phase 2: PtyManager + single-committer git module
- Phase 3: Nova orchestrator on Groq
- Phase 4: Realtime WebSocket bridge + daemon bootstrap
- Phase 5: Frontend office floor UI
- Phase 6: Approvals Dock and Memory Recall wired to the daemon
- Migrated the office floor to a PixiJS pixel-art scene with real
  hand-authored assets
