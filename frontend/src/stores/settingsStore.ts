import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../api/types';

const API_PREFIX = '/api/v1';

const normalizeApiUrl = (url?: string): string => {
    const trimmed = (url ?? '').trim();
    if (!trimmed) {
        return API_PREFIX;
    }
    return trimmed.replace(/\/+$/, '');
};

const DEFAULT_API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL as string | undefined);

interface SettingsState {
    // Settings
    apiUrl: string;
    theme: 'dark' | 'light';

    // Chat History
    chatHistory: ChatMessage[];

    // Actions
    setApiUrl: (url: string) => void;
    toggleTheme: () => void;
    addMessage: (message: ChatMessage) => void;
    clearHistory: () => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            // Default values
            apiUrl: DEFAULT_API_URL,
            theme: 'dark',
            chatHistory: [],

            // Actions
            setApiUrl: (url) => set({ apiUrl: normalizeApiUrl(url) }),

            toggleTheme: () => set((state) => ({
                theme: state.theme === 'dark' ? 'light' : 'dark'
            })),

            addMessage: (message) => set((state) => ({
                chatHistory: [...state.chatHistory, message].slice(-50), // Keep last 50 messages
            })),

            clearHistory: () => set({ chatHistory: [] }),
        }),
        {
            name: 'fehres-settings',
            merge: (persistedState, currentState) => {
                const incoming = (persistedState as Partial<SettingsState> | undefined) ?? {};
                return {
                    ...currentState,
                    ...incoming,
                    apiUrl: normalizeApiUrl(incoming.apiUrl),
                };
            },
        }
    )
);
