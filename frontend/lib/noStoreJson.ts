import { NextResponse } from 'next/server';

// `export const dynamic = 'force-dynamic'` alone wasn't enough — Netlify's
// own edge/CDN cache ("Netlify Durable") was still serving a stale response
// (observed: the very first, pre-data GET to /api/tasks got cached and kept
// being replayed after real rows existed, confirmed by comparing the same
// query run directly against Supabase). `Cache-Control: no-store` on the
// response itself is the layer that actually stops that.
export function jsonNoStore<T>(data: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
