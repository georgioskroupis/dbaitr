import { NextResponse } from 'next/server';
import { getDbAdmin, getAuthAdmin, FieldValue } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

type ActionType = 'clear_flag' | 'delete' | 'edit' | 'warn' | 'suppress' | 'other';

export async function POST(req: Request) {
  try {
    const db = getDbAdmin();
    const auth = getAuthAdmin();
    if (!db || !auth) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    const u = userDoc.data() as any;
    if (!(u?.isAdmin || u?.isModerator)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const body = await req.json();
    const { action, target, topicId, statementId, threadId, tags, notes, scores, maxLabel, maxScore } = body || {};
    if (!action || !target || !topicId || (!statementId && !threadId)) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    const docRef = await db.collection('moderation_actions').add({
      action: String(action) as ActionType,
      target: String(target),
      topicId,
      statementId: statementId || null,
      threadId: threadId || null,
      tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
      notes: typeof notes === 'string' ? notes : '',
      scores: scores || null,
      maxLabel: maxLabel || null,
      maxScore: typeof maxScore === 'number' ? maxScore : null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    // Lightweight heuristic updates to thresholds
    try {
      const settingsRef = db.collection('settings').doc('moderation');
      const snap = await settingsRef.get();
      const current = snap.exists ? (snap.data() as any) : {};
      let block = typeof current.blockThreshold === 'number' ? current.blockThreshold : 0.90;
      let flag = typeof current.flagThreshold === 'number' ? current.flagThreshold : 0.75;
      const s = typeof maxScore === 'number' ? maxScore : undefined;
      if (typeof s === 'number') {
        if (action === 'delete') {
          // Make blocking a bit more aggressive if deletes happen below current threshold
          if (s < block) block = Math.max(0.6, Math.min(block, s + 0.02));
        }
        if (action === 'clear_flag') {
          // Make flagging less aggressive if moderators routinely clear around current threshold
          if (s >= flag - 0.02) flag = Math.min(0.98, Math.max(flag, s + 0.03));
        }
      }
      await settingsRef.set({ blockThreshold: block, flagThreshold: flag, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch {}

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

