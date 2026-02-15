import { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { IdvChallengeResponse } from '@dbaitr/shared/idv';

const PLACEHOLDER_CHALLENGE: IdvChallengeResponse = {
  ok: true,
  provider: 'self_openpassport',
  challengeId: 'phase-1-placeholder',
  challenge: 'phase-1-placeholder',
  expiresAtMs: Date.now() + 10 * 60 * 1000,
  verificationUrl: null,
};

export default function VerifyScreen() {
  const expiresAt = useMemo(() => new Date(PLACEHOLDER_CHALLENGE.expiresAtMs).toISOString(), []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Native Verification (Phase 1)</Text>
        <Text style={styles.body}>
          This screen is intentionally a scaffold. In Phase 2+, it will create a signed challenge via API,
          launch the in-app verifier flow, and submit proof to your self-hosted backend.
        </Text>
        <Text style={styles.meta}>Provider: {PLACEHOLDER_CHALLENGE.provider}</Text>
        <Text style={styles.meta}>Challenge expires: {expiresAt}</Text>
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
    backgroundColor: '#ffffff',
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
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
  meta: {
    fontSize: 13,
    color: '#475569',
  },
});
