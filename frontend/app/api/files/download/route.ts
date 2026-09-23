import { NextResponse } from 'next/server';
import { supabaseHive } from '@bharat-ai-office/shared/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Returns the signed URL as JSON rather than redirecting to it — auth here
// is a Bearer header (see lib/apiAuth.ts), which a plain browser navigation
// (an <a href>, a 302 Location) can't carry, so this has to be an
// authenticated fetch from the client, which then navigates to the signed
// URL itself (that URL's signature *is* its auth, no header needed).
export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;

  const path = new URL(request.url).searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'path query param is required' }, { status: 400 });
  }

  const url = await supabaseHive.getProjectFileDownloadUrl(path);
  return NextResponse.json({ url });
}
