import type { ReactNode } from "react";
import { X } from "lucide-react";
import { AlertDialog, Dialog, DropdownMenu, Popover as RadixPopover, Tooltip as RadixTooltip } from "radix-ui";
import { Button, IconButton, cx } from "./Button";
import styles from "./Overlay.module.css";

/* ─── Dialog & Sheet ─── */

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  footerNote?: ReactNode;
  wide?: boolean;
}

/**
 * Radix focuses the first focusable element on open, which is the Close button
 * in our header. Keep focus on a field the content autofocused; otherwise focus
 * the dialog itself so screen readers start at its title.
 */
function focusDialog(event: Event) {
  event.preventDefault();
  const content = event.currentTarget as HTMLElement | null;
  if (content && !content.contains(document.activeElement)) content.focus();
}

function ModalChrome({ title, description, children, footer, footerNote }: Omit<ModalProps, "open" | "onOpenChange" | "wide">) {
  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className={styles.description}>{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</Dialog.Description>
          )}
        </div>
        <Dialog.Close asChild>
          <IconButton label="Close" size="sm">
            <X aria-hidden="true" />
          </IconButton>
        </Dialog.Close>
      </div>
      <div className={styles.body}>{children}</div>
      {(footer || footerNote) && (
        <div className={styles.footer}>
          {footerNote && <div className={styles.footerStart}>{footerNote}</div>}
          {footer}
        </div>
      )}
    </>
  );
}

export function Modal({ open, onOpenChange, wide, ...chrome }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content className={cx(styles.dialog, wide && styles.wide)} onOpenAutoFocus={focusDialog}>
          <ModalChrome {...chrome} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A right-hand panel for tasks that need room: running an operation, editing a draft. */
export function Sheet({ open, onOpenChange, wide, ...chrome }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content className={cx(styles.sheet, wide && styles.sheetWide)} onOpenAutoFocus={focusDialog}>
          <ModalChrome {...chrome} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ─── Confirm ─── */

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** The button that closes the dialog without acting. */
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  busy,
  disabled,
  onConfirm,
  children,
}: ConfirmProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.scrim} />
        <AlertDialog.Content className={styles.dialog}>
          <div className={styles.header}>
            <div className={styles.headerText}>
              <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
              <AlertDialog.Description className={styles.description}>{description}</AlertDialog.Description>
            </div>
          </div>
          {children && <div className={styles.body}>{children}</div>}
          <div className={styles.footer}>
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? "danger" : "primary"}
              loading={busy}
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/* ─── Menu ─── */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={styles.menu} align={align} sideOffset={6} collisionPadding={12}>
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
  disabled,
  shortcut,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <DropdownMenu.Item
      className={cx(styles.menuItem, danger && styles.menuItemDanger)}
      onSelect={onSelect}
      disabled={disabled}
    >
      {icon}
      {children}
      {shortcut && <span className={styles.menuShortcut}>{shortcut}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className={cx(styles.menuLabel, "placard")}>{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={styles.menuSeparator} />;
}

/* ─── Tooltip & Popover ─── */

export const TooltipProvider = RadixTooltip.Provider;

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className={styles.tooltip} side={side} sideOffset={6} collisionPadding={12}>
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export function Popover({
  trigger,
  children,
  align = "start",
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  label: string;
}) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content className={styles.popover} align={align} sideOffset={8} collisionPadding={12} aria-label={label}>
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
