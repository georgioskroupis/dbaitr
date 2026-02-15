import appCheck from '@react-native-firebase/app-check';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getMobileEnv } from '../env';

let appCheckInitPromise: Promise<void> | null = null;
let appCheckInitError: string | null = null;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'unknown_error');
}

export async function ensureNativeAppCheck(): Promise<void> {
  if (appCheckInitPromise) return appCheckInitPromise;

  appCheckInitPromise = (async () => {
    const env = getMobileEnv();
    const debugToken = env.appCheckDebugToken || undefined;
    const instance = appCheck() as any;
    const candidates: Array<() => Promise<unknown>> = debugToken
      ? [
          () => Promise.resolve(instance.activate(debugToken, true)),
          () => Promise.resolve(instance.activate(undefined, undefined, true)),
          () => Promise.resolve(instance.activate()),
        ]
      : [
          () => Promise.resolve(instance.activate(undefined, true)),
          () => Promise.resolve(instance.activate(undefined, undefined, true)),
          () => Promise.resolve(instance.activate()),
        ];

    let lastError: unknown = null;
    let activated = false;
    for (const run of candidates) {
      try {
        await run();
        activated = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!activated) {
      throw lastError || new Error('appcheck_activate_failed');
    }
    appCheckInitError = null;
  })();

  try {
    await appCheckInitPromise;
  } catch (error) {
    appCheckInitError = errorMessage(error);
    appCheckInitPromise = null;
    throw error;
  }
}

export function getAppCheckInitError(): string | null {
  return appCheckInitError;
}

export async function getNativeAppCheckToken(forceRefresh = false): Promise<string | null> {
  try {
    await ensureNativeAppCheck();
    const result = await appCheck().getToken(forceRefresh);
    return result?.token || null;
  } catch {
    return null;
  }
}

export function subscribeAuthState(listener: (user: FirebaseAuthTypes.User | null) => void): () => void {
  return auth().onAuthStateChanged(listener);
}

export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return auth().currentUser;
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function signInWithEmailPassword(email: string, password: string) {
  return auth().signInWithEmailAndPassword(email.trim(), password);
}

export async function registerWithEmailPassword(email: string, password: string, fullName: string) {
  const cred = await auth().createUserWithEmailAndPassword(email.trim(), password);
  const cleanName = fullName.trim();
  if (cleanName) {
    await cred.user.updateProfile({ displayName: cleanName });
  }
  return cred;
}

export async function signOutCurrentUser() {
  await auth().signOut();
}
