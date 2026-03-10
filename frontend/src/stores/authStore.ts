import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    token: string | null;
    email: string | null;

    setAuth: (token: string, email: string) => void;
    logout: () => void;
    isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            email: null,

            setAuth: (token, email) => set({ token, email }),

            logout: () => set({ token: null, email: null }),

            isAuthenticated: () => !!get().token,
        }),
        {
            name: 'fehres-auth',
        }
    )
);
