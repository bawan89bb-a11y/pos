import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ background: "rgba(10,10,10,0.45)", backdropFilter: "blur(2px)" }}
        />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col shadow-2xl focus:outline-none max-h-[88vh]"
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-modal)",
            width,
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--line)" }}
          >
            <Dialog.Title className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded-full hover:opacity-70"
                style={{ color: "var(--ink-3)" }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <div className="px-5 py-4 overflow-y-auto">{children}</div>
          {footer && (
            <div
              className="flex items-center justify-between px-5 py-4 border-t"
              style={{ borderColor: "var(--line)" }}
            >
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-1.5 font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed";
  const sizeCls = size === "sm" ? "text-[13px] px-3 py-1.5" : "text-[14px] px-4 py-2.5";
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--brand)", color: "#fff" },
    secondary: { background: "var(--surface-3)", color: "var(--ink)" },
    ghost: { background: "transparent", color: "var(--ink-2)" },
    destructive: { background: "var(--crit)", color: "#fff" },
  };
  return (
    <button
      type={type}
      className={`${base} ${sizeCls} ${className}`}
      style={{ borderRadius: "var(--radius-control)", ...styles[variant] }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "crit" | "neutral"; children: ReactNode }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    good: { bg: "color-mix(in srgb, var(--good) 15%, transparent)", fg: "var(--good)" },
    warn: { bg: "color-mix(in srgb, var(--warn) 20%, transparent)", fg: "#8a5a00" },
    crit: { bg: "color-mix(in srgb, var(--crit) 15%, transparent)", fg: "var(--crit)" },
    neutral: { bg: "var(--surface-3)", fg: "var(--ink-2)" },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.fg, borderRadius: "var(--radius-pill)" }}
    >
      {children}
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative inline-flex items-center shrink-0 cursor-pointer"
        style={{
          width: 42,
          height: 23,
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--brand)" : "var(--line-2)",
        }}
      >
        <SwitchPrimitive.Thumb
          className="block bg-white rounded-full shadow transition-transform"
          style={{ width: 19, height: 19, transform: checked ? "translateX(21px)" : "translateX(2px)" }}
        />
      </SwitchPrimitive.Root>
      {label && <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>{label}</span>}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-14 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
      {text}
    </div>
  );
}

export function SkeletonRows({ count = 4, cols = 4 }: { count?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-3 rounded animate-pulse" style={{ background: "var(--surface-3)" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function inputCls() {
  return "w-full px-3 py-2 text-[14px] border outline-none focus:ring-2 transition-shadow";
}

export const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  borderColor: "var(--line)",
  borderRadius: "var(--radius-control)",
  color: "var(--ink)",
};

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
