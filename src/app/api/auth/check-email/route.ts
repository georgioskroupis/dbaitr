import { NextResponse } from 'next/server';
import { getAuthAdmin, getAppCheckAdmin } from '@/lib/firebaseAdmin';

async function verifyAppCheck(req: Request) {
  const appCheck = getAppCheckAdmin();
  const hdr = req.headers.get('X-Firebase-AppCheck') || req.headers.get('X-Firebase-AppCheck-Token');
  if (!appCheck) return process.env.NODE_ENV !== 'production';
  // In development, allow missing header to reduce friction
  if (!hdr && process.env.NODE_ENV !== 'production') return true;
  try { if (!hdr) return false; await appCheck.verifyToken(hdr); return true; } catch { return false; }
}

export async function POST(req: Request) {
  try {
    if (!(await verifyAppCheck(req))) return NextResponse.json({ ok: false, error: 'appcheck' }, { status: 401 });
    const { email } = await req.json();
    if (!email || typeof email !== 'string') return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    const auth = getAuthAdmin();
    if (auth) {
      try {
        await auth.getUserByEmail(email.toLowerCase());
        return NextResponse.json({ ok: true, exists: true, source: 'admin' });
      } catch (e: any) {
        if (e?.code === 'auth/user-not-found') return NextResponse.json({ ok: true, exists: false, source: 'admin' });
        // Fall through to REST fallback on other errors
      }
    }

    // Fallback: Google Identity Toolkit REST (createAuthUri)
    try {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 501 });
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.toLowerCase(), continueUri: 'http://localhost' })
      });
      if (!r.ok) return NextResponse.json({ ok: false, error: 'rest_error', status: r.status }, { status: 500 });
      const j: any = await r.json();
      const exists = !!j?.registered;
      const methods: string[] = Array.isArray(j?.signinMethods) ? j.signinMethods : [];
      return NextResponse.json({ ok: true, exists, methods, source: 'rest' });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: 'fallback_error', message: e?.message }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
