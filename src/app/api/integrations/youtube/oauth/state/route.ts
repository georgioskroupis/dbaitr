export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Dev-only; admin-only via whoami in client, but safest to 404 in prod
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  if (!state) return NextResponse.json({ ok: true, found: false, used: false, ageSec: null, hasCodeVerifier: false });
  try {
    const { getDbAdmin } = await import('@/lib/firebase/admin');
    const db = getDbAdmin();
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
    if (!snap.exists) return NextResponse.json({ ok: true, found: false, used: false, ageSec: null, hasCodeVerifier: false });
    const d = snap.data() as any;
    const created = (d?.createdAt?.toMillis?.() ? d.createdAt.toMillis() : 0) as number;
    const ageSec = created ? Math.floor((Date.now() - created) / 1000) : null;
    const used = !!d?.usedAt;
    const hasCodeVerifier = !!d?.codeVerifier;
    return NextResponse.json({ ok: true, found: true, used, ageSec, hasCodeVerifier });
  } catch {
    return NextResponse.json({ ok: true, found: false, used: false, ageSec: null, hasCodeVerifier: false });
  }
}

