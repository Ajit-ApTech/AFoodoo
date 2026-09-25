'use client';

import React, { useEffect, useState } from 'react';
import { db, storage } from '../../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MealSlot } from '../../../types';
import { Clock, Plus, Check, Power, AlertCircle, Trash2, Upload, ImageIcon, Loader2 } from 'lucide-react';

export default function MealSlotsPage() {
  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [editingSlot, setEditingSlot] = useState<MealSlot | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSlotName, setNewSlotName] = useState('');
  const [newOpenTime, setNewOpenTime] = useState('07:00 AM');
  const [newCutoffTime, setNewCutoffTime] = useState('09:30 AM');
  const [newDeliveryStart, setNewDeliveryStart] = useState('10:30 AM');
  const [newDeliveryEnd, setNewDeliveryEnd] = useState('11:30 AM');
  const [newSlotImageUrl, setNewSlotImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Upload image to Firebase Storage
  const handleUploadSlotImage = async (file: File): Promise<string> => {
    setUploadingImage(true);
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `slot_graphics/slot_${Date.now()}_${cleanName}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      setUploadingImage(false);
      return downloadUrl;
    } catch (e: any) {
      console.error('Failed to upload slot image:', e);
      setUploadingImage(false);
      alert(`Image upload error: ${e.message}`);
      throw e;
    }
  };

  // Real-Time Cloud Firestore listener for meal_slots
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'meal_slots'), snap => {
        const slotMap = new Map<string, MealSlot>();
        snap.docs.forEach(d => {
          slotMap.set(d.id, { id: d.id, ...d.data() } as MealSlot);
        });
        setSlots(Array.from(slotMap.values()));
      });
      return unsub;
    } catch (e) {
      console.log('Using default meal slot mock data');
    }
  }, []);

  const handleToggleActive = async (slotId: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, 'meal_slots', slotId), {
        active: !currentActive,
      });
    } catch (e) {
      setSlots(prev =>
        prev.map(s => (s.id === slotId ? { ...s, active: !currentActive } : s))
      );
    }
  };

  const handleDeleteSlot = async (slotId: string, slotName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the meal slot "${slotName}"?\n\nThis will remove it from both the Admin Panel and the Customer Mobile App.`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'meal_slots', slotId));
    } catch (e) {
      console.error('Failed to delete slot from Firestore:', e);
      setSlots(prev => prev.filter(s => s.id !== slotId));
    }

    if (editingSlot?.id === slotId) {
      setEditingSlot(null);
    }
  };

  const handleSaveCutoff = async () => {
    if (!editingSlot) return;
    try {
      await updateDoc(doc(db, 'meal_slots', editingSlot.id), {
        name: editingSlot.name,
        booking_open_time: editingSlot.booking_open_time,
        booking_cutoff_time: editingSlot.booking_cutoff_time,
        delivery_start_time: editingSlot.delivery_start_time,
        delivery_end_time: editingSlot.delivery_end_time,
        image_url: editingSlot.image_url || '',
      });
    } catch (e) {
      setSlots(prev =>
        prev.map(s => (s.id === editingSlot.id ? editingSlot : s))
      );
    }
    setEditingSlot(null);
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotName) return;

    const newSlot: Omit<MealSlot, 'id'> = {
      name: newSlotName,
      booking_open_time: newOpenTime,
      booking_cutoff_time: newCutoffTime,
      delivery_start_time: newDeliveryStart,
      delivery_end_time: newDeliveryEnd,
      active: true,
      image_url: newSlotImageUrl.trim() || '',
    };

    try {
      await addDoc(collection(db, 'meal_slots'), newSlot);
      // onSnapshot automatically updates slots with the new document
    } catch (e) {
      console.error('Failed to add slot to Firestore:', e);
      setSlots(prev => {
        const slotMap = new Map<string, MealSlot>();
        prev.forEach(s => slotMap.set(s.id, s));
        const fallbackId = `slot_${Date.now()}`;
        slotMap.set(fallbackId, { id: fallbackId, ...newSlot });
        return Array.from(slotMap.values());
      });
    }

    setShowAddModal(false);
    setNewSlotName('');
    setNewSlotImageUrl('');
  };

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Clock className="h-7 w-7 text-orange-400" />
            <span>Meal Slot & Cutoff Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Changing cutoff times here instantly updates the countdown timer shown in the mobile customer app.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-orange-600/20 transition-all flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Custom Meal Slot</span>
        </button>
      </div>

      {/* Info Callout */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400">
        <AlertCircle className="h-5 w-5 text-orange-400 shrink-0" />
        <span>
          <strong>Real-Time Sync Notice:</strong> Customer mobile app subscribes to Cloud Firestore <code className="text-orange-400 bg-slate-950 px-1.5 py-0.5 rounded">meal_slots</code> collection. Any cutoff modification reflects in customer UI within 1–2 seconds.
        </span>
      </div>

      {/* Meal Slots List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {slots.map(slot => (
          <div
            key={slot.id}
            className={`bg-slate-900 border rounded-2xl p-6 transition-all shadow-xl ${
              slot.active ? 'border-slate-800' : 'border-rose-900/40 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{slot.name}</span>
                  {slot.active ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                      Active
                    </span>
                  ) : (
                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                      Disabled
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Slot ID: {slot.id}</p>
              </div>

              <button
                onClick={() => handleToggleActive(slot.id, slot.active)}
                className={`p-2.5 rounded-xl border transition-all ${
                  slot.active
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                }`}
                title="Toggle Slot Active State"
              >
                <Power className="h-4 w-4" />
              </button>
            </div>

            {/* Slot Banner Graphic Preview */}
            <div className="flex items-center gap-3 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 mb-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/60 flex-shrink-0 flex items-center justify-center">
                {slot.image_url ? (
                  <img src={slot.image_url} alt={slot.name} className="w-full h-full object-cover" />
                ) : (
                  <img src="/assets/hero_biryani_bowl.jpg" alt="Default Biryani" className="w-full h-full object-cover opacity-80" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  {slot.image_url ? 'Custom Slot Graphic' : 'Default Biryani Bowl'}
                </span>
                <span className="text-[10px] text-slate-500 truncate block">
                  {slot.image_url || 'Active fallback shown on customer mobile card'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 font-medium">Booking Window Opens:</span>
                <span className="font-bold text-slate-200">{slot.booking_open_time}</span>
              </div>

              <div className="flex items-center justify-between bg-orange-950/30 p-3 rounded-xl border border-orange-500/20">
                <span className="text-orange-400 font-bold">Booking Cutoff Time:</span>
                <span className="font-black text-orange-400 text-sm">
                  {slot.booking_cutoff_time}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 font-medium">Delivery Window:</span>
                <span className="font-bold text-emerald-400">
                  {slot.delivery_start_time} – {slot.delivery_end_time}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => handleDeleteSlot(slot.id, slot.name)}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5"
                title="Permanently delete this meal slot"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Slot</span>
              </button>

              <button
                onClick={() => setEditingSlot(slot)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-2 rounded-lg border border-slate-700 transition-all"
              >
                Edit Cutoff & Graphic ✏️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Slot Modal */}
      {editingSlot ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              Edit Slot: {editingSlot.name}
            </h3>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Slot Name
                </label>
                <input
                  type="text"
                  value={editingSlot.name}
                  onChange={e =>
                    setEditingSlot({ ...editingSlot, name: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-bold"
                />
              </div>

              {/* Slot Graphic Photo Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Slot Food Graphic (Shown on Mobile Card)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 flex items-center justify-center">
                    {editingSlot.image_url ? (
                      <img src={editingSlot.image_url} alt="Slot Graphic" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/40 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                      {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      <span>{uploadingImage ? 'Uploading Image...' : 'Upload Image Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await handleUploadSlotImage(file);
                            setEditingSlot({ ...editingSlot, image_url: url });
                          } catch (err) {}
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      placeholder="Or paste direct image URL"
                      value={editingSlot.image_url || ''}
                      onChange={e => setEditingSlot({ ...editingSlot, image_url: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Booking Open Time
                  </label>
                  <input
                    type="text"
                    value={editingSlot.booking_open_time}
                    onChange={e =>
                      setEditingSlot({ ...editingSlot, booking_open_time: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Booking Cutoff Time
                  </label>
                  <input
                    type="text"
                    value={editingSlot.booking_cutoff_time}
                    onChange={e =>
                      setEditingSlot({ ...editingSlot, booking_cutoff_time: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-bold text-orange-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Delivery Start Time
                  </label>
                  <input
                    type="text"
                    value={editingSlot.delivery_start_time}
                    onChange={e =>
                      setEditingSlot({ ...editingSlot, delivery_start_time: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Delivery End Time
                  </label>
                  <input
                    type="text"
                    value={editingSlot.delivery_end_time}
                    onChange={e =>
                      setEditingSlot({ ...editingSlot, delivery_end_time: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleDeleteSlot(editingSlot.id, editingSlot.name)}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Slot</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCutoff}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>Save & Push to App</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add Custom Slot Modal */}
      {showAddModal ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddSlot}
            className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-white">Add New Custom Meal Slot</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Slot Name (e.g., Breakfast Tiffin)
              </label>
              <input
                type="text"
                required
                value={newSlotName}
                onChange={e => setNewSlotName(e.target.value)}
                placeholder="Breakfast Tiffin Special"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100"
              />
            </div>

            {/* Custom Slot Graphic */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Slot Food Graphic Image
              </label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 flex items-center justify-center">
                  {newSlotImageUrl ? (
                    <img src={newSlotImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="inline-flex items-center gap-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/40 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                    {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span>{uploadingImage ? 'Uploading Image...' : 'Upload Slot Graphic'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await handleUploadSlotImage(file);
                          setNewSlotImageUrl(url);
                        } catch (err) {}
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="Or paste direct image URL"
                    value={newSlotImageUrl}
                    onChange={e => setNewSlotImageUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Open Time</label>
                <input
                  type="text"
                  value={newOpenTime}
                  onChange={e => setNewOpenTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Cutoff Time</label>
                <input
                  type="text"
                  value={newCutoffTime}
                  onChange={e => setNewCutoffTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-orange-400 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Delivery Start</label>
                <input
                  type="text"
                  value={newDeliveryStart}
                  onChange={e => setNewDeliveryStart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Delivery End</label>
                <input
                  type="text"
                  value={newDeliveryEnd}
                  onChange={e => setNewDeliveryEnd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg"
              >
                Create Slot
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
