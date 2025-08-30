import { evaluateTopicPills } from '@/lib/server/analysis';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const POST = withAuth(async (_ctx, req) => {
  const body = await req.json();
  const topicId = String(body?.topicId || '');
  if (!topicId) return new Response(JSON.stringify({ ok: false, error: 'missing_topic' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  const result = await evaluateTopicPills(topicId, 'event');
  return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
