import { NextResponse } from 'next/server';
import { getAuthAdmin } from '@/lib/firebaseAdmin';
import { classifyClaimType } from '@/ai/flows/classify-claim-type';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    const auth = getAuthAdmin();
    if (!auth) return NextResponse.json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
    if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    await auth.verifyIdToken(token); // only presence/validity needed

    const { text, topic } = await req.json();
    if (!text || typeof text !== 'string') return NextResponse.json({ ok: false, error: 'missing_text' }, { status: 400 });
    const result = await classifyClaimType({ text, topic });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

