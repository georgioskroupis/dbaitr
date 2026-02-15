import React from 'react';
import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { IdvChallengeResponse, IdvResultResponse } from '@dbaitr/shared/idv';
import { useAuth } from '../src/auth/AuthProvider';
import { createIdvChallenge, fetchIdvResult } from '../src/idvApi';

export default function VerifyScreen() {
  const { user, profile } = useAuth();
  const [challenge, setChallenge] = React.useState<IdvChallengeResponse | null>(null);
  const [result, setResult] = React.useState<IdvResultResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const createChallenge = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await createIdvChallenge();
      if (!response?.ok) {
        setError('Unable to create verification challenge.');
        return;
      }
      setChallenge(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create verification challenge.');
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshResult = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchIdvResult();
      if (!response) {
        setError('Unable to fetch verification status.');
        return;
      }
      setResult(response);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to fetch verification status.');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (!challenge || result?.approved) return;
    const timer = setInterval(() => {
      void refreshResult();
    }, 10_000);
    return () => clearInterval(timer);
  }, [challenge, refreshResult, result?.approved]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Native Verification</Text>
          <Text style={styles.body}>Sign in first. Verification endpoints require ID token and App Check.</Text>
          <Link href="/auth" style={styles.link}>Go to Sign In</Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Native Verification</Text>
        <Text style={styles.body}>
          Status: {profile?.kycVerified ? 'Already verified' : 'Not verified'}
        </Text>

        <Pressable style={styles.button} disabled={busy} onPress={() => void createChallenge()}>
          <Text style={styles.buttonText}>{busy ? 'Please wait…' : 'Generate Challenge'}</Text>
        </Pressable>

        {!!challenge && (
          <View style={styles.panel}>
            <Text style={styles.meta}>Challenge ID: {challenge.challengeId}</Text>
            <Text style={styles.meta}>Expires: {new Date(challenge.expiresAtMs).toLocaleString()}</Text>
            {challenge.verificationUrl ? (
              <Pressable style={styles.secondaryButton} onPress={() => void Linking.openURL(challenge.verificationUrl || '')}>
                <Text style={styles.secondaryButtonText}>Open Verification App</Text>
              </Pressable>
            ) : (
              <Text style={styles.meta}>No verification URL returned.</Text>
            )}
          </View>
        )}

        <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => void refreshResult()}>
          <Text style={styles.secondaryButtonText}>Refresh Verification Status</Text>
        </Pressable>

        {!!result && (
          <View style={styles.panel}>
            <Text style={styles.meta}>Approved: {result.approved ? 'Yes' : 'No'}</Text>
            <Text style={styles.meta}>Reason: {result.reason || 'none'}</Text>
            <Text style={styles.meta}>Provider: {result.provider || 'unknown'}</Text>
            <Text style={styles.meta}>Verified At: {result.verifiedAt || 'n/a'}</Text>
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
  },
  panel: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  meta: {
    fontSize: 13,
    color: '#475569',
  },
  button: {
    borderRadius: 8,
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d4ed8',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '600',
  },
  link: {
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
});
