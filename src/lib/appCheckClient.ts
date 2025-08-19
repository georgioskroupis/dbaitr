// Optional App Check initialization for client
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from '@/lib/firebase';

export function initAppCheckIfConfigured() {
  try {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {}
}

