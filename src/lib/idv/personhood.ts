import crypto from 'node:crypto';

const DEV_DEDUP_SECRET = 'dev-only-change-idv-dedup-secret';
const DEV_FAKE_NULLIFIER_PREFIX = 'dev-fake-nullifier:';
const MAX_CHALLENGE_LENGTH = 512;
const MAX_NULLIFIER_LENGTH = 512;

export type VerificationFailureReason =
  | 'invalid_proof'
  | 'verification_failed'
  | 'verification_unavailable';

export type SelfVerificationResult =
  | {
      ok: true;
      nullifier: string;
      assuranceLevel: string | null;
      attestationType: string | null;
    }
  | {
      ok: false;
      reason: VerificationFailureReason;
    };

export type StartSessionResult = {
  verificationUrl: string | null;
  sessionId: string | null;
};

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function isLikelyUrl(value: string): boolean {
  if (!value) return false;
  return value.startsWith('https://') || value.startsWith('http://');
}

function normalizeFailureReason(value: unknown): VerificationFailureReason {
  const raw = asString(value).toLowerCase();
  if (raw === 'invalid_proof' || raw === 'challenge_mismatch' || raw === 'proof_invalid') {
    return 'invalid_proof';
  }
  if (
    raw === 'verification_unavailable' ||
    raw === 'provider_unavailable' ||
    raw === 'timeout' ||
    raw === 'network_error'
  ) {
    return 'verification_unavailable';
  }
  return 'verification_failed';
}

export function hashChallenge(challenge: string): string {
  return crypto.createHash('sha256').update(challenge).digest('hex');
}

export function normalizeNullifier(value: unknown): string | null {
  const v = asString(value);
  if (!v || v.length > MAX_NULLIFIER_LENGTH) return null;
  // Accept conservative token-like payloads to avoid parsing ambiguous data blobs.
  if (!/^[a-zA-Z0-9:_\-./+=]+$/.test(v)) return null;
  return v;
}

export function hashNullifierForDedup(nullifier: string): string {
  const envSecret = asString(process.env.IDV_DEDUP_HMAC_SECRET);
  const secret = envSecret || (process.env.NODE_ENV !== 'production' ? DEV_DEDUP_SECRET : '');
  if (!secret) {
    throw new Error('missing_dedup_secret');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`self_openpassport:${nullifier}`)
    .digest('hex');
}

export async function startSelfVerificationSession(input: {
  uid: string;
  challengeId: string;
  challenge: string;
  expiresAtMs: number;
}): Promise<StartSessionResult> {
  const startUrl = asString(process.env.IDV_SELF_START_URL);
  if (!startUrl || !isLikelyUrl(startUrl)) {
    return { verificationUrl: null, sessionId: null };
  }
  if (process.env.NODE_ENV === 'production' && !startUrl.startsWith('https://')) {
    return { verificationUrl: null, sessionId: null };
  }

  const timeoutRaw = Number(process.env.IDV_SELF_START_TIMEOUT_MS || 10000);
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const key = asString(process.env.IDV_SELF_VERIFY_API_KEY);
    if (key) headers['X-Idv-Api-Key'] = key;

    const resp = await fetch(startUrl, {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify(input),
    }).catch(() => null);

    if (!resp || !resp.ok) return { verificationUrl: null, sessionId: null };

    const data = await resp.json().catch(() => ({}));
    const verificationUrl = asString(data?.verificationUrl || data?.url || data?.startUrl || '');
    const sessionId = asString(data?.sessionId || data?.id || '');

    return {
      verificationUrl: isLikelyUrl(verificationUrl) ? verificationUrl : null,
      sessionId: sessionId || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifySelfProof(input: {
  uid: string;
  challengeId: string;
  challenge: string;
  proof: unknown;
}): Promise<SelfVerificationResult> {
  const verifyUrl = asString(process.env.IDV_SELF_VERIFY_URL);
  if (!verifyUrl || !isLikelyUrl(verifyUrl)) {
    if (process.env.NODE_ENV !== 'production' && process.env.IDV_DEV_FAKE_APPROVE === 'true') {
      const proofObj =
        input.proof && typeof input.proof === 'object' && !Array.isArray(input.proof)
          ? (input.proof as Record<string, unknown>)
          : {};
      const provided = normalizeNullifier(proofObj.nullifier);
      const fallback = normalizeNullifier(`${DEV_FAKE_NULLIFIER_PREFIX}${input.uid}`);
      const nullifier = provided || fallback;
      if (!nullifier) return { ok: false, reason: 'invalid_proof' };
      return {
        ok: true,
        nullifier,
        assuranceLevel: 'dev',
        attestationType: 'dev_fake',
      };
    }
    return { ok: false, reason: 'verification_unavailable' };
  }

  if (process.env.NODE_ENV === 'production' && !verifyUrl.startsWith('https://')) {
    return { ok: false, reason: 'verification_unavailable' };
  }

  const timeoutRaw = Number(process.env.IDV_SELF_VERIFY_TIMEOUT_MS || 15000);
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const key = asString(process.env.IDV_SELF_VERIFY_API_KEY);
    if (key) headers['X-Idv-Api-Key'] = key;

    const payload = {
      uid: input.uid,
      challengeId: input.challengeId,
      challenge: input.challenge,
      proof: input.proof,
    };

    const resp = await fetch(verifyUrl, {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!resp) return { ok: false, reason: 'verification_unavailable' };

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, reason: normalizeFailureReason(data?.reason || data?.error) };
    }

    const verified = !!(data?.verified ?? data?.ok);
    if (!verified) {
      return { ok: false, reason: normalizeFailureReason(data?.reason || data?.error) };
    }

    const nullifier = normalizeNullifier(data?.nullifier || data?.nullifierHash || data?.nullifier_hash);
    if (!nullifier) return { ok: false, reason: 'invalid_proof' };

    const assuranceLevel = asString(data?.assuranceLevel || data?.assurance_level || '') || null;
    const attestationType = asString(data?.attestationType || data?.attestation_type || '') || null;
    return { ok: true, nullifier, assuranceLevel, attestationType };
  } catch {
    return { ok: false, reason: 'verification_unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeChallenge(value: unknown): string | null {
  const v = asString(value);
  if (!v || v.length > MAX_CHALLENGE_LENGTH) return null;
  if (!/^[a-zA-Z0-9:_\-./+=]+$/.test(v)) return null;
  return v;
}

export function normalizeChallengeId(value: unknown): string | null {
  const v = asString(value);
  if (!v || v.length > 128) return null;
  if (!/^[a-zA-Z0-9-]+$/.test(v)) return null;
  return v;
}
