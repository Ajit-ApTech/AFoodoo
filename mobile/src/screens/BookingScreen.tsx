import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/appStore';
import { placeOrder } from '../api/orders';
import { submitPaymentRequest } from '../api/payments';
import { getNextOrderCode } from '../api/orderCode';
import { useTheme } from '../theme/ThemeContext';
import { haversineDistance, buildMapsLink } from '../utils/geo';
import { UpiPaymentModal } from '../components/UpiPaymentModal';
import { getCachedPushToken } from '../services/notificationService';
import dayjs from 'dayjs';

export default function BookingScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();

  // App store
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const activeSlot = useAppStore(state => state.activeSlot);
  const deductWalletBalance = useAppStore(state => state.deductWalletBalance);
  const cart = useAppStore(state => state.cart);
  const addToCart = useAppStore(state => state.addToCart);
  const removeFromCart = useAppStore(state => state.removeFromCart);
  const updateCartQuantity = useAppStore(state => state.updateCartQuantity);
  const clearCart = useAppStore(state => state.clearCart);

  // If a single item was passed via navigation and not yet in cart, add it
  const routeItem = route?.params?.item;
  useEffect(() => {
    if (routeItem && cart.length === 0) {
      addToCart(routeItem, activeSlot);
    }
  }, [routeItem]);

  // Delivery form state — pre-filled from user's last saved address
  const savedAddr = user?.addresses && user.addresses.length > 0 ? user.addresses[0] : null;
  const [receiverName, setReceiverName] = useState(savedAddr?.receiver_name || user?.name || 'Ajit p');
  const [receiverPhone, setReceiverPhone] = useState(savedAddr?.receiver_phone || user?.phone || '+917491009852');
  const [addressLine1, setAddressLine1] = useState(savedAddr?.line1 || 'M8W2+7RW, North Chotanagpur Division, Potanga');
  const [landmark, setLandmark] = useState(savedAddr?.landmark || 'Near birsa workshop');
  const [city, setCity] = useState(savedAddr?.city || 'Potanga');
  const [pincode, setPincode] = useState(savedAddr?.zip || '825311');
  const [detectedLat, setDetectedLat] = useState<number | null>(savedAddr?.latitude ?? null);
  const [detectedLng, setDetectedLng] = useState<number | null>(savedAddr?.longitude ?? null);
  const [locating, setLocating] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Kitchen location & delivery radius (synced from Cloud Firestore settings/delivery_config)
  const [kitchenLat, setKitchenLat] = useState<number | null>(null);
  const [kitchenLng, setKitchenLng] = useState<number | null>(null);
  const [maxDeliveryRadiusKm, setMaxDeliveryRadiusKm] = useState<number>(25);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [verifyingCoupon, setVerifyingCoupon] = useState(false);

  // Payment settings state
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'wallet' | 'cod'>('wallet');
  const [upiId, setUpiId] = useState('afoodoo@upi');
  const [merchantName, setMerchantName] = useState('AFoodoo Kitchen');
  const [customQrUrl, setCustomQrUrl] = useState('');
  const [enableCod, setEnableCod] = useState(true);

  // Live admin-controlled fees & dynamic distance pricing
  const [deliveryFee, setDeliveryFee] = useState<number>(30);
  const [deliveryFeeType, setDeliveryFeeType] = useState<'fixed' | 'distance'>('distance');
  const [baseDeliveryFee, setBaseDeliveryFee] = useState<number>(20);
  const [baseDeliveryDistanceKm, setBaseDeliveryDistanceKm] = useState<number>(3);
  const [perKmFee, setPerKmFee] = useState<number>(5);
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState<number>(0);
  const [platformFee, setPlatformFee] = useState<number>(10);

  const [submitting, setSubmitting] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [pendingUpiPayload, setPendingUpiPayload] = useState<any>(null);

  // Read live UPI ID, Payment & Admin Fee settings from Cloud Firestore settings/delivery_config
  useEffect(() => {
    try {
      const { doc, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(doc(firestore, 'settings', 'delivery_config'), (snap: any) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.upi_id) setUpiId(d.upi_id);
          if (d.merchant_name) setMerchantName(d.merchant_name);
          if (d.upi_qr_image_url) setCustomQrUrl(d.upi_qr_image_url);
          if (d.enable_cod != null) setEnableCod(d.enable_cod);
          if (d.delivery_fee != null) setDeliveryFee(Number(d.delivery_fee));
          if (d.delivery_fee_type) setDeliveryFeeType(d.delivery_fee_type);
          if (d.base_delivery_fee != null) setBaseDeliveryFee(Number(d.base_delivery_fee));
          if (d.base_delivery_distance_km != null) setBaseDeliveryDistanceKm(Number(d.base_delivery_distance_km));
          if (d.per_km_fee != null) setPerKmFee(Number(d.per_km_fee));
          if (d.free_delivery_above != null) setFreeDeliveryAbove(Number(d.free_delivery_above));
          if (d.platform_fee != null) setPlatformFee(Number(d.platform_fee));
          if (d.kitchen_lat != null) setKitchenLat(Number(d.kitchen_lat));
          if (d.kitchen_lng != null) setKitchenLng(Number(d.kitchen_lng));
          if (d.max_delivery_radius_km != null) setMaxDeliveryRadiusKm(Number(d.max_delivery_radius_km));
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  // Helper to geocode address if manual coordinates are missing
  const resolveAddressCoordinates = async (
    targetLine?: string,
    targetCity?: string,
    targetZip?: string
  ): Promise<{ lat: number; lng: number } | null> => {
    if (detectedLat != null && detectedLng != null) {
      return { lat: detectedLat, lng: detectedLng };
    }
    const lineToUse = targetLine !== undefined ? targetLine : addressLine1;
    const cityToUse = targetCity !== undefined ? targetCity : city;
    const zipToUse = targetZip !== undefined ? targetZip : pincode;
    const query = [lineToUse, cityToUse, zipToUse].filter(Boolean).join(', ');
    if (!query.trim()) return null;

    try {
      const Location = require('expo-location');
      const results = await Location.geocodeAsync(query);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setDetectedLat(latitude);
        setDetectedLng(longitude);
        return { lat: latitude, lng: longitude };
      }
    } catch (e) {
      console.log('Notice resolving address coordinates:', e);
    }
    return null;
  };

  // Real-time calculation of distance from AFoodoo Kitchen
  useEffect(() => {
    let isCancelled = false;
    const calculateDistance = async () => {
      if (!kitchenLat || !kitchenLng || (kitchenLat === 0 && kitchenLng === 0)) {
        setDeliveryDistanceKm(null);
        return;
      }

      if (detectedLat != null && detectedLng != null) {
        const dist = haversineDistance(kitchenLat, kitchenLng, detectedLat, detectedLng);
        if (!isCancelled) setDeliveryDistanceKm(Math.round(dist * 10) / 10);
        return;
      }

      // If user is not currently actively editing fields, try to geocode in background
      if (!isEditingAddress && addressLine1.trim()) {
        try {
          setIsResolvingLocation(true);
          const Location = require('expo-location');
          const query = [addressLine1, city, pincode].filter(Boolean).join(', ');
          const results = await Location.geocodeAsync(query);
          if (!isCancelled && results && results.length > 0) {
            const { latitude, longitude } = results[0];
            setDetectedLat(latitude);
            setDetectedLng(longitude);
            const dist = haversineDistance(kitchenLat, kitchenLng, latitude, longitude);
            setDeliveryDistanceKm(Math.round(dist * 10) / 10);
          }
        } catch (_) {
        } finally {
          if (!isCancelled) setIsResolvingLocation(false);
        }
      }
    };

    calculateDistance();
    return () => {
      isCancelled = true;
    };
  }, [kitchenLat, kitchenLng, detectedLat, detectedLng, addressLine1, city, pincode, isEditingAddress]);

  // Reset coordinates if user manually changes address fields
  const handleAddressLineChange = (val: string) => {
    setAddressLine1(val);
    setDetectedLat(null);
    setDetectedLng(null);
    setDeliveryDistanceKm(null);
  };

  const handleCityChange = (val: string) => {
    setCity(val);
    setDetectedLat(null);
    setDetectedLng(null);
    setDeliveryDistanceKm(null);
  };

  const handlePincodeChange = (val: string) => {
    setPincode(val);
    setDetectedLat(null);
    setDetectedLng(null);
    setDeliveryDistanceKm(null);
  };

  // Items in checkout: either cart items or route item fallback
  const checkoutItems =
    cart.length > 0
      ? cart
      : routeItem
      ? [
          {
            id: routeItem.id,
            title: routeItem.title,
            price: routeItem.price,
            quantity: 1,
            image_url: routeItem.image_url,
            delivery_window: '1:00 PM – 2:00 PM',
          },
        ]
      : [];

  const subtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Dynamic delivery fee calculation (Distance-Based vs Fixed Rate)
  let calculatedDeliveryFee = deliveryFee;
  if (deliveryFeeType === 'distance') {
    if (deliveryDistanceKm != null && deliveryDistanceKm > 0) {
      const extraKm = Math.max(0, deliveryDistanceKm - baseDeliveryDistanceKm);
      calculatedDeliveryFee = Math.round(baseDeliveryFee + extraKm * perKmFee);
    } else {
      calculatedDeliveryFee = baseDeliveryFee;
    }
  }
  // Free delivery threshold check
  if (freeDeliveryAbove > 0 && subtotal >= freeDeliveryAbove) {
    calculatedDeliveryFee = 0;
  }

  const finalDeliveryFee = subtotal > 0 ? calculatedDeliveryFee : 0;
  const finalPlatformFee = subtotal > 0 ? platformFee : 0;
  const totalAmount = Math.max(0, subtotal + finalDeliveryFee + finalPlatformFee - couponDiscount);

  const walletBalance = user?.wallet_balance ?? 10204;
  const isWalletSufficient = walletBalance >= totalAmount;

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponMsg('Please enter a coupon code.');
      return;
    }
    setVerifyingCoupon(true);
    setCouponMsg('');

    try {
      const { collection, query, where, getDocs } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const q = query(collection(firestore, 'coupons'), where('code', '==', code));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const couponDoc = snap.docs[0].data();
        if (couponDoc.is_active === false) {
          setCouponMsg('This coupon is currently inactive.');
          setCouponDiscount(0);
          setCouponApplied(false);
          setAppliedCouponCode('');
          setVerifyingCoupon(false);
          return;
        }

        if (couponDoc.min_order_amount && subtotal < Number(couponDoc.min_order_amount)) {
          setCouponMsg(`Min order of ₹${couponDoc.min_order_amount} required for this coupon.`);
          setCouponDiscount(0);
          setCouponApplied(false);
          setAppliedCouponCode('');
          setVerifyingCoupon(false);
          return;
        }

        let discount = 0;
        if (couponDoc.discount_type === 'percentage') {
          const pct = Number(couponDoc.discount_value) || 0;
          const rawDiscount = Math.floor(subtotal * (pct / 100));
          discount = couponDoc.max_discount ? Math.min(rawDiscount, Number(couponDoc.max_discount)) : rawDiscount;
        } else if (couponDoc.discount_type === 'flat') {
          discount = Math.min(subtotal, Number(couponDoc.discount_value) || 0);
        } else if (couponDoc.discount_type === 'free_delivery') {
          discount = finalDeliveryFee;
        }

        setCouponDiscount(discount);
        setCouponApplied(true);
        setAppliedCouponCode(code);
        setCouponMsg(`✓ Coupon ${code} applied! Saved ₹${discount}`);
      } else {
        // Fallback for default promotional codes
        if (code === 'AFOODOO50' || code === 'FIRST50') {
          const discount = Math.min(50, Math.floor(subtotal * 0.5));
          setCouponDiscount(discount);
          setCouponApplied(true);
          setAppliedCouponCode(code);
          setCouponMsg(`✓ Coupon ${code} applied! Saved ₹${discount}`);
        } else if (code === 'FREE' || code === 'FREEDEL') {
          setCouponDiscount(finalDeliveryFee);
          setCouponApplied(true);
          setAppliedCouponCode(code);
          setCouponMsg(`✓ Free Delivery applied! Saved ₹${finalDeliveryFee}`);
        } else if (code === 'FLAT30') {
          const discount = Math.min(subtotal, 30);
          setCouponDiscount(discount);
          setCouponApplied(true);
          setAppliedCouponCode(code);
          setCouponMsg(`✓ Coupon FLAT30 applied! Saved ₹${discount}`);
        } else {
          setCouponMsg('Invalid coupon code.');
          setCouponDiscount(0);
          setCouponApplied(false);
          setAppliedCouponCode('');
        }
      }
    } catch (e) {
      if (code === 'AFOODOO50' || code === 'FIRST50') {
        const discount = Math.min(50, Math.floor(subtotal * 0.5));
        setCouponDiscount(discount);
        setCouponApplied(true);
        setAppliedCouponCode(code);
        setCouponMsg(`✓ Coupon ${code} applied! Saved ₹${discount}`);
      } else if (code === 'FREE' || code === 'FREEDEL') {
        setCouponDiscount(finalDeliveryFee);
        setCouponApplied(true);
        setAppliedCouponCode(code);
        setCouponMsg(`✓ Free Delivery applied! Saved ₹${finalDeliveryFee}`);
      } else {
        setCouponMsg('Could not verify coupon.');
      }
    } finally {
      setVerifyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponDiscount(0);
    setCouponApplied(false);
    setAppliedCouponCode('');
    setCouponMsg('');
  };

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Denied',
          'Please allow location access in Settings to auto-fill your delivery address.'
        );
        setLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setDetectedLat(lat);
      setDetectedLng(lng);

      if (kitchenLat && kitchenLng && (kitchenLat !== 0 || kitchenLng !== 0)) {
        const dist = haversineDistance(kitchenLat, kitchenLng, lat, lng);
        const roundedDist = Math.round(dist * 10) / 10;
        setDeliveryDistanceKm(roundedDist);
        if (roundedDist > maxDeliveryRadiusKm) {
          Alert.alert(
            'Outside Delivery Zone ⚠️',
            `Your detected location is ${roundedDist} km away from AFoodoo Kitchen. Our maximum delivery radius is ${maxDeliveryRadiusKm} km.`
          );
        }
      }

      const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo) {
        const parts = [geo.name, geo.street, geo.district || geo.subregion].filter(Boolean);
        if (parts.length > 0) setAddressLine1(parts.join(', '));
        if (geo.city) setCity(geo.city);
        if (geo.postalCode) setPincode(geo.postalCode);
      }
    } catch (e: any) {
      Alert.alert('GPS Notice', 'Could not fetch current coordinates. Please enter manually.');
    } finally {
      setLocating(false);
    }
  };

  const parseTimeToDayjs = (timeVal: any): dayjs.Dayjs | null => {
    if (!timeVal) return null;
    if (timeVal instanceof Date) return dayjs(timeVal);
    if (timeVal?.toDate) return dayjs(timeVal.toDate());
    if (typeof timeVal === 'string') {
      const match = timeVal.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return dayjs().set('hour', hours).set('minute', minutes).set('second', 0);
      }
      const parsed = dayjs(timeVal);
      if (parsed.isValid()) return parsed;
    }
    return null;
  };

  const handleConfirmUpiPayment = async (utrNumber?: string) => {
    if (!pendingUpiPayload) return;
    setSubmitting(true);
    try {
      const orderCode = await getNextOrderCode();
      const menuTitle =
        checkoutItems.length > 1
          ? checkoutItems.map(i => `${i.title} (${i.quantity})`).join(', ')
          : checkoutItems[0]?.title || 'Tiffin Meal';
      const menuItemId = checkoutItems[0]?.id || 'item_default';
      const deliveryWindow = checkoutItems[0]?.delivery_window || '01:00 PM – 02:30 PM';

      const result = await submitPaymentRequest({
        type: 'order',
        userId: pendingUpiPayload.userId,
        userName: pendingUpiPayload.receiverName,
        userPhone: pendingUpiPayload.receiverPhone,
        amount: totalAmount,
        utrNumber: utrNumber || undefined,
        orderPayload: {
          order_code: orderCode,
          items: checkoutItems,
          menu_item_id: menuItemId,
          menu_title: menuTitle,
          delivery_window: deliveryWindow,
          subtotal,
          delivery_fee: finalDeliveryFee,
          platform_fee: finalPlatformFee,
          total_amount: totalAmount,
          meal_slot_id: pendingUpiPayload.slotId,
          slot_name: activeSlot?.name || 'Lunch Special',
          delivery_address: pendingUpiPayload.deliveryAddress,
          delivery_lat: pendingUpiPayload.deliveryLat ?? null,
          delivery_lng: pendingUpiPayload.deliveryLng ?? null,
          delivery_distance_km: pendingUpiPayload.deliveryDistanceKm ?? null,
          maps_link: pendingUpiPayload.mapsLink ?? null,
          receiver_name: pendingUpiPayload.receiverName,
          receiver_phone: pendingUpiPayload.receiverPhone,
          instructions: '',
          coupon_code: appliedCouponCode || null,
          discount: couponDiscount,
        },
      });

      clearCart();
      setShowUpiModal(false);
      setSubmitting(false);
      Alert.alert(
        'Payment Request Submitted ⏳',
        `Your order payment verification request for ₹${totalAmount} has been sent.\n\nOnce admin verifies the payment, your order will be confirmed!`,
        [
          {
            text: 'Track Order',
            onPress: () => navigation.navigate('OrderTracking', { orderId: result.payment_request_id }),
          },
          {
            text: 'OK',
            onPress: () => navigation.navigate('Home'),
          },
        ]
      );
    } catch (err: any) {
      setSubmitting(false);
      Alert.alert('Payment Error', err.message || 'Could not submit payment request.');
    }
  };

  const handleProceedToPayment = async () => {
    if (checkoutItems.length === 0) {
      Alert.alert('Cart is Empty', 'Please add items to your cart before proceeding.');
      return;
    }

    // Check slot booking window timing
    if (activeSlot?.booking_open_time || activeSlot?.booking_cutoff_time) {
      const openStr = activeSlot.booking_open_time || '05:00 AM';
      const cutoffStr = activeSlot.booking_cutoff_time || '11:59 AM';
      let openDayjs = parseTimeToDayjs(openStr);
      let cutoffDayjs = parseTimeToDayjs(cutoffStr);
      const now = dayjs();

      if (openDayjs && cutoffDayjs && cutoffDayjs.isBefore(openDayjs)) {
        if (now.isBefore(cutoffDayjs)) {
          openDayjs = openDayjs.subtract(1, 'day');
        } else {
          cutoffDayjs = cutoffDayjs.add(1, 'day');
        }
      }

      const isBeforeOpen = openDayjs ? now.isBefore(openDayjs) : false;
      const isAfterCutoff = cutoffDayjs ? now.isAfter(cutoffDayjs) : false;
      const isWindowOpen = !isBeforeOpen && !isAfterCutoff;

      if (!isWindowOpen) {
        if (isBeforeOpen) {
          Alert.alert(
            'Booking Not Open Yet ⏳',
            `Bookings for ${activeSlot.name || 'this slot'} open at ${openStr}. Orders can only be placed between ${openStr} and ${cutoffStr}.`
          );
        } else {
          Alert.alert(
            'Booking Window Closed 🔒',
            `The booking cutoff time (${cutoffStr}) has passed for ${activeSlot.name || 'this slot'}. Orders cannot be placed outside this window.`
          );
        }
        return;
      }
    }

    if (!receiverName.trim()) {
      Alert.alert('Recipient Name Required', 'Please enter the delivery recipient name.');
      return;
    }
    if (!receiverPhone.trim()) {
      Alert.alert('Contact Number Required', 'Please enter a contact number for delivery.');
      return;
    }
    if (!addressLine1.trim()) {
      Alert.alert('Address Required', 'Please provide a flat/house number and street address.');
      return;
    }

    // --- Strict Delivery Range & Location Verification ---
    let targetLat = detectedLat;
    let targetLng = detectedLng;
    let targetDist = deliveryDistanceKm;

    if (kitchenLat != null && kitchenLng != null && (kitchenLat !== 0 || kitchenLng !== 0)) {
      if (targetLat == null || targetLng == null) {
        setSubmitting(true);
        const resolved = await resolveAddressCoordinates(addressLine1, city, pincode);
        setSubmitting(false);
        if (resolved) {
          targetLat = resolved.lat;
          targetLng = resolved.lng;
        }
      }

      if (targetLat == null || targetLng == null) {
        Alert.alert(
          'Location Verification Required 📍',
          'We could not verify your exact map coordinates for delivery. Please tap "Detect My Location" or ensure your street and city are valid so we can verify you are within our delivery range.',
          [
            { text: 'Detect My Location', onPress: handleDetectLocation },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const computedDist = Math.round(haversineDistance(kitchenLat, kitchenLng, targetLat, targetLng) * 10) / 10;
      targetDist = computedDist;
      setDeliveryDistanceKm(computedDist);

      if (computedDist > maxDeliveryRadiusKm) {
        Alert.alert(
          'Outside Delivery Range 🚫',
          `Sorry, this delivery address is approximately ${computedDist} km away from AFoodoo Kitchen.\n\nOur maximum delivery radius is ${maxDeliveryRadiusKm} km. Orders cannot be booked outside our delivery zone.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }

    if (paymentMethod === 'wallet' && !isWalletSufficient) {
      Alert.alert(
        'Insufficient Wallet Balance',
        `Your wallet balance is ₹${walletBalance.toFixed(0)}, but order total is ₹${totalAmount}. Please choose Direct UPI or Cash on Delivery.`
      );
      return;
    }

    const slotId = activeSlot?.id || 'slot_lunch_special';
    const userId = user?.id || 'demo-user-123';
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    const deliveryAddress = {
      label: 'Home',
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone.trim(),
      line1: addressLine1.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      zip: pincode.trim(),
      latitude: targetLat ?? undefined,
      longitude: targetLng ?? undefined,
      distance_km: targetDist ?? undefined,
    };

    const devicePushToken = (await getCachedPushToken()) || (user as any)?.expo_push_token || '';

    // Handle UPI
    if (paymentMethod === 'upi') {
      setPendingUpiPayload({
        userId,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        slotId,
        deliveryAddress,
        deliveryLat: targetLat ?? null,
        deliveryLng: targetLng ?? null,
        deliveryDistanceKm: targetDist ?? null,
        mapsLink: targetLat && targetLng ? buildMapsLink(targetLat, targetLng) : null,
      });
      setShowUpiModal(true);
      return;
    }

    setSubmitting(true);

    try {
      const orderCode = await getNextOrderCode();
      const menuTitle =
        checkoutItems.length > 1
          ? checkoutItems.map(i => `${i.title} (${i.quantity})`).join(', ')
          : checkoutItems[0]?.title || 'Tiffin Meal';
      const menuItemId = checkoutItems[0]?.id || 'item_default';
      const deliveryWindow = checkoutItems[0]?.delivery_window || '01:00 PM – 02:30 PM';

      const orderData: any = {
        order_code: orderCode,
        user_id: userId,
        user_name: user?.name || receiverName.trim(),
        user_phone: user?.phone || receiverPhone.trim(),
        expo_push_token: devicePushToken || null,
        items: checkoutItems,
        menu_item_id: menuItemId,
        menu_title: menuTitle,
        subtotal,
        delivery_fee: finalDeliveryFee,
        platform_fee: finalPlatformFee,
        discount: couponDiscount,
        total_amount: totalAmount,
        price: totalAmount,
        meal_slot_id: slotId,
        slot_name: activeSlot?.name || 'Lunch special Meal booking',
        delivery_window: deliveryWindow,
        delivery_start: '01:00 PM',
        delivery_end: '02:30 PM',
        status: 'booked',
        delivery_address: deliveryAddress,
        delivery_name: receiverName.trim(),
        delivery_phone: receiverPhone.trim(),
        instructions: '',
        coupon_code: appliedCouponCode || null,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'paid',
        otp_code: otpCode,
        rating: 0,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (targetLat != null) orderData.delivery_lat = targetLat;
      if (targetLng != null) orderData.delivery_lng = targetLng;
      if (targetDist != null) orderData.delivery_distance_km = targetDist;
      if (targetLat != null && targetLng != null) {
        orderData.maps_link = buildMapsLink(targetLat, targetLng);
      }

      // 1. Write order directly to Cloud Firestore
      const { collection, addDoc, doc, updateDoc, increment, getDoc } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const docRef = await addDoc(collection(firestore, 'orders'), orderData);
      const realOrderId = docRef.id;

      // 2. Increment quantity_booked on menu items (with daily 12 AM reset check)
      try {
        const nowD = new Date();
        const todayStr = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
        for (const it of checkoutItems) {
          if (it.id) {
            const itemRef = doc(firestore, 'menu_items', it.id);
            const itemSnap = await getDoc(itemRef);
            if (itemSnap.exists()) {
              const itemData = itemSnap.data();
              const lastDate = itemData.last_booked_date || itemData.date;
              const isNewDay = !lastDate || lastDate < todayStr;
              const currentBooked = isNewDay ? 0 : (Number(itemData.quantity_booked) || 0);
              await updateDoc(itemRef, {
                quantity_booked: currentBooked + (it.quantity || 1),
                last_booked_date: todayStr,
              });
            } else {
              await updateDoc(itemRef, {
                quantity_booked: increment(it.quantity || 1),
                last_booked_date: todayStr,
              });
            }
          }
        }
      } catch (_) {}

      // 3. Deduct wallet balance only upon confirmed Firestore write!
      if (paymentMethod === 'wallet') {
        deductWalletBalance(totalAmount, `Order #${orderCode} Booking 🍲`);
      }

      // 4. Update local Zustand store orders immediately
      const currentOrders = useAppStore.getState().orders;
      useAppStore.getState().setOrders([{ id: realOrderId, ...orderData }, ...currentOrders]);

      clearCart();
      setSubmitting(false);

      Alert.alert(
        'Order Confirmed! 🎉',
        `Your order #${orderCode} has been booked successfully and sent to kitchen.`,
        [
          {
            text: 'Track Order',
            onPress: () => navigation.replace('OrderTracking', { orderId: realOrderId }),
          },
        ]
      );
    } catch (e: any) {
      setSubmitting(false);
      console.log('Order creation error:', e?.message);
      Alert.alert(
        'Booking Failed',
        `Could not confirm order: ${e?.message || 'Database error'}. No amount was deducted. Please try again.`
      );
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
      color: theme.textPrimary,
    },
  ];

  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 0);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.background, paddingTop: topInset }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={styles.topHeaderBar}>
        <TouchableOpacity
          style={[styles.headerBackBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={[styles.headerBackBtnText, { color: theme.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitleText, { color: theme.textPrimary }]}>Confirm Booking 🍲</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Step Indicator matching reference: ❶ Details —— ② Payment —— ③ Confirmed */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: theme.primary, borderColor: theme.primary }]}>
              <Text style={styles.stepCircleTextActive}>1</Text>
            </View>
            <Text style={[styles.stepLabel, { color: theme.primary }]}>Details</Text>
          </View>

          <View style={[styles.stepLine, { backgroundColor: isDark ? '#332722' : '#F0D5C7' }]} />

          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: isDark ? '#261D19' : '#F4F4F5', borderColor: isDark ? '#3D2F28' : '#E4E4E7' }]}>
              <Text style={[styles.stepCircleText, { color: theme.textMuted }]}>2</Text>
            </View>
            <Text style={[styles.stepLabel, { color: theme.textMuted }]}>Payment</Text>
          </View>

          <View style={[styles.stepLine, { backgroundColor: isDark ? '#332722' : '#F0D5C7' }]} />

          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: isDark ? '#261D19' : '#F4F4F5', borderColor: isDark ? '#3D2F28' : '#E4E4E7' }]}>
              <Text style={[styles.stepCircleText, { color: theme.textMuted }]}>3</Text>
            </View>
            <Text style={[styles.stepLabel, { color: theme.textMuted }]}>Confirmed</Text>
          </View>
        </View>

        {/* Selected Meal(s) Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C1512' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 107, 0, 0.18)' : '#F3E8E2',
            },
          ]}
        >
          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>
            Selected {checkoutItems.length > 1 ? `Meals (${checkoutItems.length})` : 'Meal'}
          </Text>

          {checkoutItems.length === 0 ? (
            <View style={styles.emptyCartBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🛒</Text>
              <Text style={[styles.emptyCartText, { color: theme.textPrimary }]}>
                Your cart is currently empty
              </Text>
              <TouchableOpacity
                style={[styles.browseMenuBtn, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('Menu')}
              >
                <Text style={styles.browseMenuBtnText}>Browse Today's Menu</Text>
              </TouchableOpacity>
            </View>
          ) : (
            checkoutItems.map((cItem, idx) => (
              <View
                key={cItem.id || `item_${idx}`}
                style={[
                  styles.itemRow,
                  idx < checkoutItems.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? '#2A1F1B' : '#F3F4F6',
                    paddingBottom: 14,
                    marginBottom: 14,
                  },
                ]}
              >
                <Image
                  source={{
                    uri:
                      cItem.image_url ||
                      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
                  }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                    {cItem.title}
                  </Text>
                  <Text style={[styles.itemPrice, { color: theme.primary }]}>
                    ₹{cItem.price.toFixed(0)}
                  </Text>
                  <View style={styles.windowRow}>
                    <Text style={[styles.itemDelivery, { color: theme.textSecondary }]}>
                      🕒 Delivery Window: {cItem.delivery_window || '1:00 PM – 2:00 PM'}
                    </Text>
                  </View>
                </View>

                {/* Inline Stepper to modify quantity in cart */}
                <View
                  style={[
                    styles.inlineStepper,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFF3ED',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFD9C6',
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => removeFromCart(cItem.id)}
                    style={styles.inlineStepperBtn}
                  >
                    <Text style={[styles.inlineStepperBtnText, { color: theme.primary }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.inlineStepperVal, { color: theme.textPrimary }]}>
                    {cItem.quantity}
                  </Text>
                  <TouchableOpacity
                    onPress={() => addToCart(cItem as any, activeSlot)}
                    style={styles.inlineStepperBtn}
                  >
                    <Text style={[styles.inlineStepperBtnText, { color: theme.primary }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Delivery Details Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C1512' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 107, 0, 0.18)' : '#F3E8E2',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, marginRight: 6 }}>📍</Text>
              <Text style={[styles.cardHeader, { color: theme.textPrimary, marginBottom: 0 }]}>
                Delivery Details
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsEditingAddress(!isEditingAddress)}>
              <Text style={[styles.changeLink, { color: theme.primary }]}>
                {isEditingAddress ? 'Done' : 'Change'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditingAddress ? (
            <View style={{ marginTop: 4 }}>
              <TouchableOpacity
                style={[styles.gpsButton, { backgroundColor: '#1565C0' }]}
                onPress={handleDetectLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.gpsButtonText}>📍 Detect My Location (GPS Auto-Fill)</Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Recipient Name</Text>
              <TextInput
                style={inputStyle}
                value={receiverName}
                onChangeText={setReceiverName}
                placeholder="Full name"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Phone Number</Text>
              <TextInput
                style={inputStyle}
                value={receiverPhone}
                onChangeText={setReceiverPhone}
                placeholder="+91..."
                keyboardType="phone-pad"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Address Line</Text>
              <TextInput
                style={inputStyle}
                value={addressLine1}
                onChangeText={handleAddressLineChange}
                placeholder="House / Flat / Street"
                placeholderTextColor={theme.textMuted}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>City</Text>
                  <TextInput
                    style={inputStyle}
                    value={city}
                    onChangeText={handleCityChange}
                    placeholder="City / Area"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Pincode</Text>
                  <TextInput
                    style={inputStyle}
                    value={pincode}
                    onChangeText={handlePincodeChange}
                    placeholder="Pincode"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Landmark</Text>
              <TextInput
                style={inputStyle}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Near landmark..."
                placeholderTextColor={theme.textMuted}
              />
            </View>
          ) : (
            <View>
              <View
                style={[
                  styles.addressPreviewBox,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB',
                    borderColor: isDark ? '#2D231E' : '#E5E7EB',
                  },
                ]}
              >
                <Text style={[styles.addrName, { color: theme.textPrimary }]}>
                  👤 {receiverName} ({receiverPhone})
                </Text>
                <Text style={[styles.addrLine, { color: theme.textSecondary }]}>
                  {addressLine1}{city ? `, ${city}` : ''}{pincode ? ` - ${pincode}` : ''}
                </Text>
                {landmark ? (
                  <Text style={[styles.addrLandmark, { color: theme.textMuted }]}>
                    Landmark: {landmark}
                  </Text>
                ) : null}
              </View>

              {/* Real-time Delivery Range Verification Chip */}
              <View style={{ marginTop: 8 }}>
                {isResolvingLocation ? (
                  <View style={[styles.rangeBadge, { backgroundColor: isDark ? '#251D1A' : '#F3F4F6', borderColor: isDark ? '#3D2F28' : '#E5E7EB' }]}>
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.rangeBadgeText, { color: theme.textSecondary }]}>
                      Verifying delivery distance...
                    </Text>
                  </View>
                ) : deliveryDistanceKm !== null ? (
                  deliveryDistanceKm <= maxDeliveryRadiusKm ? (
                    <View style={[styles.rangeBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5', borderColor: '#10B981' }]}>
                      <Text style={{ fontSize: 13, marginRight: 5 }}>🟢</Text>
                      <Text style={[styles.rangeBadgeText, { color: isDark ? '#34D399' : '#059669', fontWeight: '700' }]}>
                        Within Delivery Zone • {deliveryDistanceKm} km from kitchen
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.rangeBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2', borderColor: '#EF4444' }]}>
                      <Text style={{ fontSize: 13, marginRight: 5 }}>🚫</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rangeBadgeText, { color: isDark ? '#F87171' : '#DC2626', fontWeight: '800' }]}>
                          Outside Delivery Area ({deliveryDistanceKm} km away)
                        </Text>
                        <Text style={{ fontSize: 11, color: isDark ? '#FCA5A5' : '#B91C1C', marginTop: 1 }}>
                          Our maximum delivery limit is {maxDeliveryRadiusKm} km from AFoodoo Kitchen.
                        </Text>
                      </View>
                    </View>
                  )
                ) : (
                  <TouchableOpacity
                    onPress={handleDetectLocation}
                    style={[styles.rangeBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB', borderColor: '#F59E0B' }]}
                  >
                    <Text style={{ fontSize: 13, marginRight: 5 }}>📍</Text>
                    <Text style={[styles.rangeBadgeText, { color: isDark ? '#FBBF24' : '#D97706', fontWeight: '600' }]}>
                      Map location unverified. Tap here to detect GPS location
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Apply Coupon Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C1512' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 107, 0, 0.18)' : '#F3E8E2',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 16, marginRight: 6 }}>🏷️</Text>
            <Text style={[styles.cardHeader, { color: theme.textPrimary, marginBottom: 0 }]}>
              Apply Coupon
            </Text>
          </View>

          <View style={styles.couponRow}>
            <TextInput
              style={[inputStyle, { flex: 1, marginBottom: 0, textTransform: 'uppercase' }]}
              value={couponCode}
              onChangeText={text => {
                setCouponCode(text);
                if (couponApplied) {
                  setCouponApplied(false);
                  setCouponDiscount(0);
                  setAppliedCouponCode('');
                  setCouponMsg('');
                }
              }}
              placeholder="Enter coupon code (e.g. AFOODOO50)"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              editable={!couponApplied && !verifyingCoupon}
            />
            <TouchableOpacity
              style={[
                styles.applyCouponBtn,
                { backgroundColor: couponApplied ? '#EF4444' : theme.primary },
              ]}
              onPress={couponApplied ? handleRemoveCoupon : handleApplyCoupon}
              disabled={verifyingCoupon}
            >
              <Text style={styles.applyCouponBtnText}>
                {verifyingCoupon ? 'Verifying...' : couponApplied ? 'Remove ✕' : 'Apply'}
              </Text>
            </TouchableOpacity>
          </View>

          {couponMsg ? (
            <Text
              style={[
                styles.couponMsg,
                { color: couponApplied ? '#10B981' : '#EF4444' },
              ]}
            >
              {couponMsg}
            </Text>
          ) : null}
        </View>

        {/* Payment Method Selector */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C1512' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 107, 0, 0.18)' : '#F3E8E2',
            },
          ]}
        >
          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>Select Payment Option</Text>

          {/* 1. Wallet Option */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              {
                backgroundColor: paymentMethod === 'wallet' ? (isDark ? 'rgba(255, 107, 0, 0.15)' : '#FFF0E6') : (isDark ? '#261D1A' : '#F9FAFB'),
                borderColor: paymentMethod === 'wallet' ? theme.primary : (isDark ? '#3D2F28' : '#E5E7EB'),
              },
            ]}
            onPress={() => setPaymentMethod('wallet')}
          >
            <View style={styles.radioRow}>
              <Text style={styles.optionEmoji}>👛</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                  AFoodoo Wallet (Available: ₹{walletBalance.toFixed(0)})
                </Text>
                <Text style={[styles.optionSub, { color: isWalletSufficient ? '#10B981' : '#EF4444' }]}>
                  {isWalletSufficient ? 'Instant 1-tap booking' : 'Low balance for this order'}
                </Text>
              </View>
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: paymentMethod === 'wallet' ? theme.primary : theme.textMuted },
                  paymentMethod === 'wallet' && { backgroundColor: theme.primary },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* 2. Direct UPI */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              {
                backgroundColor: paymentMethod === 'upi' ? (isDark ? 'rgba(255, 107, 0, 0.15)' : '#FFF0E6') : (isDark ? '#261D1A' : '#F9FAFB'),
                borderColor: paymentMethod === 'upi' ? theme.primary : (isDark ? '#3D2F28' : '#E5E7EB'),
              },
            ]}
            onPress={() => setPaymentMethod('upi')}
          >
            <View style={styles.radioRow}>
              <Text style={styles.optionEmoji}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                  Direct UPI & QR Code (0% Fee)
                </Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                  GPay / PhonePe / Paytm ({upiId})
                </Text>
              </View>
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: paymentMethod === 'upi' ? theme.primary : theme.textMuted },
                  paymentMethod === 'upi' && { backgroundColor: theme.primary },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* 3. Cash on Delivery */}
          {enableCod && (
            <TouchableOpacity
              style={[
                styles.paymentOption,
                {
                  backgroundColor: paymentMethod === 'cod' ? (isDark ? 'rgba(255, 107, 0, 0.15)' : '#FFF0E6') : (isDark ? '#261D1A' : '#F9FAFB'),
                  borderColor: paymentMethod === 'cod' ? theme.primary : (isDark ? '#3D2F28' : '#E5E7EB'),
                },
              ]}
              onPress={() => setPaymentMethod('cod')}
            >
              <View style={styles.radioRow}>
                <Text style={styles.optionEmoji}>💵</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                    Cash on Delivery
                  </Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                    Pay cash upon delivery
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: paymentMethod === 'cod' ? theme.primary : theme.textMuted },
                    paymentMethod === 'cod' && { backgroundColor: theme.primary },
                  ]}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Order Summary Card matching reference */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C1512' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 107, 0, 0.18)' : '#F3E8E2',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 16, marginRight: 6 }}>🧾</Text>
            <Text style={[styles.cardHeader, { color: theme.textPrimary, marginBottom: 0 }]}>
              Order Summary
            </Text>
          </View>

          {checkoutItems.map((c, i) => (
            <View key={c.id || i} style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textPrimary }]}>
                {c.title} ({c.quantity})
              </Text>
              <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>
                ₹{(c.price * c.quantity).toFixed(0)}
              </Text>
            </View>
          ))}

          {/* Delivery Fee managed dynamically by Admin Panel */}
          <View style={styles.summaryRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Delivery Fee</Text>
              {deliveryFeeType === 'distance' && deliveryDistanceKm != null && finalDeliveryFee > 0 && (
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>
                  {deliveryDistanceKm <= baseDeliveryDistanceKm
                    ? `${deliveryDistanceKm} km (Base fee)`
                    : `${deliveryDistanceKm} km (₹${baseDeliveryFee} + ${(deliveryDistanceKm - baseDeliveryDistanceKm).toFixed(1)} km × ₹${perKmFee}/km)`}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.summaryVal,
                { color: finalDeliveryFee === 0 ? '#10B981' : theme.textPrimary },
              ]}
            >
              {finalDeliveryFee === 0 ? 'FREE' : `₹${finalDeliveryFee}`}
            </Text>
          </View>

          {/* Platform Fee managed dynamically by Admin Panel */}
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Platform Fee</Text>
            <Text style={[styles.summaryVal, { color: theme.textPrimary }]}>
              ₹{finalPlatformFee}
            </Text>
          </View>

          {couponDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#10B981' }]}>Coupon Discount</Text>
              <Text style={[styles.summaryVal, { color: '#10B981' }]}>
                −₹{couponDiscount}
              </Text>
            </View>
          )}

          <View style={[styles.summaryDivider, { backgroundColor: isDark ? '#2D231E' : '#F3F4F6' }]} />

          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: theme.textPrimary }]}>Total Amount</Text>
            <Text style={[styles.totalAmount, { color: theme.primary }]}>
              ₹{totalAmount.toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Bottom CTA Button: Proceed to Payment → */}
        {(() => {
          const isOutOfRange =
            kitchenLat != null &&
            kitchenLng != null &&
            (kitchenLat !== 0 || kitchenLng !== 0) &&
            deliveryDistanceKm !== null &&
            deliveryDistanceKm > maxDeliveryRadiusKm;

          return (
            <TouchableOpacity
              style={[
                styles.proceedButton,
                {
                  backgroundColor: isOutOfRange
                    ? (isDark ? '#4A1515' : '#FEE2E2')
                    : theme.primary,
                  borderColor: isOutOfRange ? '#EF4444' : 'transparent',
                  borderWidth: isOutOfRange ? 1.5 : 0,
                },
              ]}
              onPress={handleProceedToPayment}
              disabled={submitting || checkoutItems.length === 0}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={isOutOfRange ? '#EF4444' : '#FFF'} />
              ) : isOutOfRange ? (
                <Text
                  style={[
                    styles.proceedButtonText,
                    { color: isDark ? '#FCA5A5' : '#DC2626' },
                  ]}
                >
                  🚫 Outside Delivery Area ({deliveryDistanceKm} km)
                </Text>
              ) : (
                <Text style={styles.proceedButtonText}>Proceed to Payment →</Text>
              )}
            </TouchableOpacity>
          );
        })()}
      </ScrollView>

      {/* Zero-fee Direct UPI Modal */}
      <UpiPaymentModal
        visible={showUpiModal}
        amount={totalAmount}
        upiId={upiId}
        merchantName={merchantName}
        customQrUrl={customQrUrl}
        note={`AFoodoo Order ₹${totalAmount}`}
        submitting={submitting}
        onClose={() => setShowUpiModal(false)}
        onConfirmPaid={handleConfirmUpiPayment}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackBtnText: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '800',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 10,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepLine: {
    width: 44,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 14,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  emptyCartBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyCartText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  browseMenuBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  browseMenuBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    marginVertical: 2,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDelivery: {
    fontSize: 11,
    fontWeight: '600',
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  inlineStepperBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineStepperBtnText: {
    fontSize: 16,
    fontWeight: '900',
  },
  inlineStepperVal: {
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  changeLink: {
    fontSize: 13,
    fontWeight: '800',
  },
  addressPreviewBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  addrName: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  addrLine: {
    fontSize: 12,
    lineHeight: 17,
  },
  addrLandmark: {
    fontSize: 11,
    marginTop: 3,
  },
  gpsButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  gpsButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '500',
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  applyCouponBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyCouponBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  couponMsg: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  paymentOption: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  optionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginLeft: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '900',
  },
  proceedButton: {
    marginTop: 6,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  proceedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  rangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  rangeBadgeText: {
    fontSize: 12,
  },
});
