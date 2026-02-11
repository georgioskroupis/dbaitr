import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_req, ctx?: { params?: { uid: string } }) => {
  try {
    const db = getDbAdmin();

    const uid = (ctx?.params as any)?.uid as string;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    const d = userDoc.data() as any;
    const base = {
      uid,
      email: d?.email || null,
      fullName: d?.fullName || null,
      role: d?.role || null,
      status: d?.status || null,
      kycVerified: !!d?.kycVerified,
      createdAt: toIso(d?.createdAt),
      lastActiveAt: toIso(d?.lastActiveAt),
      provider: d?.provider || null,
      flagsCount: typeof d?.flagsCount === 'number' ? d.flagsCount : 0,
    };

    // Activity: last 10 statements/threads
    const [st, th] = await Promise.all([
      db.collectionGroup('statements').where('createdBy', '==', uid).orderBy('createdAt', 'desc').limit(5).get(),
      db.collectionGroup('threads').where('createdBy', '==', uid).orderBy('createdAt', 'desc').limit(5).get(),
    ]);
    const activity = [
      ...st.docs.map(s => ({ kind: 'statement', id: s.id, createdAt: toIso((s.data() as any)?.createdAt), content: (s.data() as any)?.content || '' })),
      ...th.docs.map(s => ({ kind: 'thread', id: s.id, createdAt: toIso((s.data() as any)?.createdAt), content: (s.data() as any)?.content || '' })),
    ].sort((a, b) => (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime()));

    // Notes (moderator-only)
    let notes: any[] = [];
    const role = (ctx as any)?.role as string | undefined;
    if (role === 'admin' || role === 'super-admin' || role === 'moderator') {
      const ns = await db.collection('users').doc(uid).collection('admin_notes').orderBy('createdAt', 'desc').limit(10).get();
      notes = ns.docs.map(x => ({ id: x.id, ...(x.data() as any), createdAt: toIso((x.data() as any)?.createdAt) }));
    }

    // Flags (best-effort): recent moderation flags on statements/threads
    const flaggedSt = await db.collectionGroup('statements').where('createdBy', '==', uid).where('moderation.flagged', '==', true).limit(5).get().catch(() => ({ docs: []} as any));
    const flaggedTh = await db.collectionGroup('threads').where('createdBy', '==', uid).where('moderation.flagged', '==', true).limit(5).get().catch(() => ({ docs: []} as any));
    const flags = [
      ...flaggedSt.docs.map(d => ({ id: d.id, reason: (d.data() as any)?.moderation?.reason || 'flagged', createdAt: toIso((d.data() as any)?.createdAt) })),
      ...flaggedTh.docs.map(d => ({ id: d.id, reason: (d.data() as any)?.moderation?.reason || 'flagged', createdAt: toIso((d.data() as any)?.createdAt) })),
    ];

    const security = {
      sessions: d?.sessionsCount || null,
      lastLoginAt: toIso(d?.lastLoginAt),
      passwordUpdatedAt: toIso(d?.passwordUpdatedAt),
    };

    return NextResponse.json({ ...base, activity, notes, flags, security });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}, { ...requireRole('moderator'), ...requireStatus(['Verified']) });

function toIso(ts: any): string | null {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (ts.seconds !== undefined) return new Date(ts.seconds * 1000).toISOString();
    if (typeof ts === 'string') return ts;
    if (ts instanceof Date) return ts.toISOString();
  } catch {}
  return null;
}
