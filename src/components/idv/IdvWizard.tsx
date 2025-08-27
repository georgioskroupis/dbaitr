"use client";

import * as React from 'react';
import { CaptureCamera } from './CaptureCamera';
import { serverVerify } from '@/lib/idv/pipeline';
import { downscaleBlob } from '@/lib/idv/resize';
import { quickQualityChecks } from '@/lib/idv/quality';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

type Step = 'front' | 'back' | 'selfie' | 'result';

export function IdvWizard() {
  const [step, setStep] = React.useState<Step>('front');
  const [frontBlob, setFrontBlob] = React.useState<Blob | null>(null);
  const [backBlob, setBackBlob] = React.useState<Blob | null>(null);
  const [selfieBlob, setSelfieBlob] = React.useState<Blob | null>(null);
  const [approved, setApproved] = React.useState<boolean | null>(null);
  const [reason, setReason] = React.useState<string | null>(null);
  const [showInfo, setShowInfo] = React.useState(false);
  const { user } = useAuth();

  const onCapture = (which: 'front' | 'back' | 'selfie') => async (blob: Blob, canvas: HTMLCanvasElement) => {
    // Fast client-side quality gate to avoid slow server rejections
    const qc = quickQualityChecks(canvas);
    if (!qc.ok) {
      setReason(qc.reasons?.[0] || 'quality_insufficient');
      return;
    }
    if (which === 'front') {
      const small = await downscaleBlob(blob, 1280, 'image/jpeg', 0.85);
      setFrontBlob(small);
      setStep('back');
    }
    if (which === 'back') {
      const small = await downscaleBlob(blob, 1280, 'image/jpeg', 0.85);
      setBackBlob(small);
      setStep('selfie');
    }
    if (which === 'selfie') {
      const small = await downscaleBlob(blob, 1280, 'image/jpeg', 0.85);
      setSelfieBlob(small);
      if (user) await decide(blob, user.uid);
    }
  };

  const decide = async (selfieBlob: Blob, uid: string) => {
    if (!frontBlob || !backBlob || !selfieBlob) return;
    const token = await user?.getIdToken();
    if (!token) { setReason('unauthorized'); return; }
    const result = await serverVerify(frontBlob, backBlob, selfieBlob, uid, token);
    setApproved(result.approved);
    setReason(result.reason || null);
    setStep('result');

    // Call the new result endpoint
    await fetch('/api/idv/result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(result),
    });
  };

  const getErrorMessage = (reason: string | null) => {
    switch (reason) {
      case 'too_dark':
        return 'Too dark. Improve lighting and retake.';
      case 'too_bright':
        return 'Too bright. Avoid glare and retake.';
      case 'too_blurry':
        return 'Too blurry. Hold steady and retake.';
      case 'quality_insufficient':
        return 'Image quality is insufficient. Please retake.';
      case 'quality_front':
        return 'Image of front of ID is not clear enough. Please try again.';
      case 'quality_back':
        return 'Image of back of ID is not clear enough. Please try again.';
      case 'quality_selfie':
        return 'Selfie is not clear enough. Please try again.';
      case 'barcode_mrz_not_found':
        return 'Could not read the barcode or MRZ on the ID. Please try again.';
      case 'face_mismatch':
        return 'The face in the selfie does not match the face on the ID.';
      case 'liveness_check_failed':
        return 'Liveness check failed. Please make sure you are in a well-lit room and are not wearing any masks or glasses.';
      case 'model_unavailable':
        return 'Verification service is warming up. Please retry shortly.';
      case 'cloud_unavailable':
        return 'Verification service is temporarily unavailable. Please try again later.';
      case 'server_error':
      case 'server_fallback_error':
        return 'A server error occurred. Please try again later.';
      case 'missing_images':
        return 'Missing captures. Please go through all steps again.';
      case 'unauthorized':
        return 'Please sign in to continue verification.';
      default:
        return 'An unknown error occurred. Please try again.';
    }
  };

  return (
    <div className="space-y-6">
      {step === 'front' && (
        <div>
          <h3 className="text-white text-lg font-semibold mb-2">Step 1: Capture ID (front)</h3>
          <CaptureCamera onCapture={onCapture('front')} overlay={<div className="border-2 border-white/40 rounded-md m-6 h-[70%]" />} facingMode="environment" />
        </div>
      )}
      {step === 'back' && (
        <div>
          <h3 className="text-white text-lg font-semibold mb-2">Step 2: Capture ID (back)</h3>
          <CaptureCamera onCapture={onCapture('back')} overlay={<div className="border-2 border-white/40 rounded-md m-6 h-[70%]" />} facingMode="environment" />
        </div>
      )}
      {step === 'selfie' && (
        <div>
          <h3 className="text-white text-lg font-semibold mb-2">Step 3: Selfie + Liveness</h3>
          <CaptureCamera onCapture={onCapture('selfie')} overlay={<div className="rounded-full border-2 border-white/40 m-10 h-[70%]" />} facingMode="user" />
        </div>
      )}
      {step === 'result' && (
        <div className="text-center">
          <h3 className="text-white text-xl font-semibold mb-2">Verification Result</h3>
          {approved ? (
            <p className="text-green-400">Approved</p>
          ) : (
            <>
              <p className="text-rose-400">Not approved: {getErrorMessage(reason)}</p>
              <Button className="mt-3" onClick={() => setStep('front')}>Retry</Button>
            </>
          )}
        </div>
      )}
      <div className="text-center">
        <p className="text-xs text-white/60 inline">We process captures ephemerally and store only a boolean verification flag. </p>
        <Button variant="link" className="text-xs p-0 ml-1" onClick={() => setShowInfo((s) => !s)}>
          {showInfo ? 'Hide details' : 'What we store'}
        </Button>
      </div>
      {showInfo && (
        <div className="mt-2 text-xs text-white/70 border border-white/10 rounded p-3 bg-black/30">
          <p>- Images are processed on your device for quick checks, then uploaded to the verification service and not stored by us.</p>
          <p>- We log only the result (approved, reason) with a timestamp and your user ID to prevent abuse.</p>
          <p>- On approval, we set a verification flag on your profile; you can revoke access anytime.</p>
        </div>
      )}
    </div>
  );
}
