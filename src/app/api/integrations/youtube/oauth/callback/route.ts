export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase/admin';
import { forceRefreshClaims } from '@/lib/authz/claims';
import youtubeProvider from '@/providers/video/youtube';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const dev = process.env.NODE_ENV !== 'production';
    const rid = Math.random().toString(36).slice(2);
    if (dev) {
      try { console.error(JSON.stringify({ action: 'yt.oauth.cb.entry', state: state || null, hasCode: !!code })); } catch {}
    }
    const db = getDbAdmin();
    if (!db) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    if (!state) {
      if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'state_missing' })); } catch {} }
      const body = dev ? { ok: false, error: 'forbidden', reason: 'state_missing', requestId: rid } : { ok: false, error: 'forbidden' };
      return NextResponse.json(body, { status: 403 });
    }

    // Resolve state to a uid
    let ref = db.collection('_private').doc('youtubeOAuthStates').collection('pending').doc(state);
    let snap = await ref.get();
    if (!snap.exists) {
      const m = state.match(/^(.*)-[a-z0-9]{6,}$/i);
      if (m && m[1]) {
        const ref2 = db.collection('_private').doc('youtubeOAuthStates').collection('pending').doc(m[1]);
        const snap2 = await ref2.get();
        if (snap2.exists) { ref = ref2; snap = snap2; }
      }
    }
    if (!snap.exists) {
      if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'state_not_found' })); } catch {} }
      const body = dev ? { ok: false, error: 'forbidden', reason: 'state_not_found', requestId: rid } : { ok: false, error: 'forbidden' };
      return NextResponse.json(body, { status: 403 });
    }
    const data = snap.data() as any;
    const uid = data?.uid as string | undefined;
    if (!uid) {
      if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'state_not_found' })); } catch {} }
      const body = dev ? { ok: false, error: 'forbidden', reason: 'state_not_found', requestId: rid } : { ok: false, error: 'forbidden' };
      return NextResponse.json(body, { status: 403 });
    }

    // Optional TTL check (15 minutes)
    try {
      const ttlMin = (typeof data?.ttlMin === 'number' && data.ttlMin > 0) ? data.ttlMin : 15;
      const created = (data?.createdAt?.toMillis?.() ? data.createdAt.toMillis() : 0) as number;
      if (!created) throw new Error('missing_created');
      const ageMs = Date.now() - created;
      if (ageMs > ttlMin * 60 * 1000) {
        try { await ref.delete(); } catch {}
        if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'state_expired' })); } catch {} }
        const body = dev ? { ok: false, error: 'forbidden', reason: 'state_expired', requestId: rid } : { ok: false, error: 'forbidden' };
        return NextResponse.json(body, { status: 403 });
      }
    } catch {}
    if (data?.usedAt) {
      if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'state_used' })); } catch {} }
      const body = dev ? { ok: false, error: 'forbidden', reason: 'state_used', requestId: rid } : { ok: false, error: 'forbidden' };
      return NextResponse.json(body, { status: 403 });
    }

    // Retrieve PKCE codeVerifier from pending state
    let codeVerifier: string | undefined = undefined;
    try { codeVerifier = (snap.data() as any)?.codeVerifier || undefined; } catch {}
    if (!codeVerifier) {
      if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'pkce_missing' })); } catch {} }
      const body = dev ? { ok: false, error: 'forbidden', reason: 'pkce_missing', requestId: rid } : { ok: false, error: 'forbidden' };
      return NextResponse.json(body, { status: 403 });
    }
    if (typeof codeVerifier !== 'string' || codeVerifier.length < 43 || codeVerifier.length > 128) {
      if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'pkce_mismatch' })); } catch {} }
      const body = dev ? { ok: false, error: 'forbidden', reason: 'pkce_mismatch', requestId: rid } : { ok: false, error: 'forbidden' };
      return NextResponse.json(body, { status: 403 });
    }
    try {
      await youtubeProvider.connect(uid, code!, codeVerifier);
    } catch (e: any) {
      const msg = (e?.message || '').toString();
      await ref.delete().catch(() => {});
      if (/redirect_uri_mismatch/i.test(msg)) {
        if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'redirect_uri_mismatch' })); } catch {} }
        const body = dev ? { ok: false, error: 'unauthorized', reason: 'redirect_uri_mismatch', requestId: rid } : { ok: false, error: 'unauthorized' };
        return NextResponse.json(body, { status: 401 });
      }
      if (msg === 'youtube_not_connected_global_mismatch') {
        if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'global_channel_mismatch' })); } catch {} }
        return NextResponse.json({ ok: false, error: 'youtube_not_connected_global_mismatch', message: 'Reconnect as the owner of the configured channel' }, { status: 409 });
      }
      if (/invalid_grant/i.test(msg)) {
        if (dev) { try { console.error(JSON.stringify({ action: 'yt.oauth.cb.deny', reason: 'code_exchange_invalid_grant' })); } catch {} }
        const body = dev ? { ok: false, error: 'unauthorized', reason: 'code_exchange_invalid_grant', requestId: rid } : { ok: false, error: 'unauthorized' };
        return NextResponse.json(body, { status: 401 });
      }
      throw e;
    }
    await ref.delete();
    try { await forceRefreshClaims(uid); } catch {}
    const redirect = '/settings/integrations/youtube?connected=1';
    return NextResponse.redirect(new URL(redirect, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'));
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
