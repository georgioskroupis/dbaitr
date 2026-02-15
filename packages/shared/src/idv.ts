export type IdvProvider = 'self_openpassport';

export interface IdvChallengeResponse {
  ok: boolean;
  provider: IdvProvider;
  challengeId: string;
  challenge: string;
  expiresAtMs: number;
  verificationUrl: string | null;
  sessionId?: string;
}

export interface IdvVerifyRequest {
  challengeId: string;
  challenge: string;
  proof: unknown;
}

export interface IdvVerifyResponse {
  ok: boolean;
  approved: boolean;
  reason: string | null;
  provider?: IdvProvider;
}

export interface IdvResultResponse {
  success: boolean;
  approved: boolean;
  reason: string | null;
  provider: string | null;
  verifiedAt: string | null;
}

export interface MobileHandoffPayload {
  challengeId: string;
  challenge: string;
  expiresAtMs: number;
  verificationUrl: string | null;
}
