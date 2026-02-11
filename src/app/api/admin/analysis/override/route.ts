import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const POST = withAuth(async (req) => {
  try {
    const db = getDbAdmin();

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
}, { ...requireRole('moderator'), ...requireStatus(['Verified']) });
