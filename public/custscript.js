// GLOBAL DUPLICATE FAVORITE CHECK
window.isFavoriteAlready = async function (drinkConfig) {
  const customer = localStorage.getItem("customerName");
  if (!customer) return false;

  const res = await fetch(`/api/favorites/${encodeURIComponent(customer)}`);
  const data = await res.json();
  if (!data.ok) return false;

  const configString = JSON.stringify({
    drink_name: drinkConfig.name,
    ice_level: drinkConfig.iceLevel,
    sweetness_level: drinkConfig.sweetness,
    topping_used: (drinkConfig.toppings || []).join(", ")
  });

  return data.favorites.some(fav => {
    const favString = JSON.stringify({
      drink_name: fav.drink_name,
      ice_level: fav.ice_level,
      sweetness_level: fav.sweetness_level,
      topping_used: fav.topping_used
    });
    return favString === configString;
  });
};

window.isGuestUser = function () {
    const name = localStorage.getItem("customerName");
    return !name || name.trim() === "";
};



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
// CART BADGE (GLOBAL)
// =============================
function updateCartBadge() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");

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

// =============================
// CATEGORY FILTERING (NEW!)
// =============================
let currentCategory = 'all';

function showWeatherMessage(text) {
  // Remove existing message if any
  const existingMsg = document.querySelector('.weather-recommendation-banner');
  if (existingMsg) existingMsg.remove();

  // Create new message banner
  const banner = document.createElement('div');
  banner.className = 'weather-recommendation-banner';
  banner.style.cssText = `
    background: #f0f8ff;
    border: 2px solid #4a90e2;
    border-radius: 8px;
    padding: 15px 20px;
    margin: 0 0 20px 0;
    font-weight: bold;
    font-size: 1.1em;
    text-align: center;
    color: #2c5aa0;
  `;
  banner.textContent = text;

  // Insert at the top of the grid
  const grid = document.querySelector('.drink-items-grid');
  if (grid) {
    grid.insertBefore(banner, grid.firstChild);
  }
}

function hideWeatherMessage() {
  console.log("hideWeatherMessage called");
  const existingMsg = document.querySelector('.weather-recommendation-banner');
  console.log("Found banner:", existingMsg);
  if (existingMsg) {
    existingMsg.remove();
    console.log("Banner removed");
  }
}

function filterDrinksByCategory(category) {
  currentCategory = category;
  
  const grid = document.querySelector(".drink-items-grid");
  if (!grid) return;

  // Special handling for recommendation category
  if (category === 'recommendation') {
    filterByWeatherRecommendation(grid);
    return;
  }

  // Hide weather message for non-recommendation categories
  hideWeatherMessage();

  const allDrinks = grid.querySelectorAll(".drink-item");
  
  allDrinks.forEach(drink => {
    const drinkCategory = (drink.dataset.category || '').toLowerCase();
    const categoryLower = category.toLowerCase();
    
    if (categoryLower === 'all' || drinkCategory === categoryLower) {
      drink.style.display = '';
    } else {
      drink.style.display = 'none';
    }
  });

  // Update active button state
  document.querySelectorAll('.nav-button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.category === category) {
      btn.classList.add('active');
    }
  });

  // Save current category to sessionStorage
  try {
    sessionStorage.setItem('currentCategory', category);
  } catch (e) {}
}

function filterByWeatherRecommendation(grid) {
  const weather = window.weatherData;
  const allDrinks = grid.querySelectorAll(".drink-item");
  
  let recommendedCategories = [];
  let messageText = "";
  
  if (!weather) {
    // No weather data, show all
    recommendedCategories = ['all'];
    messageText = "Weather data unavailable. Showing all drinks 🍹";
  } else if (weather.main.temp >= 85) {
    // Hot weather
    recommendedCategories = ['iceblend', 'fruity'];
    messageText = "It's hot today! Try Ice Blended or Fruity 🌞";
  } else if (weather.main.temp <= 55) {
    // Cold weather
    recommendedCategories = ['milky', 'freshbrew'];
    messageText = "Chilly! Milky or Fresh Brew ❄️";
  } else if (weather.weather?.[0]?.main?.toLowerCase().includes('rain') || 
             weather.weather?.[0]?.main?.toLowerCase().includes('storm')) {
    // Rainy weather
    recommendedCategories = ['matcha', 'milky'];
    messageText = "Rainy day! Matcha or Milky 🌧️";
  } else {
    // Normal weather, show all
    recommendedCategories = ['all'];
    messageText = "Perfect weather for any drink! 🍹";
  }
  
  // Show/hide drinks
  allDrinks.forEach(drink => {
    const drinkCategory = (drink.dataset.category || '').toLowerCase();
    
    if (recommendedCategories.includes('all') || 
        recommendedCategories.includes(drinkCategory)) {
      drink.style.display = '';
    } else {
      drink.style.display = 'none';
    }
  });

  // Display weather message
  showWeatherMessage(messageText);

  // Update active button state
  document.querySelectorAll('.nav-button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.category === 'recommendation') {
      btn.classList.add('active');
    }
  });

  // Save current category
  try {
    sessionStorage.setItem('currentCategory', 'recommendation');
  } catch (e) {}
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

  // NEW: Category navigation buttons
  const navButtons = document.querySelectorAll(".nav-button[data-category]");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const category = btn.dataset.category;
      filterDrinksByCategory(category);
    });
  });

  // Restore saved category on page load
  try {
    const savedCategory = sessionStorage.getItem('currentCategory');
    if (savedCategory) {
      filterDrinksByCategory(savedCategory);
    }
  } catch (e) {}

  // Hide Previous Orders + Favorites for guest users
  const historyBtn = document.getElementById("viewHistoryBtn");
  const favoritesBtn = document.getElementById("viewFavoritesBtn");
  const savedName = localStorage.getItem("customerName");

  if (historyBtn && (!savedName || savedName.trim() === "")) {
    historyBtn.style.display = "none";
  }
  if (favoritesBtn && (!savedName || savedName.trim() === "")) {
    favoritesBtn.style.display = "none";
  }
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
// CART BADGE (GLOBAL)
// =============================
function updateCartBadge() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");

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
// CART ICON ONLY
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const cartIcon = document.querySelector(".cart-icon");
  if (cartIcon) {
    cartIcon.addEventListener("click", () => {
      window.location.href = "cart.html";
    });
  }

  updateCartBadge();
});

// ============================================================
//  ORDER HISTORY + QUICK REORDER LOGIC
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("viewHistoryBtn");
  if (!btn) return;

  const modal = document.getElementById("orderHistoryModal");
  const dim = document.getElementById("historyDim");
  const list = document.getElementById("historyList");

  btn.addEventListener("click", async () => {
    const customerName = localStorage.getItem("customerName");
    if (!customerName) {
      alert("No customer name found.");
      return;
    }

    const res = await fetch(`/api/history/${customerName}`);
    const data = await res.json();

    if (!data.ok) {
      alert("Failed to load history.");
      return;
    }

    list.innerHTML = data.history
    .map((r) => {
      const toppings = r.topping_used ? r.topping_used.split(", ") : [];
      const total = Number(r.drink_price) + Number(r.topping_price);

      // Build customization display
      let customizationText = `Ice: ${r.ice_level} | Sweetness: ${r.sweetness_level}`;
      
      if (r.temperature) {
        customizationText += ` | Temperature: ${r.temperature}`;
      }
      
      if (r.tea_type) {
        customizationText += ` | Tea: ${r.tea_type}`;
      }
      
      customizationText += `<br>Toppings: ${toppings.length ? toppings.join(", ") : "None"}`;

      return `
        <div class="history-entry">
          <p><b>${r.drink_name}</b> — $${total.toFixed(2)}</p>
          <p>${customizationText}</p>
          <button class="reorder-btn" 
            data-row='${JSON.stringify(r).replace(/'/g, "&apos;")}'>
            Reorder
          </button>
          <hr>
        </div>
      `;
    })
    .join("");

    modal.style.display = "block";
    dim.style.display = "block";
  });

  document.getElementById("closeHistoryModal").onclick = () => {
    modal.style.display = "none";
    dim.style.display = "none";
  };

  dim.onclick = () => {
    modal.style.display = "none";
    dim.style.display = "none";
  };

  //Quick reorder
  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("reorder-btn")) return;

    const row = JSON.parse(e.target.dataset.row);

    const toppings = row.topping_used ? row.topping_used.split(", ") : [];

    const drinkObj = {
      id: row.drink_name.toLowerCase().replace(/\s+/g, "_"),
      name: row.drink_name,
      basePrice: Number(row.drink_price),
      iceLevel: row.ice_level,
      sweetness: row.sweetness_level,
      temperature: row.temperature || "iced",
      teaType: row.tea_type || null,
      toppings,
      toppingsCost: Number(row.topping_price),
      lineTotal: Number(row.drink_price) + Number(row.topping_price),
      qty: 1,
    };

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    cart.push(drinkObj);
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartBadge();

    alert("Added to cart!");
  });
});

// ============================================================
//  FAVORITES: SAVE HELPER (GLOBAL)
// ============================================================
async function saveFavorite(drinkConfig, source) {
  try {
    const customerName = localStorage.getItem("customerName");
    if (!customerName) {
      alert("Please enter your name on the start page before saving favorites.");
      return;
    }

    const payload = {
      customer_name: customerName,
      drink_name: drinkConfig.name,
      ice_level: drinkConfig.iceLevel || "regular",
      sweetness_level: drinkConfig.sweetness || "100%",
      temperature: drinkConfig.temperature || "iced",
      tea_type: drinkConfig.teaType || null,
      topping_used: (drinkConfig.toppings || []).join(", "),
      drink_price: Number(drinkConfig.basePrice ?? drinkConfig.unitPrice ?? 0),
      topping_price: Number(drinkConfig.toppingsCost || 0),
      label: drinkConfig.label || null,
      source: source || "unknown",
    };

    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Failed to save favorite.");
    }

    alert("Saved to favorites!");
  } catch (err) {
    console.error(err);
    alert("Sorry, we couldn't save this favorite. Please try again.");
  }
}

// Make available to menu.js + cart.js
window.saveFavorite = saveFavorite;

// ============================================================
//  FAVORITES MODAL + QUICK ADD-TO-CART
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("viewFavoritesBtn");
  if (!btn) return;

  const modal = document.getElementById("favoritesModal");
  const dim = document.getElementById("favoritesDim");
  const list = document.getElementById("favoritesList");

  btn.addEventListener("click", async () => {
    const customerName = localStorage.getItem("customerName");
    if (!customerName) {
      alert("No customer name found.");
      return;
    }

    try {
      const res = await fetch(`/api/favorites/${encodeURIComponent(customerName)}`);
      const data = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to load favorites.");
      }

      const favs = data.favorites || [];

      if (!favs.length) {
        list.innerHTML = "<p>You don't have any favorites yet.</p>";
      } else {
        list.innerHTML = favs
        .map((r) => {
          const toppings = r.topping_used ? r.topping_used.split(", ") : [];
          const total = Number(r.drink_price) + Number(r.topping_price || 0);

          // Display label if present
          const displayLabel =
            r.label && r.label.trim() ? r.label.trim() : r.drink_name;

          // Build customization display
          let customizationText = `Ice: ${r.ice_level} | Sweetness: ${r.sweetness_level}`;
          
          if (r.temperature) {
            customizationText += ` | Temperature: ${r.temperature}`;
          }
          
          if (r.tea_type) {
            customizationText += ` | Tea: ${r.tea_type}`;
          }
          
          customizationText += `<br>Toppings: ${toppings.length ? toppings.join(", ") : "None"}`;

          return `
            <div class="history-entry">
              <p><b>${displayLabel}</b> — ${r.drink_name} — $${total.toFixed(2)}</p>
              <p>${customizationText}</p>

              <button class="reorder-btn favorite-reorder-btn"
                data-row='${JSON.stringify(r).replace(/'/g, "&apos;")}'>
                Add to Cart
              </button>

              <button class="reorder-btn remove-favorite-btn"
                style="background:#555;"
                data-favorite-id="${r.id}">
                Remove Favorite
              </button>

              <hr>
            </div>
          `;
        })
        .join("");
      }

      modal.style.display = "block";
      dim.style.display = "block";
    } catch (err) {
      console.error(err);
      alert("Failed to load favorites.");
    }
  });

  const closeBtn = document.getElementById("closeFavoritesModal");
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
      dim.style.display = "none";
    };
  }

  if (dim) {
    dim.onclick = () => {
      modal.style.display = "none";
      dim.style.display = "none";
    };
  }

  // Delegate for "Add to Cart" buttons in favorites modal
  // Delegate for "Add to Cart" buttons in favorites modal
  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("favorite-reorder-btn")) return;

    const row = JSON.parse(e.target.dataset.row);

    const toppings = row.topping_used ? row.topping_used.split(", ") : [];

    const drinkObj = {
      id: row.drink_name.toLowerCase().replace(/\s+/g, "_"),
      name: row.drink_name,
      basePrice: Number(row.drink_price),
      iceLevel: row.ice_level,
      sweetness: row.sweetness_level,
      temperature: row.temperature || "iced",
      teaType: row.tea_type || null,
      toppings,
      toppingsCost: Number(row.topping_price || 0),
      lineTotal: Number(row.drink_price) + Number(row.topping_price || 0),
      qty: 1,
    };

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    cart.push(drinkObj);
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartBadge();

    alert("Favorite added to cart!");
  });

   // Remove Favorite
    document.addEventListener("click", async (e) => {
      if (!e.target.classList.contains("remove-favorite-btn")) return;

      const favId = e.target.dataset.favoriteId;
      if (!favId) return;

      if (!confirm("Remove this favorite?")) return;

      try {
        const res = await fetch(`/api/favorites/${favId}`, {
          method: "DELETE"
        });
        const data = await res.json();

        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "Failed to delete favorite.");
        }

        alert("Favorite removed.");
        // Refresh modal
        document.getElementById("viewFavoritesBtn").click();
      } catch (err) {
        console.error(err);
        alert("Could not remove favorite.");
      }
    });
});
