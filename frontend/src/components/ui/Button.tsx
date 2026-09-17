import type { ComponentProps, ReactNode } from "react";
import { Slot } from "radix-ui";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
  /** Render the child element (e.g. a router Link) with button styling. */
  asChild?: boolean;
}

export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  full = false,
  asChild = false,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const classes = cx(styles.button, styles[variant], size !== "md" && styles[size], full && styles.full, className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...rest}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, "icon" | "children"> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, variant = "ghost", size = "md", className, children, ...rest }: IconButtonProps) {
  return (
    <Button variant={variant} size={size} className={cx(styles.icon, className)} aria-label={label} title={label} {...rest}>
      {children}
    </Button>
  );
}
