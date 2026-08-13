// Data model interfaces matching the Firestore schema

export interface User {
  id: string;
  name: string;
  phone: string;
  addresses: Address[];
  wallet_balance: number;
  subscription_ids: string[];
  created_at: FirebaseFirestore.Timestamp;
}

export interface Address {
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
}

export interface MealSlot {
  id: string;
  name: string; // Lunch, Dinner, or custom
  booking_open_time: FirebaseFirestore.Timestamp;
  booking_cutoff_time: FirebaseFirestore.Timestamp;
  delivery_start_time: FirebaseFirestore.Timestamp;
  delivery_end_time: FirebaseFirestore.Timestamp;
  active: boolean;
}

export interface MenuItem {
  id: string;
  meal_slot_id: string;
  date: FirebaseFirestore.Timestamp; // the calendar day this item belongs to
  title: string;
  description: string;
  image_url?: string;
  veg_flag: boolean;
  price: number;
  is_available: boolean;
  max_quantity: number;
  quantity_booked: number;
}

export type OrderStatus =
  | 'booked'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  user_id: string;
  menu_item_id: string;
  meal_slot_id: string;
  status: OrderStatus;
  delivery_address: Address;
  payment_status: string; // e.g., 'paid', 'pending', 'failed'
  otp_code?: string;
  created_at: FirebaseFirestore.Timestamp;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string; // e.g., '10_lunches'
  meals_remaining: number;
  start_date: FirebaseFirestore.Timestamp;
  end_date: FirebaseFirestore.Timestamp;
  auto_renew: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'topup' | 'debit' | 'refund';
  timestamp: FirebaseFirestore.Timestamp;
}

export interface DeliveryZone {
  id: string;
  name: string;
  polygon_coordinates: number[][]; // array of [lat, lng]
  assigned_rider_id?: string;
}
