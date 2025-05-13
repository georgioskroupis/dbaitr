
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
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
          try {
            console.log(`[AuthContext] Retrying user profile creation for ${firebaseUser.uid}...`);
            await createUserProfile(
              firebaseUser.uid,
              firebaseUser.email,
              firebaseUser.displayName,
              firebaseUser.providerData[0]?.providerId
            );
            console.log(`[AuthContext] Profile creation retry successful for ${firebaseUser.uid}`);
          } catch (retryError: any) {
            console.error(`[AuthContext] Error on profile creation retry for ${firebaseUser.uid}:`, retryError.message);
          }
        }

        const userDocRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            // Ensure registeredAt is a string for client-side date manipulation
            if (profileData.registeredAt && typeof profileData.registeredAt !== 'string') {
                 profileData.registeredAt = (profileData.registeredAt as unknown as Timestamp).toDate().toISOString();
            }
            setUserProfile(profileData);
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
          setIsSuspended(false); // Cannot determine suspension with invalid date
          return;
        }
        const gracePeriodEndDate = new Date(registeredDate.setDate(registeredDate.getDate() + 10));
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
