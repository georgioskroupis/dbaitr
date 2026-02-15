export type Role = 'super-admin' | 'admin' | 'moderator' | 'supporter' | 'viewer' | 'restricted';

export type Status = 'Grace' | 'Verified' | 'Suspended' | 'Banned' | 'Deleted';

export interface ClaimsShape {
  role?: Role;
  status?: Status;
  kycVerified?: boolean;
  graceUntilMs?: number;
  claimsChangedAt?: number;
}

export interface SessionSnapshot {
  uid: string;
  email: string | null;
  role: Role;
  status: Status;
  kycVerified: boolean;
}
