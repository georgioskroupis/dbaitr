import { IDV_THRESHOLDS } from './config';
import { detectFaces } from './detect';

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

export async function compareFacesByHistogram(idCanvas: HTMLCanvasElement, selfieCanvas: HTMLCanvasElement): Promise<{ ok: boolean; score: number; reason?: string }>{
  const idFaces = await detectFaces(idCanvas);
  const selfieFaces = await detectFaces(selfieCanvas);
  if (!idFaces.length || !selfieFaces.length) return { ok: false, score: 0, reason: 'face_not_detected' };
  const idRect = idFaces[0];
  const selfieRect = selfieFaces[0];

  function crop(canvas: HTMLCanvasElement, r: DOMRect): ImageData | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    return ctx.getImageData(x, y, Math.min(w, canvas.width - x), Math.min(h, canvas.height - y));
  }

  function histRGB(img: ImageData): number[] {
    const bins = 16;
    const hist = new Array(bins * 3).fill(0);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.floor((data[i] / 256) * bins);
      const g = Math.floor((data[i + 1] / 256) * bins);
      const b = Math.floor((data[i + 2] / 256) * bins);
      hist[r]++;
      hist[bins + g]++;
      hist[bins * 2 + b]++;
    }
    // normalize
    const sum = hist.reduce((a, v) => a + v, 0) || 1;
    return hist.map((v) => v / sum);
  }

  const idImg = crop(idCanvas, idRect);
  const sfImg = crop(selfieCanvas, selfieRect);
  if (!idImg || !sfImg) return { ok: false, score: 0, reason: 'crop_failed' };
  const h1 = histRGB(idImg);
  const h2 = histRGB(sfImg);
  const score = cosineSimilarity(h1, h2);
  return { ok: score >= IDV_THRESHOLDS.FACE_HIST_SIM_MIN, score };
}

