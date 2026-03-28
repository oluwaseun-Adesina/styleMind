import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, Modal, Linking, Image, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import { 
  Plus, Trash2, Sparkles, Shirt, Footprints, Watch, Briefcase, 
  ChevronRight, X, LogIn, LogOut, User as UserIcon, Heart 
} from 'lucide-react-native';
import { ClothingItem, OutfitSuggestion, ItemType, Formality, ItemAnalysis } from '../types';
import { getOutfitSuggestion } from '../services/geminiService';
import { API_BASE_URL, getToken, getUser, saveAuth, clearAuth } from '../firebase';
import { MaxContentWidth } from '@/constants/theme';

// Mock Ad Banner Component
const AdBanner = () => (
  <View className="w-full bg-slate-200 py-3 items-center justify-center my-4 rounded-xl border border-slate-300">
    <Text className="text-xs text-slate-500 font-bold uppercase tracking-widest">Advertisement</Text>
    <Text className="text-sm font-medium text-slate-700">Get 15% off at ASOS. Tap here!</Text>
  </View>
);

export default function AppScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemMode, setItemMode] = useState<'manual' | 'photo'>('manual');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [photoAnalysis, setPhotoAnalysis] = useState<ItemAnalysis | null>(null);
  const [lockedItemId, setLockedItemId] = useState<string | null>(null);
  const [bulkItems, setBulkItems] = useState<ItemAnalysis[]>([]);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID || 'dummy-android-id',
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID || 'dummy-ios-id',
    webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID || 'dummy-web-id',
  });

  // New item form state
  const [newItem, setNewItem] = useState<Partial<ClothingItem>>({
    type: 'top',
    formality: 'casual'
  });

  const resetNewItemForm = () => {
    setNewItem({ type: 'top', formality: 'casual' });
    setItemMode('manual');
    setSelectedImage(null);
    setImageError('');
    setIsAnalyzingImage(false);
    setPhotoAnalysis(null);
    setBulkItems([]);
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

  // Initial Auth Check
  useEffect(() => {
    const initAuth = async () => {
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

  // Handle Google Login Response
  useEffect(() => {
    if (response?.type === 'success' && response.authentication) {
      handleBackendLogin(response.authentication.accessToken);
    }
  }, [response]);

  const handleBackendLogin = async (googleAccessToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleAccessToken }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        await saveAuth(data.token, data.user);
      } else {
        Alert.alert("Error", "Backend authentication failed.");
      }
    } catch (error) {
      console.error("Login failed", error);
      Alert.alert("Error", "Could not connect to authentication server.");
    }
  };

  // Fetch Wardrobe
  useEffect(() => {
    if (!user || !token) {
      setWardrobe([]);
      return;
    }

    const fetchWardrobe = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/wardrobes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setWardrobe(data);
        }
      } catch (error) {
        console.error("Failed to fetch wardrobe", error);
      }
    };

    fetchWardrobe();
  }, [user, token]);

  const handleLogout = async () => {
    await clearAuth();
    setToken(null);
    setUser(null);
    setSuggestion(null);
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
          const location = await Location.getCurrentPositionAsync({});
          lat = location.coords.latitude;
          lon = location.coords.longitude;
        }
      } catch (e) {
        console.warn('Location permission denied or failed', e);
      }

      const res = await getOutfitSuggestion(wardrobe, prompt, token, lat, lon, lockedItemId);
      setSuggestion(res);
    } catch (error) {
      console.error("Failed to get suggestion", error);
      Alert.alert("Error", "Failed to generate suggestion.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSuggestion = async () => {
    if (!suggestion || !user || !token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/saved_outfits`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(suggestion)
      });
      if (res.ok) {
        Alert.alert("Saved", "Outfit saved to your lookbook!");
      }
    } catch (error) {
      console.error("Failed to save outfit", error);
      Alert.alert("Error", "Failed to save outfit.");
    }
  };

  const analyzeImage = async (base64: string, mimeType: string) => {
    if (!token) return;
    setIsAnalyzingImage(true);
    setImageError('');
    setBulkItems([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Failed to analyze image.');
      }

      const data = await response.json();
      const items = data.items as ItemAnalysis[];
      
      if (items && items.length > 0) {
        setBulkItems(items);
        setPhotoAnalysis(items[0]);
        setNewItem({
          name: items[0].name,
          color: items[0].color,
          type: items[0].type,
          formality: items[0].formality,
        });
      }
    } catch (error) {
      console.error('Failed to analyze wardrobe image', error);
      setImageError(error instanceof Error ? error.message : 'Failed to analyze image.');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const pickWardrobePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setImageError('Photo access is needed to scan an item.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
      base64: true,
    });

    const asset = result.assets?.[0];
    if (result.canceled || !asset) {
      return;
    }

    const manipulatedResult = await manipulateAsync(
      asset.uri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true }
    );

    setSelectedImage(manipulatedResult.uri);

    if (manipulatedResult.base64) {
      await analyzeImage(manipulatedResult.base64, 'image/jpeg');
    } else {
      setImageError('Could not read the selected image. Try another photo.');
    }
  };

  const addItem = async () => {
    if (newItem.name && newItem.color && user && token) {
      try {
        const itemData = {
          name: newItem.name, 
          color: newItem.color,
          type: newItem.type as ItemType,
          formality: newItem.formality as Formality,
        };
        
        const res = await fetch(`${API_BASE_URL}/api/wardrobes`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(itemData)
        });

        if (res.ok) {
          const addedItem = await res.json();
          setWardrobe([...wardrobe, addedItem]);
          
          if (bulkItems.length > 1) {
            const remaining = bulkItems.slice(1);
            setBulkItems(remaining);
            setPhotoAnalysis(remaining[0]);
            setNewItem({
              name: remaining[0].name,
              color: remaining[0].color,
              type: remaining[0].type,
              formality: remaining[0].formality,
            });
          } else {
            closeAddItemModal();
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
      const res = await fetch(`${API_BASE_URL}/api/wardrobes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setWardrobe(wardrobe.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error("Failed to remove item", error);
    }
  };

  const openAffiliateLink = (searchTerm: string) => {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(searchTerm)}`;
    Linking.openURL(url);
  };

  if (!isAuthReady) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8F7F4]">
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F7F4] justify-center px-8">
        <View className="w-full max-w-md self-center">
          <View className="items-center mb-12">
            <Text className="font-serif text-5xl italic mb-4">FitPick</Text>
            <Text className="text-lg text-[#8E8E8A] text-center">Your personal AI stylist.</Text>
          </View>

          <View className="bg-white p-8 rounded-[32px] shadow-sm border border-[#E5E5E1]">
            <Text className="text-2xl font-medium mb-6 text-center">Welcome</Text>
            <TouchableOpacity 
              disabled={!request}
              onPress={() => promptAsync()} 
              className="bg-[#1A1A1A] py-4 rounded-2xl flex-row justify-center items-center mb-4"
            >
              <LogIn color="white" size={20} />
              <Text className="text-white font-medium text-lg ml-2">Sign In with Google</Text>
            </TouchableOpacity>
            <Text className="text-xs text-[#8E8E8A] text-center mt-4">
              Access your wardrobe across all devices.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8F7F4]">
      {/* Header */}
      <View className="bg-white border-b border-[#E5E5E1] z-10">
        <View
          className="flex-row items-center justify-between px-6 py-4 self-center w-full"
          style={{ maxWidth: MaxContentWidth }}
        >
          <View>
            <Text className="font-serif text-2xl italic">FitPick</Text>
            <Text className="text-xs text-[#8E8E8A] mt-0.5">Hello, {user.name || 'Stylist'}</Text>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => router.push('/lookbook')} className="p-2">
              <Heart color="#8E8E8A" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} className="p-2">
              <LogOut color="#8E8E8A" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full self-center" style={{ maxWidth: MaxContentWidth }}>
          <View className="mb-8">
            <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold mb-3">
              Stylist
            </Text>
            <Text className="text-3xl font-light leading-tight mb-3">What’s the occasion?</Text>
            <Text className="text-[#8E8E8A] text-base leading-6 mb-5">
              Describe the event and we’ll build an outfit from your wardrobe.
            </Text>

            <View className="bg-white rounded-3xl p-5 border border-[#E5E5E1] shadow-sm">
              <TextInput
                multiline
                numberOfLines={4}
                value={prompt}
                onChangeText={setPrompt}
                placeholder="e.g. I have a job interview tomorrow..."
                className="text-base text-[#1A1A1A] mb-4 text-left"
                style={{ textAlignVertical: 'top', minHeight: 110 }}
              />
              <TouchableOpacity
                onPress={handleGetSuggestion}
                disabled={isLoading || !prompt.trim() || wardrobe.length === 0}
                className={`flex-row justify-center items-center py-4 rounded-2xl ${
                  isLoading || !prompt.trim() || wardrobe.length === 0 ? 'bg-gray-300' : 'bg-[#1A1A1A]'
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Sparkles color="white" size={20} />
                    <Text className="text-white font-medium ml-2 text-lg">Style Me</Text>
                  </>
                )}
              </TouchableOpacity>
              {wardrobe.length === 0 && (
                <Text className="text-red-500 text-sm mt-3 text-center">
                  Add clothes to your wardrobe below first.
                </Text>
              )}
            </View>
          </View>

          {suggestion && (
            <View className="mb-10">
              <View className="flex-row items-end justify-between mb-5">
                <View className="flex-1 mr-4">
                  <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold">
                    Suggestion for
                  </Text>
                  <Text className="text-3xl font-serif italic mt-1">{suggestion.occasion}</Text>
                </View>
                <TouchableOpacity 
                  onPress={handleSaveSuggestion}
                  className="px-4 py-2 rounded-xl border border-[#E5E5E1] bg-white"
                >
                  <Text className="text-sm font-medium">Save</Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                className="mb-6 py-2"
                contentContainerStyle={{ paddingRight: 20 }}
              >
                {[
                  { label: 'Top', name: suggestion.top.name, icon: <Shirt color="#1A1A1A" size={24} /> },
                  { label: 'Bottom', name: suggestion.bottom.name, icon: <Briefcase color="#1A1A1A" size={24} /> },
                  { label: 'Shoes', name: suggestion.shoes.name, icon: <Footprints color="#1A1A1A" size={24} /> },
                  { label: 'Accessory', name: suggestion.accessory.name, icon: <Watch color="#1A1A1A" size={24} /> }
                ].map((item) => (
                  <View key={item.label} className="items-center mr-6 w-24">
                    <View className="w-16 h-16 rounded-2xl bg-white border border-[#E5E5E1] items-center justify-center mb-2 shadow-sm">
                      {item.icon}
                    </View>
                    <Text className="text-[8px] uppercase tracking-widest text-[#8E8E8A] font-bold text-center mb-0.5">{item.label}</Text>
                    <Text className="text-[10px] font-medium text-center leading-tight" numberOfLines={2}>{item.name}</Text>
                  </View>
                ))}
              </ScrollView>

              <View className="space-y-3 mb-5">
                {[
                  { label: 'Top', data: suggestion.top },
                  { label: 'Bottom', data: suggestion.bottom },
                  { label: 'Shoes', data: suggestion.shoes },
                  { label: 'Accessory', data: suggestion.accessory }
                ].map((part) => (
                  <View key={part.label} className="bg-white p-4 rounded-2xl border border-[#E5E5E1]">
                    <Text className="text-[10px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-1">
                      {part.label}
                    </Text>
                    <Text className="text-lg font-medium mb-1">{part.data.name}</Text>
                    <Text className="text-[#555552] leading-6">{part.data.reason}</Text>
                  </View>
                ))}
              </View>

              <View className="bg-[#1A1A1A] p-5 rounded-3xl mb-5">
                <Text className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">
                  Stylist Note
                </Text>
                <Text className="text-white text-base leading-7 italic">"{suggestion.stylistNote}"</Text>
              </View>

              {suggestion.wardrobeGap && (
                <View className="bg-[#FBFBFA] p-5 rounded-3xl border border-dashed border-[#E5E5E1] items-start">
                  <Text className="text-[10px] uppercase tracking-widest text-red-500 font-bold mb-2">
                    Wardrobe Gap
                  </Text>
                  <Text className="text-[#555552] mb-4 text-base leading-6">{suggestion.wardrobeGap}</Text>
                  {suggestion.wardrobeGapSearchTerm && (
                    <TouchableOpacity
                      onPress={() => openAffiliateLink(suggestion.wardrobeGapSearchTerm!)}
                      className="bg-black px-5 py-3 rounded-xl border border-[#E5E5E1]"
                    >
                      <Text className="text-white font-medium">Shop this missing item</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View className="mt-5">
                <AdBanner />
              </View>
            </View>
          )}

          <View className="mb-12">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-[11px] uppercase tracking-[0.25em] text-[#8E8E8A] font-bold mb-2">
                  Wardrobe
                </Text>
                <Text className="text-2xl font-serif italic">My items</Text>
              </View>
              <TouchableOpacity onPress={() => openAddItemModal()} className="bg-[#1A1A1A] w-11 h-11 rounded-full items-center justify-center">
                <Plus color="white" size={20} />
              </TouchableOpacity>
            </View>

            {(['top', 'bottom', 'shoes', 'accessory'] as ItemType[]).map(type => {
              const items = wardrobe.filter(i => i.type === type);

              return (
                <View key={type} className="mb-6">
                  <Text className="text-[11px] uppercase tracking-[0.22em] text-[#8E8E8A] font-bold mb-3">
                    {type}s
                  </Text>
                  {items.length > 0 ? (
                    <View className="space-y-2">
                      {items.map(item => (
                        <View key={item.id} className="flex-row items-center justify-between p-4 bg-white rounded-2xl border border-[#E5E5E1]">
                          <View className="flex-1 pr-3">
                            <Text className="text-base font-medium">{item.name}</Text>
                            <Text className="text-xs text-[#8E8E8A] uppercase tracking-wider mt-1">
                              {item.color} • {item.formality}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <TouchableOpacity 
                              onPress={() => setLockedItemId(lockedItemId === item.id ? null : item.id)}
                              className={`p-2 rounded-lg ${lockedItemId === item.id ? 'bg-[#1A1A1A]' : ''}`}
                            >
                              <Sparkles color={lockedItemId === item.id ? 'white' : '#8E8E8A'} size={18} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeItem(item.id)} className="p-2">
                              <Trash2 color="#8E8E8A" size={18} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="rounded-2xl border border-dashed border-[#E5E5E1] bg-[#FBFBFA] px-4 py-5">
                      <Text className="text-[#8E8E8A] italic text-center text-sm">No {type}s added yet.</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Add Item Modal */}
      <Modal visible={isAddingItem} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="bg-white rounded-t-[40px] px-6 pt-5 pb-8 max-h-[92%]">
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-2xl font-serif italic">Add Item</Text>
                  {bulkItems.length > 0 && (
                    <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mt-1">
                      Reviewing: {bulkItems.length} items found
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={closeAddItemModal}>
                  <X color="#1A1A1A" size={24} />
                </TouchableOpacity>
              </View>

              <View className="flex-row bg-[#F8F7F4] rounded-xl p-1 mb-5">
                <TouchableOpacity
                  onPress={() => setItemMode('manual')}
                  className={`flex-1 py-3 rounded-lg items-center ${itemMode === 'manual' ? 'bg-white shadow-sm' : ''}`}
                >
                  <Text className={itemMode === 'manual' ? 'text-[#1A1A1A] font-medium' : 'text-[#8E8E8A]'}>
                    Manual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setItemMode('photo')}
                  className={`flex-1 py-3 rounded-lg items-center ${itemMode === 'photo' ? 'bg-white shadow-sm' : ''}`}
                >
                  <Text className={itemMode === 'photo' ? 'text-[#1A1A1A] font-medium' : 'text-[#8E8E8A]'}>
                    Scan Photo
                  </Text>
                </TouchableOpacity>
              </View>

              {itemMode === 'photo' && bulkItems.length === 0 && (
                <View className="mb-5">
                  <TouchableOpacity
                    onPress={pickWardrobePhoto}
                    disabled={isAnalyzingImage}
                    className={`py-4 rounded-xl items-center ${isAnalyzingImage ? 'bg-gray-300' : 'bg-[#1A1A1A]'}`}
                  >
                    {isAnalyzingImage ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-medium text-lg">Choose a Photo</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {selectedImage && (
                <View className="mb-5">
                  <Image
                    source={{ uri: selectedImage }}
                    className="w-full h-48 rounded-2xl mb-3"
                    resizeMode="cover"
                  />
                </View>
              )}

              {photoAnalysis && (
                <View className="mb-5 p-4 rounded-2xl bg-[#FBFBFA] border border-[#E5E5E1]">
                  <Text className="text-[10px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-2">
                    Review Scan
                  </Text>
                  <Text className="text-lg font-medium">{photoAnalysis.name}</Text>
                  <Text className="text-[#555552] mt-1">
                    {photoAnalysis.color} • {photoAnalysis.type} • {photoAnalysis.formality}
                  </Text>
                </View>
              )}

              <View className="mb-4">
                <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Item Name</Text>
                <TextInput placeholder="e.g. White Linen Shirt" value={newItem.name} onChangeText={(t) => setNewItem({...newItem, name: t})} className="bg-[#F8F7F4] p-4 rounded-xl text-base" />
              </View>
              
              <View className="mb-4">
                <Text className="text-[10px] uppercase font-bold text-[#8E8E8A] mb-2">Color</Text>
                <TextInput placeholder="e.g. White" value={newItem.color} onChangeText={(t) => setNewItem({...newItem, color: t})} className="bg-[#F8F7F4] p-4 rounded-xl text-base" />
              </View>
              
              <View className="mb-4 border border-[#E5E5E1] rounded-xl overflow-hidden mt-4">
                <Text className="p-4 bg-[#F8F7F4] font-medium border-b border-[#E5E5E1]">Item Type</Text>
                <View className="flex-row flex-wrap p-2">
                  {(['top', 'bottom', 'shoes', 'accessory'] as ItemType[]).map(t => (
                    <TouchableOpacity key={t} onPress={() => setNewItem({...newItem, type: t})} className={`p-2 px-4 m-1 rounded-full ${newItem.type === t ? 'bg-[#1A1A1A]' : 'bg-[#E5E5E1]'}`}>
                      <Text className={newItem.type === t ? 'text-white' : 'text-[#1A1A1A]'}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="mb-8 border border-[#E5E5E1] rounded-xl overflow-hidden mt-2">
                <Text className="p-4 bg-[#F8F7F4] font-medium border-b border-[#E5E5E1]">Formality</Text>
                <View className="flex-row flex-wrap p-2">
                  {(['casual', 'smart casual', 'formal'] as Formality[]).map(f => (
                    <TouchableOpacity key={f} onPress={() => setNewItem({...newItem, formality: f})} className={`p-2 px-4 m-1 rounded-full ${newItem.formality === f ? 'bg-[#1A1A1A]' : 'bg-[#E5E5E1]'}`}>
                      <Text className={newItem.formality === f ? 'text-white' : 'text-[#1A1A1A]'}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={addItem}
                disabled={!newItem.name || !newItem.color || isAnalyzingImage}
                className={`py-4 rounded-xl items-center ${!newItem.name || !newItem.color || isAnalyzingImage ? 'bg-gray-300' : 'bg-[#1A1A1A]'}`}
              >
                <Text className="text-white font-medium text-lg">
                  {bulkItems.length > 1 ? `Save & Next (${bulkItems.length - 1} left)` : 'Add to Wardrobe'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
