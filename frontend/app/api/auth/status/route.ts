import { NextResponse } from 'next/server';
import { auth } from '@bharat-ai-office/shared/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ authRequired: auth.isAuthEnabled() });
}
