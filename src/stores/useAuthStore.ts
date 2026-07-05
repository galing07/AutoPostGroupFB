import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiRequest } from '@/services/apiClient';

export type SubscriptionStatus = 'active' | 'inactive' | 'expired' | 'canceled';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface SubscriptionInfo {
  id: string;
  status: SubscriptionStatus;
  plan: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

interface AuthApiResponse {
  success: boolean;
  token: string;
  user: AuthUser;
  subscription: SubscriptionInfo | null;
}

interface SubscriptionApiResponse {
  success: boolean;
  subscription: SubscriptionInfo | null;
  active?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  refreshSubscription: () => Promise<void>;
  validateLicense: () => Promise<boolean>;
  isAuthenticated: () => boolean;
  hasActiveSubscription: () => boolean;
}

function applySubscription(subscription: SubscriptionInfo | null) {
  if (!subscription) {
    return { subscriptionStatus: 'inactive' as SubscriptionStatus, subscriptionEndsAt: null };
  }

  const expired = subscription.endsAt && new Date(subscription.endsAt).getTime() <= Date.now();
  return {
    subscriptionStatus: expired ? 'expired' as SubscriptionStatus : subscription.status,
    subscriptionEndsAt: subscription.endsAt ?? null,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: { id: 'local-user', name: 'Admin', email: 'admin@local' },
      token: 'local-token',
      subscriptionStatus: 'active',
      subscriptionEndsAt: null,

      login: async () => {},
      register: async () => {},
      forgotPassword: async () => ({ success: true, message: 'Not needed' }),
      logout: () => {},
      refreshSubscription: async () => {},
      validateLicense: async () => true,

      isAuthenticated: () => true,
      hasActiveSubscription: () => true,
    }),
    { name: 'autopost-auth' }
  )
);
