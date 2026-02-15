import React from 'react';
import type { BootstrappedProfile } from '@dbaitr/shared/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  ensureNativeAppCheck,
  getAppCheckInitError,
  getCurrentUser,
  registerWithEmailPassword,
  signInWithEmailPassword,
  signOutCurrentUser,
  subscribeAuthState,
} from '../firebase/native';
import { bootstrapUser } from './api';

type AuthContextValue = {
  initializing: boolean;
  user: FirebaseAuthTypes.User | null;
  profile: BootstrappedProfile | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'unknown_error');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = React.useState(true);
  const [user, setUser] = React.useState<FirebaseAuthTypes.User | null>(null);
  const [profile, setProfile] = React.useState<BootstrappedProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const bootstrapProfileForUser = React.useCallback(
    async (actor: FirebaseAuthTypes.User | null, opts?: { fullName?: string }) => {
      if (!actor) {
        setProfile(null);
        return;
      }
      const fullName = String(opts?.fullName || actor.displayName || '').trim() || undefined;
      const result = await bootstrapUser(fullName);
      if (!result?.ok || !result.profile) {
        const reason = result?.error || 'bootstrap_failed';
        setError(reason);
        setProfile(null);
        return;
      }
      setError(null);
      setProfile(result.profile);
    },
    []
  );

  React.useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        await ensureNativeAppCheck();
      } catch {
        const reason = getAppCheckInitError() || 'appcheck_init_failed';
        if (mounted) setError(reason);
      }

      unsubscribe = subscribeAuthState(async (nextUser) => {
        if (!mounted) return;
        setUser(nextUser);
        if (!nextUser) {
          setProfile(null);
          setInitializing(false);
          return;
        }
        try {
          await bootstrapProfileForUser(nextUser);
        } finally {
          if (mounted) setInitializing(false);
        }
      });
    })();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [bootstrapProfileForUser]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    setError(null);
    await signInWithEmailPassword(email, password);
    await bootstrapProfileForUser(getCurrentUser());
  }, [bootstrapProfileForUser]);

  const signUp = React.useCallback(async (email: string, password: string, fullName: string) => {
    setError(null);
    await registerWithEmailPassword(email, password, fullName);
    await bootstrapProfileForUser(getCurrentUser(), { fullName });
  }, [bootstrapProfileForUser]);

  const signOut = React.useCallback(async () => {
    await signOutCurrentUser();
    setProfile(null);
  }, []);

  const refreshProfile = React.useCallback(async () => {
    await bootstrapProfileForUser(user);
  }, [bootstrapProfileForUser, user]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ initializing, user, profile, error, signIn, signUp, signOut, refreshProfile }),
    [initializing, user, profile, error, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
