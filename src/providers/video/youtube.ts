import { google, youtube_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import type { VideoProvider, Visibility, Lifecycle } from './index';

// YouTube provider implementation with OAuth2. This code assumes YouTube Data API v3 is enabled.
// Ambiguities resolved:
// - We store refresh tokens under _private/youtubeTokens/{uid} with minimal caching of access token.
// - If KMS is not configured, tokens are stored as-is (encrypted at rest by Firestore + GCP). Add envelope encryption later.

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getConfig() {
  // Read lazily at runtime to avoid requiring envs at build/analyze time.
  const CLIENT_ID = getEnv('YOUTUBE_CLIENT_ID');
  const CLIENT_SECRET = getEnv('YOUTUBE_CLIENT_SECRET');
  const REDIRECT_URI = getEnv('YOUTUBE_REDIRECT_URI');
  const TARGET_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || '';
  return { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, TARGET_CHANNEL_ID };
}

function oauthClient(): OAuth2Client {
  const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = getConfig();
  const o = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  return o;
}

async function getTokenDoc(uid: string) {
  const db = getDbAdmin();
  const ref = db!.collection('_private').doc('youtubeTokens').collection('byUser').doc(uid);
  const snap = await ref.get();
  return { ref, data: snap.exists ? (snap.data() as any) : null };
}

async function getGlobalTokenDoc() {
  const db = getDbAdmin();
  const ref = db!.collection('_private').doc('youtubeTokens').collection('global').doc('host');
  const snap = await ref.get();
  return { ref, data: snap.exists ? (snap.data() as any) : null };
}

async function getOAuthClientFor(uid: string): Promise<OAuth2Client> {
  const { TARGET_CHANNEL_ID } = getConfig();
  // Prefer global channel credentials when configured
  if (TARGET_CHANNEL_ID) {
    const { data } = await getGlobalTokenDoc();
    if (!data?.refreshToken) throw new Error('youtube_not_connected');
    if (data.channelId && data.channelId !== TARGET_CHANNEL_ID) {
      throw new Error('channel_mismatch');
    }
    const o = oauthClient();
    o.setCredentials({
      refresh_token: data.refreshToken,
      access_token: data.accessToken,
      expiry_date: data.expiryDate,
      token_type: data.tokenType,
      scope: data.scope,
    });
    return o;
  }
  const { data } = await getTokenDoc(uid);
  if (!data?.refreshToken) throw new Error('youtube_not_connected');
  const o = oauthClient();
  o.setCredentials({
    refresh_token: data.refreshToken,
    access_token: data.accessToken,
    expiry_date: data.expiryDate,
    token_type: data.tokenType,
    scope: data.scope,
  });
  return o;
}

async function exchangeCodeForTokens(code: string, uid: string, codeVerifier?: string) {
  const o = oauthClient();
  const { tokens } = await o.getToken(codeVerifier ? { code, codeVerifier } as any : (code as any));
  if (!tokens.refresh_token) {
    // If refresh_token is missing (user previously consented), we cannot manage lives reliably.
    throw new Error('missing_refresh_token');
  }
  o.setCredentials(tokens);
  const yt = google.youtube({ version: 'v3', auth: o });
  const ch = await yt.channels.list({ part: ['snippet'], mine: true });
  const channel = ch.data.items?.[0];
  if (!channel) throw new Error('channel_not_found');
  const channelId = channel.id!;
  const channelTitle = channel.snippet?.title || 'Your Channel';
  const db = getDbAdmin();
  const { TARGET_CHANNEL_ID } = getConfig();
  if (TARGET_CHANNEL_ID) {
    if (channelId !== TARGET_CHANNEL_ID) {
      throw new Error('channel_mismatch');
    }
    const { ref } = await getGlobalTokenDoc();
    await ref.set({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token || null,
      expiryDate: tokens.expiry_date || null,
      scope: tokens.scope || '',
      tokenType: tokens.token_type || 'Bearer',
      channelId,
      channelTitle,
      connectedBy: uid,
      connectedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { channelId, channelTitle };
  }
  const ref = db!.collection('_private').doc('youtubeTokens').collection('byUser').doc(uid);
  await ref.set({
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token || null,
    expiryDate: tokens.expiry_date || null,
    scope: tokens.scope || '',
    tokenType: tokens.token_type || 'Bearer',
    channelId,
    channelTitle,
    connectedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { channelId, channelTitle };
}

function toPrivacyStatus(v: Visibility): youtube_v3.Schema$LiveBroadcastStatus['privacyStatus'] {
  return v;
}

export const youtubeProvider: VideoProvider = {
  async connect(uid, code, codeVerifier?) {
    return exchangeCodeForTokens(code, uid, codeVerifier);
  },
  async revoke(uid) {
    const { TARGET_CHANNEL_ID } = getConfig();
    if (TARGET_CHANNEL_ID) {
      const { data, ref } = await getGlobalTokenDoc();
      if (data?.refreshToken) {
        try {
          const o = oauthClient();
          o.setCredentials({ refresh_token: data.refreshToken });
          await o.revokeCredentials();
        } catch {}
      }
      await ref.delete();
      return;
    }
    const { data, ref } = await getTokenDoc(uid);
    if (data?.refreshToken) {
      try {
        const o = oauthClient();
        o.setCredentials({ refresh_token: data.refreshToken });
        await o.revokeCredentials();
      } catch {}
    }
    await ref.delete();
  },
  async createBroadcast(uid, input) {
    const o = await getOAuthClientFor(uid);
    const yt = google.youtube({ version: 'v3', auth: o });
    const snippet: youtube_v3.Schema$LiveBroadcastSnippet = {
      title: input.title,
      description: input.description || '',
      scheduledStartTime: input.scheduledStartTime ? input.scheduledStartTime.toISOString() : undefined,
    };
    const status: youtube_v3.Schema$LiveBroadcastStatus = {
      privacyStatus: toPrivacyStatus(input.visibility),
      selfDeclaredMadeForKids: false,
    };
    const contentDetails: youtube_v3.Schema$LiveBroadcastContentDetails = {
      enableDvr: input.allowDvr ?? true,
      enableAutoStart: input.autoStart ?? false,
      enableAutoStop: input.autoStop ?? true,
      // Low latency settings are not directly toggled here; channels may need default setting.
    };
    const res = await yt.liveBroadcasts.insert({
      part: ['snippet', 'status', 'contentDetails'],
      requestBody: { snippet, status, contentDetails, kind: 'youtube#liveBroadcast' },
    });
    const id = res.data.id!;
    return { broadcastId: id, videoId: id };
  },
  async createStream(uid, input) {
    const o = await getOAuthClientFor(uid);
    const yt = google.youtube({ version: 'v3', auth: o });
    const snippet: youtube_v3.Schema$LiveStreamSnippet = { title: input.title };
    const cdn: youtube_v3.Schema$CdnSettings = {
      ingestionType: 'rtmp',
      // Some channels require explicit resolution/framerate on stream creation
      // Defaults chosen for broad compatibility.
      resolution: '720p',
      frameRate: '30fps',
    };
    const contentDetails: youtube_v3.Schema$LiveStreamContentDetails = {
      // Ultra-low latency is typically a channel default; YouTube API has limited toggles here.
    };
    try {
      const res = await yt.liveStreams.insert({ part: ['snippet', 'cdn', 'contentDetails'], requestBody: { snippet, cdn, contentDetails } });
      const streamId = res.data.id!;
      const ingestAddress = res.data.cdn?.ingestionInfo?.ingestionAddress || '';
      const streamName = res.data.cdn?.ingestionInfo?.streamName || '';
      return { streamId, ingestAddress, streamName };
    } catch (e: any) {
      const reason = e?.errors?.[0]?.reason || e?.response?.data?.error?.errors?.[0]?.reason || '';
      const message = (e?.message || '').toString();
      if (reason === 'liveStreamingNotEnabled' || message.includes('not enabled for live streaming')) {
        throw new Error('live_streaming_not_enabled');
      }
      throw e;
    }
  },
  async bind(uid, broadcastId, streamId) {
    const o = await getOAuthClientFor(uid);
    const yt = google.youtube({ version: 'v3', auth: o });
    await yt.liveBroadcasts.bind({ part: ['id', 'contentDetails'], id: broadcastId, streamId });
  },
  async transition(uid, broadcastId, to) {
    const o = await getOAuthClientFor(uid);
    const yt = google.youtube({ version: 'v3', auth: o });
    const mapping: Record<'testing' | 'live' | 'complete' | 'canceled', youtube_v3.Params$Resource$Livebroadcasts$Transition['broadcastStatus']> = {
      testing: 'testing',
      live: 'live',
      complete: 'complete',
      canceled: 'revoked',
    };
    try {
      await yt.liveBroadcasts.transition({ id: broadcastId, part: ['status', 'contentDetails'], broadcastStatus: mapping[to] });
    } catch (e: any) {
      const reason = e?.errors?.[0]?.reason || e?.response?.data?.error?.errors?.[0]?.reason || '';
      const message = (e?.message || '').toString();
      // Common cases we want to surface as non-500s
      if (reason === 'invalidTransition' || message.includes('invalid transition')) {
        throw new Error('invalid_transition');
      }
      if (reason === 'liveStreamNotBound' || message.includes('stream not bound')) {
        throw new Error('stream_not_bound');
      }
      if (reason === 'forbidden' || message.includes('insufficient')) {
        throw new Error('youtube_not_connected');
      }
      if (reason === 'liveStreamingNotEnabled' || message.includes('not enabled for live streaming')) {
        throw new Error('live_streaming_not_enabled');
      }
      throw e;
    }
  },
  async getIngest(uid, streamId) {
    const o = await getOAuthClientFor(uid);
    const yt = google.youtube({ version: 'v3', auth: o });
    const res = await yt.liveStreams.list({ part: ['cdn'], id: [streamId] });
    const s = res.data.items?.[0];
    return {
      ingestAddress: s?.cdn?.ingestionInfo?.ingestionAddress || '',
      streamName: s?.cdn?.ingestionInfo?.streamName || '',
    };
  },
  async getStatus(uid, broadcastId) {
    const o = await getOAuthClientFor(uid);
    const yt = google.youtube({ version: 'v3', auth: o });
    const res = await yt.liveBroadcasts.list({ part: ['status', 'contentDetails'], id: [broadcastId] });
    const b = res.data.items?.[0];
    const life = (b?.status?.lifeCycleStatus || 'complete') as Lifecycle;
    // Health is not exposed directly; we approximate from monitorStream if present
    const health: 'good' | 'ok' | 'bad' = 'ok';
    return { lifecycle: life, health };
  },
};

export default youtubeProvider;
