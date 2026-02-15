const DEFAULT_API_BASE = 'https://dbaitr.com';

function normalizeApiBaseUrl(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_API_BASE;
  if (!/^https?:\/\//i.test(raw)) return DEFAULT_API_BASE;
  return raw.replace(/\/$/, '');
}

export interface MobileEnv {
  apiBaseUrl: string;
  appCheckDebugToken: string | null;
}

export function getMobileEnv(): MobileEnv {
  const appCheckDebugToken = String(process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN || '').trim() || null;
  return {
    apiBaseUrl: normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
    appCheckDebugToken,
  };
}
