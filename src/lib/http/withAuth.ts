import { NextResponse } from 'next/server';
import { verifyAppCheckStrict, verifyIdTokenStrict, HttpError, assertRole, assertStatus } from '@/lib/authz/verify';
import type { Role, Status } from '@/lib/authz/types';

type Ctx = { uid: string; role?: Role; status?: Status; kycVerified: boolean } | undefined;
type Handler<T = any> = (ctx: Ctx, req: Request) => Promise<Response | T>;

function json(status: number, body: any) { return new NextResponse(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }

export function withAuth(handler: Handler, opts?: { minRole?: Role; allowedStatus?: Status[]; public?: boolean }) {
  return async function (req: Request): Promise<Response> {
    const t0 = Date.now();
    const rid = Math.random().toString(36).slice(2);
    const route = (() => { try { const u = new URL(req.url); return u.pathname; } catch { return 'unknown'; } })();
    try {
      await verifyAppCheckStrict(req);
      if (opts?.public) {
        const res = await handler(undefined, req);
        return res instanceof Response ? res : json(200, res);
      }
      const { uid, claims } = await verifyIdTokenStrict(req);
      if (opts?.minRole) assertRole(opts.minRole, claims);
      if (opts?.allowedStatus) assertStatus(opts.allowedStatus, claims);
      const res = await handler({ uid, role: claims.role as Role | undefined, status: claims.status as Status | undefined, kycVerified: !!claims.kycVerified }, req);
      const out = res instanceof Response ? res : json(200, res);
      try { console.log(JSON.stringify({ level: 'info', requestId: rid, route, uid, role: claims.role || null, status: claims.status || null, appCheck: 'ok', latency_ms: Date.now() - t0 })); } catch {}
      return out;
    } catch (e: any) {
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
            at: new Date(),
          });
        } catch {}
        try { console.warn(JSON.stringify({ level: 'warn', requestId: rid, route, error: e.code, status: e.status, latency_ms: Date.now() - t0 })); } catch {}
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
