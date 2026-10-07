import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Modal, Linking, Image, KeyboardAvoidingView, Platform, Alert,
  useColorScheme as useNativeColorScheme,
  type ColorSchemeName
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { 
  Plus, Trash2, Sparkles, Shirt, Footprints, Watch, Briefcase, 
  ChevronRight, X, LogIn, LogOut, User as UserIcon, Heart,
  Mail, Lock, Sun, Moon, LayoutGrid, Settings, KeyRound, ArrowLeft, Pencil,
  Camera, Image as ImageIcon, Shield
} from 'lucide-react-native';
import { ClothingItem, OutfitSuggestion, ItemType, Formality, ItemAnalysis, SavedOutfitRecord, EventRecord, BulkAnalysisResult, OutfitImageResult } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyOutfitSuggestion, getOutfitImage, getOutfitSuggestion, markOutfitWorn, getEvents, addEvent, removeEvent } from '../services/geminiService';
import { apiFetch, ApiError, clearAuth, getToken, getUser, postJson, refreshSession, saveAuth, setAuthExpiredHandler } from '../apiClient';

// Photos sent for AI analysis (bulk batches must fit the API body limit).
const SCAN_MAX_WIDTH = 1024;
// Thumbnails stored on the wardrobe item (~25KB each).
const THUMB_MAX_WIDTH = 400;
const MAX_PHOTOS_PER_SCAN = 30;
const SCAN_BATCH_SIZE = 10; // backend max photos per /api/analyze-items call
const BULK_SAVE_CHUNK = 20;

// A scanned garment awaiting review before it's saved to the wardrobe.
interface ReviewItem {
  key: string;
  name: string;
  color: string;
  type: ItemType;
  formality: Formality;
  description: string;
  image?: string;
}

const DAILY_PICK_CACHE_KEY = 'dailyPickCache';
const TODAYS_PLAN_KEY = 'todaysPlan';

const todayStamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
import { MaxContentWidth } from '@/constants/theme';
import { useGoogleAuth } from '@/providers/google-auth-provider';

WebBrowser.maybeCompleteAuthSession();
const AMAZON_ASSOCIATE_TAG = process.env.EXPO_PUBLIC_AMAZON_ASSOCIATE_TAG?.trim();

const buildAmazonAffiliateUrl = (searchTerm: string) => {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', searchTerm);

  if (AMAZON_ASSOCIATE_TAG) {
    url.searchParams.set('tag', AMAZON_ASSOCIATE_TAG);
  }

  return url.toString();
};



function GoogleSignInButton({
  authLoading,
  colorScheme,
}: {
  authLoading: boolean;
  colorScheme: ColorSchemeName;
}) {
  const { promptAsync, isReady } = useGoogleAuth();

  return (
    <TouchableOpacity
      disabled={!isReady || authLoading}
      onPress={() => promptAsync()}
      className="border border-[#E5E5E1] dark:border-gray-800 py-4 rounded-2xl flex-row justify-center items-center">
      <LogIn color={colorScheme === 'dark' ? 'white' : '#1A1A1A'} size={20} />
      <Text className="text-[#1A1A1A] dark:text-white font-medium text-lg ml-2">Google Account</Text>
    </TouchableOpacity>
  );
}

export default function AppScreen() {
  const router = useRouter();
  const nativeColorScheme = useNativeColorScheme();
  const { authLoading: googleAuthLoading, isConfigured: hasGoogleSignIn, lastAuthResult, consumeAuthResult } = useGoogleAuth();
  const [activeTab, setActiveTab] = useState<'stylist' | 'lookbook'>('stylist');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfitRecord[]>([]);
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null);
  const [outfitImageUri, setOutfitImageUri] = useState('');
  const [isGeneratingOutfitImage, setIsGeneratingOutfitImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemMode, setItemMode] = useState<'manual' | 'photo'>('manual');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [lockedItemId, setLockedItemId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [outfitImageSource, setOutfitImageSource] = useState<OutfitImageResult['source']>();
  const [isAutoStyling, setIsAutoStyling] = useState(false);
  const [isDailyPick, setIsDailyPick] = useState(false);
  const [todaysPlan, setTodaysPlan] = useState('');
  const [showLocationHint, setShowLocationHint] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [numLooks, setNumLooks] = useState(1);
  const [looks, setLooks] = useState<OutfitSuggestion[]>([]);
  const [activeLook, setActiveLook] = useState(0);
  const hasAutoStyledRef = useRef(false);

  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Forgot-password flow: null = normal login, 'email' = enter email,
  // 'code' = enter the emailed code + new password.
  const [resetStep, setResetStep] = useState<null | 'email' | 'code'>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Account settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [hasPassword, setHasPassword] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // New item form state. When editingItemId is set, the Add Item modal acts
  // as an edit form for that wardrobe item instead.
  const [newItem, setNewItem] = useState<Partial<ClothingItem>>({
    type: 'top',
    formality: 'casual'
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const resetNewItemForm = () => {
    setNewItem({ type: 'top', formality: 'casual' });
    setEditingItemId(null);
    setItemMode('manual');
    setImageError('');
    setIsAnalyzingImage(false);
    setReviewItems([]);
    setScanProgress(null);
  };

  const startEditItem = (item: ClothingItem) => {
    resetNewItemForm();
    setEditingItemId(item.id);
    setNewItem({
      name: item.name,
      color: item.color,
      type: item.type,
      formality: item.formality,
      description: item.description,
      image: item.image,
    });
    setIsAddingItem(true);
  };

  const openAddItemModal = (mode: 'manual' | 'photo' = 'manual') => {
    setItemMode(mode);
    setIsAddingItem(true);
    setImageError('');
  };

  const closeAddItemModal = () => {
    setIsAddingItem(false);
    resetNewItemForm();
  };

  // Initial Auth Check — renew the session from a stored refresh token so users
  // aren't logged out when the access token expires.
  useEffect(() => {
    const initAuth = async () => {
      const savedPlan = await AsyncStorage.getItem(TODAYS_PLAN_KEY);
      if (savedPlan) setTodaysPlan(savedPlan);

      const refreshed = await refreshSession();
      if (refreshed) {
        setToken(refreshed.token);
        setUser(refreshed.user);
        setIsAuthReady(true);
        return;
      }

      const savedToken = await getToken();
      const savedUser = await getUser();
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(savedUser);
      }
      setIsAuthReady(true);
    };
    initAuth();
  }, []);

  // Persist today's plan
  useEffect(() => {
    AsyncStorage.setItem(TODAYS_PLAN_KEY, todaysPlan).catch(() => {});
  }, [todaysPlan]);

  // Log out when a session can't be refreshed (fired by apiFetch on a hard 401).
  useEffect(() => {
    setAuthExpiredHandler(() => {
      void handleLogout();
    });
    return () => setAuthExpiredHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lastAuthResult) {
      consumeAuthResult();
      router.replace('/');
    }
  }, [lastAuthResult, consumeAuthResult, router]);

  const handleEmailAuth = async () => {
    if (!email || !password) return;
    setAuthLoading(true);
    try {
      const endpoint = isRegistering ? '/api/auth/signup' : '/api/auth/login';
      const data = await postJson<{ token: string; refreshToken?: string; user: any }>(endpoint, { email, password });

      setToken(data.token);
      setUser(data.user);
      await saveAuth(data.token, data.user, data.refreshToken);
    } catch (error) {
      console.error('Email auth failed', error);
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Server error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const exitResetFlow = () => {
    setResetStep(null);
    setResetCode('');
    setNewPassword('');
  };

  const handleForgotPassword = async () => {
    if (!email) return;
    setAuthLoading(true);
    try {
      await postJson('/api/auth/forgot-password', { email });
      setResetStep('code');
    } catch (error) {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Server error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email || resetCode.length !== 6 || newPassword.length < 8) return;
    setAuthLoading(true);
    try {
      const data = await postJson<{ token: string; refreshToken?: string; user: any }>(
        '/api/auth/reset-password',
        { email, code: resetCode, newPassword }
      );
      exitResetFlow();
      setToken(data.token);
      setUser(data.user);
      await saveAuth(data.token, data.user, data.refreshToken);
    } catch (error) {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Server error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const openSettings = async () => {
    setIsSettingsOpen(true);
    setSettingsName(user?.name || '');
    setCurrentPassword('');
    setSettingsNewPassword('');
    setDeletePassword('');
    try {
      const me = await apiFetch<{ name?: string; hasPassword: boolean }>('/api/auth/me');
      setHasPassword(me.hasPassword);
      setSettingsName(me.name || '');
    } catch {
      // Fall back to local user data; password section assumes a password exists.
      setHasPassword(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!settingsName.trim()) return;
    setIsSavingSettings(true);
    try {
      const updated = await apiFetch<{ name?: string }>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: settingsName.trim() }),
      });
      const nextUser = { ...user, name: updated.name };
      setUser(nextUser);
      const savedToken = await getToken();
      if (savedToken) await saveAuth(savedToken, nextUser);
      Alert.alert('Saved', 'Profile updated.');
    } catch (error) {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Could not update the profile.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async () => {
    if (settingsNewPassword.length < 8 || (hasPassword && !currentPassword)) return;
    setIsSavingSettings(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          ...(hasPassword ? { currentPassword } : {}),
          newPassword: settingsNewPassword,
        }),
      });
      setCurrentPassword('');
      setSettingsNewPassword('');
      setHasPassword(true);
      Alert.alert('Saved', 'Password updated.');
    } catch (error) {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'Could not change the password.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Permanently delete the account and all data (Play Store requirement).
  const handleDeleteAccount = () => {
    if (hasPassword && !deletePassword) return;
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, wardrobe, saved outfits and events. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await apiFetch('/api/auth/me', {
                method: 'DELETE',
                body: JSON.stringify({
                  confirm: 'DELETE',
                  ...(hasPassword ? { password: deletePassword } : {}),
                }),
              });
              setIsSettingsOpen(false);
              await handleLogout();
              Alert.alert('Account deleted', 'Your account and all data have been removed.');
            } catch (error) {
              Alert.alert('Error', error instanceof ApiError ? error.message : 'Could not delete the account.');
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  // Fetch Wardrobe
  useEffect(() => {
    if (!user || !token) {
      setWardrobe([]);
      return;
    }

    const fetchWardrobe = async () => {
      try {
        const data = await apiFetch<ClothingItem[]>('/api/wardrobes');
        setWardrobe(data);
      } catch (error) {
        console.error("Failed to fetch wardrobe", error);
      }
    };

    fetchWardrobe();
  }, [user, token]);

  // Read coordinates only if location was already granted — never prompt on open.
  const getGrantedCoordinates = async (): Promise<{ lat?: number; lon?: number }> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setShowLocationHint(false);
        const location =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        return { lat: location?.coords.latitude, lon: location?.coords.longitude };
      }
      setShowLocationHint(true);
    } catch (e) {
      console.warn('Location unavailable for daily pick', e);
    }
    return {};
  };

  // Apply a fresh suggestion response, unpacking multiple looks when present.
  const applySuggestion = (res: OutfitSuggestion, daily: boolean) => {
    const opts = res.options && res.options.length > 1 ? res.options : [];
    setLooks(opts);
    setActiveLook(0);
    setSuggestion(opts.length ? opts[0] : res);
    setIsDailyPick(daily);
    setOutfitImageUri('');
  };

  const selectLook = (i: number) => {
    if (!looks[i]) return;
    setActiveLook(i);
    setSuggestion(looks[i]);
    setOutfitImageUri('');
  };

  const runDailyPick = async ({ force = false, variety = false } = {}) => {
    if (!user || !token) return;
    setIsAutoStyling(true);
    try {
      const { lat, lon } = await getGrantedCoordinates();
      const res = await getDailyOutfitSuggestion({
        lat,
        lon,
        plan: todaysPlan,
        variety,
        count: force ? numLooks : 1, // auto-open is single; "try another" honors the selector
      });

      if (force) {
        applySuggestion(res, true);
      } else {
        let applied = false;
        setSuggestion((current) => {
          if (current) return current;
          applied = true;
          return res.options && res.options.length > 1 ? res.options[0] : res;
        });
        if (applied) {
          setLooks(res.options && res.options.length > 1 ? res.options : []);
          setActiveLook(0);
          setIsDailyPick(true);
          setOutfitImageUri('');
        }
      }

      // Cache the pick for the rest of the calendar day
      await AsyncStorage.setItem(
        DAILY_PICK_CACHE_KEY,
        JSON.stringify({ date: todayStamp(), suggestion: res })
      );
    } catch (error) {
      console.warn('Failed to fetch daily pick', error);
    } finally {
      setIsAutoStyling(false);
    }
  };

  // Events
  useEffect(() => {
    if (!user || !token) {
      setEvents([]);
      return;
    }
    getEvents(todayStamp())
      .then(setEvents)
      .catch((e) => console.warn('Failed to fetch events', e));
  }, [user, token]);

  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(newEventDate)) {
      Alert.alert('Add event', 'Enter a title and a date as YYYY-MM-DD.');
      return;
    }
    try {
      const created = await addEvent({ title: newEventTitle.trim(), date: newEventDate });
      setEvents((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setNewEventTitle('');
      setNewEventDate('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add event.');
    }
  };

  const handleRemoveEvent = async (id: string) => {
    try {
      await removeEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      console.error('Failed to remove event', e);
    }
  };

  const handleStyleForEvent = async (title: string) => {
    if (!user || !token) return;
    setIsLoading(true);
    try {
      const { lat, lon } = await getGrantedCoordinates();
      const res = await getOutfitSuggestion(`Dress me for: ${title}`, { lat, lon, count: numLooks });
      applySuggestion(res, false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to style for event.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationPrompt = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setShowLocationHint(false);
      runDailyPick({ force: true });
    }
  };

  // Auto-suggest today's pick on open, based on time, location and season.
  // Reuse a same-day cached pick to avoid a redundant AI call.
  useEffect(() => {
    if (!user || !token || wardrobe.length === 0 || hasAutoStyledRef.current) return;
    hasAutoStyledRef.current = true;

    const loadDailyPick = async () => {
      try {
        const cached = await AsyncStorage.getItem(DAILY_PICK_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { date: string; suggestion: OutfitSuggestion };
          if (parsed.date === todayStamp() && parsed.suggestion) {
            setSuggestion((current) => current ?? parsed.suggestion);
            setIsDailyPick(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to read daily pick cache', e);
      }
      runDailyPick();
    };

    loadDailyPick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, wardrobe]);

  // Fetch Lookbook
  useEffect(() => {
    if (!user || !token || activeTab !== 'lookbook') return;

    const fetchLookbook = async () => {
      try {
        const data = await apiFetch<SavedOutfitRecord[]>('/api/saved_outfits');
        setSavedOutfits(data);
      } catch (error) {
        console.error("Failed to fetch lookbook", error);
      }
    };

    fetchLookbook();
  }, [user, token, activeTab]);

  const handleLogout = async () => {
    await clearAuth();
    await AsyncStorage.removeItem(DAILY_PICK_CACHE_KEY);
    setToken(null);
    setUser(null);
    setSuggestion(null);
    setLooks([]);
    setActiveLook(0);
    setIsDailyPick(false);
    hasAutoStyledRef.current = false;
    setOutfitImageUri('');
    setActiveTab('stylist');
  };

  const handleMarkWorn = async (id: string) => {
    if (!token) return;
    try {
      const updated = await markOutfitWorn(id);
      setSavedOutfits((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)));
      Alert.alert('Nice!', `Logged — worn ${updated.wornCount}×.`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to mark as worn.');
    }
  };

  const handleGetSuggestion = async () => {
    if (!prompt.trim() || !user || !token) return;
    setIsLoading(true);
    try {
      let lat: number | undefined;
      let lon: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          lat = location.coords.latitude;
          lon = location.coords.longitude;
        }
      } catch (e) {
        console.warn('Location permission denied or failed', e);
      }

      const res = await getOutfitSuggestion(prompt, { lat, lon, lockedItemId, count: numLooks });
      applySuggestion(res, false);
    } catch (error) {
      console.error("Failed to get suggestion", error);
      Alert.alert("Error", "Failed to generate suggestion.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateOutfitImage = async () => {
    if (!suggestion || !token) return;

    setIsGeneratingOutfitImage(true);
    try {
      const result = await getOutfitImage(suggestion);
      setOutfitImageUri(`data:${result.mimeType};base64,${result.imageBase64}`);
      setOutfitImageSource(result.source);
    } catch (error) {
      console.error("Failed to generate outfit image", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to generate outfit image.");
    } finally {
      setIsGeneratingOutfitImage(false);
    }
  };

  const handleSaveSuggestion = async () => {
    if (!suggestion || !user || !token) return;
    try {
      await apiFetch('/api/saved_outfits', {
        method: 'POST',
        body: JSON.stringify(suggestion),
      });
      Alert.alert("Saved", "Outfit saved to your lookbook!");
    } catch (error) {
      console.error("Failed to save outfit", error);
      Alert.alert("Error", "Failed to save outfit.");
    }
  };

  // Downscale a picked photo to a JPEG, returning its base64 payload.
  const resizeAsset = async (uri: string, width: number, compress: number) => {
    const result = await manipulateAsync(uri, [{ resize: { width } }], {
      compress,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!result.base64) throw new Error('Could not read one of the photos.');
    return result.base64;
  };

  const toReviewItem = (item: ItemAnalysis, image?: string): ReviewItem => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: item.name,
    color: item.color,
    type: item.type,
    formality: item.formality,
    description: item.description || '',
    image,
  });

  // Bulk scan: every picked photo is analysed (in batches the backend accepts)
  // and each detected garment becomes an editable card, carrying a thumbnail
  // of the photo it came from.
  const scanAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!token || !assets.length) return;
    const picked = assets.slice(0, MAX_PHOTOS_PER_SCAN);
    setIsAnalyzingImage(true);
    setImageError('');
    setScanProgress({ done: 0, total: picked.length });
    const failures: string[] = [];

    try {
      for (let start = 0; start < picked.length; start += SCAN_BATCH_SIZE) {
        const batch = picked.slice(start, start + SCAN_BATCH_SIZE);
        const prepared: { label: string; scan: string; thumb: string }[] = [];
        for (const [offset, asset] of batch.entries()) {
          const label = `Photo ${start + offset + 1}`;
          try {
            // Resize the scan copy from the original, then the thumbnail.
            const scanWidth = Math.min(SCAN_MAX_WIDTH, asset.width || SCAN_MAX_WIDTH);
            const thumbWidth = Math.min(THUMB_MAX_WIDTH, asset.width || THUMB_MAX_WIDTH);
            const scan = await resizeAsset(asset.uri, scanWidth, 0.8);
            const thumb = await resizeAsset(asset.uri, thumbWidth, 0.72);
            prepared.push({ label, scan, thumb: `data:image/jpeg;base64,${thumb}` });
          } catch {
            failures.push(`${label}: could not be read`);
          }
        }

        if (prepared.length) {
          try {
            const { results } = await apiFetch<BulkAnalysisResult>(
              '/api/analyze-items',
              {
                method: 'POST',
                body: JSON.stringify({
                  images: prepared.map((p) => ({ imageBase64: p.scan, mimeType: 'image/jpeg' })),
                }),
              },
              120000
            );
            const found: ReviewItem[] = [];
            for (const result of results) {
              const source = prepared[result.index];
              if (!source) continue;
              if (result.error || !result.items.length) {
                failures.push(`${source.label}: ${result.error || 'no clothing detected'}`);
                continue;
              }
              found.push(...result.items.map((item) => toReviewItem(item, source.thumb)));
            }
            setReviewItems((prev) => [...prev, ...found]);
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'analysis failed';
            prepared.forEach((p) => failures.push(`${p.label}: ${reason}`));
          }
        }

        setScanProgress({ done: Math.min(start + batch.length, picked.length), total: picked.length });
      }
    } finally {
      if (failures.length) {
        setImageError(`${failures.length} photo${failures.length > 1 ? 's' : ''} couldn't be scanned — ${failures.join('; ')}`);
      }
      setScanProgress(null);
      setIsAnalyzingImage(false);
    }
  };

  const updateReviewItem = (key: string, patch: Partial<ReviewItem>) => {
    setReviewItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeReviewItem = (key: string) => {
    setReviewItems((prev) => prev.filter((item) => item.key !== key));
  };

  const saveReviewItems = async () => {
    if (!reviewItems.length || reviewItems.some((i) => !i.name.trim() || !i.color.trim())) return;
    setIsSavingBulk(true);
    setImageError('');
    const pending = [...reviewItems];

    try {
      while (pending.length) {
        const chunk = pending.slice(0, BULK_SAVE_CHUNK);
        const saved = await apiFetch<ClothingItem[]>(
          '/api/wardrobes/bulk',
          {
            method: 'POST',
            body: JSON.stringify({
              items: chunk.map((item) => ({
                name: item.name.trim(),
                color: item.color.trim(),
                type: item.type,
                formality: item.formality,
                ...(item.description.trim() ? { description: item.description.trim() } : {}),
                ...(item.image ? { image: item.image } : {}),
              })),
            }),
          },
          60000
        );
        pending.splice(0, chunk.length);
        setWardrobe((prev) => [...prev, ...saved]);
        // Drop saved cards so a later failure only leaves the unsaved ones.
        setReviewItems([...pending]);
      }
      closeAddItemModal();
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Could not save the items. Please try again.');
    } finally {
      setIsSavingBulk(false);
    }
  };

  const pickFromGallery = async () => {
    setImageError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setImageError('Photo access is needed to add items from your gallery.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS_PER_SCAN,
      orderedSelection: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }
    await scanAssets(result.assets);
  };

  const takePhoto = async () => {
    setImageError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setImageError('Camera access is needed to snap a photo of an item.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }
    await scanAssets(result.assets);
  };

  // Attach a photo to a manually added / edited item (no AI analysis).
  const pickItemPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to add a picture of this item.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    try {
      const thumb = await resizeAsset(asset.uri, Math.min(THUMB_MAX_WIDTH, asset.width || THUMB_MAX_WIDTH), 0.72);
      setNewItem((prev) => ({ ...prev, image: `data:image/jpeg;base64,${thumb}` }));
    } catch {
      Alert.alert('Error', 'Could not read that photo. Try another one.');
    }
  };

  // Look up the photo of the wardrobe item a suggestion refers to.
  const findItemImage = (type: ItemType, name: string) => {
    const clean = name.trim().toLowerCase();
    const ofType = wardrobe.filter((i) => i.type === type);
    return (
      ofType.find((i) => i.name === name) ?? ofType.find((i) => i.name.trim().toLowerCase() === clean)
    )?.image;
  };

  const addItem = async () => {
    if (newItem.name && newItem.color && user && token) {
      try {
        const itemData = {
          name: newItem.name,
          color: newItem.color,
          type: newItem.type as ItemType,
          formality: newItem.formality as Formality,
          ...(newItem.description?.trim() ? { description: newItem.description.trim() } : {}),
          ...(newItem.image ? { image: newItem.image } : {}),
        };

        if (editingItemId) {
          const updated = await apiFetch<ClothingItem>(`/api/wardrobes/${editingItemId}`, {
            method: 'PUT',
            body: JSON.stringify(itemData),
          });
          setWardrobe(wardrobe.map(i => (i.id === editingItemId ? updated : i)));
          closeAddItemModal();
          return;
        }

        const addedItem = await apiFetch<ClothingItem>('/api/wardrobes', {
          method: 'POST',
          body: JSON.stringify(itemData),
        });
        setWardrobe([...wardrobe, addedItem]);
        closeAddItemModal();
      } catch (error) {
        console.error("Failed to add item", error);
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save the item.');
      }
    }
  };

  const removeItem = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/wardrobes/${id}`, { method: 'DELETE' });
      setWardrobe(wardrobe.filter(item => item.id !== id));
    } catch (error) {
      console.error("Failed to remove item", error);
    }
  };

  const removeSavedOutfit = (id: string) => {
    Alert.alert(
      "Remove Outfit",
      "Are you sure you want to remove this outfit?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              if (!token) return;
              await apiFetch(`/api/saved_outfits/${id}`, { method: 'DELETE' });
              setSavedOutfits(savedOutfits.filter(o => o.id !== id));
            } catch (error) {
              Alert.alert("Error", "Failed to remove outfit.");
            }
          }
        }
      ]
    );
  };

  const openAffiliateLink = (searchTerm: string) => {
    const url = buildAmazonAffiliateUrl(searchTerm);
    Linking.openURL(url);
  };

  if (!isAuthReady) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8F7F4] dark:bg-[#121212]">
        <ActivityIndicator size="large" color={nativeColorScheme === 'dark' ? "#E5E5E1" : "#1A1A1A"} />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F7F4] dark:bg-[#121212] justify-center px-8">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View className="w-full max-w-md self-center">
              <View className="items-center mb-10">
                <Text className="font-serif text-6xl italic mb-4 dark:text-white">FitPick</Text>
                <Text className="text-lg text-[#8E8E8A] text-center dark:text-gray-400">Your personal AI stylist.</Text>
              </View>

              <View className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[32px] shadow-sm border border-[#E5E5E1] dark:border-gray-800">
                <Text className="text-2xl font-medium mb-6 dark:text-white">
                  {resetStep ? 'Reset Password' : isRegistering ? 'Create Account' : 'Welcome Back'}
                </Text>

                {resetStep === 'email' && (
                  <View className="space-y-4">
                    <Text className="text-sm text-[#8E8E8A] mb-4">
                      Enter your email and we'll send you a 6-digit code to reset your password.
                    </Text>
                    <View className="relative">
                      <View className="absolute left-4 top-4 z-10">
                        <Mail color="#8E8E8A" size={18} />
                      </View>
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email Address"
                        placeholderTextColor="#8E8E8A"
                        className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 pl-12 rounded-2xl text-base dark:text-white"
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handleForgotPassword}
                      disabled={authLoading || !email}
                      className={`py-4 rounded-2xl items-center mt-4 ${!email ? 'bg-gray-300' : 'bg-[#1A1A1A] dark:bg-white'}`}
                    >
                      {authLoading ? <ActivityIndicator color={nativeColorScheme === 'dark' ? 'black' : 'white'} /> : (
                        <Text className="text-white dark:text-black font-medium text-lg">Send Reset Code</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={exitResetFlow} className="mt-6 flex-row items-center justify-center">
                      <ArrowLeft color="#8E8E8A" size={14} />
                      <Text className="text-[#8E8E8A] text-center text-sm ml-2">Back to sign in</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {resetStep === 'code' && (
                  <View className="space-y-4">
                    <Text className="text-sm text-[#8E8E8A] mb-4">
                      If an account exists for {email}, a 6-digit code is on its way. Check your inbox.
                    </Text>
                    <View className="relative">
                      <View className="absolute left-4 top-4 z-10">
                        <KeyRound color="#8E8E8A" size={18} />
                      </View>
                      <TextInput
                        value={resetCode}
                        onChangeText={(t) => setResetCode(t.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        placeholderTextColor="#8E8E8A"
                        keyboardType="number-pad"
                        maxLength={6}
                        className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 pl-12 rounded-2xl text-base dark:text-white tracking-widest"
                      />
                    </View>
                    <View className="relative mt-4">
                      <View className="absolute left-4 top-4 z-10">
                        <Lock color="#8E8E8A" size={18} />
                      </View>
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="New password (min 8 characters)"
                        placeholderTextColor="#8E8E8A"
                        secureTextEntry
                        className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 pl-12 rounded-2xl text-base dark:text-white"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handleResetPassword}
                      disabled={authLoading || resetCode.length !== 6 || newPassword.length < 8}
                      className={`py-4 rounded-2xl items-center mt-4 ${resetCode.length !== 6 || newPassword.length < 8 ? 'bg-gray-300' : 'bg-[#1A1A1A] dark:bg-white'}`}
                    >
                      {authLoading ? <ActivityIndicator color={nativeColorScheme === 'dark' ? 'black' : 'white'} /> : (
                        <Text className="text-white dark:text-black font-medium text-lg">Reset Password</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setResetStep('email')} className="mt-6">
                      <Text className="text-[#8E8E8A] text-center text-sm">Didn't get a code? Send again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={exitResetFlow} className="mt-4 flex-row items-center justify-center">
                      <ArrowLeft color="#8E8E8A" size={14} />
                      <Text className="text-[#8E8E8A] text-center text-sm ml-2">Back to sign in</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!resetStep && (
                <View className="space-y-4">
                  <View className="relative">
                    <View className="absolute left-4 top-4 z-10">
                      <Mail color="#8E8E8A" size={18} />
                    </View>
                    <TextInput 
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Email Address"
                      placeholderTextColor="#8E8E8A"
                      className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 pl-12 rounded-2xl text-base dark:text-white"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                  <View className="relative mt-4">
                    <View className="absolute left-4 top-4 z-10">
                      <Lock color="#8E8E8A" size={18} />
                    </View>
                    <TextInput 
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      placeholderTextColor="#8E8E8A"
                      secureTextEntry
                      className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 pl-12 rounded-2xl text-base dark:text-white"
                    />
                  </View>

                  <TouchableOpacity 
                    onPress={handleEmailAuth}
                    disabled={authLoading}
                    className="bg-[#1A1A1A] dark:bg-white py-4 rounded-2xl items-center mt-4"
                  >
                    {authLoading ? <ActivityIndicator color={nativeColorScheme === 'dark' ? 'black' : 'white'} /> : (
                      <Text className="text-white dark:text-black font-medium text-lg">{isRegistering ? 'Sign Up' : 'Sign In'}</Text>
                    )}
                  </TouchableOpacity>

                  {!isRegistering && (
                    <TouchableOpacity onPress={() => setResetStep('email')} className="mt-4">
                      <Text className="text-[#8E8E8A] text-center text-sm">Forgot password?</Text>
                    </TouchableOpacity>
                  )}

                  <View className="flex-row items-center my-6">
                    <View className="flex-1 h-[1px] bg-[#E5E5E1] dark:bg-gray-800" />
                    <Text className="mx-4 text-[#8E8E8A] text-xs uppercase tracking-widest">or</Text>
                    <View className="flex-1 h-[1px] bg-[#E5E5E1] dark:bg-gray-800" />
                  </View>

                  {hasGoogleSignIn ? (
                    <GoogleSignInButton
                      authLoading={authLoading || googleAuthLoading}
                      colorScheme={nativeColorScheme}
                    />
                  ) : (
                    <View className="border border-dashed border-[#E5E5E1] dark:border-gray-800 py-4 rounded-2xl items-center">
                      <Text className="text-[#8E8E8A] text-center text-sm px-4">
                        Google sign-in is not configured in this build.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity 
                    onPress={() => setIsRegistering(!isRegistering)}
                    className="mt-6"
                  >
                    <Text className="text-[#8E8E8A] text-center text-sm">
                      {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Create one'}
                    </Text>
                  </TouchableOpacity>
                </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8F7F4] dark:bg-[#121212]">
      {/* Header */}
      <View className="bg-white dark:bg-[#1E1E1E] border-b border-[#E5E5E1] dark:border-gray-800 z-10">
        <View
          className="flex-row items-center justify-between px-6 py-4 self-center w-full"
          style={{ maxWidth: MaxContentWidth }}
        >
          <View>
            <Text className="font-serif text-2xl italic dark:text-white">FitPick</Text>
            <Text className="text-xs text-[#8E8E8A] mt-0.5" numberOfLines={1}>Hello, {user.name || user.email}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => openAddItemModal()} className="p-2">
              <Plus color="#8E8E8A" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openSettings} className="p-2">
              <Settings color="#8E8E8A" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} className="p-2">
              <LogOut color="#8E8E8A" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row px-6 py-2 bg-white dark:bg-[#1E1E1E] border-b border-[#E5E5E1] dark:border-gray-800">
        <TouchableOpacity 
          onPress={() => setActiveTab('stylist')}
          className={`flex-1 flex-row items-center justify-center py-2 rounded-xl ${activeTab === 'stylist' ? 'bg-[#1A1A1A] dark:bg-white' : ''}`}
        >
          <LayoutGrid color={activeTab === 'stylist' ? (nativeColorScheme === 'dark' ? 'black' : 'white') : '#8E8E8A'} size={18} />
          <Text className={`ml-2 font-medium ${activeTab === 'stylist' ? (nativeColorScheme === 'dark' ? 'text-black' : 'text-white') : 'text-[#8E8E8A]'}`}>Stylist</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('lookbook')}
          className={`flex-1 flex-row items-center justify-center py-2 rounded-xl ml-2 ${activeTab === 'lookbook' ? 'bg-[#1A1A1A] dark:bg-white' : ''}`}
        >
          <Heart color={activeTab === 'lookbook' ? (nativeColorScheme === 'dark' ? 'black' : 'white') : '#8E8E8A'} size={18} />
          <Text className={`ml-2 font-medium ${activeTab === 'lookbook' ? (nativeColorScheme === 'dark' ? 'text-black' : 'text-white') : 'text-[#8E8E8A]'}`}>Lookbook</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full self-center" style={{ maxWidth: MaxContentWidth }}>
          {activeTab === 'stylist' ? (
            <>
              <View className="mb-6">
                <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold mb-2">Anything special today?</Text>
                <TextInput
                  value={todaysPlan}
                  onChangeText={setTodaysPlan}
                  placeholder="e.g. coffee, then a dinner date"
                  placeholderTextColor="#8E8E8A"
                  className="bg-white dark:bg-[#1E1E1E] rounded-2xl p-4 border border-[#E5E5E1] dark:border-gray-800 text-base text-[#1A1A1A] dark:text-white"
                />
                <Text className="text-xs text-[#8E8E8A] mt-2">Used to tailor your daily pick. Leave blank for a general suggestion.</Text>
              </View>

              {showLocationHint && (
                <TouchableOpacity
                  onPress={handleLocationPrompt}
                  className="mb-6 bg-[#FBFBFA] dark:bg-[#1E1E1E] rounded-2xl p-4 border border-dashed border-[#E5E5E1] dark:border-gray-800 flex-row items-center justify-between"
                >
                  <Text className="text-[#555552] dark:text-gray-400 flex-1 pr-3 text-sm">
                    Enable location for weather-aware picks.
                  </Text>
                  <Text className="text-[#1A1A1A] dark:text-white font-medium">Enable</Text>
                </TouchableOpacity>
              )}

              {/* Upcoming events */}
              <View className="mb-8">
                <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold mb-3">Upcoming</Text>
                <View className="flex-row gap-2 mb-3">
                  <TextInput
                    value={newEventTitle}
                    onChangeText={setNewEventTitle}
                    placeholder="Event"
                    placeholderTextColor="#8E8E8A"
                    className="flex-1 bg-white dark:bg-[#1E1E1E] rounded-xl p-3 border border-[#E5E5E1] dark:border-gray-800 text-sm text-[#1A1A1A] dark:text-white"
                  />
                  <TextInput
                    value={newEventDate}
                    onChangeText={setNewEventDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#8E8E8A"
                    className="w-32 bg-white dark:bg-[#1E1E1E] rounded-xl p-3 border border-[#E5E5E1] dark:border-gray-800 text-sm text-[#1A1A1A] dark:text-white"
                  />
                  <TouchableOpacity onPress={handleAddEvent} className="px-4 justify-center rounded-xl bg-[#1A1A1A] dark:bg-white">
                    <Text className="text-white dark:text-black font-medium">Add</Text>
                  </TouchableOpacity>
                </View>
                {events.map((ev) => (
                  <View key={ev.id} className="flex-row items-center justify-between p-3 mb-2 rounded-xl border border-[#E5E5E1] dark:border-gray-800 bg-white dark:bg-[#1E1E1E]">
                    <View className="flex-1 pr-2">
                      <Text className="text-sm font-medium dark:text-white" numberOfLines={1}>{ev.title}</Text>
                      <Text className="text-[10px] uppercase tracking-wider text-[#8E8E8A] mt-0.5">{ev.date}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleStyleForEvent(ev.title)} className="px-3 py-2 rounded-lg border border-[#E5E5E1] dark:border-gray-800 mr-2">
                      <Text className="text-xs font-medium dark:text-white">Style</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveEvent(ev.id)} className="p-2">
                      <Trash2 color="#8E8E8A" size={16} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View className="mb-8">
                <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold mb-3">Stylist</Text>
                <Text className="text-3xl font-light leading-tight mb-3 dark:text-white">What’s the occasion?</Text>

                <View className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 border border-[#E5E5E1] dark:border-gray-800 shadow-sm">
                  <TextInput
                    multiline
                    numberOfLines={4}
                    value={prompt}
                    onChangeText={setPrompt}
                    placeholder="e.g. I have a job interview tomorrow..."
                    placeholderTextColor="#8E8E8A"
                    className="text-base text-[#1A1A1A] dark:text-white mb-4 text-left"
                    style={{ textAlignVertical: 'top', minHeight: 110 }}
                  />
                  <View className="flex-row items-center mb-4">
                    <Text className="text-[11px] uppercase tracking-widest text-[#8E8E8A] font-bold mr-3">Looks</Text>
                    {[1, 2, 3].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setNumLooks(n)}
                        className={`w-9 h-9 mr-2 rounded-lg items-center justify-center border ${
                          numLooks === n ? 'bg-[#1A1A1A] dark:bg-white border-transparent' : 'border-[#E5E5E1] dark:border-gray-800'
                        }`}
                      >
                        <Text className={`text-sm font-medium ${numLooks === n ? 'text-white dark:text-black' : 'text-[#8E8E8A]'}`}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={handleGetSuggestion}
                    disabled={isLoading || !prompt.trim() || wardrobe.length === 0}
                    className={`flex-row justify-center items-center py-4 rounded-2xl ${
                      isLoading || !prompt.trim() || wardrobe.length === 0 ? 'bg-gray-300 dark:bg-gray-800' : 'bg-[#1A1A1A] dark:bg-white'
                    }`}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={nativeColorScheme === 'dark' ? 'black' : 'white'} />
                    ) : (
                      <>
                        <Sparkles color={nativeColorScheme === 'dark' ? 'black' : 'white'} size={20} />
                        <Text className="text-white dark:text-black font-medium ml-2 text-lg">Style Me</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {wardrobe.length === 0 && (
                    <Text className="text-red-500 text-sm mt-3 text-center">Add clothes to your wardrobe below first.</Text>
                  )}
                </View>
              </View>

              {isAutoStyling && !suggestion && (
                <View className="mb-10 bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 border border-[#E5E5E1] dark:border-gray-800 flex-row items-center">
                  <ActivityIndicator color={nativeColorScheme === 'dark' ? '#E5E5E1' : '#1A1A1A'} />
                  <Text className="ml-3 text-[#8E8E8A] flex-1">
                    Styling today's pick from your wardrobe based on the time, season and weather…
                  </Text>
                </View>
              )}

              {suggestion && (
                <View className="mb-10">
                  {looks.length > 1 && (
                    <View className="flex-row mb-4">
                      {looks.map((_, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => selectLook(i)}
                          className={`px-4 py-2 mr-2 rounded-xl border ${
                            activeLook === i ? 'bg-[#1A1A1A] dark:bg-white border-transparent' : 'border-[#E5E5E1] dark:border-gray-800'
                          }`}
                        >
                          <Text className={`text-sm font-medium ${activeLook === i ? 'text-white dark:text-black' : 'text-[#8E8E8A]'}`}>
                            Look {String.fromCharCode(65 + i)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <View className="flex-row items-end justify-between mb-3">
                    <View className="flex-1 mr-4">
                      <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold">
                        {isDailyPick ? "Today's pick for you" : 'Suggestion for'}
                      </Text>
                      <Text className="text-3xl font-serif italic mt-1 dark:text-white">{suggestion.occasion}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleSaveSuggestion}
                      className="px-4 py-2 rounded-xl border border-[#E5E5E1] dark:border-gray-800 bg-white dark:bg-[#1E1E1E]"
                    >
                      <Text className="text-sm font-medium dark:text-white">Save</Text>
                    </TouchableOpacity>
                  </View>

                  {suggestion.context && (
                    <View className="flex-row flex-wrap gap-2 mb-4">
                      {suggestion.context.weather && (
                        <View className="px-3 py-1 rounded-full bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800">
                          <Text className="text-xs text-[#555552] dark:text-gray-300 capitalize">
                            {Math.round(suggestion.context.weather.temp)}°C · {suggestion.context.weather.description}
                          </Text>
                        </View>
                      )}
                      {suggestion.context.timeOfDay && (
                        <View className="px-3 py-1 rounded-full bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800">
                          <Text className="text-xs text-[#555552] dark:text-gray-300 capitalize">{suggestion.context.timeOfDay}</Text>
                        </View>
                      )}
                      {suggestion.context.season && (
                        <View className="px-3 py-1 rounded-full bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800">
                          <Text className="text-xs text-[#555552] dark:text-gray-300 capitalize">{suggestion.context.season}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {isDailyPick && (
                    <TouchableOpacity
                      onPress={() => runDailyPick({ force: true, variety: true })}
                      disabled={isAutoStyling}
                      className="flex-row items-center justify-center py-3 rounded-2xl border border-[#E5E5E1] dark:border-gray-800 bg-white dark:bg-[#1E1E1E] mb-5"
                    >
                      {isAutoStyling ? (
                        <ActivityIndicator color={nativeColorScheme === 'dark' ? '#E5E5E1' : '#1A1A1A'} />
                      ) : (
                        <>
                          <Sparkles color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} size={16} />
                          <Text className="ml-2 font-medium dark:text-white">Try another look</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Real-photo collage: the actual items, never generated */}
                  <View className="flex-row flex-wrap justify-between mb-6">
                    {[
                      { label: 'Top', type: 'top' as ItemType, name: suggestion.top.name, icon: <Shirt color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} size={28} /> },
                      { label: 'Bottom', type: 'bottom' as ItemType, name: suggestion.bottom.name, icon: <Briefcase color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} size={28} /> },
                      { label: 'Shoes', type: 'shoes' as ItemType, name: suggestion.shoes.name, icon: <Footprints color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} size={28} /> },
                      { label: 'Accessory', type: 'accessory' as ItemType, name: suggestion.accessory.name, icon: <Watch color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} size={28} /> }
                    ].map((item) => {
                      const photo = findItemImage(item.type, item.name);
                      return (
                        <View key={item.label} className="mb-4" style={{ width: '48%' }}>
                          <View
                            className="w-full rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800 items-center justify-center mb-2 overflow-hidden"
                            style={{ aspectRatio: 4 / 5 }}
                          >
                            {photo ? (
                              <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                              item.icon
                            )}
                          </View>
                          <Text className="text-[9px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-0.5">{item.label}</Text>
                          <Text className="text-xs font-medium dark:text-gray-300" numberOfLines={2}>{item.name}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View className="bg-white dark:bg-[#1E1E1E] p-5 rounded-3xl border border-[#E5E5E1] dark:border-gray-800 mb-5">
                    <View className="flex-row items-center justify-between mb-4">
                      <View className="flex-1 mr-4">
                        <Text className="text-[10px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-1">AI Styled Image</Text>
                        <Text className="text-[#555552] dark:text-gray-400">Generate an editorial flat-lay from your item photos.</Text>
                      </View>
                      <TouchableOpacity
                        disabled={isGeneratingOutfitImage}
                        onPress={handleGenerateOutfitImage}
                        className="bg-[#1A1A1A] dark:bg-white px-4 py-3 rounded-xl flex-row items-center"
                      >
                        {isGeneratingOutfitImage ? (
                          <ActivityIndicator color={nativeColorScheme === 'dark' ? '#000' : '#fff'} />
                        ) : (
                          <>
                            <Sparkles color={nativeColorScheme === 'dark' ? '#000' : '#fff'} size={16} />
                            <Text className="text-white dark:text-black font-medium ml-2">
                              {outfitImageUri ? 'Regenerate' : 'Generate'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    {outfitImageUri && outfitImageSource && outfitImageSource !== 'reference' ? (
                      <Text className="text-xs text-[#8E8E8A] mb-3">
                        Approximate image — generated from text, so garments may differ from yours. Add photos to these items for an accurate result.
                      </Text>
                    ) : null}
                    {outfitImageUri ? (
                      <Image
                        source={{ uri: outfitImageUri }}
                        className="w-full h-96 rounded-2xl bg-[#F8F7F4] dark:bg-[#2A2A2A]"
                        resizeMode="contain"
                      />
                    ) : null}
                  </View>

                  <View className="space-y-3 mb-5">
                    {[
                      { label: 'Top', data: suggestion.top },
                      { label: 'Bottom', data: suggestion.bottom },
                      { label: 'Shoes', data: suggestion.shoes },
                      { label: 'Accessory', data: suggestion.accessory }
                    ].map((part) => (
                      <View key={part.label} className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl border border-[#E5E5E1] dark:border-gray-800 mt-2">
                        <Text className="text-[10px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-1">{part.label}</Text>
                        <Text className="text-lg font-medium mb-1 dark:text-white">{part.data.name}</Text>
                        <Text className="text-[#555552] dark:text-gray-400 leading-6">{part.data.reason}</Text>
                      </View>
                    ))}
                  </View>

                  <View className="bg-[#1A1A1A] dark:bg-[#2A2A2A] p-5 rounded-3xl mb-5">
                    <Text className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Stylist Note</Text>
                    <Text className="text-white text-base leading-7 italic">"{suggestion.stylistNote}"</Text>
                  </View>

                  {suggestion.wardrobeGap && (
                    <View className="bg-[#FBFBFA] dark:bg-[#1E1E1E] p-5 rounded-3xl border border-dashed border-[#E5E5E1] dark:border-gray-800 items-start">
                      <Text className="text-[10px] uppercase tracking-widest text-red-500 font-bold mb-2">Wardrobe Gap</Text>
                      <Text className="text-[#555552] dark:text-gray-400 mb-4 text-base leading-6">{suggestion.wardrobeGap}</Text>
                      {suggestion.wardrobeGapSearchTerm && (
                        <TouchableOpacity
                          onPress={() => openAffiliateLink(suggestion.wardrobeGapSearchTerm!)}
                          className="bg-black dark:bg-white px-5 py-3 rounded-xl"
                        >
                          <Text className="text-white dark:text-black font-medium">Shop this missing item</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}

              <View className="mb-12">
                <View className="flex-row items-center justify-between mb-4">
                  <View>
                    <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold mb-2">Wardrobe</Text>
                    <Text className="text-2xl font-serif italic dark:text-white">My items</Text>
                  </View>
                  <TouchableOpacity onPress={() => openAddItemModal()} className="bg-[#1A1A1A] dark:bg-white w-11 h-11 rounded-full items-center justify-center">
                    <Plus color={nativeColorScheme === 'dark' ? 'black' : 'white'} size={20} />
                  </TouchableOpacity>
                </View>

                {(['top', 'bottom', 'shoes', 'accessory'] as ItemType[]).map(type => {
                  const items = wardrobe.filter(i => i.type === type);
                  return (
                    <View key={type} className="mb-6">
                      <Text className="text-[11px] uppercase tracking-[0.22em] text-[#8E8E8A] font-bold mb-3">{type}s</Text>
                      {items.length > 0 ? (
                        <View className="space-y-2">
                          {items.map(item => (
                            <View key={item.id} className="flex-row items-center justify-between p-4 bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E5E1] dark:border-gray-800 mt-2">
                              {item.image ? (
                                <Image source={{ uri: item.image }} className="w-12 h-12 rounded-xl mr-3 bg-[#F8F7F4] dark:bg-[#2A2A2A]" resizeMode="cover" />
                              ) : null}
                              <View className="flex-1 pr-3">
                                <Text className="text-base font-medium dark:text-white">{item.name}</Text>
                                <Text className="text-xs text-[#8E8E8A] uppercase tracking-wider mt-1">{item.color} • {item.formality}</Text>
                              </View>
                              <View className="flex-row items-center gap-2">
                                <TouchableOpacity 
                                  onPress={() => setLockedItemId(lockedItemId === item.id ? null : item.id)}
                                  className={`p-2 rounded-lg ${lockedItemId === item.id ? 'bg-[#1A1A1A] dark:bg-white' : ''}`}
                                >
                                  <Sparkles color={lockedItemId === item.id ? (nativeColorScheme === 'dark' ? 'black' : 'white') : '#8E8E8A'} size={18} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => startEditItem(item)} className="p-2">
                                  <Pencil color="#8E8E8A" size={18} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => removeItem(item.id)} className="p-2">
                                  <Trash2 color="#8E8E8A" size={18} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View className="rounded-2xl border border-dashed border-[#E5E5E1] dark:border-gray-800 bg-[#FBFBFA] dark:bg-[#1E1E1E] px-4 py-5">
                          <Text className="text-[#8E8E8A] italic text-center text-sm">No {type}s added yet.</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View className="mb-12">
              <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold mb-3">Lookbook</Text>
              <Text className="text-3xl font-serif italic mb-6 dark:text-white">My saved outfits</Text>
              
              {savedOutfits.length > 0 ? (
                savedOutfits.map((outfit) => (
                  <View key={outfit.id} className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-[#E5E5E1] dark:border-gray-800 mb-6 shadow-sm">
                    <View className="flex-row justify-between items-start mb-4">
                      <View className="flex-1 mr-4">
                        <Text className="text-[10px] uppercase tracking-[0.2em] text-[#8E8E8A] font-bold">Occasion</Text>
                        <Text className="text-xl font-serif italic dark:text-white">{outfit.occasion}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeSavedOutfit(outfit.id)} className="p-2">
                        <Trash2 color="#8E8E8A" size={18} />
                      </TouchableOpacity>
                    </View>
                    <View className="space-y-4">
                      {[
                        { label: 'Top', name: outfit.top.name },
                        { label: 'Bottom', name: outfit.bottom.name },
                        { label: 'Shoes', name: outfit.shoes.name }
                      ].map(item => (
                        <View key={item.label}>
                          <Text className="text-[9px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-1">{item.label}</Text>
                          <Text className="text-base font-medium dark:text-gray-300">{item.name}</Text>
                        </View>
                      ))}
                    </View>
                    <View className="mt-6 pt-6 border-t border-[#F8F7F4] dark:border-gray-800">
                      <Text className="text-sm italic text-[#555552] dark:text-gray-400" numberOfLines={3}>"{outfit.stylistNote}"</Text>
                    </View>
                    <View className="mt-5 flex-row items-center justify-between">
                      <TouchableOpacity
                        onPress={() => handleMarkWorn(outfit.id)}
                        className="px-4 py-2 rounded-xl bg-[#1A1A1A] dark:bg-white"
                      >
                        <Text className="text-white dark:text-black text-xs font-medium">I wore this</Text>
                      </TouchableOpacity>
                      {(outfit.wornCount ?? 0) > 0 && (
                        <Text className="text-[10px] uppercase tracking-widest text-[#8E8E8A] font-bold">
                          Worn {outfit.wornCount}×
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View className="py-20 items-center justify-center border-2 border-dashed border-[#E5E5E1] dark:border-gray-800 rounded-3xl bg-[#FBFBFA] dark:bg-[#1E1E1E]">
                  <Heart color="#E5E5E1" size={48} />
                  <Text className="text-[#8E8E8A] text-center mt-4 px-10">Your lookbook is empty. Save some outfit suggestions to see them here!</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={isSettingsOpen} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-[#1E1E1E] rounded-t-[40px] px-6 pt-5 pb-8 max-h-[92%]">
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-serif italic dark:text-white">Settings</Text>
                <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                  <X color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} size={24} />
                </TouchableOpacity>
              </View>

              <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Profile</Text>
              <Text className="text-xs text-[#8E8E8A] mb-3">{user.email}</Text>
              <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Display Name</Text>
              <TextInput
                value={settingsName}
                onChangeText={setSettingsName}
                placeholder="Your name"
                placeholderTextColor="#8E8E8A"
                className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 rounded-xl text-base dark:text-white mb-3"
              />
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={isSavingSettings || !settingsName.trim() || settingsName.trim() === (user.name || '')}
                className={`py-3 rounded-xl items-center mb-8 ${!settingsName.trim() || settingsName.trim() === (user.name || '') ? 'bg-gray-300' : 'bg-[#1A1A1A] dark:bg-white'}`}
              >
                {isSavingSettings ? <ActivityIndicator color="white" /> : (
                  <Text className="text-white dark:text-black font-medium">Save Profile</Text>
                )}
              </TouchableOpacity>

              <View className="border-t border-[#E5E5E1] dark:border-gray-800 pt-6 mb-2">
                <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">
                  {hasPassword ? 'Change Password' : 'Set a Password'}
                </Text>
                {!hasPassword && (
                  <Text className="text-xs text-[#8E8E8A] mb-3">
                    You signed in with Google. Set a password to also log in with your email.
                  </Text>
                )}
                {hasPassword && (
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Current password"
                    placeholderTextColor="#8E8E8A"
                    secureTextEntry
                    className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 rounded-xl text-base dark:text-white mb-3"
                  />
                )}
                <TextInput
                  value={settingsNewPassword}
                  onChangeText={setSettingsNewPassword}
                  placeholder="New password (min 8 characters)"
                  placeholderTextColor="#8E8E8A"
                  secureTextEntry
                  className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 rounded-xl text-base dark:text-white mb-3"
                />
                <TouchableOpacity
                  onPress={handleChangePassword}
                  disabled={isSavingSettings || settingsNewPassword.length < 8 || (hasPassword && !currentPassword)}
                  className={`py-3 rounded-xl items-center ${settingsNewPassword.length < 8 || (hasPassword && !currentPassword) ? 'bg-gray-300' : 'bg-[#1A1A1A] dark:bg-white'}`}
                >
                  {isSavingSettings ? <ActivityIndicator color="white" /> : (
                    <Text className="text-white dark:text-black font-medium">{hasPassword ? 'Change Password' : 'Set Password'}</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View className="border-t border-[#E5E5E1] dark:border-gray-800 pt-6 mt-8">
                <TouchableOpacity
                  onPress={() => WebBrowser.openBrowserAsync('https://fitpick-oluwaseun.netlify.app/privacy')}
                  className="flex-row items-center justify-between py-2"
                >
                  <View className="flex-row items-center">
                    <Shield color="#8E8E8A" size={18} />
                    <Text className="text-sm ml-3 dark:text-white">Privacy Policy</Text>
                  </View>
                  <ChevronRight color="#8E8E8A" size={18} />
                </TouchableOpacity>
              </View>

              <View className="border-t border-[#E5E5E1] dark:border-gray-800 pt-6 mt-2 mb-2">
                <Text className="text-[10px] uppercase font-bold text-red-500 mb-2">Delete Account</Text>
                <Text className="text-xs text-[#8E8E8A] mb-3">
                  Permanently removes your account, wardrobe, saved outfits and events. This cannot be undone.
                </Text>
                {hasPassword && (
                  <TextInput
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    placeholder="Enter your password to confirm"
                    placeholderTextColor="#8E8E8A"
                    secureTextEntry
                    className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 rounded-xl text-base dark:text-white mb-3"
                  />
                )}
                <TouchableOpacity
                  onPress={handleDeleteAccount}
                  disabled={isDeletingAccount || (hasPassword && !deletePassword)}
                  className={`py-3 rounded-xl items-center ${hasPassword && !deletePassword ? 'bg-gray-300' : 'bg-red-600'}`}
                >
                  {isDeletingAccount ? <ActivityIndicator color="white" /> : (
                    <Text className="text-white font-medium">Delete My Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={isAddingItem} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-[#1E1E1E] rounded-t-[40px] px-6 pt-5 pb-8 max-h-[92%]">
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-2xl font-serif italic dark:text-white">
                    {editingItemId ? 'Edit Item' : itemMode === 'photo' ? 'Add from Photos' : 'Add Item'}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeAddItemModal}>
                  <X color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} size={24} />
                </TouchableOpacity>
              </View>

              {!editingItemId && (
              <View className="flex-row bg-[#F8F7F4] dark:bg-[#2A2A2A] rounded-xl p-1 mb-5">
                <TouchableOpacity onPress={() => setItemMode('manual')} className={`flex-1 py-3 rounded-lg items-center ${itemMode === 'manual' ? 'bg-white dark:bg-[#1E1E1E] shadow-sm' : ''}`}>
                  <Text className={itemMode === 'manual' ? 'text-[#1A1A1A] dark:text-white font-medium' : 'text-[#8E8E8A]'}>Manual</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setItemMode('photo')} className={`flex-1 py-3 rounded-lg items-center ${itemMode === 'photo' ? 'bg-white dark:bg-[#1E1E1E] shadow-sm' : ''}`}>
                  <Text className={itemMode === 'photo' ? 'text-[#1A1A1A] dark:text-white font-medium' : 'text-[#8E8E8A]'}>Scan Photos</Text>
                </TouchableOpacity>
              </View>
              )}

              {itemMode === 'photo' && (
                <View className="mb-5">
                  {reviewItems.length === 0 && !isAnalyzingImage && (
                    <Text className="text-xs text-[#8E8E8A] mb-3 text-center">
                      Pick up to {MAX_PHOTOS_PER_SCAN} photos from your gallery — each garment is detected automatically.
                    </Text>
                  )}
                  {isAnalyzingImage ? (
                    <View className="py-4 rounded-xl items-center bg-[#F8F7F4] dark:bg-[#2A2A2A]">
                      <ActivityIndicator color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} />
                      <Text className="text-xs text-[#8E8E8A] mt-2">
                        {scanProgress ? `Scanning photos… ${scanProgress.done}/${scanProgress.total}` : 'Scanning photos…'}
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={takePhoto}
                        className="flex-1 py-4 rounded-xl items-center justify-center flex-row gap-2 bg-[#1A1A1A] dark:bg-white"
                      >
                        <Camera color={nativeColorScheme === 'dark' ? '#1A1A1A' : 'white'} size={20} />
                        <Text className="text-white dark:text-black font-medium">Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={pickFromGallery}
                        className="flex-1 py-4 rounded-xl items-center justify-center flex-row gap-2 bg-[#F8F7F4] dark:bg-[#2A2A2A]"
                      >
                        <ImageIcon color={nativeColorScheme === 'dark' ? 'white' : '#1A1A1A'} size={20} />
                        <Text className="text-[#1A1A1A] dark:text-white font-medium">{reviewItems.length ? 'Add more' : 'Gallery'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {imageError ? (
                    <Text className="text-red-500 text-xs mt-2 text-center">{imageError}</Text>
                  ) : null}

                  {reviewItems.length > 0 && (
                    <View className="mt-5">
                      <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-3">
                        Review {reviewItems.length} item{reviewItems.length > 1 ? 's' : ''} before saving
                      </Text>
                      {reviewItems.map((item) => (
                        <View key={item.key} className="flex-row p-3 mb-3 rounded-2xl border border-[#E5E5E1] dark:border-gray-800">
                          {item.image ? (
                            <Image source={{ uri: item.image }} className="w-20 h-24 rounded-xl mr-3 bg-[#F8F7F4] dark:bg-[#2A2A2A]" resizeMode="cover" />
                          ) : (
                            <View className="w-20 h-24 rounded-xl mr-3 bg-[#F8F7F4] dark:bg-[#2A2A2A]" />
                          )}
                          <View className="flex-1">
                            <View className="flex-row items-center">
                              <TextInput
                                value={item.name}
                                onChangeText={(t) => updateReviewItem(item.key, { name: t })}
                                placeholder="Name"
                                placeholderTextColor="#8E8E8A"
                                className={`flex-1 bg-[#F8F7F4] dark:bg-[#2A2A2A] p-2 rounded-lg text-sm dark:text-white ${item.name.trim() ? '' : 'border border-red-400'}`}
                              />
                              <TouchableOpacity onPress={() => removeReviewItem(item.key)} className="p-2 ml-1">
                                <Trash2 color="#8E8E8A" size={16} />
                              </TouchableOpacity>
                            </View>
                            <TextInput
                              value={item.color}
                              onChangeText={(t) => updateReviewItem(item.key, { color: t })}
                              placeholder="Color"
                              placeholderTextColor="#8E8E8A"
                              className={`bg-[#F8F7F4] dark:bg-[#2A2A2A] p-2 rounded-lg text-sm dark:text-white mt-2 ${item.color.trim() ? '' : 'border border-red-400'}`}
                            />
                            <View className="flex-row flex-wrap mt-2">
                              {(['top', 'bottom', 'shoes', 'accessory'] as ItemType[]).map((t) => (
                                <TouchableOpacity
                                  key={t}
                                  onPress={() => updateReviewItem(item.key, { type: t })}
                                  className={`px-2 py-1 mr-1 mb-1 rounded-md ${item.type === t ? 'bg-[#1A1A1A] dark:bg-white' : 'bg-[#F8F7F4] dark:bg-[#2A2A2A]'}`}
                                >
                                  <Text className={`text-[11px] ${item.type === t ? 'text-white dark:text-black' : 'text-[#8E8E8A]'}`}>{t}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            <View className="flex-row flex-wrap">
                              {(['casual', 'smart casual', 'formal'] as Formality[]).map((f) => (
                                <TouchableOpacity
                                  key={f}
                                  onPress={() => updateReviewItem(item.key, { formality: f })}
                                  className={`px-2 py-1 mr-1 mb-1 rounded-md ${item.formality === f ? 'bg-[#1A1A1A] dark:bg-white' : 'bg-[#F8F7F4] dark:bg-[#2A2A2A]'}`}
                                >
                                  <Text className={`text-[11px] ${item.formality === f ? 'text-white dark:text-black' : 'text-[#8E8E8A]'}`}>{f}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        </View>
                      ))}
                      <TouchableOpacity
                        onPress={saveReviewItems}
                        disabled={isSavingBulk || isAnalyzingImage || reviewItems.some((i) => !i.name.trim() || !i.color.trim())}
                        className={`py-4 rounded-xl items-center mt-2 ${isSavingBulk || isAnalyzingImage || reviewItems.some((i) => !i.name.trim() || !i.color.trim()) ? 'bg-gray-300' : 'bg-[#1A1A1A] dark:bg-white'}`}
                      >
                        {isSavingBulk ? (
                          <ActivityIndicator color={nativeColorScheme === 'dark' ? 'black' : 'white'} />
                        ) : (
                          <Text className="text-white dark:text-black font-medium text-lg">Save all {reviewItems.length} to Wardrobe</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {itemMode === 'manual' && (
              <>
              <View className="flex-row items-center mb-5">
                {newItem.image ? (
                  <Image source={{ uri: newItem.image }} className="w-16 h-20 rounded-xl mr-4 bg-[#F8F7F4] dark:bg-[#2A2A2A]" resizeMode="cover" />
                ) : (
                  <View className="w-16 h-20 rounded-xl mr-4 bg-[#F8F7F4] dark:bg-[#2A2A2A] items-center justify-center">
                    <Shirt color="#8E8E8A" size={22} />
                  </View>
                )}
                <View>
                  <TouchableOpacity onPress={pickItemPhoto} className="px-4 py-2 rounded-xl border border-[#E5E5E1] dark:border-gray-800 self-start">
                    <Text className="text-sm font-medium dark:text-white">{newItem.image ? 'Change photo' : 'Add photo'}</Text>
                  </TouchableOpacity>
                  <Text className="text-[10px] text-[#8E8E8A] mt-1">Shows the real item in outfits.</Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Item Name</Text>
                <TextInput value={newItem.name} onChangeText={(t) => setNewItem({...newItem, name: t})} className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 rounded-xl text-base dark:text-white" />
              </View>
              
              <View className="mb-4">
                <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Color</Text>
                <TextInput value={newItem.color} onChangeText={(t) => setNewItem({...newItem, color: t})} className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 rounded-xl text-base dark:text-white" />
              </View>

              <View className="mb-4">
                <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Description (optional)</Text>
                <TextInput
                  value={newItem.description || ''}
                  onChangeText={(t) => setNewItem({...newItem, description: t})}
                  placeholder="Material, texture, fit — e.g. ribbed cotton knit, oversized"
                  placeholderTextColor="#8E8E8A"
                  multiline
                  maxLength={300}
                  className="bg-[#F8F7F4] dark:bg-[#2A2A2A] p-4 rounded-xl text-base dark:text-white min-h-[64px]"
                />
                <Text className="text-[10px] text-[#8E8E8A] mt-1">
                  Auto-filled when you scan a photo. Helps generated outfit images match the real garment.
                </Text>
              </View>

              <View className="flex-row gap-4 mb-8">
                <View className="flex-1">
                  <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Type</Text>
                  <View className="bg-[#F8F7F4] dark:bg-[#2A2A2A] rounded-xl overflow-hidden">
                    {(['top', 'bottom', 'shoes', 'accessory'] as ItemType[]).map(t => (
                      <TouchableOpacity key={t} onPress={() => setNewItem({...newItem, type: t})} className={`p-3 ${newItem.type === t ? 'bg-[#1A1A1A] dark:bg-white' : ''}`}>
                        <Text className={`text-sm ${newItem.type === t ? 'text-white dark:text-black' : 'text-[#8E8E8A]'}`}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Formality</Text>
                  <View className="bg-[#F8F7F4] dark:bg-[#2A2A2A] rounded-xl overflow-hidden">
                    {(['casual', 'smart casual', 'formal'] as Formality[]).map(f => (
                      <TouchableOpacity key={f} onPress={() => setNewItem({...newItem, formality: f})} className={`p-3 ${newItem.formality === f ? 'bg-[#1A1A1A] dark:bg-white' : ''}`}>
                        <Text className={`text-sm ${newItem.formality === f ? 'text-white dark:text-black' : 'text-[#8E8E8A]'}`}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={addItem}
                disabled={!newItem.name || !newItem.color || isAnalyzingImage}
                className={`py-4 rounded-xl items-center ${!newItem.name || !newItem.color || isAnalyzingImage ? 'bg-gray-300' : 'bg-[#1A1A1A] dark:bg-white'}`}
              >
                <Text className="text-white dark:text-black font-medium text-lg">
                  {editingItemId ? 'Save Changes' : 'Add to Wardrobe'}
                </Text>
              </TouchableOpacity>
              </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
