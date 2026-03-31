import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function OAuthRedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-[#F8F7F4] dark:bg-[#121212]">
      <ActivityIndicator size="large" />
    </View>
  );
}
