import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const POST = withAuth(async (_ctx, req) => {
  const { topicId } = await req.json();
  if (!topicId) return new Response(JSON.stringify({ ok: false, error: 'bad_request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  const { evaluateDiscussionOverview } = await import('@/lib/server/analysis');
  const res = await evaluateDiscussionOverview(String(topicId), 'event');
  return new Response(JSON.stringify({ ok: true, result: res }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
