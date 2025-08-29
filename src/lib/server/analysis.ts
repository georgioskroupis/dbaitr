import crypto from 'crypto';
import { getDbAdmin, FieldValue } from '@/lib/firebaseAdmin';
import { ENGAGEMENT, PILL_FLIP_COOLDOWN_MIN, PILL_INSTANT_JUMP, PILL_MIN_CONFIDENCE, PILL_TIE_BREAK_DELTA, TREND_DOWN, TREND_UP, ANALYSIS_VERSION, getDomainWeight } from '@/lib/analysis-config';

type Trigger = 'event' | 'scheduled';

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function nowIso() { return new Date().toISOString(); }

function shortHash(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
}

function expDecayWeight(deltaHours: number, halfLifeH: number) {
  return Math.pow(0.5, deltaHours / halfLifeH);
}

async function getTopicData(db: FirebaseFirestore.Firestore, topicId: string) {
  const topicRef = db.collection('topics').doc(topicId);
  const [topicSnap, statementsSnap, threadsSnap] = await Promise.all([
    topicRef.get(),
    topicRef.collection('statements').get(),
    db.collectionGroup('threads').where('topicId', '==', topicId).get(),
  ]);
  return {
    topicRef,
    topic: topicSnap.exists ? (topicSnap.data() as any) : null,
    statements: statementsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
    threads: threadsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
  };
}

function parseTs(ts: any): Date | null {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === 'string') return new Date(ts);
    if (ts instanceof Date) return ts;
  } catch {}
  return null;
}

function extractLinks(text: string): string[] {
  const re = /(https?:\/\/[^\s)\]]+)/g; const out: string[] = []; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

function scoreTone(statements: any[], threads: any[]) {
  // Heuristic: hostile lexicon + moderation flags on statements/threads
  const hostileLex = [/\bidiot\b/i, /\bstupid\b/i, /\bhate\b/i, /\bfool\b/i, /\bshut up\b/i, /\btrash\b/i];
  let hits = 0, total = 0;
  for (const s of [...statements, ...threads]) {
    const text = String(s.content || ''); if (!text) continue; total++;
    if (s?.moderation?.flagged) hits += 1;
    if (hostileLex.some(r => r.test(text))) hits += 0.5;
  }
  const hostile = total > 0 ? clamp01(hits / total) : 0;
  const calm = 1 - hostile;
  const value = hostile >= 0.5 ? 'heated' : 'calm';
  const confidence = value === 'heated' ? hostile : calm;
  const rationale = value === 'heated' ? 'hostility/mod flags present' : 'low hostility cues';
  return { value, confidence, rationale };
}

function scoreStyle(statements: any[], threads: any[]) {
  // Structured markers: lists, numbered points, headings, explicit turn-taking
  let structuredHits = 0, total = 0;
  const markers = [/^\d+\./m, /^-\s/m, /^\*\s/m, /\bfirst\b/i, /\bsecond\b/i, /\bin conclusion\b/i, /\bbecause\b/i, /\btherefore\b/i];
  for (const s of [...statements, ...threads]) {
    const text = String(s.content || ''); if (!text) continue; total++;
    if (markers.some(r => r.test(text))) structuredHits += 1;
  }
  const ratio = total > 0 ? structuredHits / total : 0;
  const value = ratio >= 0.5 ? 'structured' : 'informal';
  const confidence = value === 'structured' ? ratio : 1 - ratio;
  const rationale = value === 'structured' ? 'structured markers detected' : 'conversational free-form dominates';
  return { value, confidence, rationale };
}

function scoreOutcome(statements: any[]) {
  // Prefer stanceLikert if available; else map position -> numeric
  const buckets: number[] = [];
  for (const s of statements) {
    const likert = (s as any)?.stanceLikert; // 1..5 optionally
    if (typeof likert === 'number') buckets.push(likert);
    else {
      const pos = String(s.position || 'neutral');
      const v = pos === 'for' ? 5 : pos === 'against' ? 1 : 3;
      buckets.push(v);
    }
  }
  if (buckets.length === 0) return { value: 'consensus', confidence: 0, rationale: 'no data' };
  const mean = buckets.reduce((a, b) => a + b, 0) / buckets.length;
  const variance = buckets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / buckets.length;
  const normVar = clamp01(variance / 2.0); // variance of 2 ~ high dispersion
  const value = normVar >= 0.5 ? 'controversial' : 'consensus';
  const confidence = value === 'controversial' ? normVar : 1 - normVar;
  const rationale = value === 'controversial' ? 'divergent stances' : 'aligned stances';
  return { value, confidence, rationale };
}

function scoreSubstance(statements: any[], threads: any[]) {
  // Evidence = links, citations, quotes, stats, domain weights
  let weight = 0, total = 0;
  for (const s of [...statements, ...threads]) {
    const text = String(s.content || ''); if (!text) continue; total++;
    const links = extractLinks(text);
    if (links.length > 0) weight += Math.min(1, links.reduce((acc, u) => acc + getDomainWeight(u), 0) / 2);
    if (/\b\d+%\b/.test(text) || /\b\d{2,}\b/.test(text)) weight += 0.2;
    if (/".+?"/.test(text) || /\[\d+\]/.test(text)) weight += 0.2;
    if (s.claimType === 'fact' && s.sourceUrl) weight += 0.5 * getDomainWeight(s.sourceUrl);
  }
  const avg = total > 0 ? weight / total : 0;
  const value = avg >= 0.5 ? 'evidence' : 'opinion';
  const confidence = value === 'evidence' ? clamp01(avg) : clamp01(1 - avg);
  const rationale = value === 'evidence' ? 'links/quotes/stats present' : 'few citations';
  return { value, confidence, rationale };
}

function scoreEngagement(statements: any[], threads: any[]) {
  const now = Date.now();
  const events = [...statements, ...threads]
    .map(x => parseTs(x.createdAt))
    .filter((d): d is Date => !!d)
    .map(d => d.getTime());
  if (events.length === 0) return { value: 'dormant', confidence: 0, rationale: 'no activity' };
  const participants = new Set<string>([...statements, ...threads].map(x => String(x.createdBy || '')));
  const minsAgo = (t: number) => (now - t) / (1000 * 60);

  function windowScore(minutes: number): number {
    const cutoff = now - minutes * 60 * 1000;
    const recent = events.filter(t => t >= cutoff);
    if (recent.length === 0) return 0;
    const perMin = recent.length / minutes;
    const uniq = participants.size;
    const normDepth = clamp01((recent.length / Math.max(uniq, 1)) / 5); // heuristic normalization
    const recencyWeight = expDecayWeight(minsAgo(Math.max(...recent)) / 60, ENGAGEMENT.halfLifeH);
    return clamp01(0.5 * clamp01(perMin) + 0.3 * clamp01(uniq / 10) + 0.2 * normDepth) * recencyWeight;
  }
  const shortS = windowScore(ENGAGEMENT.shortWindowMin);
  const medS = windowScore(ENGAGEMENT.mediumWindowH * 60);
  const longS = windowScore(ENGAGEMENT.longWindowD * 24 * 60);
  // Weighted blend emphasizing recent
  const blended = clamp01(0.6 * shortS + 0.3 * medS + 0.1 * longS);
  const value = blended >= ENGAGEMENT.activeThreshold ? 'active' : 'dormant';
  const confidence = value === 'active' ? blended : 1 - blended;
  const rationale = value === 'active' ? 'recent active participation' : 'low recent activity';
  return { value, confidence, rationale };
}

function scoreArgumentation(statements: any[], threads: any[]) {
  // Claim–Evidence–Warrant markers and fallacy reduction
  let score = 0, total = 0;
  const claim = /\b(i claim|we argue|thesis|claim)\b/i;
  const evidence = /\b(because|evidence|data|study|according to)\b/i;
  const warrant = /\btherefore|thus|so|hence\b/i;
  const fallacies = [/ad hominem/i, /straw ?man/i, /false cause/i, /slippery slope/i];
  for (const s of [...statements, ...threads]) {
    const text = String(s.content || ''); if (!text) continue; total++;
    let v = 0;
    if (claim.test(text)) v += 0.3;
    if (evidence.test(text)) v += 0.4;
    if (warrant.test(text)) v += 0.3;
    if (fallacies.some(r => r.test(text))) v -= 0.4;
    score += clamp01(v);
  }
  const avg = total > 0 ? score / total : 0;
  const value = avg >= 0.5 ? 'solid' : 'weak';
  const confidence = value === 'solid' ? avg : 1 - avg;
  const rationale = value === 'solid' ? 'claim–evidence–warrant present' : 'weak support/coherence';
  return { value, confidence, rationale };
}

async function computeTrend24h(db: FirebaseFirestore.Firestore, topicRef: FirebaseFirestore.DocumentReference, cat: string, currentValue: string, currentConf: number) {
  const histRef = topicRef.collection('analysis_history');
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const snap = await histRef.where('createdAt', '>=', new Date(since)).orderBy('createdAt', 'asc').get();
  let pastConf: number | null = null;
  snap.forEach(d => {
    const c = (d.data()?.categories || {})[cat];
    if (!c) return;
    if (c.value === currentValue && typeof c.confidence === 'number') pastConf = c.confidence;
  });
  if (pastConf === null) return 0;
  return clamp01(currentConf) - clamp01(pastConf);
}

function shouldFlip(prev: any, nextValue: string, nextConf: number): boolean {
  if (!prev || !prev.value) return nextConf >= PILL_MIN_CONFIDENCE;
  const prevValue = String(prev.value);
  const prevConf = typeof prev.confidence === 'number' ? prev.confidence : 0;
  if (nextConf < PILL_MIN_CONFIDENCE) return false;
  if (prevValue === nextValue) return true;
  const delta = Math.abs(nextConf - prevConf);
  const updatedAt = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
  const minAgo = (Date.now() - updatedAt) / (1000 * 60);
  if (delta > PILL_INSTANT_JUMP) return true;
  if (minAgo >= PILL_FLIP_COOLDOWN_MIN && delta > PILL_TIE_BREAK_DELTA) return true;
  return false;
}

export async function evaluateTopicPills(topicId: string, trigger: Trigger = 'event') {
  const db = getDbAdmin();
  if (!db) throw new Error('admin_not_configured');
  const { topicRef, topic, statements, threads } = await getTopicData(db, topicId);
  if (!topic) throw new Error('topic_not_found');

  const tTone = scoreTone(statements, threads);
  const tStyle = scoreStyle(statements, threads);
  const tOutcome = scoreOutcome(statements);
  const tSubstance = scoreSubstance(statements, threads);
  const tEngagement = scoreEngagement(statements, threads);
  const tArgument = scoreArgumentation(statements, threads);

  const cats = { tone: tTone, style: tStyle, outcome: tOutcome, substance: tSubstance, engagement: tEngagement, argumentation: tArgument } as const;

  const updates: any = { analysis: { version: { ...ANALYSIS_VERSION, updatedAt: nowIso() }, categories: {} }, analysis_flat: {} };
  for (const [key, res] of Object.entries(cats)) {
    const prev = topic?.analysis?.categories?.[key];
    const value = String(res.value);
    const confidence = clamp01(res.confidence);
    const trend24h = await computeTrend24h(db, topicRef, key, value, confidence);
    const next = { value, confidence, trend24h, rationaleShort: res.rationale, updatedAt: nowIso(), ...(prev?.override ? { override: true, note: prev?.note } : {}) };
    const frozen = !!prev?.override;
    const effective = frozen ? prev : (shouldFlip(prev, value, confidence) ? next : prev);
    updates.analysis.categories[key] = effective || next;
  }
  updates.analysis_flat = {
    tone: updates.analysis.categories.tone?.value,
    style: updates.analysis.categories.style?.value,
    outcome: updates.analysis.categories.outcome?.value === 'consensus' ? 'consensus' : 'controversial',
    substance: updates.analysis.categories.substance?.value === 'evidence' ? 'evidence' : 'opinion',
    engagement: updates.analysis.categories.engagement?.value === 'active' ? 'active' : 'dormant',
    argumentation: updates.analysis.categories.argumentation?.value === 'solid' ? 'solid' : 'weak',
    updatedAt: nowIso(),
  };

  // Write snapshot to history (capped N=100)
  const digest = shortHash(JSON.stringify({ s: statements.length, t: threads.length }));
  const histRef = topicRef.collection('analysis_history');
  const batch = db.batch();
  batch.set(topicRef, updates, { merge: true });
  const histDoc = histRef.doc();
  batch.set(histDoc, { createdAt: FieldValue.serverTimestamp(), categories: updates.analysis.categories, digestHash: digest, trigger });
  // prune old history beyond last 100
  const histSnap = await histRef.orderBy('createdAt', 'desc').get();
  const excess = histSnap.docs.slice(100);
  for (const d of excess) batch.delete(d.ref);
  await batch.commit();

  // Structured log-like return
  return {
    ok: true,
    topicId,
    trigger,
    decisions: Object.fromEntries(Object.entries(updates.analysis.categories).map(([k, v]: any) => [k, { value: v?.value, confidence: v?.confidence, trend24h: v?.trend24h }]))
  };
}

// Minimal debounced job marker: lastRequestedAt; runner checks 20s window
export async function markAnalysisRequested(topicId: string) {
  const db = getDbAdmin();
  if (!db) return;
  await db.collection('_jobs').doc(`analysis_${topicId}`).set({ topicId, type: 'analysis', lastRequestedAt: FieldValue.serverTimestamp() }, { merge: true });
}

