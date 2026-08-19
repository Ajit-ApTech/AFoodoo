export interface NotificationSettings {
  cutoff_alerts: boolean;
  order_updates: boolean;
  promo_alerts: boolean;
  in_app_popups: boolean;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  addresses: DeliveryAddress[];
  wallet_balance: number;
  subscription_ids: string[];
  created_at: string;
  is_blocked?: boolean;
  notification_settings?: NotificationSettings;
}

export interface DeliveryAddress {
  id?: string;
  label: string;          // e.g. "Home", "Office", "Other"
  receiver_name?: string; // Person who receives the delivery (may differ from account name)
  receiver_phone?: string;
  line1: string;          // Flat / House No., Building, Street
  landmark?: string;      // e.g. "Near D-Mart"
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  maps_link?: string;
}

/** @deprecated Use DeliveryAddress */
export interface Address extends DeliveryAddress {}

export interface MealSlot {
  id: string;
  name?: string;
  booking_open_time?: any;
  booking_cutoff_time?: any;
  delivery_start_time?: any;
  delivery_end_time?: any;
  active?: boolean;
}

export interface MenuItem {
  id: string;
  meal_slot_id?: string;
  date?: any;
  title: string;
  description?: string;
  image_url?: string;
  veg_flag?: boolean;
  price: number;
  is_available?: boolean;
  max_quantity?: number;
  quantity_booked?: number;
  [key: string]: any;
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
  status: 'booked' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_address: DeliveryAddress;
  delivery_name?: string;       // Recipient's name for this specific delivery
  delivery_phone?: string;      // Recipient's contact number
  delivery_lat?: number;        // GPS latitude of delivery point
  delivery_lng?: number;        // GPS longitude of delivery point
  delivery_distance_km?: number; // Distance from kitchen in km
  maps_link?: string;           // Google Maps pin link (no API key)
  payment_status: string;
  otp_code?: string;
  created_at: any;
  tiffin_returned?: boolean;
  delivery_zone_id?: string;
  zone_name?: string;
  total_amount?: number;
  delivery_window?: string;
  delivery_start?: string;
  delivery_end?: string;
  rating?: number;
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

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  meals_remaining: number;
  start_date: any;
  end_date: any;
  auto_renew: boolean;
}
