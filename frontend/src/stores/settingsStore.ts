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

    // Chat Isolation & Persistence
    chats: Record<number, ChatMessage[]>;   // Map library ID → its messages
    activeLibraryId: number | null;         // Persisted active library

    // Actions
    setApiUrl: (url: string) => void;
    toggleTheme: () => void;
    setActiveLibraryId: (id: number | null) => void;
    addMessage: (libraryId: number, message: ChatMessage) => void;
    clearHistory: (libraryId?: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            // Default values
            apiUrl: DEFAULT_API_URL,
            theme: 'dark',
            chats: {},
            activeLibraryId: null,

            // Actions
            setApiUrl: (url) => set({ apiUrl: normalizeApiUrl(url) }),

            toggleTheme: () => set((state) => ({
                theme: state.theme === 'dark' ? 'light' : 'dark'
            })),

            setActiveLibraryId: (id) => set({ activeLibraryId: id }),

            addMessage: (libraryId, message) => set((state) => {
                const existing = state.chats[libraryId] || [];
                return {
                    chats: {
                        ...state.chats,
                        [libraryId]: [...existing, message].slice(-50), // Keep last 50 per library
                    }
                };
            }),

            clearHistory: (libraryId) => set((state) => {
                if (libraryId != null) {
                    const newChats = { ...state.chats };
                    delete newChats[libraryId];
                    return { chats: newChats };
                }
                return { chats: {} };
            }),
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
