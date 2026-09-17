// Apply the saved theme before first paint so there is no flash.
// A file rather than an inline script, so the Content Security Policy can forbid inline scripts.
try {
  var theme = localStorage.getItem("launchops_theme");
  if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
} catch (e) {
  // Storage can be unavailable (private windows, blocked site data); the default theme applies.
}
