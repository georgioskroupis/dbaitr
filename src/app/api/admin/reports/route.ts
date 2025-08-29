import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!auth || !db) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const role = (decoded as any)?.role || 'viewer';
    if (role !== 'admin') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    let reports: any[] = [];
    let flaggedStatements: any[] = [];
    let flaggedThreads: any[] = [];
    const errors: string[] = [];

    try {
      const reportsSnap = await db.collection('reports').orderBy('createdAt', 'desc').limit(50).get();
      reports = reportsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    } catch (err: any) {
      errors.push(`reports:${err?.message || err}`);
      try {
        const fallback = await db.collection('reports').limit(50).get();
        reports = fallback.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      } catch {}
    }

    try {
      const flaggedStatementsSnap = await db.collectionGroup('statements').where('moderation.flagged', '==', true).limit(50).get();
      flaggedStatements = flaggedStatementsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    } catch (err: any) {
      errors.push(`flaggedStatements:${err?.message || err}`);
    }

    try {
      const flaggedThreadsSnap = await db.collectionGroup('threads').where('moderation.flagged', '==', true).limit(50).get();
      flaggedThreads = flaggedThreadsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    } catch (err: any) {
      errors.push(`flaggedThreads:${err?.message || err}`);
    }

    return NextResponse.json({ ok: true, reports, flaggedStatements, flaggedThreads, errors: errors.length ? errors : undefined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
