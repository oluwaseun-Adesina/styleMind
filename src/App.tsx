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
  X
} from 'lucide-react';
import { ClothingItem, OutfitSuggestion, ItemType, Formality } from './types';
import { getOutfitSuggestion } from './services/geminiService';

const INITIAL_WARDROBE: ClothingItem[] = [
  { id: '1', name: 'White Oxford button-down shirt', color: 'White', type: 'top', formality: 'formal' },
  { id: '2', name: 'Navy blue polo shirt', color: 'Navy', type: 'top', formality: 'smart casual' },
  { id: '3', name: 'Black graphic tee', color: 'Black', type: 'top', formality: 'casual' },
  { id: '4', name: 'Olive green linen shirt', color: 'Olive', type: 'top', formality: 'smart casual' },
  { id: '5', name: 'Dark navy slim-fit chinos', color: 'Navy', type: 'bottom', formality: 'smart casual' },
  { id: '6', name: 'Black formal trousers', color: 'Black', type: 'bottom', formality: 'formal' },
  { id: '7', name: 'Blue denim jeans', color: 'Blue', type: 'bottom', formality: 'casual' },
  { id: '8', name: 'Khaki shorts', color: 'Khaki', type: 'bottom', formality: 'casual' },
  { id: '9', name: 'Black leather Oxford shoes', color: 'Black', type: 'shoes', formality: 'formal' },
  { id: '10', name: 'White sneakers', color: 'White', type: 'shoes', formality: 'casual' },
  { id: '11', name: 'Brown loafers', color: 'Brown', type: 'shoes', formality: 'smart casual' },
  { id: '12', name: 'Black leather belt', color: 'Black', type: 'accessory', formality: 'formal' },
  { id: '13', name: 'Silver watch', color: 'Silver', type: 'accessory', formality: 'smart casual' },
  { id: '14', name: 'Sunglasses', color: 'Black', type: 'accessory', formality: 'casual' },
];

export default function App() {
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>(INITIAL_WARDROBE);
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState<OutfitSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);

  // New item form state
  const [newItem, setNewItem] = useState<Partial<ClothingItem>>({
    type: 'top',
    formality: 'casual'
  });

  const handleGetSuggestion = async () => {
    if (!prompt.trim()) return;
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

  const addItem = () => {
    if (newItem.name && newItem.color) {
      const item: ClothingItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: newItem.name,
        color: newItem.color,
        type: newItem.type as ItemType,
        formality: newItem.formality as Formality,
      };
      setWardrobe([...wardrobe, item]);
      setNewItem({ type: 'top', formality: 'casual' });
      setIsAddingItem(false);
    }
  };

  const removeItem = (id: string) => {
    setWardrobe(wardrobe.filter(i => i.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar: Wardrobe Management */}
      <aside className="w-full lg:w-96 bg-white border-r border-[#E5E5E1] p-8 overflow-y-auto max-h-screen lg:sticky lg:top-0">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl italic">StyleMind</h1>
          <button 
            onClick={() => setIsAddingItem(true)}
            className="p-2 rounded-full bg-[#1A1A1A] text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={20} />
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
              </div>
            </section>
          ))}
        </div>
      </aside>

      {/* Main Content: Stylist Interface */}
      <main className="flex-1 p-8 lg:p-16 max-w-4xl mx-auto w-full">
        <div className="mb-12">
          <h2 className="text-4xl font-light tracking-tight mb-4">What's the occasion?</h2>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. I have a job interview at a tech startup tomorrow..."
              className="w-full bg-white border border-[#E5E5E1] rounded-2xl p-6 text-lg focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/5 min-h-[120px] resize-none shadow-sm"
            />
            <button
              onClick={handleGetSuggestion}
              disabled={isLoading || !prompt.trim()}
              className="absolute bottom-4 right-4 bg-[#1A1A1A] text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Get Suggestion
            </button>
          </div>
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
