import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  onUndo?: () => void;
}

interface ToastContextValue {
  show: (message: string, onUndo?: () => void) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, onUndo?: () => void) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, onUndo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-full px-4 py-2.5 shadow-lg text-sm"
            style={{ background: "var(--ink)", color: "var(--surface)" }}
          >
            <span>{t.message}</span>
            {t.onUndo && (
              <button
                className="font-semibold underline underline-offset-2"
                style={{ color: "var(--brand)" }}
                onClick={() => {
                  t.onUndo?.();
                  setToasts((ts) => ts.filter((x) => x.id !== t.id));
                }}
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
