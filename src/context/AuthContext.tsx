
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { DocumentData } from 'firebase/firestore';
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; // Added onSnapshot for real-time updates
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase/config';
import type { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  kycVerified: boolean; // Changed from isVerified
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // setLoading(true) here ensures we are in loading state when auth check begins
    // It was previously inside onAuthStateChanged, which might be too late if initial check is fast.
    // However, the onAuthStateChanged callback itself manages loading for async operations within.
    // Let's keep initial setLoading(true) before the listener for clarity that an auth check is pending.
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true); // Ensure loading is true while processing auth state
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            setUserProfile(null); 
          }
          setLoading(false); // Profile loaded or confirmed not to exist
        }, (error) => {
          console.error("Error listening to user profile:", error);
          setUserProfile(null);
          setLoading(false); // Error occurred, stop loading
        });
        return () => unsubscribeProfile(); 
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false); // No user, stop loading
      }
    });
    return () => unsubscribeAuth();
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount.
  
  const kycVerified = !!userProfile?.kycVerified; // Changed from isVerified

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
