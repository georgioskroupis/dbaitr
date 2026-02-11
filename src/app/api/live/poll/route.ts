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
    const updates: Array<Promise<any>> = [];
    for (const doc of targets) {
      const d = doc.data() as any;
      const uid = d?.createdBy;
      const b = d?.youtube?.broadcastId;
      if (!uid || !b) continue;
      updates.push((async () => {
        try {
          const st = await youtubeProvider.getStatus(uid, b);
          await doc.ref.set({ status: st.lifecycle }, { merge: true });
        } catch {}
      })());
    }
    await Promise.all(updates);
    return NextResponse.json({ ok: true, count: updates.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
