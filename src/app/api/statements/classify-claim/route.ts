import { NextResponse } from 'next/server';
import { withAuth, requireStatus } from '@/lib/http/withAuth';
import { classifyClaimType } from '@/ai/flows/classify-claim-type';

export const runtime = 'nodejs';

export const POST = withAuth(async (_ctx, req) => {
  try {
    const { text, topic } = await req.json();
    if (!text || typeof text !== 'string') return NextResponse.json({ ok: false, error: 'missing_text' }, { status: 400 });
    const result = await classifyClaimType({ text, topic });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}, { ...requireStatus(['Grace','Verified']) });
