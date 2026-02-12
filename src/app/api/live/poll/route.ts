import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';
import youtubeProvider from '@/providers/video/youtube';

// Best-effort poller to refresh statuses. Can be invoked by client or cron.
export const POST = withAuth(async (req) => {
  try {
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const { ids } = await req.json().catch(() => ({ ids: [] as string[] }));
    // Poll a small batch: either provided ids or recent scheduled/testing/live
    let targets: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (Array.isArray(ids) && ids.length > 0) {
      const snaps = await Promise.all(ids.map(id => db.collection('liveDebates').doc(id).get()));
      targets = snaps.filter(s => s.exists) as any;
    } else {
      const q = await db.collection('liveDebates').where('status', 'in', ['scheduled','testing','live']).limit(10).get();
      targets = q.docs;
    }
    const updates: Array<Promise<{ id: string; ok: boolean; error?: string }>> = [];
    for (const doc of targets) {
      const d = doc.data() as any;
      const uid = d?.createdBy;
      const b = d?.youtube?.broadcastId;
      if (!uid || !b) continue;
      updates.push((async () => {
        try {
          const st = await youtubeProvider.getStatus(uid, b);
          const roomStatus =
            st.lifecycle === 'live'
              ? 'live'
              : (st.lifecycle === 'complete' || st.lifecycle === 'canceled' || st.lifecycle === 'error')
                ? 'ended'
                : 'scheduled';
          const batch = db.batch();
          batch.set(doc.ref, { status: st.lifecycle }, { merge: true });
          batch.set(
            db.collection('liveRooms').doc(doc.id),
            { status: roomStatus, title: d?.title || 'Live Debate', hostUid: d?.createdBy || '' },
            { merge: true },
          );
          await batch.commit();
          return { id: doc.id, ok: true };
        } catch (e: any) {
          const msg = (e?.message || 'unknown_error').toString();
          try {
            console.warn(JSON.stringify({
              level: 'warn',
              route: '/api/live/poll',
              debateId: doc.id,
              error: msg,
            }));
          } catch {}
          return { id: doc.id, ok: false, error: msg };
        }
      })());
    }
    const results = await Promise.all(updates);
    const updated = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    return NextResponse.json({
      ok: true,
      count: results.length,
      updated,
      failed: failed.length,
      failedIds: failed.slice(0, 10).map(r => r.id),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
