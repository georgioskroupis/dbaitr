import { NextResponse } from 'next/server';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { globalRateLimiter, getClientKey } from '@/lib/rateLimit';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { setClaims } from '@/lib/authz/claims';

export const runtime = 'nodejs';

// Verifies captures through Cloud Run (or dev fallback) and persists only decision metadata.
export const POST = withAuth(async (req, ctx: any) => {
  try {
    // Basic rate limit to reduce abuse
    if (!globalRateLimiter.check(getClientKey(req))) {
      return NextResponse.json({ approved: false, reason: 'rate_limited' }, { status: 429 });
    }
    const uid = ctx?.uid as string;
    const db = getDbAdmin();

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
    let approved = false;
    let reason: string | null = null;
    let source: 'cloud' | 'dev_fallback' | 'unavailable' = 'unavailable';
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
      const data = await resp.json().catch(() => ({}));
      source = 'cloud';
      approved = resp.ok && !!data?.approved;
      reason = typeof data?.reason === 'string' ? data.reason : (resp.ok ? null : 'cloud_unavailable');
    } else if (process.env.IDV_DEV_FAKE_APPROVE === 'true' && process.env.NODE_ENV !== 'production') {
      // Minimal fallback if verification backend not configured
      source = 'dev_fallback';
      approved = true;
      reason = 'dev_mode';
    } else {
      source = 'unavailable';
      approved = false;
      reason = 'cloud_unavailable';
    }

    // Persist server decision for audit and anti-spoofing checks.
    const attemptRef = db.collection('idv_attempts').doc();
    await attemptRef.set({
      uid,
      approved,
      reason: reason || null,
      source,
      timestamp: FieldValue.serverTimestamp(),
    });
    await db.collection('idv_latest').doc(uid).set({
      attemptId: attemptRef.id,
      approved,
      reason: reason || null,
      source,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Approval must happen on the server path only; never trust client-posted approval payloads.
    if (approved) {
      await db.collection('users').doc(uid).set(
        {
          kycVerified: true,
          identity: { verified: true },
          idv_verified: true,
          status: 'verified',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await setClaims(uid, { status: 'Verified', kycVerified: true });
    }

    return NextResponse.json({ approved, reason }, { status: 200 });
  } catch {
    return NextResponse.json({ approved: false, reason: 'server_error' }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
