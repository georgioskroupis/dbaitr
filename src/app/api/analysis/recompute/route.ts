import { NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebaseAdmin';
import { evaluateTopicPills } from '@/lib/server/analysis';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!auth || !token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const isMod = (decoded as any)?.role === 'admin' || (decoded as any)?.role === 'moderator' || (decoded as any)?.isAdmin || (decoded as any)?.isModerator;
    if (!isMod) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const body = await req.json();
    const topicId = String(body?.topicId || '');
    if (!topicId) return NextResponse.json({ ok: false, error: 'missing_topic' }, { status: 400 });
    const result = await evaluateTopicPills(topicId, 'event');
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

