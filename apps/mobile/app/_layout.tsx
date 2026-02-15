import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#101936' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#f8fafc' },
      }}
    />
  );
}
