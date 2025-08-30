import { NextResponse } from 'next/server';
import { verifyAppCheckStrict, verifyIdTokenStrict, HttpError, assertRole, assertStatus } from '@/lib/authz/verify';
import type { Role, Status } from '@/lib/authz/types';

type Handler<T = any> = (ctx: { uid: string; role?: Role; status?: Status; kycVerified: boolean }, req: Request) => Promise<Response | T>;

function json(status: number, body: any) { return new NextResponse(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }

export function withAuth(handler: Handler, opts?: { minRole?: Role; allowedStatus?: Status[] }) {
  return async function (req: Request): Promise<Response> {
    const t0 = Date.now();
    const rid = Math.random().toString(36).slice(2);
    try {
      await verifyAppCheckStrict(req);
      const { uid, claims } = await verifyIdTokenStrict(req);
      if (opts?.minRole) assertRole(opts.minRole, claims);
      if (opts?.allowedStatus) assertStatus(opts.allowedStatus, claims);
      const res = await handler({ uid, role: claims.role as Role | undefined, status: claims.status as Status | undefined, kycVerified: !!claims.kycVerified }, req);
      return res instanceof Response ? res : json(200, res);
    } catch (e: any) {
      if (e instanceof HttpError) {
        const body = { ok: false, error: e.code, requestId: rid };
        return json(e.status, body);
      }
      return json(500, { ok: false, error: 'server_error', requestId: rid });
    } finally {
      // TODO: structured log with route, rid, latency
      void t0;
    }
  };
}

export function requireRole(minRole: Role) { return { minRole }; }
export function requireStatus(list: Status[]) { return { allowedStatus: list }; }

