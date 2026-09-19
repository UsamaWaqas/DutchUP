import type { IconName } from '@/components/iconData';

export interface Category {
  key: string;
  label: string;
  icon: IconName;
}

export const CATEGORIES: Category[] = [
  { key: 'general', label: 'General', icon: 'wallet' },
  { key: 'food', label: 'Food', icon: 'utensils' },
  { key: 'transport', label: 'Transport', icon: 'car' },
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'shopping', label: 'Shopping', icon: 'bag' },
  { key: 'entertainment', label: 'Entertainment', icon: 'bolt' },
];

const ICON_BY_KEY: Record<string, IconName> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.icon]));
const LABEL_BY_KEY: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export function categoryIcon(key: string): IconName {
  return ICON_BY_KEY[key] ?? 'wallet';
}

export function categoryLabel(key: string): string {
  return LABEL_BY_KEY[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
