import { NextResponse } from 'next/server';
import { auth } from '@bharat-ai-office/shared/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = await auth.login(typeof body.password === 'string' ? body.password : '');
  if (!token) {
    return NextResponse.json({ error: 'invalid password' }, { status: 401 });
  }
  return NextResponse.json({ token });
}
