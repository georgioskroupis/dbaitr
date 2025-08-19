"use client";

import * as React from 'react';

export default function IdvDiagnosticsPage() {
  const [status, setStatus] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    (async () => {
      const s: Record<string, string> = {};
      try {
        // FaceDetector
        // @ts-ignore
        const FD = (window as any).FaceDetector;
        if (FD) {
          s.FaceDetector = 'available';
        } else {
          s.FaceDetector = 'unavailable';
        }
      } catch (e: any) { s.FaceDetector = 'error'; }

      try {
        // BarcodeDetector + PDF417
        // @ts-ignore
        const BD = (window as any).BarcodeDetector;
        if (BD && BD.getSupportedFormats) {
          const fmts = await BD.getSupportedFormats();
          s.BarcodeDetector = `available (${fmts.join(', ')})`;
          s.PDF417 = fmts.includes('pdf417') ? 'supported' : 'not supported';
        } else if (BD) {
          s.BarcodeDetector = 'available';
          s.PDF417 = 'unknown';
        } else {
          s.BarcodeDetector = 'unavailable';
        }
      } catch (e: any) { s.BarcodeDetector = 'error'; }

      // ZXing
      try {
        const z = await import('@zxing/browser');
        s.ZXing = z ? 'loaded' : 'failed';
      } catch { s.ZXing = 'failed'; }

      // Human
      try {
        const mod: any = await import('@vladmandic/human');
        s.Human = mod ? 'loaded' : 'failed';
      } catch { s.Human = 'failed'; }

      // Tesseract (load only, no recognize)
      try {
        const t: any = await import('tesseract.js');
        // Worker paths are configured at runtime; here we just test import
        s.Tesseract = t ? 'loaded' : 'failed';
      } catch { s.Tesseract = 'failed'; }

      setStatus(s);
    })();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold text-white">IDV Diagnostics</h1>
      <p className="text-white/70 text-sm">Checks availability of on-device detectors and libraries. Use this to validate a given browser environment before going live.</p>
      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        {Object.keys(status).length === 0 ? (
          <p className="text-white/70">Running checks…</p>
        ) : (
          <ul className="space-y-2">
            {Object.entries(status).map(([k, v]) => (
              <li key={k} className="flex justify-between text-sm">
                <span className="text-white/80">{k}</span>
                <span className={v.includes('available') || v.includes('loaded') || v.includes('supported') ? 'text-green-400' : v === 'unknown' ? 'text-yellow-300' : 'text-rose-400'}>{v}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="text-xs text-white/50">
        <p>Notes:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>For Human, ensure models are hosted under <code>/vendor/human/models/</code> and set <code>NEXT_PUBLIC_HUMAN_MODELS_URL</code>.</li>
          <li>For Tesseract, host <code>worker.min.js</code> and <code>tesseract-core.wasm.js</code> under <code>/vendor/tesseract/</code> and set <code>NEXT_PUBLIC_TESSERACT_BASE_URL</code>.</li>
          <li>Enable CSP with <code>NEXT_ENABLE_IDV_CSP=true</code> after verifying assets load.</li>
        </ul>
      </div>
    </div>
  );
}

