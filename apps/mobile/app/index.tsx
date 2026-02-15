import { Link } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';

export default function HomeScreen() {
  const { initializing, user, profile, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>dbaitr Mobile</Text>
        <Text style={styles.body}>
          Native auth + App Check are now wired. Verification APIs use the same protected backend contract as web.
        </Text>
        {initializing && <Text style={styles.meta}>Session: loading…</Text>}
        {!initializing && !user && <Text style={styles.meta}>Session: signed out</Text>}
        {!initializing && user && (
          <Text style={styles.meta}>
            Session: {profile?.fullName || user.email || 'signed in'} ({profile?.status || 'unknown'})
          </Text>
        )}
        {!user && (
          <Link href="/auth" style={styles.link}>
            Continue to Sign In
          </Link>
        )}
        <Link href="/verify" style={styles.link}>
          Open Personhood Verification
        </Link>
        {!!user && (
          <Pressable style={styles.button} onPress={() => void signOut()}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  meta: {
    fontSize: 13,
    color: '#475569',
  },
  button: {
    borderRadius: 8,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
