import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  Shirt, 
  Footprints, 
  Watch, 
  Briefcase,
  ChevronRight,
  Loader2,
  X,
  LogIn,
  LogOut,
  User as UserIcon,
  LayoutGrid,
  Heart,
  Moon,
  Sun,
  Mail,
  Lock,
  Settings,
  KeyRound,
  ArrowLeft,
  Pencil
} from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { ClothingItem, OutfitSuggestion, ItemType, Formality, ItemAnalysis, SavedOutfitRecord, EventRecord } from './types';
import { getDailyOutfitSuggestion, getOutfitImage, getOutfitSuggestion, markOutfitWorn, refreshSession, getEvents, addEvent, removeEvent } from './services/geminiService';
import { apiFetch, apiJson, jsonHeaders } from './services/apiClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const AMAZON_ASSOCIATE_TAG = import.meta.env.VITE_AMAZON_ASSOCIATE_TAG?.trim();

const IMAGE_MAX_DIMENSION = 1280;
const IMAGE_JPEG_QUALITY = 0.82;

const buildAmazonAffiliateUrl = (searchTerm: string) => {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', searchTerm);

  if (AMAZON_ASSOCIATE_TAG) {
    url.searchParams.set('tag', AMAZON_ASSOCIATE_TAG);
  }

  return url.toString();
};

interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('token'));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null);
  const [outfitImageUrl, setOutfitImageUrl] = useState('');
  const [outfitImageError, setOutfitImageError] = useState('');
  const [isGeneratingOutfitImage, setIsGeneratingOutfitImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [itemMode, setItemMode] = useState<'manual' | 'photo'>('manual');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [lockedItemId, setLockedItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stylist' | 'lookbook'>('stylist');
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfitRecord[]>([]);
  const [bulkItems, setBulkItems] = useState<ItemAnalysis[]>([]);
  const [isAutoStyling, setIsAutoStyling] = useState(false);
  const [isDailyPick, setIsDailyPick] = useState(false);
  const [todaysPlan, setTodaysPlan] = useState(() => localStorage.getItem('todaysPlan') || '');
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [numLooks, setNumLooks] = useState(1);
  const [looks, setLooks] = useState<OutfitSuggestion[]>([]);
  const [activeLook, setActiveLook] = useState(0);
  const hasAutoStyledRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('todaysPlan', todaysPlan);
  }, [todaysPlan]);

  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  // Forgot-password flow: null = normal login, 'email' = enter email,
  // 'code' = enter the emailed code + new password.
  const [resetStep, setResetStep] = useState<null | 'email' | 'code'>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetInfo, setResetInfo] = useState('');

  // Account settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [hasPassword, setHasPassword] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsInfo, setSettingsInfo] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // New item form state. When editingItemId is set, the Add Item modal acts
  // as an edit form for that wardrobe item instead.
  const [newItem, setNewItem] = useState<Partial<ClothingItem>>({
    type: 'top',
    formality: 'casual'
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Handle Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Check initial auth state — renew the session from a stored refresh token so
  // users aren't logged out when the short-lived access token expires.
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    let cancelled = false;
    const init = async () => {
      const storedRefresh = sessionStorage.getItem('refreshToken');
      const savedUser = sessionStorage.getItem('user');

      if (storedRefresh) {
        try {
          const data = await refreshSession(storedRefresh);
          if (!cancelled) loginUser(data);
        } catch {
          if (!cancelled) handleLogout();
        }
      } else if (savedUser && sessionStorage.getItem('token')) {
        if (!cancelled) setUser(JSON.parse(savedUser));
      }

      if (!cancelled) setIsAuthReady(true);
    };

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a session can't be refreshed, apiClient fires `auth:expired` — log out.
  useEffect(() => {
    const onExpired = () => handleLogout();
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Wardrobe
  useEffect(() => {
    if (!user || !token) {
      setWardrobe([]);
      return;
    }

    const fetchWardrobe = async () => {
      try {
        const res = await apiFetch('/api/wardrobes');
        if (res.ok) {
          const responseJson = await res.json();
          const data = responseJson?.data ?? responseJson;
          setWardrobe(data);
        }
      } catch (error) {
        console.error("Failed to fetch wardrobe", error);
      }
    };

    fetchWardrobe();
  }, [user, token]);

  // Read coordinates only if the user already granted location — never prompt on open.
  const getGrantedCoordinates = async (): Promise<{ lat?: number; lon?: number }> => {
    try {
      const permission = await navigator.permissions?.query({ name: 'geolocation' });
      if (permission?.state === 'granted') {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        return { lat: position.coords.latitude, lon: position.coords.longitude };
      }
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
    setOutfitImageUrl('');
    setOutfitImageError('');
  };

  const selectLook = (i: number) => {
    if (!looks[i]) return;
    setActiveLook(i);
    setSuggestion(looks[i]);
    setOutfitImageUrl('');
    setOutfitImageError('');
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
        return;
      }

      // Initial auto-pick: don't clobber a suggestion the user already triggered.
      setSuggestion((current) => {
        if (current) return current;
        const opts = res.options && res.options.length > 1 ? res.options : [];
        setLooks(opts);
        setActiveLook(0);
        setIsDailyPick(true);
        setOutfitImageUrl('');
        setOutfitImageError('');
        return opts.length ? opts[0] : res;
      });
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
    const pad = (v: number) => String(v).padStart(2, '0');
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    getEvents(today).then(setEvents).catch((e) => console.warn('Failed to fetch events', e));
  }, [user, token]);

  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate) return;
    try {
      const created = await addEvent({ title: newEventTitle.trim(), date: newEventDate });
      setEvents((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setNewEventTitle('');
      setNewEventDate('');
    } catch (e) {
      console.error('Failed to add event', e);
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
      console.error('Failed to style for event', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-suggest today's pick on open, based on time, location and season
  useEffect(() => {
    if (!user || !token || wardrobe.length === 0 || hasAutoStyledRef.current) return;
    hasAutoStyledRef.current = true;
    runDailyPick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, wardrobe]);

  // Fetch Lookbook
  useEffect(() => {
    if (!user || !token || activeTab !== 'lookbook') return;

    const fetchLookbook = async () => {
      try {
        const res = await apiFetch('/api/saved_outfits');
        if (res.ok) {
          const responseJson = await res.json();
          const data = responseJson?.data ?? responseJson;
          setSavedOutfits(data);
        }
      } catch (error) {
        console.error("Failed to fetch lookbook", error);
      }
    };

    fetchLookbook();
  }, [user, token, activeTab]);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      setAuthError('');
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: response.access_token }),
        });

        if (res.ok) {
          const responseJson = await res.json();
          const data = responseJson?.data ?? responseJson;
          loginUser(data);
        } else {
          const errJson = await res.json().catch(() => null);
          setAuthError(errJson?.error || 'Google sign-in failed. Please try again.');
        }
      } catch (error) {
        console.error("Login failed", error);
        setAuthError('Google sign-in failed. Please try again.');
      }
    },
    onError: (error) => {
      console.error('Login Failed:', error);
      setAuthError('Google sign-in was cancelled or failed.');
    }
  });

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setAuthError('');
    setIsLoading(true);

    try {
      const endpoint = isRegistering ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const responseJson = await res.json();
      if (res.ok) {
        const data = responseJson?.data ?? responseJson;
        loginUser(data);
      } else {
        setAuthError(responseJson?.error || 'Authentication failed');
      }
    } catch (error) {
      setAuthError('Server error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setAuthError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        setAuthError(errJson?.error || 'Could not send the reset code. Please try again.');
        return;
      }
      setResetInfo(`If an account exists for ${email}, a 6-digit code is on its way. Check your inbox.`);
      setResetStep('code');
    } catch {
      setAuthError('Server error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !resetCode || !newPassword) return;
    setAuthError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: resetCode, newPassword }),
      });
      const responseJson = await res.json().catch(() => null);
      if (res.ok) {
        const data = responseJson?.data ?? responseJson;
        exitResetFlow();
        loginUser(data);
      } else {
        setAuthError(responseJson?.error || 'Could not reset the password. Please try again.');
      }
    } catch {
      setAuthError('Server error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exitResetFlow = () => {
    setResetStep(null);
    setResetCode('');
    setNewPassword('');
    setResetInfo('');
    setAuthError('');
  };

  const openSettings = async () => {
    setIsSettingsOpen(true);
    setSettingsError('');
    setSettingsInfo('');
    setCurrentPassword('');
    setSettingsNewPassword('');
    setSettingsName(user?.name || '');
    try {
      const me = await apiJson<{ name?: string; hasPassword: boolean }>('/api/auth/me');
      setHasPassword(me.hasPassword);
      setSettingsName(me.name || '');
    } catch {
      // Fall back to local user data; password section assumes a password exists.
      setHasPassword(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!settingsName.trim() || !user) return;
    setSettingsError('');
    setSettingsInfo('');
    setIsSavingSettings(true);
    try {
      const updated = await apiJson<User>('/api/auth/me', {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ name: settingsName.trim() }),
      });
      const nextUser = { ...user, name: updated.name };
      setUser(nextUser);
      sessionStorage.setItem('user', JSON.stringify(nextUser));
      setSettingsInfo('Profile updated.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not update the profile.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async () => {
    if (!settingsNewPassword || (hasPassword && !currentPassword)) return;
    setSettingsError('');
    setSettingsInfo('');
    setIsSavingSettings(true);
    try {
      await apiJson('/api/auth/change-password', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          ...(hasPassword ? { currentPassword } : {}),
          newPassword: settingsNewPassword,
        }),
      });
      setCurrentPassword('');
      setSettingsNewPassword('');
      setHasPassword(true);
      setSettingsInfo('Password updated.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const loginUser = (data: { token: string; refreshToken?: string; user: User }) => {
    setToken(data.token);
    setUser(data.user);
    sessionStorage.setItem('token', data.token);
    if (data.refreshToken) {
      sessionStorage.setItem('refreshToken', data.refreshToken);
    }
    sessionStorage.setItem('user', JSON.stringify(data.user));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setSuggestion(null);
    setLooks([]);
    setActiveLook(0);
    setIsDailyPick(false);
    hasAutoStyledRef.current = false;
    setOutfitImageUrl('');
    setOutfitImageError('');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
  };

  const getUploadPayload = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not process the selected image.'));
      img.src = dataUrl;
    });

    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare the selected image.');
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const compressedDataUrl = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
    const [, base64 = ''] = compressedDataUrl.split(',');

    return {
      base64,
      mimeType: 'image/jpeg',
    };
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsScanning(true);
    setScanError('');
    setBulkItems([]);

    try {
      const { base64, mimeType } = await getUploadPayload(file);

      const response = await apiFetch('/api/analyze-item', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Failed to analyze image');
      }

      const responseJson = await response.json();
      const data = responseJson?.data ?? responseJson;
      const items = data.items as ItemAnalysis[];
      
      if (items && items.length > 0) {
        setBulkItems(items);
        setNewItem({
          name: items[0].name,
          color: items[0].color,
          type: items[0].type,
          formality: items[0].formality,
          description: items[0].description,
        });
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to analyze image. Please try again or enter manually.');
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleGetSuggestion = async () => {
    if (!prompt.trim() || !user || !token) return;
    setIsLoading(true);
    try {
      let lat: number | undefined;
      let lon: number | undefined;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch (e) {
        console.warn("Geolocation failed or denied", e);
      }

      const res = await getOutfitSuggestion(prompt, { lat, lon, lockedItemId, count: numLooks });
      applySuggestion(res, false);
    } catch (error) {
      console.error("Failed to get suggestion", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateOutfitImage = async () => {
    if (!suggestion || !token) return;

    setIsGeneratingOutfitImage(true);
    setOutfitImageError('');

    try {
      const result = await getOutfitImage(suggestion);
      setOutfitImageUrl(`data:${result.mimeType};base64,${result.imageBase64}`);
    } catch (error) {
      setOutfitImageError(error instanceof Error ? error.message : 'Failed to generate outfit image.');
    } finally {
      setIsGeneratingOutfitImage(false);
    }
  };

  const handleSaveSuggestion = async () => {
    if (!suggestion || !user || !token) return;
    try {
      const res = await apiFetch('/api/saved_outfits', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(suggestion)
      });
      if (res.ok) {
        alert("Outfit saved to your lookbook!");
      }
    } catch (error) {
      console.error("Failed to save outfit", error);
    }
  };

  const startEditItem = (item: ClothingItem) => {
    setEditingItemId(item.id);
    setNewItem({
      name: item.name,
      color: item.color,
      type: item.type,
      formality: item.formality,
      description: item.description,
    });
    setItemMode('manual');
    setScanError('');
    setBulkItems([]);
    setIsAddingItem(true);
  };

  const closeItemModal = () => {
    setIsAddingItem(false);
    setItemMode('manual');
    setScanError('');
    setBulkItems([]);
    setEditingItemId(null);
    setNewItem({ type: 'top', formality: 'casual' });
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
        };

        if (editingItemId) {
          const res = await apiFetch(`/api/wardrobes/${editingItemId}`, {
            method: 'PUT',
            headers: jsonHeaders,
            body: JSON.stringify(itemData)
          });
          if (res.ok) {
            const responseJson = await res.json();
            const updated = responseJson?.data ?? responseJson;
            setWardrobe(wardrobe.map(i => (i.id === editingItemId ? updated : i)));
            closeItemModal();
          }
          return;
        }

        const res = await apiFetch('/api/wardrobes', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(itemData)
        });

        if (res.ok) {
          const responseJson = await res.json();
          const addedItem = responseJson?.data ?? responseJson;
          setWardrobe([...wardrobe, addedItem]);
          
          if (bulkItems.length > 1) {
            const remaining = bulkItems.slice(1);
            setBulkItems(remaining);
            setNewItem({
              name: remaining[0].name,
              color: remaining[0].color,
              type: remaining[0].type,
              formality: remaining[0].formality,
              description: remaining[0].description,
            });
          } else {
            setBulkItems([]);
            setNewItem({ type: 'top', formality: 'casual' });
            setIsAddingItem(false);
            setItemMode('manual');
            setScanError('');
          }
        }
      } catch (error) {
        console.error("Failed to add item", error);
      }
    }
  };

  const removeItem = async (id: string) => {
    if (!token) return;
    try {
      const res = await apiFetch(`/api/wardrobes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWardrobe(wardrobe.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error("Failed to remove item", error);
    }
  };

  const removeSavedOutfit = async (id: string) => {
    if (!token) return;
    try {
      const res = await apiFetch(`/api/saved_outfits/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSavedOutfits(savedOutfits.filter(o => o.id !== id));
      }
    } catch (error) {
      console.error("Failed to remove saved outfit", error);
    }
  };

  const handleMarkWorn = async (id: string) => {
    if (!token) return;
    try {
      const updated = await markOutfitWorn(id);
      setSavedOutfits((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)));
    } catch (error) {
      console.error('Failed to mark outfit as worn', error);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] dark:bg-[#121212]">
        <Loader2 className="animate-spin text-[#1A1A1A] dark:text-[#E5E5E1]" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F7F4] dark:bg-[#121212] p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <h1 className="font-serif text-6xl italic mb-4 dark:text-white">FitPick</h1>
            <p className="text-lg text-[#8E8E8A] leading-relaxed dark:text-gray-400">
              Your personal AI stylist.
            </p>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[32px] shadow-sm border border-[#E5E5E1] dark:border-gray-800">
            <h2 className="text-2xl font-medium mb-6 dark:text-white">
              {resetStep ? 'Reset Password' : isRegistering ? 'Create Account' : 'Sign In'}
            </h2>

            {authError && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm">
                {authError}
              </div>
            )}

            {resetStep === 'email' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-[#8E8E8A] leading-relaxed">
                  Enter your email and we'll send you a 6-digit code to reset your password.
                </p>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 text-[#8E8E8A]" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#F8F7F4] dark:bg-[#2A2A2A] border-transparent focus:bg-white dark:focus:bg-[#333] focus:border-[#E5E5E1] dark:text-white outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full bg-[#1A1A1A] dark:bg-white text-white dark:text-black py-4 rounded-2xl font-medium text-lg hover:opacity-90 transition-all shadow-xl mt-4 flex items-center justify-center disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Code'}
                </button>
                <button
                  type="button"
                  onClick={exitResetFlow}
                  className="w-full text-center text-[#8E8E8A] text-sm hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} /> Back to sign in
                </button>
              </form>
            )}

            {resetStep === 'code' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {resetInfo && (
                  <p className="text-sm text-[#8E8E8A] leading-relaxed">{resetInfo}</p>
                )}
                <div className="relative">
                  <KeyRound className="absolute left-4 top-4 text-[#8E8E8A]" size={18} />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#F8F7F4] dark:bg-[#2A2A2A] border-transparent focus:bg-white dark:focus:bg-[#333] focus:border-[#E5E5E1] dark:text-white outline-none transition-all tracking-[0.3em]"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 text-[#8E8E8A]" size={18} />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 characters)"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#F8F7F4] dark:bg-[#2A2A2A] border-transparent focus:bg-white dark:focus:bg-[#333] focus:border-[#E5E5E1] dark:text-white outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || resetCode.length !== 6 || newPassword.length < 8}
                  className="w-full bg-[#1A1A1A] dark:bg-white text-white dark:text-black py-4 rounded-2xl font-medium text-lg hover:opacity-90 transition-all shadow-xl mt-4 flex items-center justify-center disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password'}
                </button>
                <button
                  type="button"
                  onClick={() => { setResetStep('email'); setAuthError(''); }}
                  className="w-full text-center text-[#8E8E8A] text-sm hover:text-black dark:hover:text-white transition-colors"
                >
                  Didn't get a code? Send again
                </button>
                <button
                  type="button"
                  onClick={exitResetFlow}
                  className="w-full text-center text-[#8E8E8A] text-sm hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} /> Back to sign in
                </button>
              </form>
            )}

            {!resetStep && (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-4 text-[#8E8E8A]" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#F8F7F4] dark:bg-[#2A2A2A] border-transparent focus:bg-white dark:focus:bg-[#333] focus:border-[#E5E5E1] dark:text-white outline-none transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-4 text-[#8E8E8A]" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#F8F7F4] dark:bg-[#2A2A2A] border-transparent focus:bg-white dark:focus:bg-[#333] focus:border-[#E5E5E1] dark:text-white outline-none transition-all"
                />
              </div>
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1A1A1A] dark:bg-white text-white dark:text-black py-4 rounded-2xl font-medium text-lg hover:opacity-90 transition-all shadow-xl mt-4 flex items-center justify-center"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (isRegistering ? 'Sign Up' : 'Sign In')}
              </button>
              {!isRegistering && (
                <button
                  type="button"
                  onClick={() => { setResetStep('email'); setAuthError(''); }}
                  className="w-full text-center text-[#8E8E8A] text-sm hover:text-black dark:hover:text-white transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </form>
            )}

            {!resetStep && (
            <>
            <div className="relative my-8 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5E5E1] dark:border-gray-800"></div>
              </div>
              <span className="relative px-4 bg-white dark:bg-[#1E1E1E] text-[#8E8E8A] text-xs uppercase tracking-widest">or</span>
            </div>

            <button 
              onClick={() => handleGoogleLogin()}
              className="w-full flex items-center justify-center gap-3 border border-[#E5E5E1] dark:border-gray-800 py-4 rounded-2xl font-medium text-lg hover:bg-[#F8F7F4] dark:hover:bg-[#2A2A2A] transition-all dark:text-white"
            >
              <LogIn size={20} />
              Google Account
            </button>

            <button 
              onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }}
              className="w-full text-center mt-6 text-[#8E8E8A] text-sm hover:text-black dark:hover:text-white transition-colors"
            >
              {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Create one'}
            </button>
            </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8F7F4] dark:bg-[#121212] dark:text-white transition-colors">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-6 bg-white dark:bg-[#1E1E1E] border-b border-[#E5E5E1] dark:border-gray-800 sticky top-0 z-30">
        <h1 className="font-serif text-2xl italic">FitPick</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-[#8E8E8A]"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setIsWardrobeOpen(!isWardrobeOpen)}
            className="px-4 py-2 rounded-xl border border-[#E5E5E1] dark:border-gray-800 text-sm font-medium"
          >
            {isWardrobeOpen ? 'Close' : 'Wardrobe'}
          </button>
          <button 
            onClick={() => setIsAddingItem(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1A1A1A] dark:bg-white text-white dark:text-black"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        w-full lg:w-96 bg-white dark:bg-[#1E1E1E] border-r border-[#E5E5E1] dark:border-gray-800 p-8 overflow-y-auto 
        ${isWardrobeOpen ? 'block' : 'hidden lg:block'}
        lg:max-h-screen lg:sticky lg:top-0 z-20
      `}>
        <div className="hidden lg:flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl italic">FitPick</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-[#E5E5E1] dark:border-gray-800 text-[#8E8E8A] hover:bg-[#FBFBFA] dark:hover:bg-[#2A2A2A] transition-all"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => setIsAddingItem(true)}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-[#1A1A1A] dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity"
            >
              <Plus size={20} />
            </button>
            <button
              onClick={openSettings}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-[#E5E5E1] dark:border-gray-800 text-[#8E8E8A] hover:bg-[#FBFBFA] dark:hover:bg-[#2A2A2A] transition-all"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={handleLogout}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-[#E5E5E1] dark:border-gray-800 text-[#8E8E8A] hover:text-red-500 transition-all"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-8">
          <button 
            onClick={() => setActiveTab('stylist')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'stylist' ? 'bg-[#1A1A1A] dark:bg-white text-white dark:text-black' : 'text-[#8E8E8A] hover:bg-[#FBFBFA] dark:hover:bg-[#2A2A2A]'}`}
          >
            <LayoutGrid size={20} />
            <span className="font-medium">Stylist</span>
          </button>
          <button 
            onClick={() => setActiveTab('lookbook')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'lookbook' ? 'bg-[#1A1A1A] dark:bg-white text-white dark:text-black' : 'text-[#8E8E8A] hover:bg-[#FBFBFA] dark:hover:bg-[#2A2A2A]'}`}
          >
            <Heart size={20} />
            <span className="font-medium">Lookbook</span>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-8 p-4 bg-[#FBFBFA] dark:bg-[#2A2A2A] rounded-2xl border border-[#E5E5E1] dark:border-gray-800">
          {user.picture ? (
            <img src={user.picture} alt={user.name || ''} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#E5E5E1] dark:bg-[#333] flex items-center justify-center">
              <UserIcon size={20} className="text-[#8E8E8A]" />
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user.name || user.email}</p>
            <p className="text-[10px] text-[#8E8E8A] truncate">{user.email}</p>
          </div>
          <div className="ml-auto flex items-center">
            <button
              onClick={openSettings}
              className="lg:hidden p-2 text-[#8E8E8A]"
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="lg:hidden p-2 text-[#8E8E8A]"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {(['top', 'bottom', 'shoes', 'accessory'] as ItemType[]).map(type => (
            <section key={type}>
              <h2 className="text-[11px] uppercase tracking-widest text-[#8E8E8A] font-semibold mb-4 flex items-center gap-2">
                {type === 'top' && <Shirt size={14} />}
                {type === 'bottom' && <Briefcase size={14} />}
                {type === 'shoes' && <Footprints size={14} />}
                {type === 'accessory' && <Watch size={14} />}
                {type}s
              </h2>
              <div className="space-y-2">
                {wardrobe.filter(i => i.type === type).map(item => (
                  <div key={item.id} className="group flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-[#E5E5E1] dark:hover:border-gray-800 hover:bg-[#FBFBFA] dark:hover:bg-[#2A2A2A] transition-all">
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-[#8E8E8A] uppercase tracking-wider">{item.color} • {item.formality}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLockedItemId(lockedItemId === item.id ? null : item.id)}
                        className={`p-1.5 rounded-lg transition-all ${lockedItemId === item.id ? 'bg-[#1A1A1A] dark:bg-white text-white dark:text-black' : 'opacity-0 group-hover:opacity-100 text-[#8E8E8A] hover:bg-[#E5E5E1] dark:hover:bg-gray-800'}`}
                        title={lockedItemId === item.id ? 'Unlock Item' : 'Lock Item'}
                      >
                        <Sparkles size={14} />
                      </button>
                      <button
                        onClick={() => startEditItem(item)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[#8E8E8A] hover:text-black dark:hover:text-white transition-all"
                        title="Edit Item"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[#8E8E8A] hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {wardrobe.filter(i => i.type === type).length === 0 && (
                  <p className="text-xs text-[#8E8E8A] italic p-3 border border-dashed border-[#E5E5E1] dark:border-gray-800 rounded-xl text-center">
                    No {type}s added
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-16 max-w-4xl mx-auto w-full">
        {activeTab === 'stylist' ? (
          <>
            <div className="mb-8">
              <label className="text-[11px] uppercase tracking-[0.2em] text-[#8E8E8A] font-bold mb-2 block">
                Anything special today?
              </label>
              <input
                type="text"
                value={todaysPlan}
                onChange={(e) => setTodaysPlan(e.target.value)}
                placeholder="e.g. coffee with friends, then a dinner date"
                className="w-full bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800 rounded-2xl p-4 text-base focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 dark:text-white shadow-sm"
              />
              <p className="mt-2 text-xs text-[#8E8E8A]">Used to tailor your daily pick. Leave blank for a general suggestion.</p>
            </div>

            {/* Upcoming events */}
            <div className="mb-10">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#8E8E8A] font-bold mb-3">Upcoming</h3>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Event (e.g. Wedding)"
                  className="flex-1 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800 rounded-xl p-3 text-sm dark:text-white"
                />
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800 rounded-xl p-3 text-sm dark:text-white"
                />
                <button
                  onClick={handleAddEvent}
                  disabled={!newEventTitle.trim() || !newEventDate}
                  className="px-5 py-3 rounded-xl bg-[#1A1A1A] dark:bg-white text-white dark:text-black text-sm font-medium disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {events.length > 0 && (
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 bg-white dark:bg-[#1E1E1E]">
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate dark:text-white">{ev.title}</p>
                        <p className="text-[10px] uppercase tracking-wider text-[#8E8E8A]">{ev.date}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleStyleForEvent(ev.title)}
                          className="px-3 py-2 rounded-lg text-xs font-medium border border-[#E5E5E1] dark:border-gray-800 hover:bg-[#F8F7F4] dark:hover:bg-[#2A2A2A]"
                        >
                          Style for this
                        </button>
                        <button onClick={() => handleRemoveEvent(ev.id)} className="p-2 text-[#8E8E8A] hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-12">
              <h2 className="text-3xl lg:text-4xl font-light tracking-tight mb-4">What's the occasion?</h2>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. I have a job interview at a tech startup tomorrow..."
                  className="w-full bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800 rounded-2xl p-5 lg:p-6 text-base lg:text-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 dark:text-white min-h-[140px] resize-none shadow-sm"
                />
                <button
                  onClick={handleGetSuggestion}
                  disabled={isLoading || !prompt.trim() || wardrobe.length === 0}
                  className="mt-4 lg:absolute lg:bottom-4 lg:right-4 w-full lg:w-auto bg-[#1A1A1A] dark:bg-white text-white dark:text-black px-8 py-4 rounded-xl flex items-center justify-center gap-2 font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  Get Suggestion
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-widest text-[#8E8E8A] font-bold">Looks</span>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumLooks(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium border transition-all ${
                      numLooks === n
                        ? 'bg-[#1A1A1A] dark:bg-white text-white dark:text-black border-transparent'
                        : 'border-[#E5E5E1] dark:border-gray-800 text-[#8E8E8A] hover:bg-[#F8F7F4] dark:hover:bg-[#2A2A2A]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="text-xs text-[#8E8E8A]">{numLooks > 1 ? 'compare options' : 'single look'}</span>
              </div>
              {wardrobe.length === 0 && (
                <p className="mt-4 text-sm text-red-500 flex items-center gap-2">
                  <X size={14} /> Add items to your wardrobe first to get suggestions.
                </p>
              )}
            </div>

            {isAutoStyling && !suggestion && (
              <div className="mb-12 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800 rounded-2xl p-5 flex items-center gap-3 shadow-sm">
                <Loader2 className="animate-spin text-[#8E8E8A]" size={20} />
                <p className="text-sm text-[#8E8E8A]">
                  Styling today's pick from your wardrobe based on the time, season and weather…
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {suggestion && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-12"
                >
                  {looks.length > 1 && (
                    <div className="flex items-center gap-2">
                      {looks.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => selectLook(i)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                            activeLook === i
                              ? 'bg-[#1A1A1A] dark:bg-white text-white dark:text-black border-transparent'
                              : 'border-[#E5E5E1] dark:border-gray-800 text-[#8E8E8A] hover:bg-[#F8F7F4] dark:hover:bg-[#2A2A2A]'
                          }`}
                        >
                          Look {String.fromCharCode(65 + i)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border-b border-[#E5E5E1] dark:border-gray-800 pb-8 flex justify-between items-end gap-4 flex-wrap">
                    <div>
                      <span className="text-[11px] uppercase tracking-[0.2em] text-[#8E8E8A] font-bold">
                        {isDailyPick ? "Today's pick for you" : 'Outfit Suggestion for'}
                      </span>
                      <h3 className="text-3xl font-serif italic mt-2">{suggestion.occasion}</h3>
                      {suggestion.context && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {suggestion.context.weather && (
                            <span className="text-xs px-3 py-1 rounded-full bg-[#F8F7F4] dark:bg-[#2A2A2A] text-[#555552] dark:text-gray-300 capitalize">
                              {Math.round(suggestion.context.weather.temp)}°C · {suggestion.context.weather.description} · {suggestion.context.weather.city}
                            </span>
                          )}
                          {suggestion.context.timeOfDay && (
                            <span className="text-xs px-3 py-1 rounded-full bg-[#F8F7F4] dark:bg-[#2A2A2A] text-[#555552] dark:text-gray-300 capitalize">
                              {suggestion.context.timeOfDay}
                            </span>
                          )}
                          {suggestion.context.season && (
                            <span className="text-xs px-3 py-1 rounded-full bg-[#F8F7F4] dark:bg-[#2A2A2A] text-[#555552] dark:text-gray-300 capitalize">
                              {suggestion.context.season}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isDailyPick && (
                        <button
                          onClick={() => runDailyPick({ force: true, variety: true })}
                          disabled={isAutoStyling}
                          className="px-6 py-2 rounded-xl border border-[#E5E5E1] dark:border-gray-800 text-sm font-medium hover:bg-[#F8F7F4] dark:hover:bg-[#2A2A2A] disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                          {isAutoStyling ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                          Try another look
                        </button>
                      )}
                      <button
                        onClick={handleSaveSuggestion}
                        className="px-6 py-2 rounded-xl border border-[#E5E5E1] dark:border-gray-800 text-sm font-medium hover:bg-[#1A1A1A] dark:hover:bg-white hover:text-white dark:hover:text-black transition-all flex items-center gap-2"
                      >
                        <Heart size={16} />
                        Save to Lookbook
                      </button>
                    </div>
                  </div>

                  {/* Virtual Canvas */}
                  <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800 rounded-[32px] p-8 shadow-sm">
                    <div className="flex flex-col md:flex-row items-center justify-around gap-8">
                      {[
                        { label: 'Top', name: suggestion.top.name, icon: <Shirt size={32} /> },
                        { label: 'Bottom', name: suggestion.bottom.name, icon: <Briefcase size={32} /> },
                        { label: 'Shoes', name: suggestion.shoes.name, icon: <Footprints size={32} /> },
                        { label: 'Accessory', name: suggestion.accessory.name, icon: <Watch size={32} /> }
                      ].map((item) => (
                        <div key={item.label} className="flex flex-col items-center text-center max-w-[120px]">
                          <div className="w-20 h-20 rounded-2xl bg-[#F8F7F4] dark:bg-[#2A2A2A] flex items-center justify-center text-[#1A1A1A] dark:text-white mb-4 border border-[#E5E5E1] dark:border-gray-800">
                            {item.icon}
                          </div>
                          <span className="text-[9px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-1">{item.label}</span>
                          <p className="text-sm font-medium leading-tight">{item.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E1] dark:border-gray-800 rounded-[32px] p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-2">Visual Preview</h4>
                        <p className="text-sm text-[#555552] dark:text-gray-400">Generate a flat-lay image of this outfit.</p>
                      </div>
                      <button
                        onClick={handleGenerateOutfitImage}
                        disabled={isGeneratingOutfitImage}
                        className="px-6 py-3 rounded-xl bg-[#1A1A1A] dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {isGeneratingOutfitImage ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                        {outfitImageUrl ? 'Regenerate Image' : 'Generate Image'}
                      </button>
                    </div>
                    {outfitImageError && (
                      <p className="mb-4 text-sm text-red-500">{outfitImageError}</p>
                    )}
                    {outfitImageUrl && (
                      <img
                        src={outfitImageUrl}
                        alt={`Generated outfit preview for ${suggestion.occasion}`}
                        className="w-full max-h-[680px] object-contain rounded-2xl bg-[#F8F7F4] dark:bg-[#2A2A2A]"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {[
                      { label: 'Top', data: suggestion.top },
                      { label: 'Bottom', data: suggestion.bottom },
                      { label: 'Shoes', data: suggestion.shoes },
                      { label: 'Accessory', data: suggestion.accessory }
                    ].map((part, idx) => (
                      <motion.div 
                        key={part.label}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <h4 className="text-[10px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-3 flex items-center gap-2">
                          <ChevronRight size={12} /> {part.label}
                        </h4>
                        <p className="text-xl font-medium mb-2">{part.data.name}</p>
                        <p className="text-sm text-[#555552] dark:text-gray-400 leading-relaxed">{part.data.reason}</p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-[#1A1A1A] dark:bg-[#2A2A2A] text-white p-8 rounded-3xl relative overflow-hidden">
                    <div className="relative z-10">
                      <h4 className="text-[10px] uppercase tracking-widest opacity-60 font-bold mb-4">Stylist Note</h4>
                      <p className="text-lg font-light leading-relaxed italic">"{suggestion.stylistNote}"</p>
                    </div>
                    <Sparkles className="absolute -bottom-4 -right-4 opacity-10" size={120} />
                  </div>

                  {suggestion.wardrobeGap && (
                    <div className="p-6 border border-dashed border-[#E5E5E1] dark:border-gray-800 rounded-2xl bg-[#FBFBFA] dark:bg-[#1E1E1E] flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-red-500 font-bold mb-2">Wardrobe Gap</h4>
                        <p className="text-sm text-[#555552] dark:text-gray-400">{suggestion.wardrobeGap}</p>
                      </div>
                      {suggestion.wardrobeGapSearchTerm && (
                        <a 
                          href={buildAmazonAffiliateUrl(suggestion.wardrobeGapSearchTerm)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-3 bg-[#1A1A1A] dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-all text-center"
                        >
                          Shop missing item
                        </a>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="space-y-12">
            <div className="border-b border-[#E5E5E1] dark:border-gray-800 pb-8">
              <h2 className="text-3xl lg:text-4xl font-serif italic">My Lookbook</h2>
              <p className="text-[#8E8E8A] mt-2">Your collection of saved outfit suggestions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {savedOutfits.map((outfit) => (
                <motion.div 
                  key={outfit.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-[#E5E5E1] dark:border-gray-800 shadow-sm group relative"
                >
                  <button 
                    onClick={() => removeSavedOutfit(outfit.id)}
                    className="absolute top-4 right-4 p-2 text-[#8E8E8A] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#8E8E8A] font-bold">Occasion</span>
                  <h3 className="text-xl font-serif italic mb-6">{outfit.occasion}</h3>
                  
                  <div className="space-y-4">
                    {[
                      { label: 'Top', name: outfit.top.name },
                      { label: 'Bottom', name: outfit.bottom.name },
                      { label: 'Shoes', name: outfit.shoes.name }
                    ].map(item => (
                      <div key={item.label}>
                        <h4 className="text-[9px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-1">{item.label}</h4>
                        <p className="text-sm font-medium">{item.name}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-[#F8F7F4] dark:border-gray-800">
                    <p className="text-xs italic text-[#555552] dark:text-gray-400 leading-relaxed">
                      {(outfit.stylistNote || '').length > 100 ? (outfit.stylistNote || '').substring(0, 100) + '...' : outfit.stylistNote}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleMarkWorn(outfit.id)}
                      className="px-4 py-2 rounded-xl bg-[#1A1A1A] dark:bg-white text-white dark:text-black text-xs font-medium hover:opacity-90 transition-all"
                    >
                      I wore this
                    </button>
                    {(outfit.wornCount ?? 0) > 0 && (
                      <span className="text-[10px] uppercase tracking-widest text-[#8E8E8A] font-bold">
                        Worn {outfit.wornCount}×
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}

              {savedOutfits.length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-[#E5E5E1] dark:border-gray-800 rounded-3xl">
                  <Heart size={40} className="mx-auto text-[#E5E5E1] dark:text-gray-800 mb-4" />
                  <p className="text-[#8E8E8A]">Your lookbook is empty. Save some outfit suggestions to see them here!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-[32px] p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-serif italic dark:text-white">Settings</h3>
                <button onClick={() => setIsSettingsOpen(false)} className="text-[#8E8E8A] hover:text-black dark:hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {settingsError && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm">
                  {settingsError}
                </div>
              )}
              {settingsInfo && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-2xl text-green-700 dark:text-green-400 text-sm">
                  {settingsInfo}
                </div>
              )}

              <div className="space-y-6">
                <section>
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-3">Profile</h4>
                  <p className="text-xs text-[#8E8E8A] mb-3">{user.email}</p>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Display Name</label>
                  <input
                    type="text"
                    value={settingsName}
                    onChange={e => setSettingsName(e.target.value)}
                    placeholder="Your name"
                    className="w-full p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 dark:bg-[#2A2A2A] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingSettings || !settingsName.trim() || settingsName.trim() === (user.name || '')}
                    className="mt-3 px-6 py-3 rounded-xl bg-[#1A1A1A] dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    Save Profile
                  </button>
                </section>

                <section className="pt-6 border-t border-[#E5E5E1] dark:border-gray-800">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-3">
                    {hasPassword ? 'Change Password' : 'Set a Password'}
                  </h4>
                  {!hasPassword && (
                    <p className="text-xs text-[#8E8E8A] mb-3">
                      You signed in with Google. Set a password to also log in with your email.
                    </p>
                  )}
                  <div className="space-y-3">
                    {hasPassword && (
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        className="w-full p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 dark:bg-[#2A2A2A] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    )}
                    <input
                      type="password"
                      value={settingsNewPassword}
                      onChange={e => setSettingsNewPassword(e.target.value)}
                      placeholder="New password (min 8 characters)"
                      className="w-full p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 dark:bg-[#2A2A2A] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                    <button
                      onClick={handleChangePassword}
                      disabled={isSavingSettings || settingsNewPassword.length < 8 || (hasPassword && !currentPassword)}
                      className="px-6 py-3 rounded-xl bg-[#1A1A1A] dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {hasPassword ? 'Change Password' : 'Set Password'}
                    </button>
                  </div>
                </section>

                <section className="pt-6 border-t border-[#E5E5E1] dark:border-gray-800">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-3">Appearance</h4>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 text-sm font-medium hover:bg-[#F8F7F4] dark:hover:bg-[#2A2A2A] transition-all"
                  >
                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                    {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </button>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-[32px] p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                  <h3 className="text-2xl font-serif italic dark:text-white">{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
                  {bulkItems.length > 0 && (
                    <span className="text-[10px] uppercase font-bold text-[#8E8E8A] mt-1">Reviewing Scan: {bulkItems.length} items found</span>
                  )}
                </div>
                <button onClick={closeItemModal} className="text-[#8E8E8A] hover:text-black dark:hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {!editingItemId && (
              <div className="flex bg-[#F8F7F4] dark:bg-[#2A2A2A] rounded-xl p-1 mb-6">
                <button
                  onClick={() => setItemMode('manual')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${itemMode === 'manual' ? 'bg-white dark:bg-[#1E1E1E] shadow-sm dark:text-white' : 'text-[#8E8E8A]'}`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setItemMode('photo')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${itemMode === 'photo' ? 'bg-white dark:bg-[#1E1E1E] shadow-sm dark:text-white' : 'text-[#8E8E8A]'}`}
                >
                  Scan Photo
                </button>
              </div>
              )}

              {itemMode === 'photo' && bulkItems.length === 0 && (
                <div className="mb-6">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#E5E5E1] dark:border-gray-800 rounded-2xl cursor-pointer hover:bg-[#FBFBFA] dark:hover:bg-[#2A2A2A] transition-all relative overflow-hidden">
                    {isScanning ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-[#8E8E8A]" size={24} />
                        <span className="text-xs text-[#8E8E8A]">Analyzing item...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Sparkles className="text-[#8E8E8A]" size={24} />
                        <span className="text-xs text-[#8E8E8A]">Upload a photo to scan items</span>
                      </div>
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isScanning} />
                  </label>
                  {scanError && <p className="text-[10px] text-red-500 mt-2">{scanError}</p>}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Item Name</label>
                  <input 
                    type="text" 
                    value={newItem.name || ''}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                    placeholder="e.g. White Linen Shirt"
                    className="w-full p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 dark:bg-[#2A2A2A] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Color</label>
                    <input 
                      type="text" 
                      value={newItem.color || ''}
                      onChange={e => setNewItem({...newItem, color: e.target.value})}
                      placeholder="e.g. White"
                      className="w-full p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 dark:bg-[#2A2A2A] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Type</label>
                    <select 
                      value={newItem.type}
                      onChange={e => setNewItem({...newItem, type: e.target.value as ItemType})}
                      className="w-full p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 dark:bg-[#2A2A2A] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5 bg-white"
                    >
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                      <option value="shoes">Shoes</option>
                      <option value="accessory">Accessory</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Description (optional)</label>
                  <textarea
                    value={newItem.description || ''}
                    onChange={e => setNewItem({...newItem, description: e.target.value})}
                    placeholder="Material, texture, fit — e.g. ribbed cotton knit, oversized"
                    maxLength={300}
                    rows={2}
                    className="w-full p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 dark:bg-[#2A2A2A] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                  />
                  <p className="text-[10px] text-[#8E8E8A] mt-1">
                    Auto-filled when you scan a photo. Helps generated outfit images match the real garment.
                  </p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Formality</label>
                  <select
                    value={newItem.formality}
                    onChange={e => setNewItem({...newItem, formality: e.target.value as Formality})}
                    className="w-full p-3 rounded-xl border border-[#E5E5E1] dark:border-gray-800 dark:bg-[#2A2A2A] dark:text-white focus:outline-none focus:ring-2 focus:ring-black/5 bg-white"
                  >
                    <option value="casual">Casual</option>
                    <option value="smart casual">Smart Casual</option>
                    <option value="formal">Formal</option>
                  </select>
                </div>
                <button 
                  onClick={addItem}
                  className="w-full bg-[#1A1A1A] dark:bg-white text-white dark:text-black py-4 rounded-xl font-medium mt-4 hover:opacity-90 transition-opacity"
                >
                  {editingItemId ? 'Save Changes' : bulkItems.length > 1 ? `Save & Next (${bulkItems.length - 1} left)` : 'Add to Wardrobe'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
