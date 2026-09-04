import { create } from 'zustand';
import { getStoredToken, clearToken, storeToken } from '../api/wardrobeApi';

interface AuthState {
  isSignedIn: boolean;
  isLoading: boolean;
  phone: string | null;
  checkStoredAuth: () => Promise<void>;
  signIn: (phone: string) => void;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isSignedIn: false,
  isLoading: true,
  phone: null,
  checkStoredAuth: async () => {
    const token = await getStoredToken();
    set({ isSignedIn: !!token, isLoading: false });
  },
  signIn: (phone: string) => set({ isSignedIn: true, phone }),
  signInWithToken: async (token: string) => {
    await storeToken(token);
    set({ isSignedIn: true, phone: null });
  },
  signOut: async () => {
    await clearToken();
    set({ isSignedIn: false, phone: null });
  },
}));
