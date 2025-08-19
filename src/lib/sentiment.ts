import crypto from 'crypto';

export type RawProbs = { neg: number; neu: number; pos: number };

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function computePolarity(probs: RawProbs): number {
  const { neg, neu, pos } = probs;
  return -1 * neg + 0 * neu + 1 * pos;
}

export function polarityToScore(polarity: number): number {
  // map [-1,1] -> [0,100]
  const raw = (polarity + 1) * 50;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped);
}

export function bucketLabel(score: number): 'Very Negative' | 'Negative' | 'Neutral' | 'Positive' | 'Very Positive' {
  if (score <= 20) return 'Very Negative';
  if (score <= 40) return 'Negative';
  if (score <= 60) return 'Neutral';
  if (score <= 80) return 'Positive';
  return 'Very Positive';
}

export function maxConfidence(probs: RawProbs): number {
  return Math.max(probs.neg, probs.neu, probs.pos);
}

