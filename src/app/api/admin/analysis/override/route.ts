import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const isMod = (decoded as any)?.role === 'admin' || (decoded as any)?.role === 'moderator' || (decoded as any)?.isAdmin || (decoded as any)?.isModerator;
    if (!isMod) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const body = await req.json();
    const topicId = String(body?.topicId || '');
    const category = String(body?.category || ''); // tone|style|outcome|substance|engagement|argumentation
    const value = String(body?.value || '');
    const note = body?.note ? String(body.note) : undefined;
    if (!topicId || !category || !value) return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 });

    const ref = db.collection('topics').doc(topicId);
    const field = `analysis.categories.${category}`;
    await ref.set({
      analysis: { categories: { [category]: { value, confidence: 1, trend24h: 0, override: true, note, updatedAt: new Date().toISOString() } } },
      analysis_flat: { [category]: value, updatedAt: new Date().toISOString() },
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

