export type Role = 'super-admin' | 'admin' | 'moderator' | 'supporter' | 'viewer' | 'restricted';
export type Status = 'Grace' | 'Verified' | 'Suspended' | 'Banned' | 'Deleted';

export interface ClaimsShape {
  role?: Role;
  status?: Status;
  kycVerified?: boolean;
  [k: string]: unknown;
}

export type CapabilityKey =
  | 'create_topic'
  | 'post_statement'
  | 'post_thread'
  | 'host_live'
  | 'admin_panel'
  | 'moderate'
  | 'analysis_override'
  | 'analysis_recompute';

export const CapabilitiesByRole: Record<Role, CapabilityKey[]> = {
  'super-admin': ['create_topic','post_statement','post_thread','host_live','admin_panel','moderate','analysis_override','analysis_recompute'],
  'admin': ['create_topic','post_statement','post_thread','host_live','admin_panel','moderate','analysis_override','analysis_recompute'],
  'moderator': ['create_topic','post_statement','post_thread','moderate'],
  'supporter': ['create_topic','post_statement','post_thread','host_live'],
  'viewer': ['create_topic','post_statement','post_thread'],
  'restricted': [],
};

export function hasCapability(role: Role | undefined, cap: CapabilityKey): boolean {
  if (!role) return false;
  return CapabilitiesByRole[role].includes(cap);
}

export function minRoleForCapability(cap: CapabilityKey): Role {
  const order: Role[] = ['restricted','viewer','supporter','moderator','admin','super-admin'];
  for (const r of order) {
    if (CapabilitiesByRole[r].includes(cap)) return r;
  }
  return 'super-admin';
}
