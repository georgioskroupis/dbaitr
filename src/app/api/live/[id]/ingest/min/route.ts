export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

const diagnosticsEnabled = process.env.NODE_ENV !== 'production' && process.env.INGEST_DIAGNOSTICS_ENABLED === '1';

export const GET = withAuth(async (_req, ctx: any) => {
  if (!diagnosticsEnabled) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  const id = (ctx?.params as any)?.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const db = getDbAdmin();
  const snap = await db.collection('liveDebates').doc(id).get();
  const debate = snap.exists ? (snap.data() as any) : null;
  const youtube = debate?.youtube || {};

  return NextResponse.json({
    ok: true,
    route: 'ingest/min',
    hasDoc: !!snap.exists,
    hasYoutube: !!debate?.youtube,
    hasIngestAddress: !!youtube?.ingestAddress,
    hasStreamName: !!youtube?.streamName,
  });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
