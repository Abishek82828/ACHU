import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, ShoppingCart, AlertCircle, X } from 'lucide-react';

type ToastVariant = 'success' | 'cart' | 'error';
interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextType {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-24 right-4 sm:right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const cfg = {
            success: { icon: <Check className="w-4 h-4" />, bg: 'bg-brand-600', text: 'text-white' },
            cart: { icon: <ShoppingCart className="w-4 h-4" />, bg: 'bg-earth-900', text: 'text-white' },
            error: { icon: <AlertCircle className="w-4 h-4" />, bg: 'bg-red-600', text: 'text-white' },
          }[t.variant];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto ${cfg.bg} ${cfg.text} px-4 py-3 rounded-2xl shadow-2xl shadow-brand-900/20 flex items-center gap-3 min-w-[240px] max-w-sm animate-toast-in`}
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {cfg.icon}
              </div>
              <span className="text-sm font-medium flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
