#!/usr/bin/env node
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const API_BASE = 'https://firebaseapphosting.googleapis.com/v1beta';
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const TERMINAL_SUCCESS = new Set(['SUCCEEDED']);
const TERMINAL_FAILURE = new Set(['FAILED', 'CANCELLED']);

function env(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function requiredEnv(name) {
  const value = env(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function parsePositiveInt(name, fallback) {
  const raw = Number(env(name, String(fallback)));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function parseIsoMs(value) {
  if (!value) return 0;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return ms;
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function parseJsonOrThrow(text, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${label}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
  }
}

async function loadServiceAccount() {
  const raw = env('FIREBASE_SERVICE_ACCOUNT');
  if (raw) {
    const sa = parseJsonOrThrow(raw, 'FIREBASE_SERVICE_ACCOUNT');
    validateServiceAccount(sa, 'FIREBASE_SERVICE_ACCOUNT');
    return sa;
  }

  const path = env('GOOGLE_APPLICATION_CREDENTIALS');
  if (path) {
    const file = await readFile(path, 'utf8');
    const sa = parseJsonOrThrow(file, `GOOGLE_APPLICATION_CREDENTIALS (${path})`);
    validateServiceAccount(sa, `GOOGLE_APPLICATION_CREDENTIALS (${path})`);
    return sa;
  }

  throw new Error('Missing Firebase credentials: set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS');
}

function validateServiceAccount(sa, label) {
  if (!sa || typeof sa !== 'object') throw new Error(`${label}: expected object`);
  if (!sa.client_email || !sa.private_key) {
    throw new Error(`${label}: missing client_email/private_key`);
  }
}

function createJwtAssertion(serviceAccount, scope) {
  const tokenUri = String(serviceAccount.token_uri || DEFAULT_TOKEN_URI);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const unsigned = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key, 'base64url');
  return { assertion: `${unsigned}.${signature}`, tokenUri };
}

async function mintAccessToken(serviceAccount, scope = DEFAULT_SCOPE) {
  const { assertion, tokenUri } = createJwtAssertion(serviceAccount, scope);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const resp = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await resp.text();
  const data = text ? parseJsonOrThrow(text, 'OAuth token response') : {};
  if (!resp.ok || !data.access_token) {
    const detail = data?.error_description || data?.error || text || `HTTP ${resp.status}`;
    throw new Error(`Failed to mint OAuth token: ${detail}`);
  }
  return String(data.access_token);
}

async function apiGet(path, accessToken) {
  const url = `${API_BASE}/${path}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  });
  const text = await resp.text();
  const data = text ? parseJsonOrThrow(text, `App Hosting API (${path})`) : {};
  if (!resp.ok) {
    const detail = data?.error?.message || text || `HTTP ${resp.status}`;
    throw new Error(`App Hosting API error (${path}): ${detail}`);
  }
  return data;
}

async function listPaged({ path, field, accessToken, pageSize = 100 }) {
  const items = [];
  let nextPageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (nextPageToken) params.set('pageToken', nextPageToken);
    const payload = await apiGet(`${path}?${params.toString()}`, accessToken);
    if (Array.isArray(payload?.[field])) {
      items.push(...payload[field]);
    }
    nextPageToken = String(payload?.nextPageToken || '');
  } while (nextPageToken);
  return items;
}

function backendIdFromName(name) {
  const parts = String(name || '').split('/');
  return parts[parts.length - 1] || '';
}

function extractBuildErrorMessage(build) {
  const direct = String(build?.error?.message || '').trim();
  if (direct) return direct;
  const entries = Array.isArray(build?.errors) ? build.errors : [];
  for (const entry of entries) {
    const msg = String(entry?.error?.message || '').trim();
    if (msg) return msg;
  }
  return '';
}

async function resolveBackendId({ projectId, location, accessToken, explicit }) {
  if (explicit) return explicit;
  const backends = await listPaged({
    path: `projects/${projectId}/locations/${location}/backends`,
    field: 'backends',
    accessToken,
  });
  if (!backends.length) {
    throw new Error(`No App Hosting backends found in ${projectId}/${location}`);
  }
  if (backends.length > 1) {
    const ids = backends.map((b) => backendIdFromName(b?.name)).filter(Boolean);
    throw new Error(
      `Multiple App Hosting backends found (${ids.join(', ')}). Set APPHOSTING_BACKEND_ID explicitly.`
    );
  }
  return backendIdFromName(backends[0]?.name);
}

async function main() {
  const projectId = requiredEnv('FIREBASE_PROJECT_ID');
  const expectedCommit = requiredEnv('APPHOSTING_EXPECTED_COMMIT').toLowerCase();
  const location = env('APPHOSTING_LOCATION', 'us-central1');
  const explicitBackend = env('APPHOSTING_BACKEND_ID');
  const notBeforeIso = env('APPHOSTING_ROLLOUT_NOT_BEFORE');
  const notBeforeMs = parseIsoMs(notBeforeIso);
  const timeoutSec = parsePositiveInt('APPHOSTING_ROLLOUT_TIMEOUT_SEC', 900);
  const pollSec = parsePositiveInt('APPHOSTING_ROLLOUT_POLL_INTERVAL_SEC', 10);
  const deadlineMs = Date.now() + timeoutSec * 1000;

  const serviceAccount = await loadServiceAccount();
  const accessToken = await mintAccessToken(serviceAccount);
  const backendId = await resolveBackendId({
    projectId,
    location,
    accessToken,
    explicit: explicitBackend,
  });

  console.log(
    `[rollout-check] backend=${backendId} location=${location} expected_commit=${expectedCommit} timeout=${timeoutSec}s`
  );
  if (notBeforeMs) {
    console.log(`[rollout-check] filtering rollouts created at or after ${new Date(notBeforeMs).toISOString()}`);
  }

  const buildCache = new Map();
  let lastState = '';

  while (Date.now() < deadlineMs) {
    const rollouts = await listPaged({
      path: `projects/${projectId}/locations/${location}/backends/${backendId}/rollouts`,
      field: 'rollouts',
      accessToken,
      pageSize: 200,
    });

    const ordered = rollouts
      .map((r) => ({
        ...r,
        _createMs: Number.isFinite(Date.parse(String(r?.createTime || '')))
          ? Date.parse(String(r.createTime))
          : 0,
      }))
      .filter((r) => (notBeforeMs ? r._createMs >= notBeforeMs : true))
      .sort((a, b) => b._createMs - a._createMs);

    let matched = null;

    for (const rollout of ordered.slice(0, 60)) {
      const buildName = String(rollout?.build || '').trim();
      if (!buildName) continue;

      let build = buildCache.get(buildName);
      if (!build) {
        build = await apiGet(buildName, accessToken);
        buildCache.set(buildName, build);
      }

      const hash = String(build?.source?.codebase?.hash || '').toLowerCase();
      if (hash === expectedCommit) {
        matched = { rollout, build };
        break;
      }
    }

    if (!matched) {
      console.log(
        `[rollout-check] waiting: no rollout for commit ${expectedCommit} yet (candidates=${ordered.length})`
      );
      await sleep(pollSec * 1000);
      continue;
    }

    const state = String(matched.rollout?.state || 'UNKNOWN');
    const name = String(matched.rollout?.name || '(unknown)');
    const summary = `${name} state=${state}`;
    if (summary !== lastState) {
      console.log(`[rollout-check] matched ${summary}`);
      lastState = summary;
    }

    if (TERMINAL_SUCCESS.has(state)) {
      console.log(`[rollout-check] success: rollout reached ${state}`);
      return;
    }

    if (TERMINAL_FAILURE.has(state)) {
      const err = extractBuildErrorMessage(matched.build);
      const suffix = err ? ` | build_error=${err}` : '';
      throw new Error(`App Hosting rollout failed: ${summary}${suffix}`);
    }

    await sleep(pollSec * 1000);
  }

  throw new Error(
    `Timeout waiting for App Hosting rollout commit=${expectedCommit}. Last observed=${lastState || 'none'}`
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[rollout-check] ERROR: ${message}`);
  process.exit(1);
});
