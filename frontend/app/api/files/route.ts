import { supabaseHive } from '@bharat-ai-office/shared/server';
import { requireAuth } from '@/lib/apiAuth';
import { jsonNoStore } from '@/lib/noStoreJson';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;

  const files = await supabaseHive.listProjectFiles();
  return jsonNoStore(files);
}
