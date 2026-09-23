import { NextResponse } from 'next/server';
import { nova, supabaseHive } from '@bharat-ai-office/shared/server';
import { requireAuth } from '@/lib/apiAuth';
import { jsonNoStore } from '@/lib/noStoreJson';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  return jsonNoStore((await supabaseHive.getBrief()) ?? null);
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
  if (!brief) {
    return NextResponse.json({ error: 'brief is required' }, { status: 400 });
  }
  const tasks = await nova.decomposeBrief(brief);
  return NextResponse.json({ taskCount: tasks.length, tasks });
}

// Abandons the current project so the Brief Strip's composer reopens —
// the only way to recover from a project stuck with no escalation raised
// (or to simply start over) before this route existed.
export async function DELETE(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;

  await supabaseHive.clearProject();
  return jsonNoStore({ ok: true });
}
