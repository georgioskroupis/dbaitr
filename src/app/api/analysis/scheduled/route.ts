import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebaseAdmin';
import { evaluateTopicPills } from '@/lib/server/analysis';

export const runtime = 'nodejs';

// Scheduled invocations: scans for recent jobs and evaluates with debounce controls.
export async function GET() {
  try {
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const now = Date.now();
    const since = new Date(now - 2 * 60 * 60 * 1000); // lookback 2h
    const jobsSnap = await db.collection('_jobs').where('type', '==', 'analysis').where('lastRequestedAt', '>=', since).get();
    const out: any[] = [];
    for (const d of jobsSnap.docs) {
      const j = d.data() as any;
      const ts = j?.lastRequestedAt?.toDate?.() || new Date();
      // Debounce: ensure at least 20s since request
      if (now - ts.getTime() < 20_000) continue;
      // Under load: cap to every 30s per topic (via _jobs.cooldownAt)
      const cooldownAt = j?.cooldownAt?.toDate?.()?.getTime?.() || 0;
      if (now < cooldownAt) continue;
      try {
        const res = await evaluateTopicPills(String(j.topicId || ''), 'scheduled');
        out.push(res);
        await d.ref.set({ cooldownAt: new Date(now + 30_000) }, { merge: true });
      } catch (e) { /* swallow; next run will retry */ }
    }
    // Cadence for engagement: active every 5m; dormant every 60m
    try {
      const topicsRef = db.collection('topics');
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [actSnap, dormSnap] = await Promise.all([
        topicsRef.where('analysis_flat.engagement', '==', 'active').where('analysis_flat.updatedAt', '<=', fiveMinAgo.toISOString()).limit(10).get(),
        topicsRef.where('analysis_flat.engagement', '==', 'dormant').where('analysis_flat.updatedAt', '<=', sixtyMinAgo.toISOString()).limit(10).get(),
      ]);
      for (const d of [...actSnap.docs, ...dormSnap.docs]) {
        try { out.push(await evaluateTopicPills(d.id, 'scheduled')); } catch {}
      }
    } catch {}
    return NextResponse.json({ ok: true, count: out.length, results: out });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
