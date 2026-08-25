// Data model interfaces matching the Firestore schema

export interface User {
  id: string;
  name: string;
  phone: string;
  addresses: Address[];
  wallet_balance: number;
  subscription_ids: string[];
  role?: 'super_admin' | 'kitchen_staff' | 'delivery_manager' | 'customer';
  is_blocked?: boolean;
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
  delivery_zone_id?: string;
  tiffin_returned?: boolean;
  created_at: FirebaseFirestore.Timestamp;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string; // e.g., 'Lunch Weekly'
  meals_remaining: number;
  start_date: FirebaseFirestore.Timestamp;
  end_date: FirebaseFirestore.Timestamp;
  auto_renew: boolean;
  is_paused?: boolean;
  paused_dates?: string[];
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'topup' | 'debit' | 'refund' | 'plan_credit';
  title?: string;
  timestamp: FirebaseFirestore.Timestamp;
}

export interface DeliveryZone {
  id: string;
  name: string;
  polygon_coordinates: number[][]; // array of [lat, lng]
  assigned_rider_id?: string;
}

export type PaymentRequestType = 'order' | 'wallet_topup' | 'subscription';

export type PaymentRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'utr_submitted'
  | 'permanently_rejected'
  | 'expired';

export interface PaymentRequest {
  id: string;
  type: PaymentRequestType;
  user_id: string;
  user_name: string;
  user_phone: string;
  amount: number;
  status: PaymentRequestStatus;
  order_payload?: any;
  wallet_payload?: any;
  subscription_payload?: any;
  utr_number?: string | null;
  utr_submitted_at?: any;
  approved_by?: string | null;
  approved_at?: any;
  rejected_by?: string | null;
  rejected_at?: any;
  reject_reason?: string | null;
  result_order_id?: string | null;
  result_subscription_id?: string | null;
  created_at: any;
  updated_at: any;
  expires_at?: any;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action_type:
    | 'wallet_adjust'
    | 'user_block'
    | 'cutoff_change'
    | 'menu_edit'
    | 'subscription_override'
    | 'push_broadcast'
    | 'payment_approval'
    | 'payment_rejection';
  details: string;
  target_id?: string;
  ip_address?: string;
  timestamp: FirebaseFirestore.Timestamp;
}

