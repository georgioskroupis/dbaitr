"use client";

// Optional App Check initialization for client
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import type { AppCheck } from 'firebase/app-check';
import { getClientApp } from '@/lib/firebase/client';

let appCheckInstance: AppCheck | null = null;

export function getAppCheckInstance(): AppCheck | null {
  return appCheckInstance;
}

export function initAppCheckIfConfigured() {
  try {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;

    // In development, set a fixed debug token from env (no auto-generate/fallback)
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      const dbg = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
      if (dbg) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = dbg;
      }
    }

    if (!appCheckInstance && typeof window !== 'undefined') {
      const app = getClientApp();
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
