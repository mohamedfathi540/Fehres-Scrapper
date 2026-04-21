import { useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useToastStore, dismissToast, type ToastType } from '../../stores/toastStore';

const iconMap: Record<ToastType, typeof AlertCircle> = {
    error: AlertCircle,
    success: CheckCircle2,
    warning: AlertTriangle,
    info: Info,
};

const colorMap: Record<ToastType, string> = {
    error: 'border-error/40 bg-error/10 text-error',
    success: 'border-success/40 bg-success/10 text-success',
    warning: 'border-warning/40 bg-warning/10 text-warning',
    info: 'border-primary-500/40 bg-primary-500/10 text-primary-400',
};

function ToastItem({ id, message, type, duration }: { id: string; message: string; type: ToastType; duration: number }) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const Icon = iconMap[type];

    useEffect(() => {
        timerRef.current = setTimeout(() => dismissToast(id), duration);
        return () => clearTimeout(timerRef.current);
    }, [id, duration]);

    return (
        <div
            className={`
                flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm
                shadow-lg shadow-black/20 animate-slide-in-right
                ${colorMap[type]}
            `}
            role="alert"
        >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1 text-text-primary">{message}</p>
            <button
                onClick={() => dismissToast(id)}
                className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} {...toast} />
            ))}
        </div>
    );
}
