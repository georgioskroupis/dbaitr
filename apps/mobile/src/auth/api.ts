import type { BootstrapResponse, CheckEmailResponse, MeResponse } from '@dbaitr/shared/auth';
import { mobileApiFetch, readJsonSafe } from '../http/apiFetch';

export async function checkEmailExists(email: string): Promise<CheckEmailResponse | null> {
  const res = await mobileApiFetch('/api/auth/check-email', {
    method: 'POST',
    allowAnonymous: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return readJsonSafe<CheckEmailResponse>(res);
}

export async function bootstrapUser(fullName?: string): Promise<BootstrapResponse | null> {
  const body = fullName ? JSON.stringify({ fullName }) : '{}';
  const res = await mobileApiFetch('/api/users/bootstrap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  return readJsonSafe<BootstrapResponse>(res);
}

export async function fetchCurrentProfile(): Promise<MeResponse | null> {
  const res = await mobileApiFetch('/api/users/me', {
    method: 'GET',
  });
  return readJsonSafe<MeResponse>(res);
}
