import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Trash2, Heart } from 'lucide-react-native';
import { API_BASE_URL, getToken, getUser } from '../firebase';
import { OutfitSuggestion } from '../types';
import { MaxContentWidth } from '@/constants/theme';

export default function LookbookScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savedOutfits, setSavedOutfits] = useState<(OutfitSuggestion & { id: string })[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const savedToken = await getToken();
      const user = await getUser();
      if (!savedToken || !user) {
        setLoading(false);
        router.replace('/');
        return;
      }
      setToken(savedToken);
      fetchLookbook(savedToken);
    };
    init();
  }, []);

  const fetchLookbook = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/saved_outfits`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSavedOutfits(data);
      }
    } catch (error) {
      console.error("Lookbook Error: ", error);
    } finally {
      setLoading(false);
    }
  };

  const removeSavedOutfit = (id: string) => {
    Alert.alert(
      "Remove Outfit",
      "Are you sure you want to remove this outfit from your lookbook?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              if (!token) return;
              const res = await fetch(`${API_BASE_URL}/api/saved_outfits/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (res.ok) {
                setSavedOutfits(savedOutfits.filter(o => o.id !== id));
              }
            } catch (error) {
              Alert.alert("Error", "Failed to remove outfit.");
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8F7F4]">
        <ActivityIndicator size="large" color="#1A1A1A" />
      </View>
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
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft color="#1A1A1A" size={24} />
          </TouchableOpacity>
          <Text className="font-serif text-xl italic">My Lookbook</Text>
          <View className="w-10" /> 
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full self-center" style={{ maxWidth: MaxContentWidth }}>
          {savedOutfits.length > 0 ? (
            savedOutfits.map((outfit) => (
              <View key={outfit.id} className="bg-white p-6 rounded-3xl border border-[#E5E5E1] mb-6 shadow-sm">
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1 mr-4">
                    <Text className="text-[10px] uppercase tracking-[0.2em] text-[#8E8E8A] font-bold">Occasion</Text>
                    <Text className="text-xl font-serif italic">{outfit.occasion}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeSavedOutfit(outfit.id)} className="p-2">
                    <Trash2 color="#8E8E8A" size={18} />
                  </TouchableOpacity>
                </View>

                <View className="space-y-4">
                  {[
                    { label: 'Top', name: outfit.top.name },
                    { label: 'Bottom', name: outfit.bottom.name },
                    { label: 'Shoes', name: outfit.shoes.name },
                    { label: 'Accessory', name: outfit.accessory.name }
                  ].map(item => (
                    <View key={item.label}>
                      <Text className="text-[9px] uppercase tracking-widest text-[#8E8E8A] font-bold mb-1">{item.label}</Text>
                      <Text className="text-base font-medium">{item.name}</Text>
                    </View>
                  ))}
                </View>

                <View className="mt-6 pt-6 border-t border-[#F8F7F4]">
                  <Text className="text-sm italic text-[#555552] leading-5">
                    "{outfit.stylistNote}"
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View className="py-20 items-center justify-center border-2 border-dashed border-[#E5E5E1] rounded-3xl bg-[#FBFBFA]">
              <Heart color="#E5E5E1" size={48} />
              <Text className="text-[#8E8E8A] text-center mt-4 px-10">
                Your lookbook is empty. Save some outfit suggestions to see them here!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
