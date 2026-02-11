import { getDbAdmin } from '@/lib/firebase/admin';

export type GlobalYoutubeCreds = {
  docPath: string;
  hasRefresh: boolean;
  channelId: string | null;
  userId: string | null;
  requiredChannelId: string | null;
  requiredUserId: string | null;
};

export async function resolveGlobalYoutubeCreds(): Promise<GlobalYoutubeCreds> {
  const db = getDbAdmin();
  const ref = db.collection('_private').doc('youtubeTokens').collection('global').doc('host');
  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as any) : null;
  const requiredChannelId = process.env.YOUTUBE_CHANNEL_ID || null;
  const requiredUserId = process.env.YOUTUBE_CHANNEL_USER_ID || null;
  return {
    docPath: `${ref.parent.parent?.path}/${ref.parent.id}/${ref.id}`,
    hasRefresh: !!data?.refreshToken,
    channelId: data?.channelId || null,
    userId: data?.userId || null,
    requiredChannelId,
    requiredUserId,
  };
}

export default resolveGlobalYoutubeCreds;

