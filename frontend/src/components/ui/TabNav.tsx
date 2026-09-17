import type { ReactNode } from "react";
import { NavLink } from "react-router";
import styles from "./Display.module.css";

export interface TabNavItem {
  to: string;
  label: string;
  end?: boolean;
  badge?: ReactNode;
}

export function TabNav({ items, label }: { items: TabNavItem[]; label: string }) {
  return (
    <nav className={styles.tabnav} aria-label={label}>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={styles.tab}>
          {item.label}
          {/* Keeps the label and badge as separate words for assistive tech ("Reports 1 of 5"). */}
          {item.badge != null && " "}
          {item.badge}
        </NavLink>
      ))}
    </nav>
  );
}
