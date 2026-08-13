export interface User {
  id: string;
  name: string;
  phone: string;
  addresses: Address[];
  wallet_balance: number;
  subscription_ids: string[];
  created_at: string;
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
}

export interface Order {
  id: string;
  user_id: string;
  menu_item_id: string;
  meal_slot_id: string;
  status: 'booked' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_address: Address;
  payment_status: string;
  otp_code?: string;
  created_at: any;
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
