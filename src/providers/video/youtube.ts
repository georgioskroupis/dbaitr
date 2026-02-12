import { google, youtube_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getDbAdmin, FieldValue } from '@/lib/firebase/admin';
import type { VideoProvider, Visibility, Lifecycle } from './index';

// YouTube provider implementation with OAuth2. This code assumes YouTube Data API v3 is enabled.
// Ambiguities resolved:
// - Global-only mode: tokens are stored under _private/youtubeTokens/global/host.
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
  const TARGET_CHANNEL_ID = getEnv('YOUTUBE_CHANNEL_ID'); // fail fast if missing
  const TARGET_USER_ID = getEnv('YOUTUBE_CHANNEL_USER_ID'); // derived from channel id (UC… → …)
  return { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, TARGET_CHANNEL_ID, TARGET_USER_ID };
}

function oauthClient(): OAuth2Client {
  const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = getConfig();
  const o = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  return o;
}

function providerError(e: any): { reason: string; message: string; httpStatus: number | null; code: number | null } {
  return {
    reason: (
      e?.errors?.[0]?.reason ||
      e?.response?.data?.error?.errors?.[0]?.reason ||
      e?.response?.data?.error?.status ||
      ''
    ).toString(),
    message: (e?.message || e?.response?.data?.error?.message || '').toString(),
    httpStatus: typeof e?.response?.status === 'number' ? e.response.status : null,
    code: typeof e?.response?.data?.error?.code === 'number' ? e.response.data.error.code : null,
  };
}

function isAuthLikeError(err: { reason: string; message: string; httpStatus: number | null; code: number | null }): boolean {
  const r = err.reason.toLowerCase();
  const m = err.message.toLowerCase();
  return (
    err.httpStatus === 401 ||
    err.httpStatus === 403 ||
    err.code === 401 ||
    err.code === 403 ||
    r === 'forbidden' ||
    r === 'insufficientpermissions' ||
    r === 'unauthenticated' ||
    r === 'autherror' ||
    r === 'invalid_grant' ||
    m.includes('invalid_grant') ||
    m.includes('unauthorized') ||
    m.includes('insufficient')
  );
}

function isLiveNotEnabledError(err: { reason: string; message: string }): boolean {
  const r = err.reason.toLowerCase();
  const m = err.message.toLowerCase();
  return (
    r === 'livestreamingnotenabled' ||
    r === 'insufficientlivepermissions' ||
    m.includes('not enabled for live streaming') ||
    m.includes('live streaming is not enabled')
  );
}

function isEmbedNotAllowedError(err: { reason: string; message: string }): boolean {
  const r = err.reason.toLowerCase();
  const m = err.message.toLowerCase();
  return (
    r === 'invalidembedsetting' ||
    r === 'forbiddenembedsetting' ||
    r === 'embedsettingnotallowed' ||
    r === 'embednotallowed' ||
    m.includes('cannot embed this broadcast') ||
    m.includes('invalid value for the contentdetails.enable_embed') ||
    m.includes('allow embedding') ||
    m.includes('embedding has been disabled') ||
    m.includes('playback on other websites has been disabled')
  );
}

function mapBroadcastLifecycle(raw: string | null | undefined): Lifecycle {
  const v = (raw || '').toLowerCase();
  if (!v || v === 'created' || v === 'ready') return 'scheduled';
  if (v === 'teststarting' || v === 'testing') return 'testing';
  if (v === 'livestarting' || v === 'live') return 'live';
  if (v === 'complete') return 'complete';
  if (v === 'revoked') return 'canceled';
  return 'error';
}

async function getGlobalTokenDoc() {
  const db = getDbAdmin();
  const ref = db!.collection('_private').doc('youtubeTokens').collection('global').doc('host');
  const snap = await ref.get();
  return { ref, data: snap.exists ? (snap.data() as any) : null };
}

async function getOAuthClientFor(_uid: string): Promise<OAuth2Client> {
  const { TARGET_CHANNEL_ID, TARGET_USER_ID } = getConfig();
  const { data } = await getGlobalTokenDoc();
  if (!data?.refreshToken) throw new Error('youtube_not_connected');
  const chanOk = data.channelId && data.channelId === TARGET_CHANNEL_ID;
  const userOk = data.userId && data.userId === TARGET_USER_ID;
  if (!chanOk || !userOk) throw new Error('youtube_not_connected_global_mismatch');
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
  const { REDIRECT_URI } = getConfig();
  let tokens: any;
  try {
    tokens = (await o.getToken(codeVerifier ? ({ code, codeVerifier, redirect_uri: REDIRECT_URI } as any) : ({ code, redirect_uri: REDIRECT_URI } as any))).tokens;
  } catch (e: any) {
    const msg = (e?.message || '').toString();
    if (/redirect_uri_mismatch/i.test(msg)) throw new Error('redirect_uri_mismatch');
    if (/invalid_grant/i.test(msg)) throw new Error('invalid_grant');
    throw e;
  }
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
  const { TARGET_CHANNEL_ID, TARGET_USER_ID } = getConfig();
  const derivedUserId = channelId?.startsWith('UC') ? channelId.slice(2) : '';
  if (channelId !== TARGET_CHANNEL_ID || (TARGET_USER_ID && derivedUserId !== TARGET_USER_ID)) {
    throw new Error('youtube_not_connected_global_mismatch');
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
    userId: derivedUserId || null,
    connectedBy: uid,
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
  async getBroadcastInfo(uid, broadcastId: string): Promise<{
    lifecycle: string | null;
    boundStreamId: string | null;
    scheduledStartTime: string | null;
  }> {
    try {
      const o = await getOAuthClientFor(uid);
      const yt = google.youtube({ version: 'v3', auth: o });
      const res = await yt.liveBroadcasts.list({ part: ['status', 'contentDetails', 'snippet'], id: [broadcastId] });
      const b = res.data.items?.[0];
      const lifecycle = (b?.status?.lifeCycleStatus || null) as string | null;
      const boundStreamId = (b?.contentDetails as any)?.boundStreamId || null;
      const scheduledStartTime = (b?.snippet?.scheduledStartTime || null) as string | null;
      return { lifecycle, boundStreamId, scheduledStartTime };
    } catch (e: any) {
      const err = providerError(e);
      if (isAuthLikeError(err)) throw new Error('youtube_not_connected');
      throw e;
    }
  },
  async getStreamInfo(uid, streamId: string): Promise<{
    streamStatus: string | null;
    healthStatus: string | null;
  }> {
    try {
      const o = await getOAuthClientFor(uid);
      const yt = google.youtube({ version: 'v3', auth: o });
      const res = await yt.liveStreams.list({ part: ['status'], id: [streamId] });
      const s = res.data.items?.[0];
      const streamStatus = (s?.status?.streamStatus || null) as string | null;
      // @ts-ignore healthStatus may be present depending on channel/stream
      const healthStatus = (s?.status?.healthStatus?.status || null) as string | null;
      return { streamStatus, healthStatus };
    } catch (e: any) {
      const err = providerError(e);
      if (isAuthLikeError(err)) throw new Error('youtube_not_connected');
      throw e;
    }
  },
  async revoke(_uid) {
    const { data, ref } = await getGlobalTokenDoc();
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
      // Always allow embed playback for platform-hosted debates.
      enableEmbed: true,
      monitorStream: { enableMonitorStream: true },
      ...(typeof input.autoStart === 'boolean' ? { enableAutoStart: input.autoStart } : {}),
      ...(typeof input.autoStop === 'boolean' ? { enableAutoStop: input.autoStop } : {}),
    };
    try {
      const res = await yt.liveBroadcasts.insert({
        part: ['snippet', 'status', 'contentDetails'],
        requestBody: { snippet, status, contentDetails, kind: 'youtube#liveBroadcast' },
      });
      const id = res.data.id!;
      let broadcastDetails = (res.data.contentDetails || {}) as youtube_v3.Schema$LiveBroadcastContentDetails;
      const readContentDetails = async (): Promise<youtube_v3.Schema$LiveBroadcastContentDetails> => {
        const verify = await yt.liveBroadcasts.list({ part: ['contentDetails'], id: [id] });
        return (verify.data.items?.[0]?.contentDetails || {}) as youtube_v3.Schema$LiveBroadcastContentDetails;
      };
      const forceEnableEmbed = async (base: youtube_v3.Schema$LiveBroadcastContentDetails) => {
        await yt.liveBroadcasts.update({
          part: ['id', 'contentDetails'],
          requestBody: {
            id,
            contentDetails: {
              ...base,
              enableEmbed: true,
              enableDvr: base.enableDvr ?? (input.allowDvr ?? true),
              monitorStream: base.monitorStream || { enableMonitorStream: true },
              ...(typeof input.autoStart === 'boolean' ? { enableAutoStart: input.autoStart } : {}),
              ...(typeof input.autoStop === 'boolean' ? { enableAutoStop: input.autoStop } : {}),
            },
          },
        });
      };

      // Defensive enforcement: always verify embed policy, even if insert response reports true.
      try {
        if (broadcastDetails.enableEmbed !== true) {
          await forceEnableEmbed(broadcastDetails);
          broadcastDetails = await readContentDetails();
        } else {
          broadcastDetails = await readContentDetails();
          if (broadcastDetails.enableEmbed !== true) {
            await forceEnableEmbed(broadcastDetails);
            broadcastDetails = await readContentDetails();
          }
        }
        if (broadcastDetails.enableEmbed !== true) {
          throw new Error('live_embedding_not_allowed');
        }
      } catch (e: any) {
        const err = providerError(e);
        if (isEmbedNotAllowedError(err) || (e?.message || '').toString() === 'live_embedding_not_allowed') {
          throw new Error('live_embedding_not_allowed');
        }
        throw e;
      }
      return { broadcastId: id, videoId: id };
    } catch (e: any) {
      const err = providerError(e);
      if (isLiveNotEnabledError(err)) {
        throw new Error('live_streaming_not_enabled');
      }
      if (isEmbedNotAllowedError(err)) {
        throw new Error('live_embedding_not_allowed');
      }
      if (isAuthLikeError(err)) {
        throw new Error('youtube_not_connected');
      }
      throw e;
    }
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
      const err = providerError(e);
      if (isLiveNotEnabledError(err)) {
        throw new Error('live_streaming_not_enabled');
      }
      if (isAuthLikeError(err)) {
        throw new Error('youtube_not_connected');
      }
      throw e;
    }
  },
  async bind(uid, broadcastId, streamId) {
    try {
      const o = await getOAuthClientFor(uid);
      const yt = google.youtube({ version: 'v3', auth: o });
      await yt.liveBroadcasts.bind({ part: ['id', 'contentDetails'], id: broadcastId, streamId });
    } catch (e: any) {
      const err = providerError(e);
      if (isLiveNotEnabledError(err)) throw new Error('live_streaming_not_enabled');
      if (isAuthLikeError(err)) throw new Error('youtube_not_connected');
      throw e;
    }
  },
  async transition(uid, broadcastId, to) {
    const o = await getOAuthClientFor(uid);
    const yt = google.youtube({ version: 'v3', auth: o });
    try { console.log(JSON.stringify({ level: 'info', provider: 'youtube', action: 'transition.start', broadcastId, to })); } catch {}
    const mapping: Record<'testing' | 'live' | 'complete' | 'canceled', youtube_v3.Params$Resource$Livebroadcasts$Transition['broadcastStatus']> = {
      testing: 'testing',
      live: 'live',
      complete: 'complete',
      canceled: 'revoked',
    };
    try {
      await yt.liveBroadcasts.transition({ id: broadcastId, part: ['status', 'contentDetails'], broadcastStatus: mapping[to] });
      try { console.log(JSON.stringify({ level: 'info', provider: 'youtube', action: 'transition.ok', broadcastId, to })); } catch {}
    } catch (e: any) {
      const reason = e?.errors?.[0]?.reason || e?.response?.data?.error?.errors?.[0]?.reason || e?.response?.data?.error?.status || '';
      const message = (e?.message || e?.response?.data?.error?.message || '').toString();
      const code = e?.response?.data?.error?.code || e?.response?.status;
      try {
        console.error(JSON.stringify({
          level: 'error', provider: 'youtube', action: 'transition.error',
          broadcastId, to, reason, code, message,
          errors: e?.response?.data?.error?.errors || e?.errors || null,
        }));
      } catch {}
      // Common cases we want to surface as non-500s
      if (reason === 'err||StreamInactive' || reason === 'errorStreamInactive' || message.toLowerCase().includes('stream inactive')) {
        throw new Error('stream_inactive');
      }
      if (reason === 'redundantTransition' || message.toLowerCase().includes('redundant transition')) {
        // Already in the requested lifecycle; treat as idempotent success.
        return;
      }
      if (reason === 'invalidTransition' || message.includes('invalid transition')) {
        throw new Error('invalid_transition');
      }
      if (message.toLowerCase().includes('cannot be transitioned')) {
        throw new Error('invalid_transition');
      }
      if (reason === 'failedPrecondition' || reason === 'FAILED_PRECONDITION' || code === 400) {
        // Many invalid state errors are returned as failedPrecondition/bad request
        throw new Error('invalid_transition');
      }
      if (reason === 'liveStreamNotBound' || message.includes('stream not bound')) {
        throw new Error('stream_not_bound');
      }
      const err = providerError(e);
      if (isLiveNotEnabledError(err)) {
        throw new Error('live_streaming_not_enabled');
      }
      if (isAuthLikeError(err)) {
        throw new Error('youtube_not_connected');
      }
      throw e;
    }
  },
  async getIngest(uid, streamId) {
    try {
      const o = await getOAuthClientFor(uid);
      const yt = google.youtube({ version: 'v3', auth: o });
      const res = await yt.liveStreams.list({ part: ['cdn'], id: [streamId] });
      const s = res.data.items?.[0];
      const ingestAddress =
        s?.cdn?.ingestionInfo?.rtmpsIngestionAddress ||
        s?.cdn?.ingestionInfo?.ingestionAddress ||
        '';
      return {
        ingestAddress,
        streamName: s?.cdn?.ingestionInfo?.streamName || '',
      };
    } catch (e: any) {
      const err = providerError(e);
      if (isAuthLikeError(err)) throw new Error('youtube_not_connected');
      if (err.httpStatus === 404 || err.reason.toLowerCase() === 'notfound') throw new Error('stream_not_found');
      throw e;
    }
  },
  async getStatus(uid, broadcastId) {
    try {
      const o = await getOAuthClientFor(uid);
      const yt = google.youtube({ version: 'v3', auth: o });
      const res = await yt.liveBroadcasts.list({ part: ['status', 'contentDetails'], id: [broadcastId] });
      const b = res.data.items?.[0];
      if (!b) {
        return { lifecycle: 'error', health: 'bad' as const };
      }
      const raw = (b?.status?.lifeCycleStatus || null) as string | null;
      const life = mapBroadcastLifecycle(raw);
      const health: 'good' | 'ok' | 'bad' = 'ok';
      return { lifecycle: life, health };
    } catch (e: any) {
      const err = providerError(e);
      if (isAuthLikeError(err)) throw new Error('youtube_not_connected');
      throw e;
    }
  },
};

// Helper: purge stored credentials without calling Google (used on invalid_grant/unauthorized)
export async function purgeYoutubeCredentials(_uid: string): Promise<void> {
  const db = getDbAdmin();
  if (!db) return;
  const { ref } = await getGlobalTokenDoc();
  await ref.delete();
}

export default youtubeProvider;
