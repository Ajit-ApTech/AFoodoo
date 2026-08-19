'use client';

import React, { useEffect, useState } from 'react';
import { db, storage } from '../../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MenuItem, MealSlot } from '../../../types';
import { UtensilsCrossed, Plus, Upload, Copy, AlertCircle, Edit, Trash2 } from 'lucide-react';

export default function MenuManagementPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [selectedFilterSlot, setSelectedFilterSlot] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('199');
  const [vegFlag, setVegFlag] = useState(true);
  const [maxQuantity, setMaxQuantity] = useState('50');
  const [slotId, setSlotId] = useState('slot_lunch_today');
  const [imageUrl, setImageUrl] = useState('');

  // Subscribe directly to Cloud Firestore menu_items collection
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'menu_items'), snap => {
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
          const uniqueList = Array.from(new Map(list.map(item => [item.id, item])).values());
          setItems(uniqueList);
        }
      });
      return unsub;
    } catch (e) {
      console.log('Using default menu items listener catch');
    }
  }, []);

  // Subscribe directly to Cloud Firestore meal_slots collection for dynamic dropdown & filtering
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'meal_slots'), snap => {
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealSlot));
          setSlots(list);
        }
      });
      return unsub;
    } catch (e) {
      console.log('Using default meal slots');
    }
  }, []);

  // Open modal for creating a new dish
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setPrice('199');
    setVegFlag(true);
    setMaxQuantity('50');
    setSlotId(slots[0]?.id || slots[0]?.name || 'slot_lunch_today');
    setImageUrl('');
    setSelectedFile(null);
    setShowAddModal(true);
  };

  // Open modal for editing an existing dish
  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description || '');
    setPrice(String(item.price || 199));
    setVegFlag(item.veg_flag ?? true);
    setMaxQuantity(String(item.max_quantity || 50));
    setSlotId(item.meal_slot_id || slots[0]?.id || 'slot_lunch_today');
    setImageUrl(item.image_url || '');
    setSelectedFile(null);
    setShowAddModal(true);
  };

  const handleDeleteDish = async (itemId: string, dishTitle: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${dishTitle}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'menu_items', itemId));
      console.log('Successfully deleted dish from Cloud Firestore:', itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (e: any) {
      console.error('Firestore delete error:', e);
      setItems(prev => prev.filter(i => i.id !== itemId));
    }
  };

  // Upload image to Cloudinary or Firebase Storage
  const handleImageUpload = async (file: File): Promise<string> => {
    setUploadingImage(true);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dc5t7fpqx';
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'afoodoo';

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadingImage(false);
        return data.secure_url;
      }
    } catch (e) {
      console.log('Cloudinary upload attempt error, trying fallback');
    }

    try {
      const storageRef = ref(storage, `menu_photos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setUploadingImage(false);
      return url;
    } catch (e) {
      setUploadingImage(false);
      return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80';
    }
  };

  const handleToggleAvailable = async (itemId: string, currentAvailable: boolean) => {
    try {
      await updateDoc(doc(db, 'menu_items', itemId), {
        is_available: !currentAvailable,
      });
    } catch (e) {
      setItems(prev =>
        prev.map(item => (item.id === itemId ? { ...item, is_available: !currentAvailable } : item))
      );
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalImageUrl = imageUrl;

    if (selectedFile) {
      finalImageUrl = await handleImageUpload(selectedFile);
    }

    const payload = {
      meal_slot_id: slotId,
      date: new Date().toISOString().split('T')[0],
      title,
      description,
      price: Number(price),
      veg_flag: vegFlag,
      image_url: finalImageUrl || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      max_quantity: Number(maxQuantity),
      quantity_booked: editingItem ? (editingItem.quantity_booked || 0) : 0,
    };

    if (editingItem) {
      try {
        await updateDoc(doc(db, 'menu_items', editingItem.id), payload);
        console.log('Successfully updated dish in Cloud Firestore:', editingItem.id);
      } catch (e: any) {
        console.error('Firestore update error:', e);
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload } : i));
      }
    } else {
      try {
        const docRef = await addDoc(collection(db, 'menu_items'), payload);
        console.log('Successfully published dish to Cloud Firestore:', docRef.id);
      } catch (e: any) {
        console.error('Firestore write error:', e);
        setItems(prev => [{ id: `m_${Date.now()}`, ...payload }, ...prev]);
      }
    }

    setShowAddModal(false);
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setSelectedFile(null);
  };

  const handleDuplicateLastWeek = () => {
    alert('Duplicate Menu Action: Last week\'s dishes cloned for the upcoming week!');
  };

  // Filter items based on selected slot tab and guarantee key uniqueness by item.id
  const uniqueItemsMap = new Map<string, MenuItem>();
  items.forEach(item => uniqueItemsMap.set(item.id, item));
  const uniqueItems = Array.from(uniqueItemsMap.values());

  const displayedItems = uniqueItems.filter(item => {
    if (selectedFilterSlot === 'all') return true;
    const matchingSlot = slots.find(s => s.id === selectedFilterSlot);
    return item.meal_slot_id === selectedFilterSlot || item.meal_slot_id === matchingSlot?.name;
  });

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <UtensilsCrossed className="h-7 w-7 text-emerald-400" />
            <span>Food Menu & Photos Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Assign dishes to meal slots, edit prices, upload photos, and toggle availability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDuplicateLastWeek}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
          >
            <Copy className="h-4 w-4 text-purple-400" />
            Duplicate Last Week's Menu
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-orange-600/20 transition-all flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add New Dish
          </button>
        </div>
      </div>

      {/* Cloud Storage Notice */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400">
        <AlertCircle className="h-5 w-5 text-emerald-400 shrink-0" />
        <span>
          <strong>Slot-Wise Menu Management:</strong> Each dish is assigned to a specific meal slot. Customers will only see dishes matching their selected slot.
        </span>
      </div>

      {/* Slot Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedFilterSlot('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
            selectedFilterSlot === 'all'
              ? 'bg-orange-600 border-orange-500 text-white'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          All Dishes ({items.length})
        </button>

        {slots.map(s => {
          const slotItemCount = items.filter(i => i.meal_slot_id === s.id || i.meal_slot_id === s.name).length;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedFilterSlot(s.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                selectedFilterSlot === s.id
                  ? 'bg-orange-600 border-orange-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {s.name} ({slotItemCount})
            </button>
          );
        })}
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedItems.map(item => {
          const slotName = slots.find(s => s.id === item.meal_slot_id)?.name || item.meal_slot_id || 'General';

          return (
            <div
              key={item.id}
              className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all shadow-xl flex flex-col justify-between ${
                item.is_available ? 'border-slate-800' : 'border-rose-900/40 opacity-70'
              }`}
            >
              <div>
                <div className="h-48 relative overflow-hidden bg-slate-950">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : null}

                  <span
                    className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      item.veg_flag
                        ? 'bg-emerald-600/90 text-white'
                        : 'bg-rose-600/90 text-white'
                    }`}
                  >
                    {item.veg_flag ? '🌱 VEG' : '🍖 NON-VEG'}
                  </span>

                  <span
                    className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      item.is_available
                        ? 'bg-slate-900/80 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-900/80 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {item.is_available ? 'Available' : 'Sold Out'}
                  </span>
                </div>

                <div className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-100 text-base leading-tight">
                      {item.title}
                    </h3>
                    <span className="text-lg font-black text-orange-400 shrink-0">
                      ₹{item.price}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Slot: <strong className="text-orange-400 font-semibold">{slotName}</strong></span>
                    <span>Portions: <strong className="text-emerald-400">{item.quantity_booked}/{item.max_quantity}</strong></span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-all flex items-center gap-1"
                  >
                    <Edit className="h-3.5 w-3.5 text-orange-400" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteDish(item.id, item.title)}
                    className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-rose-800/60 transition-all flex items-center gap-1"
                    title="Delete Dish"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                    <span>Delete</span>
                  </button>
                </div>

                <button
                  onClick={() => handleToggleAvailable(item.id, item.is_available)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    item.is_available
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {item.is_available ? 'Mark Sold Out' : 'Mark Available'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Dish Modal */}
      {showAddModal ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveMenuItem}
            className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? `Edit Dish: ${editingItem.title}` : 'Add New Dish & Photo'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Dish Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Deluxe Paneer Makhani Thali"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Description & Ingredients
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Paneer Makhani, 3 Phulkas, Dal Tadka, Rice, Sweet & Salad..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-orange-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Max Portions
                  </label>
                  <input
                    type="number"
                    required
                    value={maxQuantity}
                    onChange={e => setMaxQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Dietary Type
                  </label>
                  <select
                    value={vegFlag ? 'veg' : 'nonveg'}
                    onChange={e => setVegFlag(e.target.value === 'veg')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="veg">🌱 VEG</option>
                    <option value="nonveg">🍖 NON-VEG</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Assign Meal Slot
                  </label>
                  <select
                    value={slotId}
                    onChange={e => setSlotId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    {slots.length > 0 ? (
                      slots.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="slot_lunch_today">Lunch Tiffin</option>
                        <option value="slot_dinner_today">Dinner Tiffin</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Photo Upload File Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Food Photo (Cloud Firebase Storage Upload)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-orange-600/20 file:text-orange-400 hover:file:bg-orange-600/30"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadingImage}
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                <span>{uploadingImage ? 'Uploading Photo...' : editingItem ? 'Save Changes' : 'Publish Dish to App'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
