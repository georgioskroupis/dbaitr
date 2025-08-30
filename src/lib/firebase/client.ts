"use client";

// Canonical Firebase client initialization with App Check support
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getDatabase, type Database } from 'firebase/database';
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
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  } as const;
  app = getApps().length ? getApp() : initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  try { rtdb = getDatabase(app); } catch { rtdb = undefined; }
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
    if (!siteKey) return null;
    if (!app) initApp();
    if (!appCheck) {
      // Dev: honor global debug token if present
      appCheck = initializeAppCheck(app!, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
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
    const res = await getToken(ac, force).catch(() => null);
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

