import { NextResponse } from 'next/server';
import { nova, supabaseHive } from '@bharat-ai-office/shared';
import { requireAuth } from '@/lib/apiAuth';

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json((await supabaseHive.getBrief()) ?? null);
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
