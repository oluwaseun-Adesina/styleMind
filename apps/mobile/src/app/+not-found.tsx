import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.includes('oauthredirect')) {
      router.replace('/');
    }
  }, [pathname, router]);

  return (
    <View className="flex-1 items-center justify-center bg-[#F8F7F4] dark:bg-[#121212] px-6">
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-center text-[#8E8E8A] dark:text-gray-400">
        Redirecting back into FitPick...
      </Text>
    </View>
  );
}
