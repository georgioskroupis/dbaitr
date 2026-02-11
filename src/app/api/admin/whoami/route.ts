export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { withAuth, requireRole, requireStatus } from '@/lib/http/withAuth';

export const GET = withAuth(async (_req, ctx: any) => {
  return NextResponse.json({ ok: true, uid: ctx?.uid, role: ctx?.role || null, claims: { role: ctx?.role, status: ctx?.status, kycVerified: ctx?.kycVerified } });
}, { ...requireRole('admin'), ...requireStatus(['Verified']) });
