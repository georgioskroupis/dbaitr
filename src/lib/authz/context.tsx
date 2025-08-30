"use client";

import * as React from 'react';
import { getAuth } from '@/lib/firebase/client';
import type { Role, Status, CapabilityKey } from './types';
import { CapabilitiesByRole } from './types';
import { getDbClient } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';

type AuthZ = {
  user: any | null;
  role: Role | undefined;
  status: Status | undefined;
  kycVerified: boolean;
  can: Record<CapabilityKey, boolean>;
  claimsChangedAt?: string | null;
};

const AuthZContext = React.createContext<AuthZ>({ user: null, role: undefined, status: undefined, kycVerified: false, can: { } as any });

export function AuthZProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthZ>({ user: null, role: undefined, status: undefined, kycVerified: false, can: {} as any });

  React.useEffect(() => {
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) { setState({ user: null, role: undefined, status: undefined, kycVerified: false, can: {} as any }); return; }
      // Refresh token to pick latest claims
      await u.getIdToken(true).catch(() => {});
      const res = await u.getIdTokenResult();
      const role = (res.claims as any).role as Role | undefined;
      const status = (res.claims as any).status as Status | undefined;
      const kyc = !!(res.claims as any).kycVerified;
      const can = Object.fromEntries(Object.keys(CapabilitiesByRole).flatMap(k=>[]) as any);
      const caps = CapabilitiesByRole[role || 'restricted'] || [];
      const map: any = {};
      for (const c of caps) map[c] = true;
      setState({ user: u, role, status, kycVerified: kyc, can: map });
      // Subscribe to claimsChangedAt
      const db = getDbClient();
      const ref = doc(db, 'user_private', u.uid);
      const unsub2 = onSnapshot(ref, async (snap) => {
        const t = (snap.exists() ? (snap.data() as any).claimsChangedAt : null) || null;
        if (t) { await u.getIdToken(true).catch(()=>{}); const r2 = await u.getIdTokenResult(); const role2 = (r2.claims as any).role as Role | undefined; const status2 = (r2.claims as any).status as Status | undefined; const kyc2 = !!(r2.claims as any).kycVerified; const caps2 = CapabilitiesByRole[role2 || 'restricted'] || []; const map2: any = {}; for (const c of caps2) map2[c] = true; setState(s => ({ ...s, role: role2, status: status2, kycVerified: kyc2, can: map2, claimsChangedAt: t })); broadcastClaimsChanged(); }
      });
      // Clean up nested subscription when user logs out
      return () => { try { unsub2(); } catch {} };
    });
    return () => unsub();
  }, []);

  return <AuthZContext.Provider value={state}>{children}</AuthZContext.Provider>;
}

export function useAuthZ() { return React.useContext(AuthZContext); }

function broadcastClaimsChanged() {
  try { new BroadcastChannel('authz').postMessage({ type: 'claimsChanged' }); } catch {}
}

