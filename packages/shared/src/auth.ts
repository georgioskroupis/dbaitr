export interface CheckEmailRequest {
  email: string;
}

export interface CheckEmailResponse {
  ok: boolean;
  exists: boolean;
  methods?: string[];
  source?: string;
  confidence?: 'high' | 'medium' | 'low';
  error?: string;
}

export type UserStatus = 'grace' | 'verified' | 'suspended' | 'banned' | 'deleted';

export interface BootstrappedProfile {
  uid: string;
  email: string | null;
  fullName: string;
  role: string;
  status: UserStatus;
  kycVerified: boolean;
  provider: 'password' | 'google' | 'apple' | 'unknown';
}

export interface BootstrapRequest {
  fullName?: string;
}

export interface BootstrapResponse {
  ok: boolean;
  profile?: BootstrappedProfile;
  error?: string;
}

export interface MeResponse {
  ok: boolean;
  profile: Record<string, unknown> | null;
  error?: string;
}
