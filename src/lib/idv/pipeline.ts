import { IDV_FLAGS } from './config';
import { quickQualityChecks } from './quality';
import { compareFacesByHistogram } from './face';
import { evaluateActiveLiveness, evaluatePassiveLiveness } from './liveness';
import { detectPdf417Robust } from './detect';
import { loadHuman } from './libs/human';
import { ocrMRZ } from './libs/tesseract';
import { parseMrz } from './mrz';

export type VerifyResult = { approved: boolean; reason?: string | null };

export async function tryOnDeviceVerify(front: Blob, back: Blob, selfie: Blob): Promise<VerifyResult> {
  if (!IDV_FLAGS.ON_DEVICE) return { approved: false, reason: 'on_device_disabled' };
  try {
    async function blobToCanvas(b: Blob): Promise<HTMLCanvasElement> {
      const img = await createImageBitmap(b);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no_ctx');
      ctx.drawImage(img, 0, 0);
      img.close?.();
      return c;
    }

    const [frontC, backC, selfieC] = await Promise.all([
      blobToCanvas(front),
      blobToCanvas(back),
      blobToCanvas(selfie),
    ]);

    // Quality checks
    const qcFront = quickQualityChecks(frontC);
    const qcBack = quickQualityChecks(backC);
    const qcSelfie = quickQualityChecks(selfieC);
    if (!qcFront.ok || !qcBack.ok || !qcSelfie.ok) return { approved: false, reason: 'quality_insufficient' };

    // Back: require PDF417 if available
    let hasBarcode = await detectPdf417Robust(backC);
    if (!hasBarcode) {
      const mrz = await ocrMRZ(backC);
      if (mrz.ok && mrz.lines) {
        const parsed = parseMrz(mrz.lines);
        hasBarcode = parsed.ok;
      }
    }
    if (!hasBarcode) return { approved: false, reason: 'barcode_mrz_not_found' };

    // Face match with Human descriptors if available, else histogram fallback
    const human = await loadHuman();
    let faceOk = false;
    if (human) {
      try {
        const [resFront, resSelfie] = await Promise.all([
          human.detect(frontC),
          human.detect(selfieC)
        ]);
        const d1 = resFront?.face?.[0]?.embedding || resFront?.face?.[0]?.descriptor;
        const d2 = resSelfie?.face?.[0]?.embedding || resSelfie?.face?.[0]?.descriptor;
        if (Array.isArray(d1) && Array.isArray(d2) && d1.length === d2.length) {
          // Cosine similarity
          let dot = 0, na = 0, nb = 0;
          for (let i = 0; i < d1.length; i++) { dot += d1[i] * d2[i]; na += d1[i] * d1[i]; nb += d2[i] * d2[i]; }
          const score = dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
          faceOk = score >= 0.65; // reuse default similarity target
        }
      } catch {}
    }
    if (!faceOk) {
      const face = await compareFacesByHistogram(frontC, selfieC);
      faceOk = face.ok;
      if (!faceOk) return { approved: false, reason: 'face_mismatch' };
    }

    // Liveness checks (minimal)
    const active = await evaluateActiveLiveness(selfieC);
    const passive = await evaluatePassiveLiveness(selfieC);
    if (!active.ok) return { approved: false, reason: 'liveness_active_failed' };
    if (!passive.ok) return { approved: false, reason: 'liveness_passive_failed' };

    return { approved: true };
  } catch (e) {
    return { approved: false, reason: 'on_device_error' };
  }
}

export async function serverFallbackVerify(front: Blob, back: Blob, selfie: Blob): Promise<VerifyResult> {
  try {
    const fd = new FormData();
    fd.append('front', front);
    fd.append('back', back);
    fd.append('selfie', selfie);
    const resp = await fetch('/api/idv/verify', { method: 'POST', body: fd });
    const data = await resp.json();
    return { approved: !!data?.approved, reason: data?.reason || null };
  } catch {
    return { approved: false, reason: 'server_fallback_error' };
  }
}
