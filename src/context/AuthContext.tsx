
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
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Set up a real-time listener for user profile changes
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            setUserProfile(null); 
          }
          // Ensure loading is set to false after profile is fetched or listener updates
          // This might need to be coordinated if auth state changes rapidly
          if (loading) setLoading(false); 
        }, (error) => {
          console.error("Error listening to user profile:", error);
          setUserProfile(null);
          if (loading) setLoading(false);
        });
        // Return this inner unsubscribe when the auth state changes or component unmounts
        return () => unsubscribeProfile(); 
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });
    // This outer unsubscribe is for the auth state listener
    return () => unsubscribeAuth();
  }, [loading]); // Added loading to dependency array to manage its state carefully
  
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
