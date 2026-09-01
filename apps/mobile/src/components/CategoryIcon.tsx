import React from 'react';
import {
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Heart,
  Lightbulb,
  PiggyBank,
  Coffee,
  Plane,
  CreditCard,
  Gift,
  Wifi,
  Receipt,
  Wallet,
  Landmark,
  type LucideProps,
} from 'lucide-react-native';

const MAP: Record<string, typeof ShoppingBag> = {
  shopping_bag: ShoppingBag,
  shopping_cart: ShoppingBag,
  restaurant: Utensils,
  local_dining: Utensils,
  local_cafe: Coffee,
  directions_car: Car,
  home: Home,
  house: Home,
  favorite: Heart,
  health_and_safety: Heart,
  fitness_center: Heart,
  bolt: Lightbulb,
  sports_esports: Gift,
  movie: Gift,
  savings: PiggyBank,
  fuel: Car,
  local_gas_station: Car,
  flight: Plane,
  credit_card: CreditCard,
  card_giftcard: Gift,
  wifi: Wifi,
  receipt: Receipt,
  receipt_long: Receipt,
  payments: Wallet,
  account_balance: Landmark,
  account_balance_wallet: Wallet,
};

export function CategoryIcon({ name, ...props }: LucideProps & { name?: string }) {
  const Icon = (name && MAP[name]) || ShoppingBag;
  return <Icon {...props} />;
}
