
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { DocumentData } from 'firebase/firestore';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore'; // Import Timestamp
import * as React from 'react';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { logger } from '@/lib/logger';
import { auth, db } from '@/lib/firebase';
import type { UserProfile } from '@/types';
// Avoid server action import in client provider

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  kycVerified: boolean;
  isSuspended: boolean; // Added for KYC grace period
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
  // Track the Firestore user profile listener so we can reliably unsubscribe on sign-out
  const profileUnsubRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      logger.debug("📡 [AuthContext] onAuthStateChanged triggered:", firebaseUser);
      setLoading(true); 
      // Always tear down any previous profile listener before switching user state
      try { if (profileUnsubRef.current) { profileUnsubRef.current(); profileUnsubRef.current = null; } } catch {}
      if (firebaseUser) {
        setUser(firebaseUser);

        // Profile creation ensured server-side on first write; skip client-side server action

        const userDocRef = doc(db, "users", firebaseUser.uid);
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
            const current = auth.currentUser;
            if (current) {
              const t = await current.getIdToken();
              const res = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${t}` } });
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
        setLoading(false); 
      }
    });
    return () => unsubscribeAuth();
  }, []); 
  
  const kycVerified = !!userProfile?.kycVerified; 

  useEffect(() => {
    if (userProfile && !userProfile.kycVerified && userProfile.registeredAt) {
      try {
        const registeredDate = new Date(userProfile.registeredAt); 
        if (isNaN(registeredDate.getTime())) {
          logger.warn("[AuthContext] Invalid registeredAt date for suspension check:", userProfile.registeredAt);
          setIsSuspended(false); 
          return;
        }
        const gracePeriodEndDate = new Date(registeredDate);
        gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 10);
        const now = new Date();
        setIsSuspended(now > gracePeriodEndDate);
      } catch (e) {
        logger.error("[AuthContext] Error calculating suspension status:", e);
        setIsSuspended(false);
      }
    } else {
      setIsSuspended(false);
    }
  }, [userProfile]);

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
