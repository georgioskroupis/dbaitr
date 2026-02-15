import type { IdvChallengeResponse, IdvResultResponse } from '@dbaitr/shared/idv';
import { mobileApiFetch, readJsonSafe } from './http/apiFetch';

export async function fetchIdvResult(): Promise<IdvResultResponse | null> {
  const res = await mobileApiFetch('/api/idv/result', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return readJsonSafe<IdvResultResponse>(res);
}

export async function createIdvChallenge(): Promise<IdvChallengeResponse | null> {
  const res = await mobileApiFetch('/api/idv/challenge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return readJsonSafe<IdvChallengeResponse>(res);
}
