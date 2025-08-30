import { getAppCheckToken } from '@/lib/firebase/client';

export async function withAppCheckHeaders(init?: RequestInit): Promise<RequestInit> {
  const token = await getAppCheckToken().catch(()=>null);
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('X-Firebase-AppCheck', token);
  return { ...(init || {}), headers };
}

