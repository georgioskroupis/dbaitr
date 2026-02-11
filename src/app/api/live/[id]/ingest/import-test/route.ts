export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

const diagnosticsEnabled = process.env.NODE_ENV !== 'production' && process.env.INGEST_DIAGNOSTICS_ENABLED === '1';

export const GET = withAuth(async () => {
  if (!diagnosticsEnabled) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  try {
    await import('@/providers/video/youtube');
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      route: 'ingest/import-test',
      fail: 'provider',
      message: String(e?.message || 'error'),
    });
  }

  try {
    await import('@/lib/firebase/admin');
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      route: 'ingest/import-test',
      fail: 'adminHelper',
      message: String(e?.message || 'error'),
    });
  }

  return NextResponse.json({ ok: true, route: 'ingest/import-test', provider: 'ok', adminHelper: 'ok' });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
