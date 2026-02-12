"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import {
  createVerificationChallenge,
  getVerificationResult,
  submitVerificationProof,
  type VerificationChallenge,
} from '@/lib/idv/pipeline';

export function IdvWizard() {
  const { user } = useAuth();
  const [challenge, setChallenge] = React.useState<VerificationChallenge | null>(null);
  const [proofJson, setProofJson] = React.useState('');
  const [approved, setApproved] = React.useState<boolean | null>(null);
  const [reason, setReason] = React.useState<string | null>(null);
  const [provider, setProvider] = React.useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = React.useState<string | null>(null);
  const [showInfo, setShowInfo] = React.useState(false);
  const [loadingChallenge, setLoadingChallenge] = React.useState(false);
  const [submittingProof, setSubmittingProof] = React.useState(false);

  const expired =
    !!challenge?.expiresAtMs && Number.isFinite(challenge.expiresAtMs) && Date.now() > challenge.expiresAtMs;

  const startChallenge = async () => {
    if (!user) {
      setReason('unauthorized');
      return;
    }
    setLoadingChallenge(true);
    setApproved(null);
    setReason(null);
    setProvider(null);
    setVerifiedAt(null);
    setProofJson('');
    try {
      const res = await createVerificationChallenge();
      if (!res.ok || !res.challenge) {
        setChallenge(null);
        setReason(res.reason || 'server_error');
        return;
      }
      setChallenge(res.challenge);
    } finally {
      setLoadingChallenge(false);
    }
  };

  const submitProof = async () => {
    if (!challenge) {
      setReason('invalid_challenge');
      return;
    }
    if (expired) {
      setReason('challenge_expired');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(proofJson);
    } catch {
      setReason('invalid_proof_json');
      setApproved(false);
      return;
    }

    setSubmittingProof(true);
    setApproved(null);
    setReason(null);
    try {
      const res = await submitVerificationProof({
        challengeId: challenge.challengeId,
        challenge: challenge.challenge,
        proof: parsed,
      });
      setApproved(res.approved);
      setReason(res.reason || null);
      setProvider(res.provider || null);

      if (res.approved) {
        const latest = await getVerificationResult();
        setProvider(latest.provider || res.provider || null);
        setVerifiedAt(latest.verifiedAt || null);
      }
    } finally {
      setSubmittingProof(false);
    }
  };

  const getReasonMessage = (r: string | null) => {
    switch (r) {
      case 'rate_limited':
        return 'Too many attempts. Please wait a minute and retry.';
      case 'invalid_challenge':
        return 'The verification challenge is invalid. Generate a new one.';
      case 'challenge_used':
        return 'This challenge was already used. Generate a new one.';
      case 'challenge_expired':
        return 'This challenge has expired. Generate a new one.';
      case 'invalid_proof_json':
        return 'Proof must be valid JSON.';
      case 'invalid_proof':
        return 'The submitted proof could not be validated.';
      case 'duplicate_identity':
        return 'This identity is already linked to another account.';
      case 'verification_unavailable':
        return 'Verification service is temporarily unavailable. Please retry later.';
      case 'verification_failed':
        return 'Verification did not pass. Please retry with a new proof.';
      case 'unauthorized':
        return 'Please sign in before starting verification.';
      case 'server_error':
        return 'Unexpected server error. Please retry shortly.';
      case 'not_verified':
        return 'Verification has not completed yet.';
      default:
        return 'Verification failed. Please try again.';
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-white/75">
        <p className="font-medium text-white">How it works</p>
        <p className="mt-2">
          1. Generate a one-time challenge for your account.
          <br />
          2. Complete proof-of-personhood in the configured verifier.
          <br />
          3. Paste the proof JSON and submit.
        </p>
      </div>

      {!challenge ? (
        <div className="text-center">
          <Button onClick={startChallenge} disabled={loadingChallenge || !user}>
            {loadingChallenge ? 'Generating challenge...' : 'Generate Verification Challenge'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-white/10 bg-black/30 p-4">
          <div className="space-y-1 text-xs text-white/70">
            <p>
              <span className="text-white/90">Challenge ID:</span> {challenge.challengeId}
            </p>
            <p>
              <span className="text-white/90">Expires:</span>{' '}
              {challenge.expiresAtMs ? new Date(challenge.expiresAtMs).toLocaleString() : 'soon'}
            </p>
            {challenge.sessionId && (
              <p>
                <span className="text-white/90">Session:</span> {challenge.sessionId}
              </p>
            )}
          </div>

          <div className="rounded border border-white/10 bg-black/40 p-3 text-xs font-mono text-white/80 break-all">
            {challenge.challenge}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {challenge.verificationUrl ? (
              <Button asChild variant="secondary">
                <a href={challenge.verificationUrl} target="_blank" rel="noopener noreferrer">
                  Open Verification App
                </a>
              </Button>
            ) : (
              <p className="text-xs text-white/60">
                No start URL configured. Use your verifier tooling with the challenge above.
              </p>
            )}
            <Button variant="outline" onClick={startChallenge} disabled={loadingChallenge}>
              Regenerate Challenge
            </Button>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/80">Proof JSON</label>
            <Textarea
              value={proofJson}
              onChange={(e) => setProofJson(e.target.value)}
              placeholder='{"proof":"...","nullifier":"..."}'
              className="min-h-40 bg-black/40 border-white/20 text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={submitProof} disabled={submittingProof || !proofJson.trim() || expired}>
              {submittingProof ? 'Submitting proof...' : 'Submit Proof'}
            </Button>
            {expired && <span className="text-xs text-rose-300">Challenge expired. Regenerate before submitting.</span>}
          </div>
        </div>
      )}

      {approved === true && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-4 text-emerald-300">
          <p className="font-semibold">Verification approved.</p>
          {provider && <p className="text-sm mt-1">Provider: {provider}</p>}
          {verifiedAt && <p className="text-sm">Verified at: {new Date(verifiedAt).toLocaleString()}</p>}
        </div>
      )}

      {approved === false && reason && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-900/20 p-4 text-rose-300">
          <p className="font-semibold">Verification not approved.</p>
          <p className="text-sm mt-1">{getReasonMessage(reason)}</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-white/60 inline">We store only your profile and verification state.</p>
        <Button variant="link" className="text-xs p-0 ml-1" onClick={() => setShowInfo((s) => !s)}>
          {showInfo ? 'Hide details' : 'What we store'}
        </Button>
      </div>
      {showInfo && (
        <div className="mt-2 text-xs text-white/70 border border-white/10 rounded p-3 bg-black/30">
          <p>- We do not store ID images, selfies, or raw proof payloads.</p>
          <p>- We store only verification state (`kycVerified`) and minimal personhood metadata on your account.</p>
          <p>- Deduplication uses a one-way HMAC hash of a provider nullifier to prevent duplicate identities.</p>
        </div>
      )}
    </div>
  );
}
