import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin, getAppCheckAdmin, FieldValue } from '@/lib/firebaseAdmin';

async function verifyAppCheck(req: Request) {
  const appCheck = getAppCheckAdmin();
  const hdr = req.headers.get('X-Firebase-AppCheck') || req.headers.get('X-Firebase-AppCheck-Token');
  if (!appCheck) return process.env.NODE_ENV !== 'production';
  try { if (!hdr) return false; await appCheck.verifyToken(hdr); return true; } catch { return false; }
}

export async function POST(req: Request) {
  try {
    if (!(await verifyAppCheck(req))) return NextResponse.json({ ok: false, error: 'appcheck' }, { status: 401 });
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const body = await req.json();
    const roomId = (body?.roomId || '').trim();
    const secondsRaw = body?.seconds;
    if (!roomId) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    const roomRef = db.collection('liveRooms').doc(roomId);
    const snap = await roomRef.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });
    const room = snap.data() as any;
    const isHost = room.hostUid === uid;
    const isMod = Array.isArray(room.moderators) && room.moderators.includes(uid);
    if (!(isHost || isMod)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const seconds = (secondsRaw === 'off' || secondsRaw === null) ? 0 : Math.max(0, parseInt(secondsRaw, 10) || 0);
    await roomRef.set({ settings: { slowModeSec: seconds } }, { merge: true });
    try { await db.collection('_private').doc('telemetry').collection('events').add({ kind: 'livechat_slow', roomId, uid, seconds, ts: FieldValue.serverTimestamp() }); } catch {}
    return NextResponse.json({ ok: true, seconds });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
