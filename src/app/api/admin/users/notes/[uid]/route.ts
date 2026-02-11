import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const POST = withAuth(async (req, ctx?: { params?: { uid: string } }) => {
  try {
    const db = getDbAdmin();
    const actorUid = (ctx as any)?.uid;
    const body = await req.json();
    const text = String(body?.text || '').trim();
    if (text.length < 3) return NextResponse.json({ ok: false, error: 'short' }, { status: 400 });
    const uid = (ctx?.params as any)?.uid as string;
    const userRef = db.collection('users').doc(uid);
    const noteRef = userRef.collection('admin_notes').doc();
    await noteRef.set({ text, by: actorUid, createdAt: FieldValue.serverTimestamp() });
    await userRef.set({ notesCount: FieldValue.increment(1) }, { merge: true });
    // Audit
    await userRef.collection('audit_logs').add({ by: actorUid, action: 'note.add', reason: text.slice(0, 120), at: FieldValue.serverTimestamp(), from: {}, to: {} });
    return NextResponse.json({ ok: true, id: noteRef.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}, { ...requireRole('moderator'), ...requireStatus(['Verified']) });
