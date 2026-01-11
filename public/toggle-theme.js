// @ts-nocheck
function getPreferTheme() {
  const storedTheme = localStorage.getItem("theme");

  if (storedTheme === "system" || !storedTheme) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return storedTheme;
}

function getThemeMode() {
  return localStorage.getItem("theme") || "system";
}

let themeMode = getThemeMode();
let themeValue = getPreferTheme();

// Expose to global scope for Header.astro dropdown
// @ts-ignore - Adding custom properties to window
window.themeMode = themeMode;
// @ts-ignore
window.themeValue = themeValue;

function setPreference() {
  localStorage.setItem("theme", themeMode);
  themeValue = getPreferTheme();
  // @ts-ignore
  window.themeMode = themeMode;
  // @ts-ignore
  window.themeValue = themeValue;
  reflectPreference();
}

function reflectPreference() {
  // Update themeValue from window if it was changed externally
  // @ts-ignore
  themeMode = window.themeMode || themeMode;
  // @ts-ignore
  themeValue = window.themeValue || themeValue;

  // Set data-theme to the user's choice (system/light/dark)
  document.firstElementChild.setAttribute("data-theme", themeMode);
  // Set data-theme-resolved to the actual theme that should be applied (light/dark)
  document.firstElementChild.setAttribute("data-theme-resolved", themeValue);

  document.querySelector("#theme-btn")?.setAttribute("aria-label", themeMode);

  const body = document.body;

  if (body) {
    const computedStyles = window.getComputedStyle(body);
    const bgColor = computedStyles.backgroundColor;

    document
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  }
}

// Expose to global scope for Header.astro dropdown
// @ts-ignore
window.reflectPreference = reflectPreference;

reflectPreference();

window.onload = () => {
  function setThemeFeature() {
    reflectPreference();
    // Theme button click is now handled by Header.astro dropdown
  }

  setThemeFeature();

  document.addEventListener("astro:after-swap", setThemeFeature);
};

document.addEventListener("astro:before-swap", event => {
  const bgColor = document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute("content");

  event.newDocument
    .querySelector("meta[name='theme-color']")
    ?.setAttribute("content", bgColor);
});

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (themeMode === "system") {
      themeValue = getPreferTheme();
      reflectPreference();
    }
  });
