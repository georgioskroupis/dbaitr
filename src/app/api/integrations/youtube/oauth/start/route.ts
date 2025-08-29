export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAuthAdmin, getDbAdmin, FieldValue } from '@/lib/firebaseAdmin';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const auth = getAuthAdmin();
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !auth) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(token);
    const claims = decoded as any;
    const role = claims?.role || 'viewer';
    const subscription = claims?.subscription;
    const globalChannel = !!process.env.YOUTUBE_CHANNEL_ID;
    // If a global channel is configured, only admins may connect it
    const eligible = globalChannel
      ? role === 'admin'
      : (process.env.NODE_ENV !== 'production' || role === 'admin' || role === 'supporter' || subscription === 'plus' || subscription === 'supporter' || subscription === 'core');
    if (!eligible) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    // Lazy env access at handler runtime only (not module import time)
    const o = new google.auth.OAuth2(
      getEnv('YOUTUBE_CLIENT_ID'),
      getEnv('YOUTUBE_CLIENT_SECRET'),
      getEnv('YOUTUBE_REDIRECT_URI')
    );
    // Create a short-lived state record to correlate callback → uid without relying on headers
    const db = getDbAdmin();
    const sid = (randomUUID ? randomUUID() : Math.random().toString(36).slice(2)) + '-' + Date.now().toString(36);
    await db!.collection('_private').doc('youtubeOAuthStates').collection('pending').doc(sid).set({
      uid: decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      mode: globalChannel ? 'global' : 'user',
    });
    const url = o.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube'],
      prompt: 'consent', // ensure refresh_token on first connect
      state: sid,
    });
    return NextResponse.json({ ok: true, authUrl: url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}
