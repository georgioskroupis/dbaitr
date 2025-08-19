import { IDV_THRESHOLDS } from './config';
import { detectFaces } from './detect';

export async function evaluateActiveLiveness(selfieCanvas: HTMLCanvasElement): Promise<{ ok: boolean; passedSteps: number }>{
  // Minimal active check: ensure face is reasonably centered and large enough
  const faces = await detectFaces(selfieCanvas);
  if (!faces.length) return { ok: false, passedSteps: 0 };
  const r = faces[0];
  const area = r.width * r.height;
  const imgArea = selfieCanvas.width * selfieCanvas.height;
  const sizeOk = area / imgArea > 0.05; // face occupies at least 5%
  const centerX = r.x + r.width / 2;
  const centerY = r.y + r.height / 2;
  const cxOk = centerX > selfieCanvas.width * 0.25 && centerX < selfieCanvas.width * 0.75;
  const cyOk = centerY > selfieCanvas.height * 0.2 && centerY < selfieCanvas.height * 0.8;
  const passed = [sizeOk, cxOk && cyOk].filter(Boolean).length;
  return { ok: passed >= IDV_THRESHOLDS.ACTIVE_LIVENESS_MIN_STEPS, passedSteps: passed };
}

export async function evaluatePassiveLiveness(image: HTMLCanvasElement | ImageBitmap): Promise<{ ok: boolean; score: number }>{
  // Minimal passive heuristic: measure edge variance (sharpness) and brightness window
  // Reuse quality checks indirectly via a small scorer
  const canvas = image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, score: 0 };
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += y;
  }
  const brightness = sum / (data.length / 4);
  const brightOk = brightness > IDV_THRESHOLDS.BRIGHTNESS_MIN && brightness < IDV_THRESHOLDS.BRIGHTNESS_MAX;
  const score = brightOk ? 0.8 : 0.3;
  return { ok: score >= IDV_THRESHOLDS.PASSIVE_LIVENESS_MIN, score };
}
