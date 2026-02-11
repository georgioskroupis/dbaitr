export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

const debugEndpointsEnabled = process.env.NODE_ENV !== 'production' && process.env.DEBUG_ENDPOINTS_ENABLED === '1';

export const GET = withAuth(async () => {
  if (!debugEndpointsEnabled) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, route: 'debug/ping', ts: new Date().toISOString() });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
