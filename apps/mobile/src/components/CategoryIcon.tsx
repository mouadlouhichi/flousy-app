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
  restaurant: Utensils,
  local_dining: Utensils,
  directions_car: Car,
  home: Home,
  house: Home,
  favorite: Heart,
  health_and_safety: Heart,
  bolt: Lightbulb,
  sports_esports: Gift,
  movie: Gift,
  savings: PiggyBank,
  local_cafe: Coffee,
  fuel: Car,
  flight: Plane,
  credit_card: CreditCard,
  fitness_center: Heart,
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
