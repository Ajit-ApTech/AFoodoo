'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { DeliveryConfig } from '../../../types';
import { MapPin, Navigation, Save, Settings2, Truck, Phone, Radius, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { buildMapsLink } from '../../../lib/geo';

const DEFAULT_CONFIG: DeliveryConfig = {
  kitchen_name: 'AFoodoo Kitchen',
  kitchen_address: '',
  kitchen_lat: 0,
  kitchen_lng: 0,
  kitchen_maps_link: '',
  max_delivery_radius_km: 25,
  rider_whatsapp: '',
  support_phone: '+91 98765 43210',
  support_email: 'support@afoodoo.com',
  support_hours: '8:00 AM - 10:00 PM Daily',
  upi_id: 'afoodoo@upi',
  merchant_name: 'AFoodoo Kitchen',
  enable_cod: true,
  updated_at: '',
};

export default function DeliverySettingsPage() {
  const [config, setConfig] = useState<DeliveryConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Load settings directly from Cloud Firestore on mount (no local storage)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'delivery_config'));
        if (snap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...(snap.data() as DeliveryConfig) });
        }
      } catch (e: any) {
        console.log('Firestore settings load error:', e.message);
        if (e.message?.includes('permission')) {
          setError('Firebase Security Rules notice: Please allow read access for /settings collection in Firebase Console.');
        }
      }
    };
    loadConfig();
  }, []);

  // Auto-update the Maps preview link whenever lat/lng changes
  useEffect(() => {
    if (config.kitchen_lat && config.kitchen_lng) {
      setConfig(prev => ({
        ...prev,
        kitchen_maps_link: buildMapsLink(prev.kitchen_lat, prev.kitchen_lng),
      }));
    }
  }, [config.kitchen_lat, config.kitchen_lng]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser geolocation is not supported. Please enter coordinates manually.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));
        setConfig(prev => ({ ...prev, kitchen_lat: lat, kitchen_lng: lng }));
        setLocating(false);
      },
      err => {
        let message = '';
        if (err.code === 1) {
          message =
            'Location permission was blocked. Please click the 🔒 lock icon in your browser address bar → Site Settings → Allow Location, then try again.';
        } else if (err.code === 2) {
          message =
            'Browser could not detect your location via Wi-Fi or network. Please enter the kitchen GPS coordinates manually below.';
        } else if (err.code === 3) {
          message =
            'Location detection timed out. Your network may be slow. Please try again or enter coordinates manually.';
        } else {
          message = `Location error: ${err.message}. Please enter coordinates manually.`;
        }
        setError(message);
        setLocating(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };

  const handleSave = async () => {
    if (!config.kitchen_name.trim()) {
      setError('Kitchen name is required.');
      return;
    }
    if (!config.kitchen_lat || !config.kitchen_lng) {
      setError('Kitchen GPS coordinates are required. Use "Detect My Location" or enter manually.');
      return;
    }
    setSaving(true);
    setError('');

    const updatedConfig: DeliveryConfig = {
      ...config,
      kitchen_maps_link: buildMapsLink(config.kitchen_lat, config.kitchen_lng),
      updated_at: new Date().toISOString(),
    };

    try {
      // 1. Write strictly to Cloud Firestore settings/delivery_config
      await setDoc(doc(db, 'settings', 'delivery_config'), updatedConfig);

      // 2. Add audit log
      try {
        await addDoc(collection(db, 'audit_logs'), {
          action_type: 'DELIVERY_SETTINGS_UPDATED',
          admin_email: 'admin@afoodoo.com',
          details: `Updated kitchen location to "${config.kitchen_name}" (${config.kitchen_lat}, ${config.kitchen_lng}). Max delivery radius: ${config.max_delivery_radius_km} km.`,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {}

      setConfig(updatedConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: any) {
      console.error('Firestore save failed:', e);
      if (e.message?.includes('permission') || e.code === 'permission-denied') {
        setError(
          'Firebase Permission Error: Cloud Firestore security rules blocked writing to /settings/delivery_config. Please update Firestore Rules in Firebase Console to allow read/write on the settings collection.'
        );
      } else {
        setError(`Save failed: ${e.message}`);
      }
    }
    setSaving(false);
  };

  const inputClass =
    'w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors';
  const labelClass = 'block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5';

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Settings2 className="h-7 w-7 text-orange-400" />
          <span>Delivery Settings</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure kitchen GPS location, delivery radius, and rider contact. Used for route optimization and order eligibility checks.
        </p>
      </div>

      {/* Success Banner */}
      {saved && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Settings saved successfully! Route optimization and delivery radius checks will now use the updated kitchen location.
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Section A: Kitchen Location */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
          <MapPin className="h-5 w-5 text-orange-400" />
          <h2 className="text-base font-extrabold text-white">Kitchen Location</h2>
        </div>

        {/* Kitchen Name */}
        <div>
          <label className={labelClass}>Kitchen Name</label>
          <input
            className={inputClass}
            placeholder="e.g. AFoodoo Central Kitchen"
            value={config.kitchen_name}
            onChange={e => setConfig(prev => ({ ...prev, kitchen_name: e.target.value }))}
          />
        </div>

        {/* Kitchen Address */}
        <div>
          <label className={labelClass}>Street Address</label>
          <input
            className={inputClass}
            placeholder="e.g. Shop 4, Building A, Sector 5, Mumbai"
            value={config.kitchen_address}
            onChange={e => setConfig(prev => ({ ...prev, kitchen_address: e.target.value }))}
          />
        </div>

        {/* GPS Detect Button */}
        <div>
          <button
            onClick={handleUseMyLocation}
            disabled={locating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all"
          >
            <Navigation className={`h-4 w-4 ${locating ? 'animate-spin' : ''}`} />
            {locating ? 'Detecting Location...' : '📍 Detect Kitchen Location (Browser GPS)'}
          </button>
          <p className="text-xs text-slate-500 mt-1.5">
            Uses Wi-Fi/network-based location — works on Mac and desktop PCs (no GPS chip needed). No API key required.
          </p>
          <p className="text-xs text-slate-600 mt-1">
            💡 <strong className="text-slate-500">Can't detect?</strong> Open{' '}
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Google Maps
            </a>
            , navigate to the kitchen location, right-click on the exact spot → <em>"What's here?"</em> — copy the coordinates shown and paste them in Latitude / Longitude below.
          </p>
        </div>

        {/* Manual Lat / Lng */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Latitude</label>
            <input
              type="number"
              step="0.000001"
              className={inputClass}
              placeholder="e.g. 19.0760"
              value={config.kitchen_lat || ''}
              onChange={e => setConfig(prev => ({ ...prev, kitchen_lat: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className={labelClass}>Longitude</label>
            <input
              type="number"
              step="0.000001"
              className={inputClass}
              placeholder="e.g. 72.8777"
              value={config.kitchen_lng || ''}
              onChange={e => setConfig(prev => ({ ...prev, kitchen_lng: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>

        {/* Maps Preview */}
        {config.kitchen_lat !== 0 && config.kitchen_lng !== 0 && (
          <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Kitchen Pin Verification</p>
              <p className="text-xs text-slate-300 mt-0.5 font-mono">
                {config.kitchen_lat}, {config.kitchen_lng}
              </p>
            </div>
            <a
              href={buildMapsLink(config.kitchen_lat, config.kitchen_lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Verify on Maps
            </a>
          </div>
        )}
      </div>

      {/* Section B: Delivery Radius */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
          <Truck className="h-5 w-5 text-orange-400" />
          <h2 className="text-base font-extrabold text-white">Delivery Zone & Radius</h2>
        </div>

        <div>
          <label className={labelClass}>
            Maximum Delivery Radius: <span className="text-orange-400">{config.max_delivery_radius_km} km</span>
          </label>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={config.max_delivery_radius_km}
            onChange={e => setConfig(prev => ({ ...prev, max_delivery_radius_km: parseInt(e.target.value) }))}
            className="w-full accent-orange-500 mt-2"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>1 km</span>
            <span>25 km (default)</span>
            <span>50 km</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Orders outside this radius will be blocked at checkout. Customer will see: <em>"We don't deliver to your location yet."</em>
          </p>
        </div>

        {/* Manual Radius Input */}
        <div>
          <label className={labelClass}>Or Enter Radius Manually (km)</label>
          <input
            type="number"
            min={1}
            max={50}
            className={inputClass}
            value={config.max_delivery_radius_km}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                max_delivery_radius_km: Math.min(50, Math.max(1, parseInt(e.target.value) || 25)),
              }))
            }
          />
        </div>
      </div>

      {/* Section C: Rider Contact */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
          <Phone className="h-5 w-5 text-orange-400" />
          <h2 className="text-base font-extrabold text-white">Rider Contact</h2>
        </div>

        <div>
          <label className={labelClass}>Rider WhatsApp Number</label>
          <input
            className={inputClass}
            placeholder="e.g. +917412589630 (with country code)"
            value={config.rider_whatsapp}
            onChange={e => setConfig(prev => ({ ...prev, rider_whatsapp: e.target.value }))}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            Used for the "Send Route to Rider via WhatsApp" button on the Live Order Queue page.
          </p>
        </div>
      </div>

      {/* Section D: Customer Support & Contact Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
          <Phone className="h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-extrabold text-white">Customer Support & Help Center Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Support Phone / WhatsApp Number</label>
            <input
              className={inputClass}
              placeholder="e.g. +91 98765 43210"
              value={config.support_phone || ''}
              onChange={e => setConfig(prev => ({ ...prev, support_phone: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelClass}>Support Email Address</label>
            <input
              className={inputClass}
              placeholder="e.g. support@afoodoo.com"
              value={config.support_email || ''}
              onChange={e => setConfig(prev => ({ ...prev, support_email: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Support Operating Hours</label>
          <input
            className={inputClass}
            placeholder="e.g. 8:00 AM - 10:00 PM Daily"
            value={config.support_hours || ''}
            onChange={e => setConfig(prev => ({ ...prev, support_hours: e.target.value }))}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            Displayed on the Mobile App Profile & Help Center screen for 1-tap customer assistance.
          </p>
        </div>
      </div>

      {/* Section E: Zero-Fee Direct UPI & Payment Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
          <Phone className="h-5 w-5 text-purple-400" />
          <h2 className="text-base font-extrabold text-white">0% Fee Direct UPI Payment Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Kitchen UPI VPA ID (Payee Address)</label>
            <input
              className={inputClass}
              placeholder="e.g. afoodoo@upi or 9876543210@paytm"
              value={config.upi_id || ''}
              onChange={e => setConfig(prev => ({ ...prev, upi_id: e.target.value }))}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Direct NPCI UPI link will open GPay / PhonePe / Paytm to send payments straight to this UPI ID with 0% gateway charges.
            </p>
          </div>

          <div>
            <label className={labelClass}>Merchant / Business Name</label>
            <input
              className={inputClass}
              placeholder="e.g. AFoodoo Kitchen"
              value={config.merchant_name || ''}
              onChange={e => setConfig(prev => ({ ...prev, merchant_name: e.target.value }))}
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enable_cod ?? true}
              onChange={e => setConfig(prev => ({ ...prev, enable_cod: e.target.checked }))}
              className="h-4 w-4 accent-orange-500 rounded"
            />
            <span className="text-xs font-bold text-slate-200">
              Enable Cash on Delivery / Pay at Store Option for Customers
            </span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-extrabold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Saving to Firestore...' : 'Save Delivery Settings'}
      </button>

      {config.updated_at && (
        <p className="text-xs text-slate-500">
          Last updated: {new Date(config.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
