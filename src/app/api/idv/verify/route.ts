import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Proxies to Cloud Run if configured; does not persist or log payloads
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const front = form.get('front');
    const back = form.get('back');
    const selfie = form.get('selfie');
    if (!front || !back || !selfie) {
      return NextResponse.json({ approved: false, reason: 'missing_images' }, { status: 400 });
    }

    const cloudUrl = process.env.CLOUD_RUN_IDV_URL;
    if (cloudUrl) {
      // Proxy form-data to Cloud Run endpoint
      const fd = new FormData();
      fd.append('front', front as Blob, 'front.jpg');
      fd.append('back', back as Blob, 'back.jpg');
      fd.append('selfie', selfie as Blob, 'selfie.jpg');
      const resp = await fetch(cloudUrl, { method: 'POST', body: fd });
      // Only return approved boolean + reason; never expose payload
      const data = await resp.json().catch(() => ({}));
      return NextResponse.json({ approved: !!data?.approved, reason: data?.reason || null }, { status: resp.ok ? 200 : 502 });
    }

    // Minimal fallback if Cloud Run not configured
    return NextResponse.json({ approved: false, reason: 'cloud_unavailable' }, { status: 503 });
  } catch {
    return NextResponse.json({ approved: false, reason: 'server_error' }, { status: 500 });
  }
}
