import crypto from 'node:crypto';
import express from 'express';
import { AllIds, DefaultConfigStore, SelfBackendVerifier } from '@selfxyz/core';
import { SelfAppBuilder, getUniversalLink } from '@selfxyz/qrcode';

const app = express();
app.use(express.json({ limit: '2mb' }));

function asString(v) {
  return String(v ?? '').trim();
}

function asBool(v, fallback = false) {
  const raw = asString(v).toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function asInt(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function ensureApiKey(req, res, next) {
  const expected = asString(process.env.IDV_SHARED_API_KEY);
  if (!expected) {
    return res.status(503).json({ ok: false, reason: 'misconfigured_api_key' });
  }
  const provided = asString(req.header('x-idv-api-key') || req.header('X-Idv-Api-Key'));
  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, reason: 'unauthorized' });
  }
  next();
}

const SELF_SCOPE_SEED = asString(process.env.SELF_SCOPE_SEED || 'dbaitr-human-v1');
const PUBLIC_APP_URL = asString(process.env.PUBLIC_APP_URL || 'https://dbaitr.com').replace(/\/+$/, '');
const SELF_ENDPOINT = asString(process.env.SELF_ENDPOINT || `${PUBLIC_APP_URL}/api/idv/relay`);
const SELF_ENDPOINT_TYPE = asString(process.env.SELF_ENDPOINT_TYPE || 'https');
const SELF_APP_NAME = asString(process.env.SELF_APP_NAME || 'dbaitr');
const SELF_APP_LOGO_URL = asString(process.env.SELF_APP_LOGO_URL || 'https://dbaitr.com/logo.png');
const SELF_MOCK_PASSPORT = asBool(process.env.SELF_MOCK_PASSPORT, false);
const SELF_MINIMUM_AGE = asInt(process.env.SELF_MINIMUM_AGE, 18);
const SELF_EXCLUDED_COUNTRIES = asString(process.env.SELF_EXCLUDED_COUNTRIES)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);
const SELF_OFAC = asBool(process.env.SELF_OFAC, false);

const verifier = new SelfBackendVerifier(
  SELF_SCOPE_SEED,
  SELF_ENDPOINT,
  SELF_MOCK_PASSPORT,
  AllIds,
  new DefaultConfigStore({
    minimumAge: SELF_MINIMUM_AGE,
    excludedCountries: SELF_EXCLUDED_COUNTRIES,
    ofac: SELF_OFAC,
  }),
  'hex'
);

function encodeContext({ challengeId, challenge }) {
  const payload = {
    v: 1,
    cid: challengeId,
    c: challenge,
    ts: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeContext(raw) {
  const direct = asString(raw);
  if (!direct) return { challengeId: null, challenge: null, userDefinedData: '' };
  try {
    const parsed = JSON.parse(direct);
    const challengeId = asString(parsed?.challengeId || parsed?.cid);
    const challenge = asString(parsed?.challenge || parsed?.c);
    if (challengeId && challenge) return { challengeId, challenge, userDefinedData: direct };
  } catch {}
  try {
    const decoded = Buffer.from(direct, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    const challengeId = asString(parsed?.challengeId || parsed?.cid);
    const challenge = asString(parsed?.challenge || parsed?.c);
    if (challengeId && challenge) return { challengeId, challenge, userDefinedData: direct };
  } catch {}
  return { challengeId: null, challenge: null, userDefinedData: direct };
}

function extractPayload(body) {
  const top = body && typeof body === 'object' ? body : {};
  const nestedProof =
    top.proof && typeof top.proof === 'object' && !Array.isArray(top.proof)
      ? top.proof
      : top.payload && typeof top.payload === 'object' && !Array.isArray(top.payload)
        ? top.payload
        : null;

  const source = nestedProof || top;
  return {
    attestationId: source?.attestationId,
    proof: source?.proof,
    publicSignals: source?.publicSignals,
    userContextData: source?.userContextData,
    expectedChallengeId: asString(top.challengeId || ''),
    expectedChallenge: asString(top.challenge || ''),
  };
}

function uidToHex(uid) {
  const digest = crypto.createHash('sha256').update(uid).digest('hex');
  return `0x${digest.slice(0, 40)}`;
}

function extractNullifier(result, requestPayload) {
  const candidates = [
    result?.discloseOutput?.nullifier,
    result?.nullifier,
    requestPayload?.nullifier,
  ];
  for (const v of candidates) {
    const s = asString(v);
    if (s) return s;
  }
  return '';
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, route: 'idv-self-health' });
});

app.post('/start', ensureApiKey, (req, res) => {
  try {
    const uid = asString(req.body?.uid);
    const challengeId = asString(req.body?.challengeId);
    const challenge = asString(req.body?.challenge);
    if (!uid || !challengeId || !challenge) {
      return res.status(400).json({ ok: false, reason: 'invalid_challenge' });
    }

    const userId = uidToHex(uid);
    const userDefinedData = encodeContext({ challengeId, challenge });

    const selfApp = new SelfAppBuilder({
      version: 2,
      appName: SELF_APP_NAME,
      scope: SELF_SCOPE_SEED,
      endpoint: SELF_ENDPOINT,
      endpointType: SELF_ENDPOINT_TYPE,
      logoBase64: SELF_APP_LOGO_URL,
      userId,
      userIdType: 'hex',
      userDefinedData,
      disclosures: {
        minimumAge: SELF_MINIMUM_AGE,
        excludedCountries: SELF_EXCLUDED_COUNTRIES,
        ofac: SELF_OFAC,
      },
    }).build();

    const verificationUrl = getUniversalLink(selfApp);
    return res.json({ ok: true, verificationUrl, sessionId: challengeId });
  } catch (error) {
    return res.status(500).json({ ok: false, reason: 'server_error' });
  }
});

app.post('/verify', ensureApiKey, async (req, res) => {
  try {
    const payload = extractPayload(req.body);
    if (!payload.attestationId || !payload.proof || !payload.publicSignals || !payload.userContextData) {
      return res.status(400).json({ verified: false, reason: 'invalid_payload' });
    }

    const result = await verifier.verify(
      payload.attestationId,
      payload.proof,
      payload.publicSignals,
      payload.userContextData
    );

    if (!result?.isValidDetails?.isValid) {
      return res.status(400).json({ verified: false, reason: 'invalid_proof' });
    }

    const nullifier = extractNullifier(result, req.body?.proof);
    if (!nullifier) {
      return res.status(400).json({ verified: false, reason: 'invalid_proof' });
    }

    const decoded = decodeContext(result?.userData?.userDefinedData);
    const challengeId = decoded.challengeId;
    const challenge = decoded.challenge;
    if (!challengeId || !challenge) {
      return res.status(400).json({ verified: false, reason: 'invalid_challenge' });
    }

    if (
      (payload.expectedChallengeId && payload.expectedChallengeId !== challengeId) ||
      (payload.expectedChallenge && payload.expectedChallenge !== challenge)
    ) {
      return res.status(400).json({ verified: false, reason: 'invalid_challenge' });
    }

    return res.json({
      verified: true,
      nullifier,
      assuranceLevel: SELF_MINIMUM_AGE > 0 ? `minimum_age_${SELF_MINIMUM_AGE}` : 'default',
      attestationType: String(payload.attestationId || ''),
      challengeId,
      challenge,
      userDefinedData: decoded.userDefinedData,
    });
  } catch (error) {
    return res.status(503).json({ verified: false, reason: 'verification_unavailable' });
  }
});

const port = asInt(process.env.PORT, 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'idv_self_service_started',
      port,
      scope: SELF_SCOPE_SEED,
      endpoint: SELF_ENDPOINT,
      endpointType: SELF_ENDPOINT_TYPE,
      mockPassport: SELF_MOCK_PASSPORT,
    })
  );
});
