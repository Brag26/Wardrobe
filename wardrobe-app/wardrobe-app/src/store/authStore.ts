import { create } from 'zustand';
import { getStoredToken, clearToken, storeToken, devLogin } from '../api/wardrobeApi';

interface AuthState {
  isSignedIn: boolean;
  isLoading: boolean;
  phone: string | null;
  checkStoredAuth: () => Promise<void>;
  signIn: (phone: string) => void;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Explicit request: skip login entirely, land straight in the app with
// no screen shown at all. If a real session token is already stored,
// use it as before. If not, silently establish one via devLogin behind
// the scenes — the person never sees a phone screen, tap a button, or
// know a login step happened at all. This only works because
// DEV_LOGIN_ENABLED is on for this backend; if that's ever turned off
// for a real production deploy, this silent call would start failing
// and someone would need a real login path back.
const AUTO_LOGIN_PHONE = '+919999999999';

export const useAuthStore = create<AuthState>((set) => ({
  isSignedIn: false,
  isLoading: true,
  phone: null,
  checkStoredAuth: async () => {
    const token = await getStoredToken();
    if (token) {
      set({ isSignedIn: true, isLoading: false });
      return;
    }
    try {
      await devLogin(AUTO_LOGIN_PHONE);
      set({ isSignedIn: true, isLoading: false });
    } catch (e) {
      // Silent auto-login failed (e.g. DEV_LOGIN_ENABLED is off on the
      // backend) — fall back to actually showing the login screen
      // rather than leaving the person stuck on a blank/loading app
      // with no way in at all.
      console.error('[authStore] Silent auto-login failed:', e);
      set({ isSignedIn: false, isLoading: false });
    }
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
