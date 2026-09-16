// Server-only barrel: Postgres access, session auth (node:crypto), and the
// LLM router/rate-limiter, none of which can be bundled into a browser
// build. Import from '@bharat-ai-office/shared/server' in Next.js API
// routes and the daemon worker; the client-safe './index' barrel must
// never re-export any of this (see index.ts's comment) or a Next.js
// client component pulling in a single type from the package drags all of
// this — and node:crypto — into the browser bundle and fails the build.
export * as supabaseHive from './supabaseHive';
export * as auth from './auth';
export * as llmProviders from './llm/providers';
export * as llmAssignments from './llm/assignments';
export * as llmRateLimiter from './llm/rateLimiter';
export * as llmRouter from './llm/router';
export * as nova from './nova/nova';
