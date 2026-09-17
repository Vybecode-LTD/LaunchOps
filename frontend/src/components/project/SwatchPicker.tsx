import { Check } from "lucide-react";
import { SWATCHES, swatchColor } from "@/lib/domain/projects";
import styles from "./Project.module.css";

export function SwatchPicker({ id, value, onChange }: { id?: string; value: string; onChange: (color: string) => void }) {
  const current = swatchColor(value);
  return (
    <div id={id} className={styles.swatchPicker} role="radiogroup" aria-label="Project color">
      {SWATCHES.map((swatch) => {
        const selected = swatch.value === current;
        return (
          <button
            key={swatch.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={swatch.name}
            title={swatch.name}
            className={styles.swatchOption}
            style={{ background: swatch.value }}
            onClick={() => onChange(swatch.value)}
          >
            {selected && <Check size={14} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
