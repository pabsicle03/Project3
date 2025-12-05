// =============================
// Accessibility dropdown toggle
// =============================
function toggleDropdown() {
  document.getElementById("accessibilityDropdown")?.classList.toggle("show");
}

// =============================
// Clear accessibility prefs
// =============================
function clearAccessibilityPrefs() {
  try {
    localStorage.removeItem("textSize");
    localStorage.removeItem("language");
    localStorage.removeItem("highContrast");
  } catch (e) {}

  const html = document.documentElement;
  const body = document.body;

  html.classList.remove("text-small", "text-large");
  body.classList.remove("text-small", "text-large", "high-contrast");

  const combo = document.querySelector(".goog-te-combo");
  if (combo && combo.value !== "en") {
    combo.value = "en";
    combo.dispatchEvent(new Event("change"));
  }
}

function resetAccessibilityAndGo(e, url) {
  if (e) e.preventDefault();
  clearAccessibilityPrefs();
  window.location.href = url;
}

// =============================
// Text size helpers
// =============================
function applyTextSize(size) {
  const html = document.documentElement;
  const body = document.body;

  html.classList.remove("text-small", "text-large");
  body.classList.remove("text-small", "text-large");

  if (size === "small") {
    html.classList.add("text-small");
    body.classList.add("text-small");
  } else if (size === "large") {
    html.classList.add("text-large");
    body.classList.add("text-large");
  }
}

function changeTextSize(size) {
  try {
    localStorage.setItem("textSize", size);
  } catch (e) {}
  applyTextSize(size);
}

// =============================
// Smooth nav between categories
// =============================
function navigateSmoothly(url) {
  const grid = document.querySelector(".drink-items-grid");
  if (!grid) {
    window.location.href = url;
    return;
  }

  grid.style.transition = "opacity 0.3s";
  grid.style.opacity = 0;

  setTimeout(() => {
    window.location.href = url;
  }, 300);
}

// =============================
// Language helpers
// =============================
function setLanguage(langCode) {
  const combo = document.querySelector(".goog-te-combo");
  if (!combo) {
    console.warn("Translate combo not ready, retrying...");
    return setTimeout(() => setLanguage(langCode), 300);
  }
  if (combo.value !== langCode) {
    combo.value = langCode;
    combo.dispatchEvent(new Event("change"));
  }
}

function applySavedLanguage() {
  const savedLang = localStorage.getItem("language");
  if (!savedLang || savedLang === "en") return;

  function tryApply() {
    const combo = document.querySelector(".goog-te-combo");
    if (combo) {
      setLanguage(savedLang);
    } else {
      setTimeout(tryApply, 500);
    }
  }
  tryApply();
}

// =============================
// Accessibility + nav setup
// =============================
document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("load", () => {
    setTimeout(() => {
      applySavedLanguage();
    }, 700);
  });

  const savedHighContrast = localStorage.getItem("highContrast");
  if (savedHighContrast === "true") {
    document.body.classList.add("high-contrast");
  }

  const langOptions = document.querySelectorAll(".lang-option");
  langOptions.forEach((option) => {
    option.addEventListener("click", (e) => {
      e.preventDefault();
      const lang = option.getAttribute("data-lang");

      localStorage.setItem("language", lang);

      if (lang === "en" || lang === "es") {
        setLanguage(lang);
      }

      toggleDropdown();
    });
  });

  const sizeOptions = document.querySelectorAll(".size-option");
  sizeOptions.forEach((option) => {
    option.addEventListener("click", (e) => {
      e.preventDefault();
      const size = option.getAttribute("data-size");
      changeTextSize(size);
      toggleDropdown();
    });
  });

  const saved = localStorage.getItem("textSize");
  if (saved === "large" || saved === "small") {
    applyTextSize(saved);
  }

  const contrastToggle = document.getElementById("contrastToggle");
  if (contrastToggle) {
    contrastToggle.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.toggle("high-contrast");
      const isHighContrast = document.body.classList.contains("high-contrast");
      localStorage.setItem("highContrast", isHighContrast);
      toggleDropdown();
    });
  }

  const navButtons = document.querySelectorAll(".nav-button a");
  navButtons.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const url = link.getAttribute("href");
      navigateSmoothly(url);
    });
  });
});

// =============================
// Close dropdown when clicking outside
// =============================
window.addEventListener("click", (event) => {
  const isButton = event.target.closest(".accessibility-btn");
  const isDropdown = event.target.closest("#accessibilityDropdown");

  if (!isButton && !isDropdown) {
    const dropdowns = document.getElementsByClassName("dropdown-content");
    for (let i = 0; i < dropdowns.length; i++) {
      const openDropdown = dropdowns[i];
      if (openDropdown.classList.contains("show")) {
        openDropdown.classList.remove("show");
      }
    }
  }
});

// =============================
// CART BADGE (GLOBAL) — UPDATED VERSION
// =============================
function updateCartBadge() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");

  // Sum total quantities
  let totalQty = 0;
  cart.forEach((item) => {
    let q = 1;
    if (typeof item.quantity === "number" && item.quantity > 0) {
      q = item.quantity;
    } else if (typeof item.qty === "number" && item.qty > 0) {
      q = item.qty;
    }
    totalQty += q;
  });

  if (totalQty > 0) {
    badge.textContent = totalQty;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

updateCartBadge();
window.addEventListener("pageshow", updateCartBadge);

// =============================
// MENU GRID + CART ICON
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const grid = document.querySelector(".drink-items-grid");
  if (grid) {
    grid.addEventListener("click", (e) => {
      const tile = e.target.closest(".drink-item");
      if (!tile) return;
      if (!tile.dataset.drinkId) return;

      let id = tile.dataset.drinkId || "";
      let name = tile.dataset.name || "";
      let basePrice = tile.dataset.price
        ? parseFloat(tile.dataset.price)
        : NaN;

      if (!name) {
        const nameEl = tile.querySelector(
          ".drink-name, [data-role='drink-name']"
        );
        name = nameEl ? nameEl.textContent.trim() : "Custom Drink";
      }
      if (Number.isNaN(basePrice)) {
        const priceEl = tile.querySelector(
          ".drink-price, [data-role='drink-price']"
        );
        if (priceEl) {
          const m = priceEl.textContent.replace(/[^\d.]/g, "");
          basePrice = m ? parseFloat(m) : 0;
        } else {
          basePrice = 0;
        }
      }
      if (!id) {
        id = name
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "");
      }

      const drink = { id, name, basePrice };

      sessionStorage.setItem("lastMenuUrl", window.location.pathname);
      sessionStorage.setItem("selectedDrink", JSON.stringify(drink));

      window.location.href = "drinkcustomization.html";
    });
  }

  const cartIcon = document.querySelector(".cart-icon");
  if (cartIcon) {
    cartIcon.addEventListener("click", () => {
      window.location.href = "cart.html";
    });
  }

  updateCartBadge();
});
