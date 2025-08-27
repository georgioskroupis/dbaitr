export async function downscaleBlob(
  blob: Blob,
  maxDim = 1280,
  mime: string = 'image/jpeg',
  quality = 0.85
): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const { width, height } = bmp as any;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    if (scale >= 1) {
      bmp.close?.();
      return blob; // already small enough
    }
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close?.();
      return blob;
    }
    ctx.drawImage(bmp as any, 0, 0, w, h);
    bmp.close?.();
    const out: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || blob), mime, quality);
    });
    return out;
  } catch {
    return blob;
  }
}

