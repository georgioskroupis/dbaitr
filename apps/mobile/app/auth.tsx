import React from 'react';
import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { checkEmailExists } from '../src/auth/api';
import { useAuth } from '../src/auth/AuthProvider';

export default function AuthScreen() {
  const { user, error: authError, signIn, signUp } = useAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [checking, setChecking] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [knownAccount, setKnownAccount] = React.useState<boolean | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();

  const checkEmail = React.useCallback(async () => {
    setLocalError(null);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setLocalError('Enter a valid email.');
      return;
    }

    setChecking(true);
    try {
      const result = await checkEmailExists(normalizedEmail);
      if (!result?.ok) {
        setLocalError(result?.error || 'Unable to check email right now.');
        return;
      }
      setKnownAccount(!!result.exists);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to check email right now.');
    } finally {
      setChecking(false);
    }
  }, [normalizedEmail]);

  const submit = React.useCallback(async () => {
    setLocalError(null);
    if (!normalizedEmail) {
      setLocalError('Email is required.');
      return;
    }
    if (!password || password.length < 8) {
      setLocalError('Use a password with at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (knownAccount) {
        await signIn(normalizedEmail, password);
      } else {
        const name = fullName.trim();
        if (name.length < 3 || !name.includes(' ')) {
          setLocalError('Enter your full legal name.');
          return;
        }
        await signUp(normalizedEmail, password, name);
      }
      router.replace('/');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }, [fullName, knownAccount, normalizedEmail, password, signIn, signUp]);

  if (user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>You are signed in.</Text>
          <Text style={styles.body}>Continue to verification or return to the home screen.</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/')}>
            <Text style={styles.buttonText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign in to dbaitr</Text>
        <Text style={styles.body}>We check your email first, then route to login or registration.</Text>

        <TextInput
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          style={styles.input}
          onChangeText={(value) => {
            setEmail(value);
            setKnownAccount(null);
          }}
        />

        {knownAccount === null && (
          <Pressable style={styles.button} disabled={checking} onPress={checkEmail}>
            <Text style={styles.buttonText}>{checking ? 'Checking…' : 'Continue'}</Text>
          </Pressable>
        )}

        {knownAccount !== null && (
          <>
            {!knownAccount && (
              <TextInput
                value={fullName}
                autoCapitalize="words"
                placeholder="Full legal name"
                style={styles.input}
                onChangeText={setFullName}
              />
            )}
            <TextInput
              value={password}
              secureTextEntry
              placeholder={knownAccount ? 'Password' : 'Create password'}
              style={styles.input}
              onChangeText={setPassword}
            />
            <Pressable style={styles.button} disabled={submitting} onPress={submit}>
              <Text style={styles.buttonText}>
                {submitting ? 'Please wait…' : knownAccount ? 'Sign In' : 'Create Account'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.linkButton]}
              onPress={() => {
                setKnownAccount(null);
                setPassword('');
                setFullName('');
                setLocalError(null);
              }}
            >
              <Text style={styles.linkText}>Use a different email</Text>
            </Pressable>
          </>
        )}

        {(localError || authError) && <Text style={styles.errorText}>{localError || authError}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    justifyContent: 'center',
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
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#fff',
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
  linkButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
});
