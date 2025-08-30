export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const GET = withAuth(async (_ctx, _req) => {
  try {
    const db = getDbAdmin();

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
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
