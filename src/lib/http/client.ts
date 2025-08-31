"use client";

import { getAppCheckToken } from '@/lib/firebase/client';
import { getAuth } from '@/lib/firebase/client';

type ApiFetchOptions = RequestInit & { allowAnonymous?: boolean };

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function setHeader(headers: Headers, key: string, value: string) {
  if (!headers.has(key)) headers.set(key, value);
  else headers.set(key, value);
}

export async function apiFetch(input: RequestInfo | URL, init?: ApiFetchOptions) {
  const opts = init || {};
  const headers = new Headers(opts.headers || {});

  // App Check: try once, then retry once if needed
  let appCheckToken: string | null = null;
  try { appCheckToken = await getAppCheckToken(); } catch { appCheckToken = null; }
  if (!appCheckToken) {
    await sleep(150);
    try { appCheckToken = await getAppCheckToken(true); } catch { appCheckToken = null; }
  }
  if (appCheckToken) setHeader(headers, 'X-Firebase-AppCheck', appCheckToken);

  // ID token: required unless allowAnonymous is true
  let idToken: string | null = null;
  const user = (() => { try { return getAuth().currentUser; } catch { return null; } })();

  if (user) {
    try { idToken = await user.getIdToken(true); } catch { idToken = null; }
    if (!idToken) {
      await sleep(150);
      try { idToken = await user.getIdToken(true); } catch { idToken = null; }
    }
    if (idToken) setHeader(headers, 'Authorization', `Bearer ${idToken}`);
  } else if (!opts.allowAnonymous) {
    const err = new Error('Unauthenticated: ID token required');
    // @ts-expect-error add code for typed handling
    err.code = 'unauthenticated';
    throw err;
  }

  if (process.env.NODE_ENV !== 'production') {
    const mask = (t: string | null) => (t ? `${t.slice(0, 6)}…${t.slice(-6)}` : 'null');
    // eslint-disable-next-line no-console
    console.debug('[apiFetch] headers', {
      appCheck: appCheckToken ? mask(appCheckToken) : 'none',
      idToken: idToken ? mask(idToken) : (opts.allowAnonymous ? 'anon' : 'none'),
    });
  }

  const finalInit: RequestInit = { ...opts, headers };
  return fetch(input, finalInit);
}

// No globals exposed
