// Tesseract loader with self-hosted worker/wasm support via public/vendor/tesseract/
let tesseract: any | null = null;
export async function loadTesseract(): Promise<any | null> {
  if (tesseract) return tesseract;
  try {
    const mod: any = await import('tesseract.js');
    tesseract = mod;
    return tesseract;
  } catch {
    return null;
  }
}

export async function ocrMRZ(canvas: HTMLCanvasElement): Promise<{ ok: boolean; lines?: string[] }>{
  const t = await loadTesseract();
  if (!t) return { ok: false };
  try {
    const base = (process.env.NEXT_PUBLIC_TESSERACT_BASE_URL || '/vendor/tesseract/') as string;
    const worker = await t.createWorker({
      langPath: base,
      workerPath: base + 'worker.min.js',
      corePath: base + 'tesseract-core.wasm.js',
      logger: undefined,
    });
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    await worker.setParameters({
      tessedit_pageseg_mode: t.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    } as any);
    const { data } = await worker.recognize(canvas);
    const text = (data?.text || '').trim();
    await worker.terminate();
    const rawLines = text.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
    // Heuristic: MRZ lines often contain many '<' and uppercase alphanumerics
    const mrzLines = rawLines.filter((l: string) => l.replace(/[A-Z0-9<]/g, '').length < Math.max(2, Math.floor(l.length * 0.1)));
    if (mrzLines.length >= 2) return { ok: true, lines: mrzLines.slice(0, 3) };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
