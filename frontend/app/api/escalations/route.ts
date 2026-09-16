import { NextResponse } from 'next/server';
import { supabaseHive } from '@bharat-ai-office/shared';
import { requireAuth } from '@/lib/apiAuth';

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json(await supabaseHive.listEscalations());
}
