import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin, FieldValue } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { uid: string } }) {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const actorUid = decoded.uid;
    const role = (decoded as any)?.role || '';
    const isMod = role === 'moderator' || role === 'admin' || role === 'super-admin';
    if (!isMod) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const body = await req.json();
    const text = String(body?.text || '').trim();
    if (text.length < 3) return NextResponse.json({ ok: false, error: 'short' }, { status: 400 });
    const uid = params.uid;
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
}

