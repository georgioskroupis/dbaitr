"use client";

import * as React from 'react';
import { CaptureCamera } from './CaptureCamera';
import { serverVerify } from '@/lib/idv/pipeline';
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
  const { user } = useAuth();

  const onCapture = (which: 'front' | 'back' | 'selfie') => async (blob: Blob, canvas: HTMLCanvasElement) => {
    if (!user) return;
    if (which === 'front') { setFrontBlob(blob); setStep('back'); }
    if (which === 'back') { setBackBlob(blob); setStep('selfie'); }
    if (which === 'selfie') { setSelfieBlob(blob); await decide(blob, user.uid); }
  };

  const decide = async (selfieBlob: Blob, uid: string) => {
    if (!frontBlob || !backBlob || !selfieBlob) return;
    const token = await user.getIdToken();
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
      <p className="text-xs text-white/60 text-center">We process captures ephemerally and store only a boolean verification flag.</p>
    </div>
  );
}
