"use client";

// Optional App Check initialization for client
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import type { AppCheck } from 'firebase/app-check';
import { app } from '@/lib/firebase';

const DEBUG_TOKEN_STORAGE_KEY = 'DB8_APPCHECK_DEBUG_TOKEN';
const V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let appCheckInstance: AppCheck | null = null;

export function getAppCheckInstance(): AppCheck | null {
  return appCheckInstance;
}

export function initAppCheckIfConfigured() {
  try {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;

    // In development, enable App Check debug token and persist it for reuse.
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      try {
        let token = localStorage.getItem(DEBUG_TOKEN_STORAGE_KEY) || '';
        // If existing token is not a valid v4 UUID, discard it
        if (!token || !V4_RE.test(token)) {
          const uuid = globalThis.crypto?.randomUUID?.();
          if (uuid && V4_RE.test(uuid)) {
            token = uuid;
            localStorage.setItem(DEBUG_TOKEN_STORAGE_KEY, token);
          } else {
            // As a fallback, let SDK generate and print one to console
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
          }
        }
        if (token && V4_RE.test(token)) {
          // Set the global debug token before initializing App Check.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = token;
        }
      } catch {
        // Swallow errors; App Check will still initialize without debug token.
      }
    }

    if (!appCheckInstance) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[AppCheck] init skipped or failed:', (e as any)?.message || e);
  }
}
