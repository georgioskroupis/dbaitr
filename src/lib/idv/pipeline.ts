export type VerificationChallenge = {
  provider: string;
  challengeId: string;
  challenge: string;
  expiresAtMs: number;
  verificationUrl?: string | null;
  sessionId?: string | null;
};

export type VerifyResult = {
  approved: boolean;
  reason?: string | null;
  provider?: string | null;
};

export async function createVerificationChallenge(): Promise<{
  ok: boolean;
  challenge?: VerificationChallenge;
  reason?: string;
}> {
  try {
    const { apiFetch } = await import('@/lib/http/client');
    const resp = await apiFetch('/api/idv/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      return { ok: false, reason: data?.error || 'server_error' };
    }
    return {
      ok: true,
      challenge: {
        provider: String(data?.provider || 'self_openpassport'),
        challengeId: String(data?.challengeId || ''),
        challenge: String(data?.challenge || ''),
        expiresAtMs: Number(data?.expiresAtMs || 0),
        verificationUrl: data?.verificationUrl || null,
        sessionId: data?.sessionId || null,
      },
    };
  } catch {
    return { ok: false, reason: 'server_error' };
  }
}

export async function submitVerificationProof(input: {
  challengeId: string;
  challenge: string;
  proof: unknown;
}): Promise<VerifyResult> {
  try {
    const { apiFetch } = await import('@/lib/http/client');
    const resp = await apiFetch('/api/idv/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await resp.json().catch(() => ({}));
    return {
      approved: !!data?.approved,
      reason: data?.reason || (resp.ok ? null : 'server_error'),
      provider: data?.provider || null,
    };
  } catch {
    return { approved: false, reason: 'server_error', provider: null };
  }
}

export async function getVerificationResult(): Promise<{
  approved: boolean;
  reason?: string | null;
  provider?: string | null;
  verifiedAt?: string | null;
}> {
  try {
    const { apiFetch } = await import('@/lib/http/client');
    const resp = await apiFetch('/api/idv/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await resp.json().catch(() => ({}));
    return {
      approved: !!data?.approved,
      reason: data?.reason || null,
      provider: data?.provider || null,
      verifiedAt: data?.verifiedAt || null,
    };
  } catch {
    return { approved: false, reason: 'server_error', provider: null, verifiedAt: null };
  }
}
