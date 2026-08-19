export type AdminRole = 'super_admin' | 'kitchen_staff' | 'delivery_manager';

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface MealSlot {
  id: string;
  name: string;
  booking_open_time: string;
  booking_cutoff_time: string;
  delivery_start_time: string;
  delivery_end_time: string;
  active: boolean;
}

export interface MenuItem {
  id: string;
  meal_slot_id: string;
  date: string;
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

export interface DeliveryAddress {
  id?: string;
  label: string;
  receiver_name?: string;
  receiver_phone?: string;
  line1: string;
  landmark?: string;
  city: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  maps_link?: string;
}

export interface Order {
  id: string;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  menu_item_id: string;
  menu_title?: string;
  meal_slot_id: string;
  slot_name?: string;
  status: OrderStatus;
  delivery_address: DeliveryAddress;
  delivery_name?: string;
  delivery_phone?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_distance_km?: number;
  maps_link?: string;
  payment_status: 'paid' | 'pending' | 'failed';
  otp_code?: string;
  delivery_zone_id?: string;
  zone_name?: string;
  tiffin_returned?: boolean;
  total_amount?: number;
  delivery_window?: string;
  delivery_start?: string;
  delivery_end?: string;
  created_at: string;
  [key: string]: any;
}

export interface DeliveryConfig {
  kitchen_name: string;
  kitchen_address: string;
  kitchen_lat: number;
  kitchen_lng: number;
  kitchen_maps_link: string;
  max_delivery_radius_km: number;
  rider_whatsapp: string;
  updated_at: string;
}

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  wallet_balance: number;
  subscription_ids: string[];
  active_subscription?: string;
  role?: string;
  is_blocked?: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  user_name?: string;
  plan_type: string;
  meals_remaining: number;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  is_paused?: boolean;
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
    | 'push_broadcast';
  details: string;
  target_id?: string;
  timestamp: string;
}

export interface DashboardSnapshot {
  total_bookings: number;
  lunch_bookings: number;
  dinner_bookings: number;
  today_revenue: number;
  active_subscriptions: number;
  pending_deliveries: number;
  cutoff_alert: {
    message: string;
    minutes_remaining: number;
  };
}
