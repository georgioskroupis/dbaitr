export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

const debugEndpointsEnabled = process.env.NODE_ENV !== 'production' && process.env.DEBUG_ENDPOINTS_ENABLED === '1';

function decodeJwtPart(part: string): any {
  try {
    const pad = part.length % 4 === 2 ? '==' : part.length % 4 === 3 ? '=' : '';
    const payload = part.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const txt = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

export const GET = withAuth(async (req, ctx: any) => {
  if (!debugEndpointsEnabled) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const expectedAppIds = [process.env.NEXT_PUBLIC_FIREBASE_APP_ID].filter(Boolean) as string[];
  const appCheckToken = req.headers.get('x-firebase-appcheck') || req.headers.get('x-firebase-appcheck-token');

  let appCheck: any = { verdict: appCheckToken ? 'present' : 'missing', tokenAppId: null, aud: null, expSec: null, expectedAppIds };
  if (appCheckToken) {
    try {
      const parts = appCheckToken.split('.');
      const payload = parts.length === 3 ? decodeJwtPart(parts[1]) : null;
      const tokenAppId = payload?.app_id || payload?.sub || null;
      const expSec = Number(payload?.exp || 0) || null;
      const aud = payload?.aud || null;
      const mismatch = expectedAppIds.length > 0 && tokenAppId && !expectedAppIds.includes(String(tokenAppId));
      appCheck = { verdict: mismatch ? 'app_id_mismatch' : 'valid', tokenAppId, aud, expSec, expectedAppIds };
    } catch {
      appCheck = { verdict: 'invalid', tokenAppId: null, aud: null, expSec: null, expectedAppIds };
    }
  }

  return NextResponse.json({
    route: '/api/debug/echo',
    appCheck,
    idToken: {
      verdict: 'valid',
      uid: ctx?.uid || null,
      role: ctx?.role || null,
      status: ctx?.status || null,
      kycVerified: !!ctx?.kycVerified,
    },
  });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
