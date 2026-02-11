export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
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
  return NextResponse.json({ ok: true, route: 'ingest/bare', id });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
