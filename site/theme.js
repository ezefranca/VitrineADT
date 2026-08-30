(() => {
  const storageKey = "vitrineadt-theme";
  const root = document.documentElement;

  function systemTheme() {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function storedTheme() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function applyTheme(theme, persist = false) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = nextTheme === "dark" ? "#141416" : "#f5f5f7";
    if (persist) {
      try {
        localStorage.setItem(storageKey, nextTheme);
      } catch {
        // A preferência temporária continua funcionando sem localStorage.
      }
    }

    const button = document.querySelector(".theme-toggle");
    if (!button) return;
    const nextLabel = nextTheme === "dark" ? "Usar tema claro" : "Usar tema escuro";
    button.setAttribute("aria-label", nextLabel);
    button.title = nextLabel;
    button.setAttribute("aria-pressed", String(nextTheme === "dark"));
    const icon = button.querySelector(".theme-toggle-icon");
    const label = button.querySelector(".theme-toggle-label");
    if (icon) icon.textContent = nextTheme === "dark" ? "☀" : "☾";
    if (label) label.textContent = nextTheme === "dark" ? "Claro" : "Escuro";
  }

  applyTheme(storedTheme() ?? systemTheme());

  function setup() {
    const button = document.querySelector(".theme-toggle");
    if (!button || button.dataset.ready) return;
    button.dataset.ready = "true";
    button.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
    applyTheme(root.dataset.theme);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
