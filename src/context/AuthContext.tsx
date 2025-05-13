
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { DocumentData } from 'firebase/firestore';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase/config';
import type { UserProfile } from '@/types';
import { createUserProfile } from '@/lib/firestoreActions'; // Import createUserProfile

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  kycVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true); 
      if (firebaseUser) {
        setUser(firebaseUser);

        // Ensure user profile exists in Firestore
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
          // Simple one-time retry logic
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
            setUserProfile(docSnap.data() as UserProfile);
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

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, kycVerified }}>
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

