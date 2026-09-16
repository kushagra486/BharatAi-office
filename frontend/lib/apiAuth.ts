import { auth } from '@bharat-ai-office/shared';
import { NextResponse } from 'next/server';

// The old Fastify daemon had one global onRequest hook gating every route.
// Next.js Route Handlers don't have an equivalent without Edge Middleware —
// and Edge Middleware can't run this check anyway, since auth.ts uses
// node:crypto (timingSafeEqual/randomBytes), which isn't available in the
// Edge runtime. Route Handlers default to the Node.js runtime, so the gate
// lives here instead, called at the top of every protected route.
export async function requireAuth(request: Request): Promise<NextResponse | null> {
  if (!auth.isAuthEnabled()) return null;
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!(await auth.isValidToken(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
