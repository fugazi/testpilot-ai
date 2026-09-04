'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

type ToastVariant = 'success' | 'error';

type Toast = {
  id: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toast: (t: Toast) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

/**
 * Provider that renders toast messages. Use `useToast()` to show toasts.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Toast) => {
    const id = t.id || String(Date.now());
    setToasts((s) => [...s, { ...t, id }]);
    if (t.duration !== 0) {
      const duration = t.duration ?? 3000;
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== id));
      }, duration);
    }
  }, []);

  const remove = useCallback((id: string) => setToasts((s) => s.filter((x) => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed z-50 right-6 top-6 flex flex-col gap-3 w-[320px] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg bg-white border shadow-md p-3 flex gap-3 items-start animate-in slide-in-from-right duration-300"
            role="status"
          >
            <div className={t.variant === 'error' ? 'text-red-600 mt-0.5' : 'text-green-600 mt-0.5'}>
              {t.variant === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              {t.title && <div className="font-medium text-sm">{t.title}</div>}
              <div className="text-sm text-gray-700 mt-1">{t.message}</div>
            </div>
            <div className="ml-3 flex items-center">
              <button
                className="text-sm text-gray-400 hover:text-gray-700"
                onClick={() => remove(t.id)}
                aria-label="Close notification"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
