import { Stack } from 'expo-router';
import { AuthProvider } from '../src/auth/AuthProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#101936' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#f8fafc' },
        }}
      />
    </AuthProvider>
  );
}
