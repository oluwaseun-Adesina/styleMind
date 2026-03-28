import { useState, useEffect } from 'react';
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
  User as UserIcon
} from 'lucide-react';
import { ClothingItem, OutfitSuggestion, ItemType, Formality } from './types';
import { getOutfitSuggestion } from './services/geminiService';
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  getDocFromServer
} from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);

  // New item form state
  const [newItem, setNewItem] = useState<Partial<ClothingItem>>({
    type: 'top',
    formality: 'casual'
  });

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore listener
  useEffect(() => {
    if (!user) {
      setWardrobe([]);
      return;
    }

    const q = query(collection(db, 'wardrobes'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as ClothingItem[];
      setWardrobe(items);
    }, (error) => {
      console.error("Firestore Error: ", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Test connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSuggestion(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleGetSuggestion = async () => {
    if (!prompt.trim() || !user) return;
    setIsLoading(true);
    try {
      const res = await getOutfitSuggestion(wardrobe, prompt);
      setSuggestion(res);
    } catch (error) {
      console.error("Failed to get suggestion", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async () => {
    if (newItem.name && newItem.color && user) {
      try {
        const itemData = {
          id: Math.random().toString(36).substr(2, 9),
          name: newItem.name,
          color: newItem.color,
          type: newItem.type as ItemType,
          formality: newItem.formality as Formality,
          uid: user.uid
        };
        await addDoc(collection(db, 'wardrobes'), itemData);
        setNewItem({ type: 'top', formality: 'casual' });
        setIsAddingItem(false);
      } catch (error) {
        console.error("Failed to add item", error);
      }
    }
  };

  const removeItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'wardrobes', id));
    } catch (error) {
      console.error("Failed to remove item", error);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <Loader2 className="animate-spin text-[#1A1A1A]" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F7F4] p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <h1 className="font-serif text-6xl italic mb-6">FitPick</h1>
          <p className="text-xl text-[#8E8E8A] mb-12 leading-relaxed">
            Your personal AI stylist. Organize your wardrobe and get perfect outfit suggestions for any occasion.
          </p>
          <button 
            onClick={handleLogin}
            className="flex items-center gap-3 bg-[#1A1A1A] text-white px-8 py-4 rounded-2xl font-medium text-lg hover:opacity-90 transition-all shadow-xl"
          >
            <LogIn size={24} />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8F7F4]">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-6 bg-white border-b border-[#E5E5E1] sticky top-0 z-30">
        <h1 className="font-serif text-2xl italic">FitPick</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsWardrobeOpen(!isWardrobeOpen)}
            className="px-4 py-2 rounded-xl border border-[#E5E5E1] text-sm font-medium hover:bg-[#FBFBFA]"
          >
            {isWardrobeOpen ? 'Close Wardrobe' : 'View Wardrobe'}
          </button>
          <button 
            onClick={() => setIsAddingItem(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1A1A1A] text-white"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Sidebar: Wardrobe Management */}
      <aside className={`
        w-full lg:w-96 bg-white border-r border-[#E5E5E1] p-8 overflow-y-auto 
        ${isWardrobeOpen ? 'block' : 'hidden lg:block'}
        lg:max-h-screen lg:sticky lg:top-0 z-20
      `}>
        <div className="hidden lg:flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl italic">FitPick</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAddingItem(true)}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-[#1A1A1A] text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={20} />
            </button>
            <button 
              onClick={handleLogout}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-[#E5E5E1] text-[#8E8E8A] hover:text-red-500 transition-all"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-8 p-4 bg-[#FBFBFA] rounded-2xl border border-[#E5E5E1]">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#E5E5E1] flex items-center justify-center">
              <UserIcon size={20} className="text-[#8E8E8A]" />
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user.displayName}</p>
            <p className="text-[10px] text-[#8E8E8A] truncate">{user.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="lg:hidden ml-auto p-2 text-[#8E8E8A]"
          >
            <LogOut size={18} />
          </button>
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
                  <div key={item.id} className="group flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-[#E5E5E1] hover:bg-[#FBFBFA] transition-all">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-[10px] text-[#8E8E8A] uppercase tracking-wider">{item.color} • {item.formality}</p>
                    </div>
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-[#8E8E8A] hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {wardrobe.filter(i => i.type === type).length === 0 && (
                  <p className="text-xs text-[#8E8E8A] italic p-3 border border-dashed border-[#E5E5E1] rounded-xl text-center">
                    No {type}s added
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </aside>

      {/* Main Content: Stylist Interface */}
      <main className="flex-1 p-6 lg:p-16 max-w-4xl mx-auto w-full">
        <div className="mb-12">
          <h2 className="text-3xl lg:text-4xl font-light tracking-tight mb-4">What's the occasion?</h2>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. I have a job interview at a tech startup tomorrow..."
              className="w-full bg-white border border-[#E5E5E1] rounded-2xl p-5 lg:p-6 text-base lg:text-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 min-h-[140px] resize-none shadow-sm"
            />
            <button
              onClick={handleGetSuggestion}
              disabled={isLoading || !prompt.trim() || wardrobe.length === 0}
              className="mt-4 lg:absolute lg:bottom-4 lg:right-4 w-full lg:w-auto bg-[#1A1A1A] text-white px-8 py-4 rounded-xl flex items-center justify-center gap-2 font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Get Suggestion
            </button>
          </div>
          {wardrobe.length === 0 && (
            <p className="mt-4 text-sm text-red-500 flex items-center gap-2">
              <X size={14} /> Add items to your wardrobe first to get suggestions.
            </p>
          )}
        </div>

        <AnimatePresence mode="wait">
          {suggestion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="border-b border-[#E5E5E1] pb-8">
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#8E8E8A] font-bold">Outfit Suggestion for</span>
                <h3 className="text-3xl font-serif italic mt-2">{suggestion.occasion}</h3>
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
                    <p className="text-sm text-[#555552] leading-relaxed">{part.data.reason}</p>
                  </motion.div>
                ))}
              </div>

              <div className="bg-[#1A1A1A] text-white p-8 rounded-3xl relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-[10px] uppercase tracking-widest opacity-60 font-bold mb-4">Stylist Note</h4>
                  <p className="text-lg font-light leading-relaxed italic">"{suggestion.stylistNote}"</p>
                </div>
                <Sparkles className="absolute -bottom-4 -right-4 opacity-10" size={120} />
              </div>

              {suggestion.wardrobeGap && (
                <div className="p-6 border border-dashed border-[#E5E5E1] rounded-2xl bg-[#FBFBFA]">
                  <h4 className="text-[10px] uppercase tracking-widest text-red-500 font-bold mb-2">Wardrobe Gap</h4>
                  <p className="text-sm text-[#555552]">{suggestion.wardrobeGap}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Item Modal */}
      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-serif italic">Add New Item</h3>
                <button onClick={() => setIsAddingItem(false)} className="text-[#8E8E8A] hover:text-black">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Item Name</label>
                  <input 
                    type="text" 
                    value={newItem.name || ''}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                    placeholder="e.g. White Linen Shirt"
                    className="w-full p-3 rounded-xl border border-[#E5E5E1] focus:outline-none focus:ring-2 focus:ring-black/5"
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
                      className="w-full p-3 rounded-xl border border-[#E5E5E1] focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Type</label>
                    <select 
                      value={newItem.type}
                      onChange={e => setNewItem({...newItem, type: e.target.value as ItemType})}
                      className="w-full p-3 rounded-xl border border-[#E5E5E1] focus:outline-none focus:ring-2 focus:ring-black/5 bg-white"
                    >
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                      <option value="shoes">Shoes</option>
                      <option value="accessory">Accessory</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-[#8E8E8A] mb-1 block">Formality</label>
                  <select 
                    value={newItem.formality}
                    onChange={e => setNewItem({...newItem, formality: e.target.value as Formality})}
                    className="w-full p-3 rounded-xl border border-[#E5E5E1] focus:outline-none focus:ring-2 focus:ring-black/5 bg-white"
                  >
                    <option value="casual">Casual</option>
                    <option value="smart casual">Smart Casual</option>
                    <option value="formal">Formal</option>
                  </select>
                </div>
                <button 
                  onClick={addItem}
                  className="w-full bg-[#1A1A1A] text-white py-4 rounded-xl font-medium mt-4 hover:opacity-90 transition-opacity"
                >
                  Add to Wardrobe
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
