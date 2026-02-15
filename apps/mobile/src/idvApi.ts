import type { IdvChallengeResponse, IdvResultResponse } from '@dbaitr/shared/idv';
import { getApiBaseUrl } from './config';

export async function fetchIdvResult(idToken: string): Promise<IdvResultResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/idv/result`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  return (await res.json()) as IdvResultResponse;
}

export async function createIdvChallenge(idToken: string): Promise<IdvChallengeResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/idv/challenge`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  return (await res.json()) as IdvChallengeResponse;
}
