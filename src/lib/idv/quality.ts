import { IDV_THRESHOLDS } from './config';

type QC = { ok: boolean; reasons: string[]; brightness?: number; blur?: number };

export function quickQualityChecks(img: HTMLCanvasElement | ImageBitmap): QC {
  let canvas: HTMLCanvasElement;
  if (img instanceof HTMLCanvasElement) {
    canvas = img;
  } else {
    canvas = document.createElement('canvas');
    // @ts-ignore
    const bmp = img as ImageBitmap;
    canvas.width = (bmp as any).width;
    canvas.height = (bmp as any).height;
    const c = canvas.getContext('2d');
    if (!c) return { ok: false, reasons: ['no_2d_context'] };
    c.drawImage(img as any, 0, 0);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, reasons: ['no_2d_context'] };
  const { width, height } = canvas;
  if (width === 0 || height === 0) return { ok: false, reasons: ['empty_image'] };
  const data = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Luma approx
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += y;
  }
  const brightness = sum / (data.length / 4);

  // Simple blur metric: variance of Laplacian approximation via Sobel
  // Downscale for speed
  const sw = Math.max(1, Math.floor(width / 4));
  const sh = Math.max(1, Math.floor(height / 4));
  const small = document.createElement('canvas');
  small.width = sw; small.height = sh;
  const sctx = small.getContext('2d');
  if (!sctx) return { ok: false, reasons: ['no_2d_context'] };
  sctx.drawImage(canvas, 0, 0, sw, sh);
  const sdata = sctx.getImageData(0, 0, sw, sh).data;
  const gray = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      gray[y * sw + x] = 0.2126 * sdata[idx] + 0.7152 * sdata[idx + 1] + 0.0722 * sdata[idx + 2];
    }
  }
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
  const gx = new Float32Array(sw * sh);
  const gy = new Float32Array(sw * sh);
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      let sx = 0, sy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const v = gray[(y + ky) * sw + (x + kx)];
          sx += v * sobelX[ky + 1][kx + 1];
          sy += v * sobelY[ky + 1][kx + 1];
        }
      }
      gx[y * sw + x] = sx; gy[y * sw + x] = sy;
    }
  }
  // Laplacian magnitude approx as |gx| + |gy|
  const lap = new Float32Array(sw * sh);
  let mean = 0;
  for (let i2 = 0; i2 < lap.length; i2++) { lap[i2] = Math.abs(gx[i2]) + Math.abs(gy[i2]); mean += lap[i2]; }
  mean /= lap.length;
  let variance = 0;
  for (let i2 = 0; i2 < lap.length; i2++) { const d = lap[i2] - mean; variance += d * d; }
  variance /= lap.length;

  const reasons: string[] = [];
  if (brightness < IDV_THRESHOLDS.BRIGHTNESS_MIN) reasons.push('too_dark');
  if (brightness > IDV_THRESHOLDS.BRIGHTNESS_MAX) reasons.push('too_bright');
  if (variance < IDV_THRESHOLDS.BLUR_LAPLACIAN_MIN) reasons.push('too_blurry');
  return { ok: reasons.length === 0, reasons, brightness, blur: variance };
}

