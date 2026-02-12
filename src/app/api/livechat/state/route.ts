import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';

type RoomStatus = 'live' | 'ended' | 'scheduled';

function mapDebateStatusToRoomStatus(status: string | undefined): RoomStatus {
  if (status === 'live') return 'live';
  if (status === 'complete' || status === 'canceled' || status === 'error') return 'ended';
  return 'scheduled';
}

function toMillis(v: any): number | null {
  if (!v) return null;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return null;
}

export const GET = withAuth(async (req) => {
  try {
    const db = getDbAdmin();
    const url = new URL(req.url);
    const roomId = (url.searchParams.get('roomId') || '').trim();
    const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10);
    const readLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50;
    if (!roomId) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });

    const roomRef = db.collection('liveRooms').doc(roomId);
    const roomSnap = await roomRef.get();

    let room: any = null;
    if (roomSnap.exists) {
      const d = roomSnap.data() as any;
      room = {
        id: roomId,
        title: d?.title || 'Live Debate',
        status: (d?.status || 'scheduled') as RoomStatus,
        hostUid: d?.hostUid || '',
        moderators: Array.isArray(d?.moderators) ? d.moderators : [],
        settings: d?.settings || {},
        pinned: Array.isArray(d?.pinned) ? d.pinned : [],
      };
    } else {
      const debateSnap = await db.collection('liveDebates').doc(roomId).get();
      if (!debateSnap.exists) return NextResponse.json({ ok: false, error: 'room_not_found' }, { status: 404 });
      const d = debateSnap.data() as any;
      room = {
        id: roomId,
        title: d?.title || 'Live Debate',
        status: mapDebateStatusToRoomStatus(d?.status),
        hostUid: d?.createdBy || '',
        moderators: [],
        settings: {},
        pinned: [],
      };
    }

    const msgSnap = await roomRef.collection('messages').orderBy('createdAt', 'desc').limit(readLimit).get();
    const messages = msgSnap.docs
      .map((doc) => {
        const d = doc.data() as any;
        return {
          id: doc.id,
          uid: d?.uid || '',
          displayName: d?.displayName || 'User',
          role: d?.role || 'viewer',
          text: d?.text || '',
          type: d?.type || 'message',
          replyToMsgId: d?.replyToMsgId || null,
          shadowed: !!d?.shadowed,
          createdAtMs: toMillis(d?.createdAt),
        };
      })
      .reverse();

    return NextResponse.json({ ok: true, room, messages });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message || 'server_error' }, { status: 500 });
  }
}, { public: true, rateLimit: { ipPerMin: 240 } });

