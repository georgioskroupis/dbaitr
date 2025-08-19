// Lightweight wrappers around browser Shape Detection API if available.

export async function detectFaces(canvas: HTMLCanvasElement): Promise<DOMRect[]> {
  try {
    // @ts-ignore
    const FaceDetectorCtor = (window as any).FaceDetector;
    if (!FaceDetectorCtor) return [];
    // @ts-ignore
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 3 });
    const faces = await detector.detect(canvas as unknown as ImageBitmapSource);
    return faces?.map((f: any) => f.boundingBox as DOMRect) ?? [];
  } catch {
    return [];
  }
}

export async function detectPdf417(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    // @ts-ignore
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) return false;
    // @ts-ignore
    const supported = await BarcodeDetectorCtor.getSupportedFormats?.();
    const canPdf = Array.isArray(supported) ? supported.includes('pdf417') : true;
    if (!canPdf) return false;
    // @ts-ignore
    const detector = new BarcodeDetectorCtor({ formats: ['pdf417'] });
    const codes = await detector.detect(canvas as unknown as ImageBitmapSource);
    return Array.isArray(codes) && codes.some((c: any) => (c.format || '').toLowerCase() === 'pdf417');
  } catch {
    return false;
  }
}

import { detectPdf417ZXing } from './libs/zxing';
export async function detectPdf417Robust(canvas: HTMLCanvasElement): Promise<boolean> {
  // Try native BarcodeDetector first, then ZXing
  const native = await detectPdf417(canvas);
  if (native) return true;
  return await detectPdf417ZXing(canvas);
}
