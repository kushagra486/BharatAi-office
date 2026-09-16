import { NextResponse } from 'next/server';
import { nova } from '@bharat-ai-office/shared';
import { requireAuth } from '@/lib/apiAuth';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'invalid escalation id' }, { status: 400 });
  }
  return NextResponse.json(await nova.applyHumanResolution(id, 'denied'));
}
