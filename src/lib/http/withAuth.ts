import { NextResponse } from 'next/server';
import { verifyAppCheckStrict, verifyIdTokenStrict, HttpError } from '@/lib/authz/verify';
import type { Role, Status, CapabilityKey, ClaimsShape } from '@/lib/authz/types';
import { hasCapability } from '@/lib/authz/types';

type Ctx = { uid: string; role?: Role; status?: Status; kycVerified: boolean; claims?: ClaimsShape } | undefined;
type RouteCtx = { params?: any } | undefined;
type Handler = (req: Request, ctx?: (NonNullable<Ctx> & { params?: any }) | { params?: any }) => Promise<Response>;

function json(status: number, body: any) { return new NextResponse(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }

type RateLimitOpts = { userPerMin?: number; ipPerMin?: number };
export function withAuth(handler: Handler, opts?: { minRole?: Role; allowedStatus?: Status[]; public?: boolean; capability?: CapabilityKey; rateLimit?: RateLimitOpts; idempotent?: boolean }) {
  // Next 15 passes (req, ctx?) where ctx.params may be a Promise
  return async function (req: Request, ctx?: RouteCtx): Promise<Response> {
    const t0 = Date.now();
    const rid = Math.random().toString(36).slice(2);
    const route = (() => { try { const u = new URL(req.url); return u.pathname; } catch { return 'unknown'; } })();
    if (process.env.NODE_ENV !== 'production') {
      try { console.error('[withAuth] entry', { requestId: rid, route }); } catch {}
    }
    // Resolve params if provided and may be a promise
    let paramsResolved: any = undefined;
    try {
      const p = (ctx as any)?.params;
      paramsResolved = p && typeof p.then === 'function' ? await p : p;
    } catch { paramsResolved = undefined; }
    // Debug-only snapshot of identity to include in denial logs
    let dbgUid: string | null = null;
    let dbgClaims: any = null;
    try {
      await verifyAppCheckStrict(req);
      // Public endpoints: apply IP rate limits after App Check
      if (opts?.public) {
        const ipOk = await rateLimitOkPublic(req, opts?.rateLimit);
        if (!ipOk) {
          await write429Diag(rid, route, 'ip');
          try { console.warn(JSON.stringify({ level: 'warn', requestId: rid, route, error: 'rate_limited', subject: 'ip', latency_ms: Date.now() - t0 })); } catch {}
          return json(429, { ok: false, error: 'rate_limited', requestId: rid });
        }
        const res = await handler(req, { params: paramsResolved });
        return res instanceof Response ? res : (res || json(200, { ok: true }));
      }
      const { uid, claims } = await verifyIdTokenStrict(req);
      dbgUid = uid;
      dbgClaims = claims;
      if (opts?.capability && !hasCapability(claims.role as Role | undefined, opts.capability)) {
        throw new HttpError(403, 'forbidden');
      }
      // Role gate with normalized hierarchy
      if (opts?.minRole) {
        const rank: Record<string, number> = {
          'restricted': 0,
          'viewer': 1,
          'supporter': 2,
          'moderator': 3,
          'admin': 4,
          'super-admin': 5,
        };
        const haveRole = (claims.role as string | undefined) || '';
        const haveRank = rank[haveRole] ?? -1;
        const needRank = rank[String(opts.minRole)] ?? 999;
        if (!(haveRank >= needRank)) {
          if (process.env.NODE_ENV !== 'production') {
            try { console.error(`[withAuth] deny role: have=${haveRole || 'none'}, rank=${haveRank} need>=${needRank} requestId=${rid}`); } catch {}
          }
          throw new HttpError(403, 'forbidden');
        }
      }
      // Status gate, case-insensitive
      if (opts?.allowedStatus && opts.allowedStatus.length) {
        const have = ((claims.status as string | undefined) || '').toLowerCase();
        const allowed = opts.allowedStatus.map(s => String(s).toLowerCase());
        if (have === 'suspended') {
          if (process.env.NODE_ENV !== 'production') {
            try { console.error(`[withAuth] deny status: have=${claims.status || 'none'} needAny=${allowed.join('|')} requestId=${rid}`); } catch {}
          }
          throw new HttpError(423, 'locked');
        }
        if (!allowed.includes(have)) {
          if (process.env.NODE_ENV !== 'production') {
            try { console.error(`[withAuth] deny status: have=${claims.status || 'none'} needAny=${allowed.join('|')} requestId=${rid}`); } catch {}
          }
          throw new HttpError(403, 'forbidden');
        }
      }
      // Per-route user/IP rate limiting
      const rlOk = await rateLimitOkProtected(req, uid, opts?.rateLimit);
      if (!rlOk) {
        await write429Diag(rid, route, uid);
        try { console.warn(JSON.stringify({ level: 'warn', requestId: rid, route, error: 'rate_limited', subject: uid, latency_ms: Date.now() - t0 })); } catch {}
        return json(429, { ok: false, error: 'rate_limited', requestId: rid });
      }
      // Idempotency for protected endpoints
      const idemKey = req.headers.get('x-idempotency-key') || req.headers.get('X-Idempotency-Key');
      if (opts?.idempotent && idemKey) {
        const prior = await idemLoad(route, uid, String(idemKey));
        if (prior) {
          try { console.log(JSON.stringify({ level: 'info', requestId: rid, route, uid, reused: true, latency_ms: Date.now() - t0 })); } catch {}
          return json(prior.status || 200, prior.body || { ok: true });
        }
      }
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.error('[withAuth] ok', { requestId: rid, uid, role: claims.role || null, status: claims.status || null });
        } catch {}
      }
      const res = await handler(req, {
        uid,
        role: claims.role as Role | undefined,
        status: claims.status as Status | undefined,
        kycVerified: !!claims.kycVerified,
        claims: claims as ClaimsShape,
        params: paramsResolved
      } as any);
      const out = res instanceof Response ? res : (res || json(200, { ok: true }));
      // Save idempotency snapshot
      if (opts?.idempotent && idemKey) {
        try {
          const bodyText = await out.clone().text();
          await idemSave(route, uid, String(idemKey), out.status, bodyText);
        } catch {}
      }
      try { console.log(JSON.stringify({ level: 'info', requestId: rid, route, uid, role: claims.role || null, status: claims.status || null, appCheck: 'ok', latency_ms: Date.now() - t0 })); } catch {}
      return out;
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') {
        try { console.error('[withAuth] exception', (e?.message || e) + ''); } catch {}
      }
      if (e instanceof HttpError) {
        const body = { ok: false, error: e.code, requestId: rid };
        try {
          const { getDbAdmin } = await import('@/lib/firebase/admin');
          const db = getDbAdmin();
          await db.collection('_diagnostics').doc('auth').collection('denials').add({
            requestId: rid,
            route,
            code: e.code,
            status: e.status,
            uid: dbgUid || null,
            role: dbgClaims?.role || null,
            statusClaim: dbgClaims?.status || null,
            at: new Date(),
          });
        } catch {}
        try {
          console.warn(JSON.stringify({
            level: 'warn', requestId: rid, route,
            error: e.code, status: e.status,
            uid: dbgUid || null,
            role: dbgClaims?.role || null,
            statusClaim: dbgClaims?.status || null,
            latency_ms: Date.now() - t0,
          }));
        } catch {}
        return json(e.status, body);
      }
      try { console.error(JSON.stringify({ level: 'error', requestId: rid, route, error: 'server_error', latency_ms: Date.now() - t0 })); } catch {}
      return json(500, { ok: false, error: 'server_error', requestId: rid });
    } finally {
      // TODO: structured log with route, rid, latency
      void t0;
    }
  };
}

export function requireRole(minRole: Role) { return { minRole }; }
export function requireStatus(list: Status[]) { return { allowedStatus: list }; }

// Rate limiting helpers
const RL_BUCKET: Map<string, number[]> = new Map();
const ONE_MIN = 60;
function secNow() { return Math.floor(Date.now() / 1000); }

async function rateLimitOkPublic(req: Request, opt?: RateLimitOpts): Promise<boolean> {
  const ipLimit = opt?.ipPerMin ?? 120;
  const now = secNow();
  const url = new URL(req.url);
  const route = url.pathname;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '0.0.0.0';
  const key = `i:${route}:${ip}`;
  const arr = RL_BUCKET.get(key) || [];
  const filtered = arr.filter(ts => ts > now - ONE_MIN);
  filtered.push(now);
  RL_BUCKET.set(key, filtered);
  return filtered.length <= ipLimit;
}

async function rateLimitOkProtected(req: Request, uid: string, opt?: RateLimitOpts): Promise<boolean> {
  const uLimit = opt?.userPerMin ?? 30;
  const ipLimit = opt?.ipPerMin ?? 120;
  const now = secNow();
  const url = new URL(req.url);
  const route = url.pathname;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '0.0.0.0';
  const keys = [
    { key: `u:${route}:${uid}`, limit: uLimit },
    { key: `i:${route}:${ip}`, limit: ipLimit },
  ];
  for (const { key, limit } of keys) {
    const arr = RL_BUCKET.get(key) || [];
    const filtered = arr.filter(ts => ts > now - ONE_MIN);
    filtered.push(now);
    RL_BUCKET.set(key, filtered);
    if (filtered.length > limit) return false;
  }
  return true;
}

async function write429Diag(rid: string, route: string, subject: string) {
  try {
    const { getDbAdmin } = await import('@/lib/firebase/admin');
    const db = getDbAdmin();
    await db.collection('_diagnostics').doc('auth').collection('denials').add({ requestId: rid, route, code: 'rate_limited', status: 429, subject, at: new Date() });
  } catch {}
}

async function idemLoad(route: string, uid: string, key: string): Promise<{ status: number; body: any } | null> {
  try {
    const { getDbAdmin } = await import('@/lib/firebase/admin');
    const db = getDbAdmin();
    const id = `${uid}:${route}:${key}`.slice(0, 500);
    const snap = await db.collection('admin_operations').doc(id).get();
    if (!snap.exists) return null;
    const d = snap.data() as any;
    const body = d?.body ? JSON.parse(d.body) : null;
    return { status: d?.status || 200, body };
  } catch { return null; }
}
async function idemSave(route: string, uid: string, key: string, status: number, bodyText: string) {
  const { getDbAdmin, FieldValue } = await import('@/lib/firebase/admin');
  const db = getDbAdmin();
  const id = `${uid}:${route}:${key}`.slice(0, 500);
  await db.collection('admin_operations').doc(id).set({
    uid, route, status,
    body: bodyText,
    createdAt: FieldValue.serverTimestamp(),
    ttl: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  }, { merge: true });
}
