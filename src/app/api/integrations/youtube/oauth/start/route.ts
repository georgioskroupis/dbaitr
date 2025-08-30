export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const POST = withAuth(async (ctx, _req) => {
  try {
    const role = ctx?.role || 'viewer';
    const subscription = undefined;
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
    // PKCE setup (S256)
    const codeVerifier = ((randomUUID ? randomUUID() : Math.random().toString(36).slice(2)) + Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9\-._~]/g, '').slice(0, 64);
    const enc = new TextEncoder();
    const data = enc.encode(codeVerifier);
    // @ts-ignore
    const digest = await (globalThis.crypto?.subtle || require('crypto').webcrypto.subtle).digest('SHA-256', data);
    const buf = Buffer.from(digest);
    const codeChallenge = buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    // Create a short-lived state record to correlate callback → uid without relying on headers
    const db = getDbAdmin();
    const sid = (randomUUID ? randomUUID() : Math.random().toString(36).slice(2)) + '-' + Date.now().toString(36);
    await db!.collection('_private').doc('youtubeOAuthStates').collection('pending').doc(sid).set({
      uid: ctx?.uid,
      createdAt: FieldValue.serverTimestamp(),
      mode: globalChannel ? 'global' : 'user',
      codeVerifier,
    });
    const url = o.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube'],
      prompt: 'consent', // ensure refresh_token on first connect
      state: sid,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return NextResponse.json({ ok: true, authUrl: url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'server_error', message: e?.message }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
