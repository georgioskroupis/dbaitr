
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { DocumentData } from 'firebase/firestore';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore'; // Import Timestamp
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase/config';
import type { UserProfile } from '@/types';
import { createUserProfile } from '@/lib/firestoreActions'; 

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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("📡 [AuthContext] onAuthStateChanged triggered:", firebaseUser);
      setLoading(true); 
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          console.log(`[AuthContext] Ensuring profile for UID: ${firebaseUser.uid}`);
          await createUserProfile(
            firebaseUser.uid,
            firebaseUser.email,
            firebaseUser.displayName,
            firebaseUser.providerData[0]?.providerId
          );
        } catch (profileError: any) {
          console.error(`[AuthContext] Error ensuring user profile for ${firebaseUser.uid}:`, profileError.message);
        }

        const userDocRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const rawProfileData = docSnap.data();
            const processedProfileData = convertProfileTimestamps(rawProfileData);
            setUserProfile(processedProfileData);
          } else {
            setUserProfile(null); 
            console.warn(`[AuthContext] User profile document not found for UID: ${firebaseUser.uid} after creation attempt.`);
          }
          setLoading(false); 
        }, (error) => {
          console.error("[AuthContext] Error listening to user profile:", error);
          setUserProfile(null);
          setLoading(false); 
        });
        return () => unsubscribeProfile(); 
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
          console.warn("[AuthContext] Invalid registeredAt date for suspension check:", userProfile.registeredAt);
          setIsSuspended(false); 
          return;
        }
        const gracePeriodEndDate = new Date(registeredDate);
        gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 10);
        const now = new Date();
        setIsSuspended(now > gracePeriodEndDate);
      } catch (e) {
        console.error("[AuthContext] Error calculating suspension status:", e);
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

