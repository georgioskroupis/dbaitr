"use client";

import * as React from 'react';
import { CaptureCamera } from './CaptureCamera';
import { quickQualityChecks } from '@/lib/idv/quality';
import { IDV_FLAGS } from '@/lib/idv/config';
import { tryOnDeviceVerify, serverFallbackVerify } from '@/lib/idv/pipeline';
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
    const qc = quickQualityChecks(canvas);
    if (!qc.ok) {
      setReason('quality_insufficient');
      return;
    }
    if (which === 'front') { setFrontBlob(blob); setStep('back'); }
    if (which === 'back') { setBackBlob(blob); setStep('selfie'); }
    if (which === 'selfie') { setSelfieBlob(blob); await decide(); }
  };

  const decide = async () => {
    if (!frontBlob || !backBlob || !selfieBlob) return;
    const toFinal = (r: { approved: boolean; reason?: string | null } | null | undefined) => ({
      approved: !!r?.approved,
      reason: r?.reason ?? null,
    });
    let onDevice = { approved: false as boolean, reason: null as string | null };
    let finalRes = { approved: false as boolean, reason: null as string | null };
    try {
      if (IDV_FLAGS.ON_DEVICE) {
        const od = await tryOnDeviceVerify(frontBlob, backBlob, selfieBlob);
        onDevice = toFinal(od);
      }
      // If server approval is required, always defer to server
      if (IDV_FLAGS.IDV_AI_APPROVAL) {
        const srv = await serverFallbackVerify(frontBlob, backBlob, selfieBlob);
        finalRes = toFinal(srv);
      } else {
        if (onDevice.approved) {
          finalRes = onDevice;
        } else {
          // Try server fallback for extra coverage; if unavailable, keep on-device reason
          const srv = await serverFallbackVerify(frontBlob, backBlob, selfieBlob);
          if (srv && (srv as any).reason === 'cloud_unavailable') {
            finalRes = onDevice; // preserve granular local reason
          } else {
            finalRes = srv ? toFinal(srv) : onDevice;
          }
        }
      }
    } catch (e) {
      finalRes = { approved: false, reason: 'decision_error' };
    }
    setApproved(finalRes.approved);
    setReason(finalRes.reason || null);
    setStep('result');
  };

  const approveProfile = async () => {
    if (!user) return;
    const token = await user.getIdToken(true);
    await fetch('/api/idv/approve', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
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
            <>
              <p className="text-green-400">Approved</p>
              <Button className="mt-3" onClick={approveProfile}>Apply Verification</Button>
            </>
          ) : (
            <>
              <p className="text-rose-400">Not approved{reason ? `: ${reason}` : ''}</p>
              <Button className="mt-3" onClick={() => setStep('front')}>Retry</Button>
            </>
          )}
        </div>
      )}
      <p className="text-xs text-white/60 text-center">We process captures ephemerally and store only a boolean verification flag.</p>
    </div>
  );
}
