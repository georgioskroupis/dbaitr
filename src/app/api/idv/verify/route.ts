import { NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebaseAdmin';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// Proxies to Cloud Run if configured; does not persist or log payloads
export async function POST(req: Request) {
  try {
    // Basic rate limit to reduce abuse
    if (!globalRateLimiter.check(getClientKey(req))) {
      return NextResponse.json({ approved: false, reason: 'rate_limited' }, { status: 429 });
    }
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ success: false, reason: 'unauthorized' }, { status: 401 });
    }

    const auth = getAuthAdmin();
    if (!auth) {
      throw new Error('Auth not initialized');
    }
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const form = await req.formData();
    const front = form.get('front');
    const back = form.get('back');
    const selfie = form.get('selfie');
    if (!front || !back || !selfie) {
      return NextResponse.json({ approved: false, reason: 'missing_images' }, { status: 400 });
    }

    let cloudUrl = process.env.CLOUD_RUN_IDV_URL;
    if (!cloudUrl && process.env.NODE_ENV !== 'production') {
      // Try a local dev service if available
      cloudUrl = process.env.IDV_DEV_LOCAL_URL || 'http://localhost:8000';
    }
    if (cloudUrl) {
      // Proxy form-data to Cloud Run endpoint
      const fd = new FormData();
      fd.append('front', front as Blob, 'front.jpg');
      fd.append('back', back as Blob, 'back.jpg');
      fd.append('selfie', selfie as Blob, 'selfie.jpg');
      fd.append('uid', uid as string);
      const resp = await fetch(cloudUrl, {
        method: 'POST',
        body: fd,
        // Propagate caller identity context to backend (optional, non-secret)
        headers: {
          'X-User-Id': uid,
        },
      });
      // Only return approved boolean + reason; never expose payload
      const data = await resp.json().catch(() => ({}));
      return NextResponse.json({ approved: !!data?.approved, reason: data?.reason || null }, { status: resp.ok ? 200 : 502 });
    }

    // Minimal fallback if verification backend not configured
    if (process.env.IDV_DEV_FAKE_APPROVE === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ approved: true, reason: 'dev_mode' }, { status: 200 });
    }
    return NextResponse.json({ approved: false, reason: 'cloud_unavailable' }, { status: 503 });
  } catch {
    return NextResponse.json({ approved: false, reason: 'server_error' }, { status: 500 });
  }
}
