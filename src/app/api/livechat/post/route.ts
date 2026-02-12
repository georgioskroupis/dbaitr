import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';

// withAuth handles App Check

function isProfaneOrSuspicious(text: string): boolean {
  const bad = /(fuck|shit|bitch|cunt|nigger|faggot)/i;
  const url = /https?:\/\//i;
  return bad.test(text) || url.test(text);
}

function isEmojiOnly(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (!compact) return false;
  // Covers common emoji code points + modifiers/ZWJ sequences.
  return /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d\ufe0f]+$/u.test(compact);
}

export const POST = withAuth(async (req, ctx: any) => {
  try {
    const db = getDbAdmin();
    const uid = ctx?.uid as string;
    const claims = (ctx?.claims || {}) as Record<string, unknown>;
    const body = await req.json();
    const roomId = (body?.roomId || '').trim();
    const text = (body?.text || '').toString().trim();
    const requestedType = (body?.type || 'message') as string;
    const allowedTypes = new Set(['message', 'question', 'answer']);
    if (!allowedTypes.has(requestedType)) {
      return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    }
    const type = requestedType as 'message'|'question'|'answer';
    if (!roomId || !text) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    if (text.length > 500) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });

    const roomRef = db.collection('liveRooms').doc(roomId);
    let roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      // Backfill compatibility: derive missing room doc from legacy liveDebates entry.
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
        settings: {
          supporterOnly: false,
          slowModeSec: 0,
          emojiOnly: false,
          questionsOnly: false,
          bannedUids: [],
        },
        pinned: [],
        stats: { messageCount: 0 },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      roomSnap = await roomRef.get();
    }
    const room = roomSnap.data() as any;
    if (room.status !== 'live') return NextResponse.json({ ok: false, error: 'not_live' }, { status: 409 });

    const isHost = room.hostUid === uid;
    const isMod = Array.isArray(room.moderators) && room.moderators.includes(uid);
    const isSupporter =
      ctx?.role === 'supporter' ||
      claims.supporter === true ||
      ['plus','supporter','core'].includes(String(claims.subscription || ''));

    if (room?.settings?.supporterOnly) {
      if (!(isHost || isMod || isSupporter)) {
        return NextResponse.json({ ok: false, error: 'supporters_only' }, { status: 403 });
      }
    }
    if (room?.settings?.emojiOnly && !isEmojiOnly(text)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
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
    const normalizedType: 'message'|'question'|'answer' = room?.settings?.questionsOnly ? 'question' : type;
    const displayName = String((claims.name as string) || '').trim() || 'User';

    const msgRef = roomRef.collection('messages').doc();
    await msgRef.set({
      uid,
      displayName,
      role,
      text,
      type: normalizedType,
      replyToMsgId: null,
      shadowed,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    try { await roomRef.set({ stats: { messageCount: FieldValue.increment(1) } }, { merge: true }); } catch {}

    try { await db.collection('_private').doc('telemetry').collection('events').add({
      kind: 'livechat_post', roomId, uid, role, type: normalizedType, slow, supporterOnly: !!room?.settings?.supporterOnly, ts: FieldValue.serverTimestamp(),
    }); } catch {}

    return NextResponse.json({ ok: true, id: msgRef.id });
  } catch {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
