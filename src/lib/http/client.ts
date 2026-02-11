"use client";

import { getAppCheckToken } from '@/lib/firebase/client';
import { getAuth } from '@/lib/firebase/client';
import type { IdTokenResult } from 'firebase/auth';

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
  const user = (() => { try { return getAuth().currentUser; } catch { return null; } })();
  const { token: idToken, source: idSource } = await getStableIdToken(user, opts.allowAnonymous === true);
  if (idToken) setHeader(headers, 'Authorization', `Bearer ${idToken}`);
  if (!user && !idToken && !opts.allowAnonymous) {
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
      idTokenSource: idSource,
    });
  }

  const finalInit: RequestInit = { ...opts, headers };
  const res = await fetch(input, finalInit);
  if (res.status === 401 && user) {
    // Force-refresh ID token once and retry a single time
    await forceRefreshIdToken(user);
    const retryHeaders = new Headers(opts.headers || {});
    if (appCheckToken) setHeader(retryHeaders, 'X-Firebase-AppCheck', appCheckToken);
    const fresh = await getStableIdToken(user, false, /*force*/ true);
    if (fresh.token) setHeader(retryHeaders, 'Authorization', `Bearer ${fresh.token}`);
    const retryInit: RequestInit = { ...opts, headers: retryHeaders };
    return fetch(input, retryInit);
  }
  return res;
}

// No globals exposed

// --------------------
// ID token stable cache (memory-only)

let cachedIdToken: string | null = null;
let cachedExpMs = 0;
let refreshingPromise: Promise<void> | null = null;
let claimsBCSetup = false;

function nowMs() { return Date.now(); }

function markTokenStale() {
  cachedIdToken = null;
  cachedExpMs = 0;
}

function setupClaimsBroadcastListener() {
  if (claimsBCSetup || typeof window === 'undefined') return;
  try {
    const bc = new BroadcastChannel('authz');
    bc.onmessage = (ev) => {
      if (ev?.data?.type === 'claimsChanged') markTokenStale();
    };
    claimsBCSetup = true;
  } catch {}
}

async function singleFlightRefresh(user: NonNullable<ReturnType<typeof getAuth>['currentUser']>) {
  if (refreshingPromise) return refreshingPromise;
  refreshingPromise = (async () => {
    try {
      const res: IdTokenResult = await user.getIdTokenResult(true);
      cachedIdToken = res.token;
      cachedExpMs = new Date(res.expirationTime).getTime();
    } finally {
      refreshingPromise = null;
    }
  })();
  return refreshingPromise;
}

async function getStableIdToken(
  user: ReturnType<typeof getAuth>['currentUser'],
  allowAnonymous: boolean,
  force?: boolean,
): Promise<{ token: string | null; source: 'cached' | 'refreshed' | 'anon' | 'none' }> {
  setupClaimsBroadcastListener();
  if (!user) return { token: allowAnonymous ? null : null, source: allowAnonymous ? 'anon' : 'none' };
  const thresholdMs = 120 * 1000; // 2 minutes
  const now = nowMs();
  if (force) {
    await singleFlightRefresh(user);
    return { token: cachedIdToken, source: 'refreshed' };
  }
  if (cachedIdToken && cachedExpMs - now > thresholdMs) {
    return { token: cachedIdToken, source: 'cached' };
  }
  // No cached or near expiry → refresh without forcing server verification if possible
  try {
    const res: IdTokenResult = await user.getIdTokenResult();
    cachedIdToken = res.token;
    cachedExpMs = new Date(res.expirationTime).getTime();
    const stillFresh = cachedExpMs - now > thresholdMs;
    if (!stillFresh) {
      await singleFlightRefresh(user);
      return { token: cachedIdToken, source: 'refreshed' };
    }
    return { token: cachedIdToken, source: 'cached' };
  } catch {
    await singleFlightRefresh(user);
    return { token: cachedIdToken, source: 'refreshed' };
  }
}

async function forceRefreshIdToken(user: NonNullable<ReturnType<typeof getAuth>['currentUser']>) {
  await singleFlightRefresh(user);
}
