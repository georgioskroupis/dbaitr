import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function detectAI(text: string): Promise<number | null> {
  const key = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HF_DETECTOR_MODEL || 'roberta-base-openai-detector';
  if (!key) return null;
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text.slice(0, 4000) }),
    });
    const json: any = await res.json();
    const arr = Array.isArray(json) ? json : (Array.isArray(json?.[0]) ? json[0] : []);
    let prob: number | null = null;
    for (const o of arr) {
      const label = (o?.label || o?.name || '').toString().toLowerCase();
      if (label.includes('ai') || label.includes('generated')) prob = typeof o?.score === 'number' ? o.score : prob;
    }
    return prob;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ ok: false, error: 'missing_text' }, { status: 400 });
    const prob = await detectAI(text);
    return NextResponse.json({ ok: true, prob });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

