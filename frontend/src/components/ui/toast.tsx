import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { Toast as RadixToast } from "radix-ui";
import { Button, IconButton } from "./Button";
import styles from "./Toast.module.css";

export type ToastTone = "ok" | "crit" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  /** Milliseconds; defaults to 5s, 8s for errors. */
  duration?: number;
  /** Called when the toast closes for any reason other than its action. */
  onDismiss?: () => void;
}

interface ToastRecord extends ToastInput {
  id: number;
  open: boolean;
}

interface ToastApi {
  show: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  // Toasts whose action was used; their onDismiss must not also run.
  const acted = useRef(new Set<number>());

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.map((t) => (t.id === id ? { ...t, open: false } : t)));
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 300);
  }, []);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId++;
    setToasts((all) => [...all.slice(-3), { ...toast, id, open: true }]);
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider swipeDirection="right" label="Notification">
        {children}
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onOpenChange={(open) => {
              if (open) return;
              if (acted.current.has(t.id)) acted.current.delete(t.id);
              else t.onDismiss?.();
              dismiss(t.id);
            }}
            onAction={() => {
              acted.current.add(t.id);
              t.action?.onClick();
            }}
          />
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onOpenChange,
  onAction,
}: {
  toast: ToastRecord;
  onOpenChange: (open: boolean) => void;
  onAction: () => void;
}) {
  const tone = toast.tone ?? "ok";
  const Mark = tone === "crit" ? CircleAlert : tone === "info" ? Info : CircleCheck;
  return (
    <RadixToast.Root
      className={styles.toast}
      open={toast.open}
      onOpenChange={onOpenChange}
      duration={toast.duration ?? (tone === "crit" ? 8000 : 5000)}
      type={tone === "crit" ? "foreground" : "background"}
    >
      <Mark className={`${styles.mark} ${styles[tone]}`} aria-hidden="true" />
      <div className={styles.content}>
        <RadixToast.Title className={styles.title}>{toast.title}</RadixToast.Title>
        {toast.description && <RadixToast.Description className={styles.description}>{toast.description}</RadixToast.Description>}
      </div>
      <div className={styles.actions}>
        {toast.action && (
          <RadixToast.Action asChild altText={toast.action.label}>
            <Button size="sm" variant="secondary" onClick={onAction}>
              {toast.action.label}
            </Button>
          </RadixToast.Action>
        )}
        <RadixToast.Close asChild>
          <IconButton label="Dismiss" size="sm">
            <X aria-hidden="true" />
          </IconButton>
        </RadixToast.Close>
      </div>
    </RadixToast.Root>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
