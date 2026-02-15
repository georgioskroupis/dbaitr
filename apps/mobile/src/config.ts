const DEFAULT_API_BASE = 'https://dbaitr.com';

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && /^https?:\/\//.test(envUrl)) return envUrl;
  return DEFAULT_API_BASE;
}
