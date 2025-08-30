import { NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebaseAdmin';

// Read-only diagnostics to help verify production Firebase configuration alignment.
// Does not expose secrets; API key is public by nature, and we only return a short prefix.
export async function GET() {
  try {
    const admin = getAuthAdmin();
    const adminProjectId = (admin as any)?.app?.options?.projectId || process.env.GOOGLE_CLOUD_PROJECT || null;
    const envProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || null;

    return NextResponse.json({
      ok: true,
      adminProjectId,
      envProjectId,
      authDomain,
      apiKeyPrefix: apiKey ? apiKey.slice(0, 6) : null,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'debug_failed' }, { status: 500 });
  }
}

