import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri, type AuthRequestPromptOptions, type AuthSessionResult } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { postJson, saveAuth } from '@/firebase';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_IDS = {
  android: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
  web: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
};

const getGoogleNativeRedirectUri = () => {
  const nativeClientId = Platform.select({
    android: GOOGLE_CLIENT_IDS.android,
    ios: GOOGLE_CLIENT_IDS.ios,
    default: undefined,
  });

  if (!nativeClientId) {
    return undefined;
  }

  const clientIdPrefix = nativeClientId.replace(/\.apps\.googleusercontent\.com$/, '');
  return makeRedirectUri({
    native: `com.googleusercontent.apps.${clientIdPrefix}:/oauthredirect`,
  });
};

type GoogleAuthContextValue = {
  authLoading: boolean;
  isConfigured: boolean;
  isReady: boolean;
  promptAsync: (options?: AuthRequestPromptOptions) => Promise<AuthSessionResult>;
  lastAuthResult: { token: string; user: any } | null;
};

const GoogleAuthContext = createContext<GoogleAuthContextValue | null>(null);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const handledAccessTokenRef = useRef<string | null>(null);
  const googleRedirectUri = getGoogleNativeRedirectUri();
  const [authLoading, setAuthLoading] = useState(false);
  const [lastAuthResult, setLastAuthResult] = useState<{ token: string; user: any } | null>(null);
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_IDS.android,
    iosClientId: GOOGLE_CLIENT_IDS.ios,
    webClientId: GOOGLE_CLIENT_IDS.web,
    ...(googleRedirectUri ? { redirectUri: googleRedirectUri } : {}),
  });

  useEffect(() => {
    const accessToken = response?.type === 'success' ? response.authentication?.accessToken : undefined;

    if (!accessToken || handledAccessTokenRef.current === accessToken) {
      return;
    }

    handledAccessTokenRef.current = accessToken;

    const completeGoogleLogin = async () => {
      setAuthLoading(true);
      try {
        const data = await postJson<{ token: string; user: any }>('/api/auth/google', {
          token: accessToken,
        });
        await saveAuth(data.token, data.user);
        setLastAuthResult({ token: data.token, user: data.user });
      } catch (error) {
        console.error('Google auth completion failed', error);
      } finally {
        setAuthLoading(false);
      }
    };

    void completeGoogleLogin();
  }, [response]);

  const value = useMemo<GoogleAuthContextValue>(
    () => ({
      authLoading,
      lastAuthResult,
      isConfigured: Boolean(
        Platform.select({
          android: GOOGLE_CLIENT_IDS.android,
          ios: GOOGLE_CLIENT_IDS.ios,
          default: GOOGLE_CLIENT_IDS.web,
        })
      ),
      isReady: Boolean(request),
      promptAsync,
    }),
    [authLoading, lastAuthResult, promptAsync, request]
  );

  return <GoogleAuthContext.Provider value={value}>{children}</GoogleAuthContext.Provider>;
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);

  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }

  return context;
}
