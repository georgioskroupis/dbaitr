// ZXing loader and helpers. Uses @zxing/browser for PDF417 when BarcodeDetector is unavailable.
let zxing: any | null = null;
export async function loadZXing(): Promise<any | null> {
  if (zxing) return zxing;
  try {
    const lib: any = await import('@zxing/browser');
    const core: any = await import('@zxing/library');
    zxing = { browser: lib, core };
    return zxing;
  } catch {
    return null;
  }
}

export async function detectPdf417ZXing(canvas: HTMLCanvasElement): Promise<boolean> {
  const lib = await loadZXing();
  if (!lib) return false;
  try {
    // Convert canvas to image element
    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    await new Promise((res, rej) => { img.onload = () => res(null); img.onerror = rej; });
    const { browser, core } = lib;
    const reader = new browser.BrowserMultiFormatReader();
    const hints = new Map();
    hints.set(core.DecodeHintType.POSSIBLE_FORMATS, [core.BarcodeFormat.PDF_417]);
    reader.hints = hints;
    const result = await reader.decodeFromImageElement(img as any).catch(() => null);
    return !!result && (result.getBarcodeFormat?.() === core.BarcodeFormat.PDF_417 || (result as any).format === 'PDF_417');
  } catch {
    return false;
  }
}
