export type Visibility = 'public' | 'unlisted' | 'private';
export type Lifecycle = 'scheduled' | 'testing' | 'live' | 'complete' | 'canceled' | 'error';

export interface VideoProvider {
  connect(uid: string, code: string): Promise<{ channelId: string; channelTitle: string }>;
  revoke(uid: string): Promise<void>;
  createBroadcast(
    uid: string,
    input: {
      title: string;
      description?: string;
      scheduledStartTime?: Date;
      visibility: Visibility;
      allowDvr?: boolean;
      ultraLowLatency?: boolean;
      autoStart?: boolean;
      autoStop?: boolean;
    }
  ): Promise<{ broadcastId: string; videoId: string }>;
  createStream(uid: string, input: { title: string }): Promise<{ streamId: string; ingestAddress: string; streamName: string }>;
  bind(uid: string, broadcastId: string, streamId: string): Promise<void>;
  transition(uid: string, broadcastId: string, to: 'testing' | 'live' | 'complete' | 'canceled'): Promise<void>;
  getIngest(uid: string, streamId: string): Promise<{ ingestAddress: string; streamName: string }>;
  getStatus(uid: string, broadcastId: string): Promise<{ lifecycle: Lifecycle; health: 'good' | 'ok' | 'bad' }>;
}

export function getVideoProvider(): 'youtube' {
  // Future: allow swapping via env. For now, default to YouTube only.
  const p = (process.env.VIDEO_PROVIDER || 'youtube').toLowerCase();
  return p as 'youtube';
}

