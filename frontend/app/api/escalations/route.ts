import { NextResponse } from 'next/server';
import { supabaseHive } from '@bharat-ai-office/shared/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json(await supabaseHive.listEscalations());
}
