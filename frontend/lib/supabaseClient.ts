import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Browser-side client, using the anon/publishable key — safe to expose:
// RLS on every table restricts it to read-only (see the
// initial_hive_schema migration's "public read" policies), and all writes
// still go through the Next.js API routes using the service_role key
// server-side. This replaces the old raw `ws` connection to the daemon —
// Supabase Realtime's postgres_changes does the same job (push updates as
// the database changes) without needing a WebSocket server of our own.
//
// Lazily constructed (not a top-level `createClient(...)` call): Next.js
// evaluates a 'use client' file's module scope during server-side
// prerendering too, and createClient throws immediately on an empty URL —
// which is what NEXT_PUBLIC_SUPABASE_URL resolves to during a build that
// has no env vars configured. Deferring construction to first actual use
// (always inside a useEffect, i.e. browser-only) sidesteps that.
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
  }
  return client;
}
