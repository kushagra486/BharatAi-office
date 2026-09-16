import { NextResponse } from 'next/server';
import { auth } from '@bharat-ai-office/shared';

export async function POST(request: Request) {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (token) await auth.logout(token);
  return NextResponse.json({ ok: true });
}
