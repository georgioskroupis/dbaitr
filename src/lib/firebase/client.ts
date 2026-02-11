"use client";

// Canonical Firebase client initialization with App Check support
import { initializeApp, getApps, getApp as getAppSdk, type FirebaseApp } from 'firebase/app';
import { getAuth as getAuthSdk, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore as getFirestoreSdk, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage as getStorageSdk, type FirebaseStorage } from 'firebase/storage';
import { getDatabase as getDatabaseSdk, type Database } from 'firebase/database';
import { initializeAppCheck, ReCaptchaV3Provider, getToken, type AppCheck } from 'firebase/app-check';
import { logger } from '@/lib/logger';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let rtdb: Database | undefined;
let appCheck: AppCheck | null = null;

function initApp() {
  if (app) return app;
  const computedDbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com` : undefined);
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    ...(computedDbUrl ? { databaseURL: computedDbUrl } : {}),
  } as const;
  if (getApps().length) {
    app = getAppSdk();
  } else {
    app = initializeApp(cfg);
  }
  auth = getAuthSdk(app);
  // Configure Firestore transport to avoid WebChannel flakiness in dev environments
  try {
    if (!getApps().length) {
      // no-op; handled above
    }
    // If Firestore was not previously initialized, prefer initializeFirestore with long polling
    try {
      // This throws if Firestore already initialized; we guard below
      db = initializeFirestore(app, {
        // Prefer long polling in dev/hot-reload to avoid INTERNAL ASSERTION crashes
        experimentalAutoDetectLongPolling: true,
        // Disable fetch streams; fall back to XHR which is more stable in some dev setups
        // Cast to any to avoid type coupling across SDK minors
        ...(typeof window !== 'undefined' ? ({ useFetchStreams: false } as any) : {}),
      } as any);
    } catch {
      db = getFirestoreSdk(app);
    }
  } catch {
    db = getFirestoreSdk(app);
  }
  storage = getStorageSdk(app);
  try { rtdb = getDatabaseSdk(app); } catch { rtdb = undefined; }
  setPersistence(auth, browserLocalPersistence).catch((e) => {
    logger.error('auth persistence error', e?.code || '', e?.message || e);
  });
  return app;
}

export function getClientApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase client accessed on server. Use Admin SDK.');
  }
  return initApp();
}

export function getAuthClient(): Auth {
  if (!app) initApp();
  if (!auth) throw new Error('Auth not initialized');
  return auth;
}

export function getDbClient(): Firestore {
  if (!app) initApp();
  // Ensure App Check is initialized before Firestore use
  try { ensureAppCheck(); } catch {}
  if (!db) throw new Error('Firestore not initialized');
  return db;
}

export function getStorageClient(): FirebaseStorage {
  if (!app) initApp();
  if (!storage) throw new Error('Storage not initialized');
  return storage;
}

export function getRtdbClient(): Database | undefined {
  if (!app) initApp();
  return rtdb;
}

export function ensureAppCheck(): AppCheck | null {
  if (typeof window === 'undefined') return null;
  try {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) { logger.debug('[AppCheck] site key not configured; skipping init'); return null; }
    if (!app) initApp();
    if (!appCheck) {
      // In development, set a fixed debug token from env (no auto-generate/fallback)
      if (process.env.NODE_ENV !== 'production') {
        try {
          const dbg = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
          if (dbg) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = dbg;
          }
        } catch {}
      }
      // Dev: honor global debug token if present
      appCheck = initializeAppCheck(app!, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      logger.debug('[AppCheck] initialized');
    }
    return appCheck;
  } catch (e) {
    console.warn('[AppCheck] init failed', (e as any)?.message || e);
    return null;
  }
}

export async function getAppCheckToken(force = false): Promise<string | null> {
  try {
    const ac = ensureAppCheck();
    if (!ac) return null;
    const res = await getToken(ac, force).catch((err) => { logger.debug('[AppCheck] getToken error', (err as any)?.message || err); return null; });
    if (res?.token) logger.debug('[AppCheck] token acquired', { len: String(res.token).length, force });
    else logger.debug('[AppCheck] no token', { force });
    return res?.token || null;
  } catch { return null; }
}

export const appClient = {
  getApp: getClientApp,
  getAuth: getAuthClient,
  getDb: getDbClient,
  getStorage: getStorageClient,
  getRtdb: getRtdbClient,
  ensureAppCheck,
  getAppCheckToken,
};

// Back-compat named exports for ergonomics in client code
export const getAuth = getAuthClient;
export const getDb = getDbClient;
export const getApp = getClientApp;
export const getRtdb = getRtdbClient;
