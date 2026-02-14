import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/http/withAuth';

export const POST = withAuth(async (req) => {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });

    // Fast-path: server-owned profile store.
    try {
      const db = getDbAdmin();
      const users = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
      if (!users.empty) return NextResponse.json({ ok: true, exists: true, source: 'users', confidence: 'high' });
    } catch {}

    const auth = getAuthAdmin();
    if (auth) {
      try {
        await auth.getUserByEmail(normalizedEmail);
        return NextResponse.json({ ok: true, exists: true, source: 'admin', confidence: 'high' });
      } catch (e: any) {
        if (e?.code === 'auth/user-not-found') {
          return NextResponse.json({ ok: true, exists: false, source: 'admin', confidence: 'high' });
        }
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
        body: JSON.stringify({ identifier: normalizedEmail, continueUri: 'http://localhost' })
      });
      if (!r.ok) {
        return NextResponse.json({ ok: true, exists: false, source: 'rest', confidence: 'low', status: r.status });
      }
      const j: any = await r.json();
      const exists = !!j?.registered;
      const methods: string[] = Array.isArray(j?.signinMethods) ? j.signinMethods : [];
      return NextResponse.json({ ok: true, exists, methods, source: 'rest', confidence: exists ? 'medium' : 'low' });
    } catch (e: any) {
      return NextResponse.json({ ok: true, exists: false, source: 'fallback_error', confidence: 'low' });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { public: true });
