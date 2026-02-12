import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';

export const POST = withAuth(async (req, ctx: any) => {
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const { roomId, targetUid, action } = await req.json();
    if (!roomId || !targetUid || !['shadow','unshadow'].includes(action)) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    const roomRef = db.collection('liveRooms').doc(roomId);
    let snap = await roomRef.get();
    if (!snap.exists) {
      const debateSnap = await db.collection('liveDebates').doc(roomId).get();
      if (!debateSnap.exists) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });
      const debate = debateSnap.data() as any;
      const mappedStatus =
        debate?.status === 'live'
          ? 'live'
          : (debate?.status === 'complete' || debate?.status === 'canceled' || debate?.status === 'error')
            ? 'ended'
            : 'scheduled';
      await roomRef.set({
        title: debate?.title || 'Live Debate',
        hostUid: debate?.createdBy || '',
        moderators: [],
        status: mappedStatus,
      }, { merge: true });
      snap = await roomRef.get();
    }
    const room = snap.data() as any;
    const isHost = room.hostUid === uid;
    const isMod = Array.isArray(room.moderators) && room.moderators.includes(uid);
    if (!(isHost || isMod)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const field = action==='shadow' ? { settings: { bannedUids: FieldValue.arrayUnion(targetUid) } } : { settings: { bannedUids: FieldValue.arrayRemove(targetUid) } };
    await roomRef.set(field, { merge: true });
    try { await db.collection('_private').doc('telemetry').collection('events').add({ kind: 'livechat_shadow', roomId, uid, targetUid, action, ts: FieldValue.serverTimestamp() }); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
