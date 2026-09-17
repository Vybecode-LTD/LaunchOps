import { useId, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Switch as RadixSwitch } from "radix-ui";
import { cx } from "./Button";
import styles from "./Field.module.css";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error, with ids wired for assistive tech. */
export function Field({ label, hint, error, optional, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}> (optional)</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <div id={hintId} className={styles.error} role="alert">
          {error}
        </div>
      ) : hint ? (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function Input({ className, mono, ...rest }: ComponentProps<"input"> & { mono?: boolean }) {
  return <input className={cx(styles.control, mono && styles.mono, className)} {...rest} />;
}

export function Textarea({ className, mono, ...rest }: ComponentProps<"textarea"> & { mono?: boolean }) {
  return <textarea className={cx(styles.control, mono && styles.mono, className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cx(styles.control, styles.select, className)} {...rest} />;
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function FieldStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.stack, className)}>{children}</div>;
}

/** A styled checkbox without a visible label; give it an aria-label or an associated <label>. */
export function CheckboxInput({ className, ...rest }: Omit<ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cx(styles.checkbox, className)} {...rest} />;
}

export function Checkbox({ label, className, ...rest }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cx(styles.checkboxRow, className)}>
      <input type="checkbox" className={styles.checkbox} {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** A switch with a visible, associated label and optional description. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  spread = false,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Put the switch at the far end of the row. */
  spread?: boolean;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const control = (
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} describedBy={descriptionId} />
  );
  return (
    <div className={cx(styles.switchField, spread && styles.switchFieldSpread)}>
      {!spread && control}
      <div className={styles.switchLabel}>
        {/* The label names the switch; the description is announced separately. */}
        <label htmlFor={id}>{label}</label>
        {description && (
          <span id={descriptionId} className={styles.hint}>
            {description}
          </span>
        )}
      </div>
      {spread && control}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
  describedBy,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name when there's no visible <label for>. */
  label?: string;
  disabled?: boolean;
  id?: string;
  describedBy?: string;
}) {
  return (
    <RadixSwitch.Root
      id={id}
      className={styles.switch}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
    >
      <RadixSwitch.Thumb className={styles.thumb} />
    </RadixSwitch.Root>
  );
}

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  "aria-describedby"?: string;
}

/** Type and press Enter or comma to add. Backspace on empty input removes the last tag. */
export function TagInput({ id, value, onChange, placeholder, ...aria }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.includes(s));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className={styles.tags}>
      {value.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button
            type="button"
            className={styles.tagRemove}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        className={styles.tagInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        {...aria}
      />
    </div>
  );
}
