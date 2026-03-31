import { Slot } from 'expo-router';
import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleAuthProvider } from '@/providers/google-auth-provider';
import '../global.css';

cssInterop(SafeAreaView, {
  className: 'style',
});

export default function Layout() {
  return (
    <GoogleAuthProvider>
      <Slot />
    </GoogleAuthProvider>
  );
}
