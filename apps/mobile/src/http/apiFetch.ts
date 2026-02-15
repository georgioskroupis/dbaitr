import { getApiBaseUrl } from '../config';
import { getCurrentIdToken, getNativeAppCheckToken } from '../firebase/native';

type MobileApiFetchOptions = RequestInit & {
  allowAnonymous?: boolean;
};

function resolveUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  const base = getApiBaseUrl();
  const path = input.startsWith('/') ? input : `/${input}`;
  return `${base}${path}`;
}

function setHeader(headers: Headers, key: string, value: string) {
  headers.set(key, value);
}

async function buildAuthHeaders(headers: Headers, force = false) {
  const appCheck = await getNativeAppCheckToken(force);
  if (appCheck) setHeader(headers, 'X-Firebase-AppCheck', appCheck);

  const idToken = await getCurrentIdToken(force);
  if (idToken) setHeader(headers, 'Authorization', `Bearer ${idToken}`);

  return {
    hasAppCheck: !!appCheck,
    hasIdToken: !!idToken,
  };
}

export async function mobileApiFetch(input: string, init?: MobileApiFetchOptions): Promise<Response> {
  const options = init || {};
  const headers = new Headers(options.headers || {});
  const allowAnonymous = options.allowAnonymous === true;

  const first = await buildAuthHeaders(headers, false);
  if (!first.hasAppCheck) {
    const error = new Error('Missing App Check token');
    // @ts-expect-error Runtime code for caller classification
    error.code = 'unauthenticated_appcheck';
    throw error;
  }
  if (!allowAnonymous && !first.hasIdToken) {
    const error = new Error('Missing auth token');
    // @ts-expect-error Runtime code for caller classification
    error.code = 'unauthenticated';
    throw error;
  }

  const requestInit: RequestInit = { ...options, headers };
  const targetUrl = resolveUrl(input);
  const res = await fetch(targetUrl, requestInit);
  if (res.status !== 401) return res;

  const retryHeaders = new Headers(options.headers || {});
  const retry = await buildAuthHeaders(retryHeaders, true);
  if (!retry.hasAppCheck) return res;
  if (!allowAnonymous && !retry.hasIdToken) return res;

  return fetch(targetUrl, { ...options, headers: retryHeaders });
}

export async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
