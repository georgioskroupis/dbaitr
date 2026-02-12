"use client";

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { getDb, getRtdb } from '@/lib/firebase/client';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ref as rRef, onValue, onDisconnect, remove, set, update } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/http/client';

type Room = { id: string; title: string; status: 'live'|'ended'|'scheduled'; hostUid: string; moderators?: string[]; settings?: { supporterOnly?: boolean; slowModeSec?: number; emojiOnly?: boolean; questionsOnly?: boolean; bannedUids?: string[] }; pinned?: string[] };
type Message = { id: string; uid: string; displayName: string; role: 'host'|'mod'|'supporter'|'viewer'; text: string; type: 'message'|'question'|'answer'|'system'; replyToMsgId?: string|null; shadowed?: boolean; createdAt?: any };

function RoleBadge({ role }: { role: Message['role'] }) {
  const c = role==='host' ? 'bg-rose-500' : role==='mod' ? 'bg-emerald-600' : role==='supporter' ? 'bg-indigo-600' : 'bg-white/20';
  const label = role==='host' ? 'Host' : role==='mod' ? 'Mod' : role==='supporter' ? 'Supporter' : 'Viewer';
  return <span className={`ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded ${c} text-white`}>{label}</span>;
}

export function LiveChat({ roomId }: { roomId: string }) {
  const db = getDb();
  const rtdb = getRtdb();
  const { user } = useAuth();
  const [room, setRoom] = React.useState<Room | null>(null);
  const [compatMode, setCompatMode] = React.useState(false);
  const [roomState, setRoomState] = React.useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [roomError, setRoomError] = React.useState<string | null>(null);
  const [rawMsgs, setRawMsgs] = React.useState<Message[]>([]);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [tab, setTab] = React.useState<'all'|'pinned'|'questions'>('all');
  const [cooldown, setCooldown] = React.useState<number>(0);
  const [watching, setWatching] = React.useState<number>(0);
  const [typingUsers, setTypingUsers] = React.useState<string[]>([]);

  const isHost = !!(user && room && room.hostUid === user.uid);
  const isMod = !!(user && room && Array.isArray(room.moderators) && room.moderators.includes(user.uid));

  React.useEffect(() => {
    if (compatMode) return;
    setRoomState('loading');
    setRoomError(null);
    const rRefDoc = doc(db, 'liveRooms', roomId);
    const unsub = onSnapshot(rRefDoc, (snap) => {
      const d = snap.data() as any;
      if (!d) {
        // Backfill compatibility for older debates that predate liveRooms documents.
        getDoc(doc(db, 'liveDebates', roomId)).then((debateSnap) => {
          if (!debateSnap.exists()) {
            setRoom(null);
            setRoomState('unavailable');
            setRoomError('room_not_found');
            return;
          }
          const v = debateSnap.data() as any;
          const mappedStatus =
            v?.status === 'live'
              ? 'live'
              : (v?.status === 'complete' || v?.status === 'canceled' || v?.status === 'error')
                ? 'ended'
                : 'scheduled';
          setRoom({
            id: roomId,
            title: v?.title || 'Live Debate',
            status: mappedStatus,
            hostUid: v?.createdBy || '',
            moderators: [],
            settings: {},
            pinned: [],
          });
          setRoomState('ready');
          setRoomError(null);
        }).catch(() => {
          setRoom(null);
          setRoomState('unavailable');
          setRoomError('room_load_failed');
        });
        return;
      }
      setRoom({ id: snap.id, title: d.title, status: d.status, hostUid: d.hostUid, moderators: d.moderators || [], settings: d.settings || {}, pinned: d.pinned || [] });
      setRoomState('ready');
      setRoomError(null);
    }, (err) => {
      const code = (err as any)?.code || '';
      if (code === 'permission-denied') {
        setCompatMode(true);
        return;
      }
      setRoomState('unavailable');
      setRoomError(code || 'listener_error');
      // eslint-disable-next-line no-console
      console.warn('[LiveChat] room listener error:', code);
    });
    return () => unsub();
  }, [compatMode, db, roomId]);

  React.useEffect(() => {
    if (compatMode) return;
    const col = collection(db, 'liveRooms', roomId, 'messages');
    const q = query(col, orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const out: Message[] = [];
      snap.forEach(d => out.push({ id: d.id, ...(d.data() as any) } as Message));
      setRawMsgs(out.reverse());
    }, (err) => {
      const code = (err as any)?.code || '';
      if (code === 'permission-denied') {
        setCompatMode(true);
        return;
      }
      if (code !== 'permission-denied') {
        // eslint-disable-next-line no-console
        console.warn('[LiveChat] messages listener error:', code);
      }
    });
    return () => unsub();
  }, [compatMode, db, roomId]);

  React.useEffect(() => {
    if (!compatMode) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const pull = async () => {
      try {
        const res = await apiFetch(`/api/livechat/state?roomId=${encodeURIComponent(roomId)}&limit=50`, { allowAnonymous: true });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok || !j?.ok) {
          throw new Error((j?.error || `http_${res.status}`).toString());
        }
        if (cancelled) return;
        setRoom((j?.room || null) as Room | null);
        setRawMsgs(Array.isArray(j?.messages) ? (j.messages as Message[]) : []);
        setRoomState('ready');
        setRoomError(null);
      } catch (e: any) {
        if (cancelled) return;
        setRoomState('unavailable');
        setRoomError((e?.message || 'compat_failed').toString());
      }
    };
    pull();
    timer = setInterval(pull, 4000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [compatMode, roomId]);

  React.useEffect(() => {
    if (!rtdb) return;
    const watchersRef = rRef(rtdb, `presence/${roomId}`);
    const unsub = onValue(watchersRef, (snap) => {
      const val = snap.val() || {};
      const keys = Object.keys(val);
      setWatching(keys.length);
      const typing: string[] = [];
      for (const k of keys) { if (val[k]?.typing) typing.push(val[k]?.displayName || 'Someone'); }
      setTypingUsers(typing.slice(0, 3));
    });
    return () => unsub();
  }, [roomId]);

  React.useEffect(() => {
    if (!rtdb || !user) return;
    const meRef = rRef(rtdb, `presence/${roomId}/${user.uid}`);
    const base = { uid: user.uid, displayName: user.displayName || 'User', typing: false, ts: Date.now() };
    set(meRef, base).catch(() => {});
    try { onDisconnect(meRef).remove().catch(() => {}); } catch {}
    return () => { remove(meRef).catch(() => {}); };
  }, [rtdb, roomId, user?.uid, user?.displayName]);

  const canPost = React.useMemo(() => {
    if (!user || !room || room.status !== 'live') return false;
    if (room.settings?.supporterOnly) {
      if (isHost || isMod) return true;
      // supporter allowed (server authoritative)
      return true;
    }
    return true;
  }, [user, room, isHost, isMod]);

  const post = async () => {
    if (!canPost || !text.trim()) return;
    setSending(true);
    try {
      const token = user ? await user.getIdToken() : '';
      const res = await apiFetch('/api/livechat/post', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ roomId, text, type: room?.settings?.questionsOnly ? 'question' : 'message' }) });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        const reason = j?.error || 'unknown_error';
        if (reason === 'slow_mode') { const sec = Number(j?.retryAfter || 0); setCooldown(sec); }
        alert(
          reason === 'unauthenticated'
            ? 'Sign in to chat'
            : reason === 'supporters_only'
              ? 'Chat is supporters-only'
              : reason === 'slow_mode'
                ? `Slow mode: ${j?.retryAfter || 0}s`
                : reason === 'not_live'
                  ? 'Chat is disabled'
                  : reason === 'forbidden' && room?.settings?.emojiOnly
                    ? 'Emoji-only mode is enabled.'
                    : 'Failed to send'
        );
        return;
      }
      setText('');
    } finally { setSending(false); }
  };

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onTyping = React.useCallback((v: string) => {
    setText(v);
    if (!rtdb || !user) return;
    try {
      const meRef = rRef(rtdb, `presence/${roomId}/${user.uid}`);
      update(meRef, { typing: !!v, ts: Date.now(), displayName: user.displayName || 'User' }).catch(() => {});
    } catch {}
  }, [roomId, user]);

  const tryCommand = async (): Promise<boolean> => {
    const raw = text.trim();
    if (!raw.startsWith('/')) return false;
    if (!(isHost || isMod)) { setText(''); return true; }
    const parts = raw.slice(1).split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const token = user ? await user.getIdToken() : '';
    try {
      if (cmd === 'slow') {
        const arg = parts[1] || '';
        const seconds = arg === 'off' ? 'off' : String(parseInt(arg, 10) || 0);
        await apiFetch('/api/livechat/mod/slow', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ roomId, seconds }) });
      } else if (cmd === 'pin' || cmd === 'unpin') {
        const msgId = parts[1] || '';
        if (msgId) await apiFetch('/api/livechat/mod/pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ roomId, msgId, action: cmd }) });
      } else if (cmd === 'shadow' || cmd === 'unshadow') {
        const uidPart = parts[1] || '';
        const targetUid = uidPart.replace(/^uid[:@]?/i, '');
        if (targetUid) await apiFetch('/api/livechat/mod/shadow', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ roomId, targetUid, action: cmd }) });
      }
    } catch {}
    setText('');
    return true;
  };

  if (!room) {
    const msg =
      roomState === 'loading'
        ? 'Loading chat...'
        : compatMode
          ? 'Chat read fallback is active but unavailable right now. Try refreshing in a few seconds.'
          : roomError === 'room_not_found'
            ? 'Chat room was not found for this debate.'
            : 'Chat is temporarily unavailable.';
    return (
      <Card className="bg-black/40 border border-white/10 mt-4">
        <CardHeader><CardTitle className="text-white">Live Chat</CardTitle></CardHeader>
        <CardContent className="text-white/80">
          <p className="text-sm text-white/60">{msg}</p>
        </CardContent>
      </Card>
    );
  }
  const msgs = rawMsgs.filter(m => !m.shadowed || isHost || isMod || (user && m.uid === user.uid));
  const readOnly = room.status !== 'live';
  const pinnedSet = new Set(room.pinned || []);

  return (
      <Card className="bg-black/40 border border-white/10 mt-4">
        <CardHeader><CardTitle className="text-white">Live Chat</CardTitle></CardHeader>
        <CardContent className="text-white/80 space-y-3">
          {compatMode && (
            <p className="text-xs text-amber-300">
              Compatibility mode: using server-backed chat feed.
            </p>
          )}
          <div className="text-xs text-white/60 flex items-center gap-2"><span>{watching} watching</span>{typingUsers.length > 0 && <span>· {typingUsers.join(', ')} typing…</span>}</div>
        <div className="flex items-center gap-2 text-sm">
          <Button variant={tab==='all'?'default':'outline'} onClick={()=>setTab('all')}>All</Button>
          <Button variant={tab==='pinned'?'default':'outline'} onClick={()=>setTab('pinned')}>Pinned</Button>
          <Button variant={tab==='questions'?'default':'outline'} onClick={()=>setTab('questions')}>Questions</Button>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1" id="livechat-scroll">
          {msgs.filter(m => tab==='questions' ? m.type==='question' : tab==='pinned' ? pinnedSet.has(m.id) : true).map(m => (
            <div key={m.id} className="text-sm">
              <span className="font-semibold text-white">{m.displayName || 'User'}</span>
              <RoleBadge role={m.role} />
              {m.type==='question' && <span className="ml-2 text-amber-300 text-xs">Question</span>}
              {(isHost || isMod) && (<span className="ml-2 text-xs"><button className="underline" onClick={async ()=>{ const token = user ? await user.getIdToken() : ''; const pinned = pinnedSet.has(m.id); await apiFetch('/api/livechat/mod/pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ roomId, msgId: m.id, action: pinned?'unpin':'pin' }) }); }}>{pinnedSet.has(m.id)?'Unpin':'Pin'}</button></span>)}
              <div className="text-white/80 whitespace-pre-wrap break-words">{m.text}</div>
            </div>
          ))}
          {msgs.length===0 && <p className="text-white/60 text-sm">No messages yet.</p>}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={readOnly? 'Chat is disabled' : canPost? 'Say something…' : 'Sign in to chat'}
            value={text}
            onChange={e=>onTyping(e.target.value)}
            onKeyDown={async e=>{ if (e.key==='Enter') { if (!(await tryCommand())) await post(); } }}
            disabled={readOnly || !canPost || sending || cooldown>0}
            className="bg-white/5 border-white/10 text-white"
          />
          <Button onClick={post} disabled={readOnly || !canPost || sending || cooldown>0} className="bg-rose-500 hover:bg-rose-400">{cooldown>0? `${cooldown}s` : 'Send'}</Button>
        </div>
        {room.settings?.emojiOnly && <p className="text-xs text-white/60">Emoji-only mode is enabled.</p>}
        {room.settings?.supporterOnly && <p className="text-xs text-white/60">Supporters-only chat. <a className="underline" href="/pricing">Become a supporter</a>.</p>}
      </CardContent>
    </Card>
  );
}
