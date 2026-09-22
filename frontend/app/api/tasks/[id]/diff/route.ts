import { supabaseHive } from '@bharat-ai-office/shared/server';
import { requireAuth } from '@/lib/apiAuth';
import { jsonNoStore } from '@/lib/noStoreJson';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// url is undefined when the task never committed a diff (still running,
// failed before committing, or predates this feature) — that's an expected
// state, not a 404, since the panel just hides the "view diff" action then.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;

  const url = await supabaseHive.getTaskDiffUrl(params.id);
  return jsonNoStore({ url: url ?? null });
}
