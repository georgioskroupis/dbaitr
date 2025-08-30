export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin } from '@/lib/firebase/admin';
import youtubeProvider from '@/providers/video/youtube';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const auth = getAuthAdmin();
    const db = getDbAdmin();
    if (!code || !state || !auth || !db) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // Resolve state to a uid
    const ref = db.collection('_private').doc('youtubeOAuthStates').collection('pending').doc(state);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const data = snap.data() as any;
    const uid = data?.uid as string | undefined;
    if (!uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // Optional TTL check (15 minutes)
    try {
      const created = (data?.createdAt?.toMillis?.() ? data.createdAt.toMillis() : Date.now()) as number;
      if (Date.now() - created > 15 * 60 * 1000) {
        await ref.delete();
        return NextResponse.json({ ok: false, error: 'expired' }, { status: 400 });
      }
    } catch {}

    // If a global channel is configured, ensure the initiating user was admin at start time? We can re-check current claims.
    if (process.env.YOUTUBE_CHANNEL_ID) {
      try {
        const user = await auth.getUser(uid);
        const role = (user.customClaims as any)?.role || 'viewer';
        if (role !== 'admin') {
          await ref.delete();
          return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
        }
      } catch {
        await ref.delete();
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }
    }

    await youtubeProvider.connect(uid, code);
    await ref.delete();
    // Redirect back to settings page with success
    const redirect = '/settings/integrations/youtube?connected=1';
    return NextResponse.redirect(new URL(redirect, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'));
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
