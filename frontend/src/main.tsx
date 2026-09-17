import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/mona-sans/standard.css";
import "@fontsource-variable/jetbrains-mono";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/print.css";
import { App } from "./app/App";

// public/theme-init.js applies the saved theme before first paint; repeat it here for
// environments that don't run it (the desktop app serves its own document).
try {
  const saved = localStorage.getItem("launchops_theme");
  if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
} catch {
  /* storage unavailable: follow the system theme */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
