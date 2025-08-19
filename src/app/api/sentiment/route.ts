import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getAdminApp } from '@/lib/firebaseAdmin';
import { getFirestore } from 'firebase-admin/firestore';
import { getClientKey, globalRateLimiter } from '@/lib/rateLimit';
import { computePolarity, polarityToScore, bucketLabel, maxConfidence, normalizeText, sha256, type RawProbs } from '@/lib/sentiment';

interface Payload {
  target: 'statement';
  topicId: string;
  statementId: string;
  text: string;
  lang?: string;
}

async function inferRawProbs(text: string): Promise<RawProbs> {
  const url = process.env.SENTIMENT_INFERENCE_URL;
  if (!url) throw new Error('SENTIMENT_INFERENCE_URL not configured');
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!resp.ok) throw new Error(`Inference HTTP ${resp.status}`);
  const json = await resp.json();
  const probs = json?.probs as { neg: number; neu: number; pos: number };
  if (!probs) throw new Error('Invalid inference response');
  return probs;
}

export async function POST(req: Request) {
  try {
    const key = getClientKey(req);
    if (!globalRateLimiter.check(`sentiment:${key}`)) return NextResponse.json({ ok: false }, { status: 429 });
    const payload = (await req.json()) as Payload;
    const { target, topicId, statementId, text, lang } = payload || ({} as any);
    if (!target || target !== 'statement' || !topicId || !statementId || !text) return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 });

    const adminApp = getAdminApp();
    if (!adminApp) return NextResponse.json({ ok: false, error: 'Admin not configured' }, { status: 501 });
    const adminDb = getFirestore(adminApp);

    const norm = normalizeText(text);
    const hash = sha256(norm);

    // Cache lookup
    const cacheRef = adminDb.collection('sentimentCache').doc(hash);
    const cacheSnap = await cacheRef.get();
    let probs: RawProbs | null = null;
    const model = 'cardiffnlp/twitter-xlm-roberta-base-sentiment';
    const modelVersion = '1';

    if (cacheSnap.exists) {
      const d = cacheSnap.data() as any;
      probs = d?.probs || null;
    }
    if (!probs) {
      probs = await inferRawProbs(norm);
      await cacheRef.set({ probs, model, modelVersion, updatedAt: new Date() }, { merge: true });
    }

    const polarity = computePolarity(probs);
    const score = polarityToScore(polarity);
    const confidence = maxConfidence(probs);
    const label = bucketLabel(score);
    const sentiment = { score, label, confidence, probs, model, modelVersion, lang: lang || null, hash, updatedAt: new Date() };

    // Write to target doc and update aggregation
    const targetRef = adminDb.collection('topics').doc(topicId).collection('statements').doc(statementId);

    await targetRef.set({ sentiment }, { merge: true });

    // Aggregation doc per statement
    const aggRef = adminDb.collection('topics').doc(topicId).collection('statements').doc(statementId).collection('aggregations').doc('sentiment');
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(aggRef);
      let bins: number[] = Array(101).fill(0);
      let n = 0;
      let mean = 0;
      if (snap.exists) {
        const d = snap.data() as any;
        bins = Array.isArray(d.sentimentDist) && d.sentimentDist.length === 101 ? d.sentimentDist : bins;
        n = typeof d.n === 'number' ? d.n : 0;
        mean = typeof d.mean === 'number' ? d.mean : 0;
      }
      bins[score] = (bins[score] || 0) + 1;
      const newN = n + 1;
      const newMean = (mean * n + score) / newN;
      tx.set(aggRef, { sentimentDist: bins, n: newN, mean: newMean, lastUpdated: new Date() }, { merge: true });
    });

    // Topic-wide aggregation (only for statements)
    const topicAggRef = adminDb.collection('topics').doc(topicId).collection('aggregations').doc('sentiment');
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(topicAggRef);
      let bins: number[] = Array(101).fill(0);
      let n = 0;
      let mean = 0;
      if (snap.exists) {
        const d = snap.data() as any;
        bins = Array.isArray(d.sentimentDist) && d.sentimentDist.length === 101 ? d.sentimentDist : bins;
        n = typeof d.n === 'number' ? d.n : 0;
        mean = typeof d.mean === 'number' ? d.mean : 0;
      }
      bins[score] = (bins[score] || 0) + 1;
      const newN = n + 1;
      const newMean = (mean * n + score) / newN;
      tx.set(topicAggRef, { sentimentDist: bins, n: newN, mean: newMean, lastUpdated: new Date() }, { merge: true });
    });

    return NextResponse.json({ ok: true, sentiment });
  } catch (err) {
    logger.error('[api/sentiment] Failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
