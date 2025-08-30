import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';

// withAuth handles App Check

function isProfaneOrSuspicious(text: string): boolean {
  const bad = /(fuck|shit|bitch|cunt|nigger|faggot)/i;
  const url = /https?:\/\//i;
  return bad.test(text) || url.test(text);
}

export const POST = withAuth(async (ctx, req) => {
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const claims: any = { role: ctx?.role };
    const body = await req.json();
    const roomId = (body?.roomId || '').trim();
    const text = (body?.text || '').toString();
    const type = (body?.type || 'message') as 'message'|'question'|'answer'|'system';
    if (!roomId || !text) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });

    const roomRef = db.collection('liveRooms').doc(roomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });
    const room = roomSnap.data() as any;
    if (room.status !== 'live') return NextResponse.json({ ok: false, error: 'not_live' }, { status: 409 });

    const isHost = room.hostUid === uid;
    const isMod = Array.isArray(room.moderators) && room.moderators.includes(uid);
    const isSupporter = !!claims.supporter || ['plus','supporter','core'].includes((claims.subscription || '').toString());

    if (room?.settings?.supporterOnly) {
      if (!(isHost || isMod || isSupporter)) {
        return NextResponse.json({ ok: false, error: 'supporters_only' }, { status: 403 });
      }
    }

    const slow = +(room?.settings?.slowModeSec || 0);
    if (slow > 0) {
      const stateRef = roomRef.collection('userState').doc(uid);
      const stateSnap = await stateRef.get();
      const last = stateSnap.exists ? (stateSnap.data() as any)?.lastPostAt || 0 : 0;
      const now = Date.now();
      if (last && now - last < slow * 1000) {
        return NextResponse.json({ ok: false, error: 'slow_mode', retryAfter: Math.ceil((slow*1000 - (now - last))/1000) }, { status: 429 });
      }
      await stateRef.set({ lastPostAt: now }, { merge: true });
    }

    const banned = Array.isArray(room?.settings?.bannedUids) && room.settings.bannedUids.includes(uid);
    const shadowed = banned || isProfaneOrSuspicious(text);
    const role: 'host'|'mod'|'supporter'|'viewer' = isHost ? 'host' : isMod ? 'mod' : isSupporter ? 'supporter' : 'viewer';

    const msgRef = roomRef.collection('messages').doc();
    await msgRef.set({
      uid,
      displayName: 'User',
      role,
      text,
      type,
      replyToMsgId: null,
      shadowed,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    try { await roomRef.set({ stats: { messageCount: FieldValue.increment(1) } }, { merge: true }); } catch {}

    try { await db.collection('_private').doc('telemetry').collection('events').add({
      kind: 'livechat_post', roomId, uid, role, type, slow, supporterOnly: !!room?.settings?.supporterOnly, ts: FieldValue.serverTimestamp(),
    }); } catch {}

    return NextResponse.json({ ok: true, id: msgRef.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
