export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const GET = withAuth(async (_ctx, req) => {
  const db = getDbAdmin();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code') || undefined;
  const route = searchParams.get('route') || undefined;
  const window = searchParams.get('window') || '24h';
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const sinceMs = window === '1h' ? 3600e3 : window === '7d' ? 7*24*3600e3 : 24*3600e3;
  const since = new Date(Date.now() - sinceMs);
  let q: FirebaseFirestore.Query = db.collection('_diagnostics').doc('auth').collection('denials').where('at','>=', since).orderBy('at','desc');
  if (code) q = q.where('code','==', code);
  if (route) q = q.where('route','==', route);
  const snap = await q.limit(pageSize).get();
  const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  // Aggregates
  const agg: Record<string, number> = {};
  for (const it of items) {
    const k = `${it.route || 'unknown'}|${it.code || 'unknown'}`;
    agg[k] = (agg[k] || 0) + 1;
  }
  // Best-effort retention prune (delete docs older than 30d if count > 10000)
  try {
    const oldCutoff = new Date(Date.now() - 30*24*3600e3);
    const countSnap = await db.collection('_diagnostics').doc('auth').collection('denials').orderBy('at','desc').limit(1).get();
    if (!countSnap.empty) {
      const oldSnap = await db.collection('_diagnostics').doc('auth').collection('denials').where('at','<', oldCutoff).limit(500).get();
      if (!oldSnap.empty) {
        const batch = db.batch();
        oldSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch {}
  return NextResponse.json({ ok: true, items, aggregates: agg, window });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
