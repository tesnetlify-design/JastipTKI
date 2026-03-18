
export type AppState = 'LANDING' | 'AUTH' | 'DASHBOARD';

export type UserType = 'new_user' | 'old_user' | 'active_user' | 'loyalty_user';

export interface AppConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  defaultCurrency: string;
  promoBanner: string;
  supportContact: string;
  appVersion: string;
  minSupportedVersion: string;
  enableVoucher: boolean;
  enableCheckout: boolean;
  adminWhatsApp: string;
  adminEmail: string;
  hubName: string;
  hubPhone: string;
  hubAddress: string;
  updatedAt?: any;
}

export interface FeatureFlags {
  enableNewCheckout: boolean;
  enableReferral: boolean;
  enableBetaFeature: boolean;
  enableNewVoucherSystem: boolean;
  updatedAt?: any;
}

export interface TransactionConfig {
  statusLabel: Record<string, string>;
  statusColor: Record<string, string>;
  allowedStatusTransition: Record<string, string[]>;
  updatedAt?: any;
}

export interface PaymentConfig {
  adminFee: number;
  serviceFee: number; // Percentage (e.g. 0.10 for 10%)
  exchangeRate: number;
  minTransaction: number;
  maxTransaction: number;
  roundingMode: 'UP_05' | 'UP_10' | 'NORMAL';
  updatedAt?: any;
}

export interface ShippingRate {
  id: string;
  countryCode: string;
  countryName: string;
  baseRate: number;
  perKgRate: number;
  estimatedDays: number;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  weight: number;
  imageUrl: string;
  category: string;
  description?: string;
  active: boolean;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
  priceTag: string;
  features: string[];
  color: string;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  message: string;
  rating: number;
  date?: string;
  userId?: string;
}

export interface TransactionUpdate {
  date: string;
  message: string;
  location: string;
}

export interface TransactionItem {
  name: string;
  price: number;
  quantity: number;
}

export interface TransactionReview {
  rating: number;
  comment: string;
  date: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'JASTIP' | 'BELANJA';
  status: string;
  date: string;
  destination: string;
  amount: number;
  items?: TransactionItem[];
  updates?: TransactionUpdate[];
  shippingCost?: number;
  serviceFee?: number;
  weight?: number;
  actualWeight?: number;
  review?: TransactionReview;
  details?: any;
  createdAt?: any;
}

export interface Voucher {
  id: string;
  code: string;
  title: string;
  description: string;
  discountValue: number;
  discountType: 'FIXED' | 'PERCENTAGE';
  targetUser: UserType | 'all_user';
  promoType: string;
  priority: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  quota: number;
  usedCount: number;
  country?: string;
  minTransaction?: number;
}

export type UserRole = 'user' | 'admin' | 'staff' | 'super_admin';

export interface MenuPermissions {
  transactions: boolean;
  products: boolean;
  vouchers: boolean;
  rates: boolean;
  testimonials: boolean;
  users: boolean;
  settings: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role?: UserRole;
  menuPermissions?: MenuPermissions;
  addresses?: any[];
  claimedVouchers?: string[];
  activeClaimedVoucher?: string | null;
  claimStatus?: 'claimed' | 'used' | 'expired';
  voucherCollection?: string[];
  usedVouchers?: string[];
}
