import { NextResponse } from 'next/server';
import { supabaseHive } from '@bharat-ai-office/shared/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json(await supabaseHive.searchMemory(q));
}
