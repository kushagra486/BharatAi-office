# Changelog

All notable changes to Bharat AI Office are recorded here, newest first.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

- Cancel/reset button for a stuck or unwanted active project
- Token usage breakdown by provider/model in the UI (not just a per-agent total)

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
