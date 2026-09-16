import { NextResponse } from 'next/server';
import { auth } from '@bharat-ai-office/shared';

export async function GET() {
  return NextResponse.json({ authRequired: auth.isAuthEnabled() });
}
