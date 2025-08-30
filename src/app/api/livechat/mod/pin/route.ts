import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';

export const POST = withAuth(async (ctx, req) => {
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const { roomId, msgId, action } = await req.json();
    if (!roomId || !msgId || !['pin','unpin'].includes(action)) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    const roomRef = db.collection('liveRooms').doc(roomId);
    const snap = await roomRef.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });
    const room = snap.data() as any;
    const isHost = room.hostUid === uid;
    const isMod = Array.isArray(room.moderators) && room.moderators.includes(uid);
    if (!(isHost || isMod)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const arrField = action==='pin' ? { pinned: FieldValue.arrayUnion(msgId) } : { pinned: FieldValue.arrayRemove(msgId) };
    await roomRef.set(arrField, { merge: true });
    try { await db.collection('_private').doc('telemetry').collection('events').add({ kind: 'livechat_pin', roomId, uid, msgId, action, ts: FieldValue.serverTimestamp() }); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
