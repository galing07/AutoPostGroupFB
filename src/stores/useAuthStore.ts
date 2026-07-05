import { create } from 'zustand';
import { persist } from 'zustand/middleware';


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


export const useAuthStore = create<AuthState>()(
  persist(
    () => ({
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
    } as AuthState),
    { name: 'autopost-auth' }
  )
);
