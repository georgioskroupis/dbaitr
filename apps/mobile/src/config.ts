import { getMobileEnv } from './env';

export function getApiBaseUrl(): string {
  return getMobileEnv().apiBaseUrl;
}
