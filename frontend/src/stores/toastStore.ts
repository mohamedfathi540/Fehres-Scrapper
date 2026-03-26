import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
}

interface ToastStore {
    toasts: Toast[];
    addToast: (toast: Toast) => void;
    dismissToast: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (toast) =>
        set((state) => ({ toasts: [...state.toasts, toast] })),
    dismissToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

let counter = 0;

/**
 * Show a toast notification. Can be called from anywhere (components, interceptors, etc.).
 */
export const showToast = (
    message: string,
    type: ToastType = 'info',
    duration = 4000,
) => {
    const id = `toast-${Date.now()}-${++counter}`;
    useToastStore.getState().addToast({ id, message, type, duration });
};

export const dismissToast = (id: string) => {
    useToastStore.getState().dismissToast(id);
};

export { useToastStore };
