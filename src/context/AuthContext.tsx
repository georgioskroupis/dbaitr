
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore'; // Import Timestamp
import * as React from 'react';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { logger } from '@/lib/logger';
import { getAuth, getDb } from '@/lib/firebase/client';
import type { UserProfile } from '@/types';
import { apiFetch } from '@/lib/http/client';
import { withinGraceWindow } from '@/lib/authz/grace';
// Avoid server action import in client provider

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  kycVerified: boolean;
  isSuspended: boolean; // Added for verification grace period
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to convert Firestore Timestamps to ISO strings within an object
const convertProfileTimestamps = (data: any): UserProfile => {
  const profile = { ...data } as UserProfile; // Cast to UserProfile

  if (data.createdAt && data.createdAt instanceof Timestamp) {
    profile.createdAt = data.createdAt.toDate().toISOString();
  } else if (data.createdAt && typeof data.createdAt === 'object' && 'seconds' in data.createdAt) {
    profile.createdAt = new Timestamp(data.createdAt.seconds, data.createdAt.nanoseconds).toDate().toISOString();
  }

  if (data.updatedAt && data.updatedAt instanceof Timestamp) {
    profile.updatedAt = data.updatedAt.toDate().toISOString();
  } else if (data.updatedAt && typeof data.updatedAt === 'object' && 'seconds' in data.updatedAt) {
    profile.updatedAt = new Timestamp(data.updatedAt.seconds, data.updatedAt.nanoseconds).toDate().toISOString();
  }
  
  if (data.registeredAt && data.registeredAt instanceof Timestamp) {
    profile.registeredAt = data.registeredAt.toDate().toISOString();
  } else if (data.registeredAt && typeof data.registeredAt === 'object' && 'seconds' in data.registeredAt) {
    profile.registeredAt = new Timestamp(data.registeredAt.seconds, data.registeredAt.nanoseconds).toDate().toISOString();
  }
  return profile;
};


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimKycVerified, setClaimKycVerified] = useState(false);
  // Track the Firestore user profile listener so we can reliably unsubscribe on sign-out
  const profileUnsubRef = useRef<null | (() => void)>(null);
  const claimsUnsubRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(getAuth(), async (firebaseUser) => {
      logger.debug("📡 [AuthContext] onAuthStateChanged triggered:", firebaseUser);
      setLoading(true); 
      // Always tear down any previous profile listener before switching user state
      try { if (profileUnsubRef.current) { profileUnsubRef.current(); profileUnsubRef.current = null; } } catch {}
      try { if (claimsUnsubRef.current) { claimsUnsubRef.current(); claimsUnsubRef.current = null; } } catch {}
      if (firebaseUser) {
        setUser(firebaseUser);

        // Ensure server-owned profile bootstrap and default claims.
        try {
          await apiFetch('/api/users/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: (firebaseUser.displayName || '').trim() || undefined,
            }),
          });
        } catch {}

        // Read claims from ID token, then keep them fresh on claimsChangedAt updates.
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult();
          setClaimStatus(String((idTokenResult.claims as any)?.status || '') || null);
          setClaimKycVerified(!!(idTokenResult.claims as any)?.kycVerified);
        } catch {
          setClaimStatus(null);
          setClaimKycVerified(false);
        }

        const claimsDocRef = doc(getDb(), 'user_private', firebaseUser.uid);
        const unsubscribeClaims = onSnapshot(claimsDocRef, async () => {
          try {
            const fresh = await firebaseUser.getIdTokenResult(true);
            setClaimStatus(String((fresh.claims as any)?.status || '') || null);
            setClaimKycVerified(!!(fresh.claims as any)?.kycVerified);
          } catch {}
        }, () => {});
        claimsUnsubRef.current = unsubscribeClaims;

        const userDocRef = doc(getDb(), "users", firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const rawProfileData = docSnap.data();
            const processedProfileData = convertProfileTimestamps(rawProfileData);
            setUserProfile(processedProfileData);
            setLoading(false);
          } else {
            setUserProfile(null);
            setLoading(false);
            logger.warn(`[AuthContext] User profile document not found for UID: ${firebaseUser.uid} after creation attempt.`);
          }
        }, async (error: any) => {
          // During sign-out or App Check hiccups, a permission error can surface here. Avoid noisy logs.
          const code = error?.code || '';
          if (code !== 'permission-denied') {
            logger.error("[AuthContext] Error listening to user profile:", error);
          } else {
            logger.debug("[AuthContext] Profile listener permission-denied (likely sign-out or App Check)");
          }
          // Fallback: fetch via admin API in case rules block client read
          try {
            // Only try fallback if still authenticated
            const current = getAuth().currentUser;
            if (current) {
              const res = await apiFetch('/api/users/me');
              if (res.ok) {
                const j = await res.json();
                if (j?.ok) setUserProfile(j.profile || null);
              }
            }
          } catch {}
          setLoading(false);
        });
        // remember unsub so we can tear it down cleanly on auth changes
        profileUnsubRef.current = unsubscribeProfile;
        return; 
      } else {
        setUser(null);
        setUserProfile(null);
        setClaimStatus(null);
        setClaimKycVerified(false);
        setLoading(false); 
      }
    });
    return () => {
      try { unsubscribeAuth(); } catch {}
      try { if (profileUnsubRef.current) profileUnsubRef.current(); } catch {}
      try { if (claimsUnsubRef.current) claimsUnsubRef.current(); } catch {}
    };
  }, []); 
  
  // Claims are the source of truth for authorization-sensitive verification state.
  const kycVerified = claimKycVerified;

  useEffect(() => {
    const hardBlocked = claimStatus === 'Suspended' || claimStatus === 'Banned' || claimStatus === 'Deleted';
    if (hardBlocked) {
      setIsSuspended(true);
      return;
    }
    if (!user) {
      setIsSuspended(false);
      return;
    }
    if (kycVerified) {
      setIsSuspended(false);
      return;
    }
    const creationTime = user.metadata?.creationTime || null;
    setIsSuspended(!withinGraceWindow(creationTime));
  }, [user, kycVerified, claimStatus]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, kycVerified, isSuspended }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
