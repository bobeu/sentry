"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "error" | "success" | "info";

type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "error") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev.slice(-4), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(92vw,22rem)] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto animate-toast-in rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ${
              item.kind === "error"
                ? "border-red-400/30 bg-[#2a1212]/92 text-red-100"
                : item.kind === "success"
                  ? "border-[var(--accent)]/35 bg-[#102016]/95 text-[#dff7e8]"
                  : "border-white/15 bg-[#121812]/95 text-[#e8f5d8]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p>{item.message}</p>
              <button
                type="button"
                className="text-xs opacity-70 transition hover:opacity-100"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
