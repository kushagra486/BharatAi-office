import { auth } from '@bharat-ai-office/shared/server';
import { jsonNoStore } from '@/lib/noStoreJson';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  return jsonNoStore({ authRequired: auth.isAuthEnabled() });
}
