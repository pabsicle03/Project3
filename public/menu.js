// menu.js - Combined version with categories, favorites, temperature, and tea type
document.addEventListener("DOMContentLoaded", initMenu);

let MENU_CACHE = null;
const TOPPING_PRICE = 0.75;
let activeDrink = null;

// Mapping series names to category slugs for filtering
const SERIES_TO_CATEGORY = {
  "Non-Caffeinated Series": "noncaf",
  "Ice Blended Series": "iceblend",
  "Matcha Series": "matcha",
  "Fruit Tea Series": "fruity",
  "Fresh Brew Series": "freshbrew",
  "Milky Series": "milky"
};

async function initMenu() {
  const root = document.getElementById("menuRoot") || document.querySelector(".drink-items-grid");
  if (!root) return;

  const PAGE_SERIES = detectSeriesFromUrl();
  if (!document.getElementById("menuRoot") && root.classList.contains("drink-items-grid")) {
    root.innerHTML = "";
  }

  try {
    const res = await fetch("/api/menu");
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data?.ok || !data.series || typeof data.series !== "object") {
      throw new Error("Bad /api/menu response");
    }

    MENU_CACHE = data;

    const fileName = location.pathname.split("/").pop().toLowerCase();
    
    if (fileName === "recommendation.html") {
      await renderWeatherRecommendation(root);
      return;
    }

    if (document.getElementById("menuRoot")) {
      const container = document.getElementById("menuRoot");
      container.innerHTML = "";
      const grid = document.createElement("div");
      grid.className = "drink-items-grid";
      container.appendChild(grid);
      
      // Render ALL drinks with their categories
      Object.entries(MENU_CACHE.series).forEach(([seriesName, drinks]) => {
        const category = SERIES_TO_CATEGORY[seriesName] || "other";
        appendDrinks(grid, drinks, category);
      });
    } else {
      const seriesName = PAGE_SERIES;
      const category = seriesName ? SERIES_TO_CATEGORY[seriesName] : null;
      appendDrinks(root, getDrinksForSeries(PAGE_SERIES, MENU_CACHE.series), category);
    }
  } catch (err) {
    console.error(err);
    const target = document.getElementById("menuRoot") || document.querySelector(".drink-items-grid");
    if (target) {
      target.innerHTML = `<p style="padding:1rem;color:#b00;">Failed to load menu from <code>http://localhost:3000/api/menu</code>. Is the backend running?</p>`;
    }
  }
}

/* ------------------ Weather Recommendation ------------------ */
async function renderWeatherRecommendation(root) {
  root.innerHTML = `<p style="padding:10px;">Loading recommendation...</p>`;

  let attempts = 0;
  while (!window.weatherData && attempts < 20) { 
    await new Promise(res => setTimeout(res, 200)); 
    attempts++; 
  }

  if (!MENU_CACHE?.series) { 
    root.innerHTML = "<p>Menu unavailable.</p>"; 
    return; 
  }

  const weather = window.weatherData;
  root.innerHTML = "";

  // Recommendation text
  const msg = document.createElement("p");
  msg.className = "weather-recommendation-text";
  msg.style.fontWeight = "bold";
  msg.style.padding = "10px 0";
  
  let recommendedSeries = [];
  
  if (!weather) {
    msg.textContent = "Weather data unavailable. Showing all drinks 🍹";
    recommendedSeries = Object.entries(MENU_CACHE.series);
  } else if (weather.main.temp >= 85) {
    msg.textContent = "It's hot today! Try Ice Blended or Fruity 🌞";
    recommendedSeries = [
      ["Ice Blended Series", MENU_CACHE.series["Ice Blended Series"] || []],
      ["Fruit Tea Series", MENU_CACHE.series["Fruit Tea Series"] || []]
    ];
  } else if (weather.main.temp <= 55) {
    msg.textContent = "Chilly! Milky or Fresh Brew ❄️";
    recommendedSeries = [
      ["Milky Series", MENU_CACHE.series["Milky Series"] || []],
      ["Fresh Brew Series", MENU_CACHE.series["Fresh Brew Series"] || []]
    ];
  } else if (weather.weather[0].main.toLowerCase().includes("rain") || 
             weather.weather[0].main.toLowerCase().includes("storm")) {
    msg.textContent = "Rainy day! Matcha or Milky 🌧️";
    recommendedSeries = [
      ["Matcha Series", MENU_CACHE.series["Matcha Series"] || []],
      ["Milky Series", MENU_CACHE.series["Milky Series"] || []]
    ];
  } else {
    msg.textContent = "Perfect weather for any drink! 🍹";
    recommendedSeries = Object.entries(MENU_CACHE.series);
  }

  root.appendChild(msg);

  const hr = document.createElement("hr");
  hr.style.border = "1px solid #ccc";
  root.appendChild(hr);

  // Drink tiles with categories
  recommendedSeries.forEach(([seriesName, drinks]) => {
    const category = SERIES_TO_CATEGORY[seriesName] || "recommendation";
    appendDrinks(root, drinks, category);
  });
}

/* ------------------ Drink Helpers ------------------ */
function detectSeriesFromUrl() {
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  const base = file.replace(/\.html?$/i, "");

  const SERIES_MAP = {
    custnoncaf:    "Non-Caffeinated Series",
    custiceblend:  "Ice Blended Series",
    custmatcha:    "Matcha Series",
    custfruity:    "Fruit Tea Series",
    custfreshbrew: "Fresh Brew Series",
    custmilky:     "Milky Series",
    customerallmenu: null,
    index:           null,
    all:             null
  };

  return Object.prototype.hasOwnProperty.call(SERIES_MAP, base)
    ? SERIES_MAP[base]
    : null;
}

function getDrinksForSeries(seriesName, seriesObj) {
  if (!seriesName) {
    return Object.values(seriesObj).flat();
  }
  return Array.isArray(seriesObj[seriesName]) ? seriesObj[seriesName] : [];
}

function appendDrinks(gridEl, drinks, category = null) {
  if (!Array.isArray(drinks) || drinks.length === 0) {
    if (!gridEl.querySelector('.drink-item')) {
      gridEl.innerHTML = `<p class="empty">No drinks available.</p>`;
    }
    return;
  }

  const fr = document.createDocumentFragment();

  drinks.forEach(d => {
    const price = toNumber(d.drink_price);
    const oos = isFinite(+d.qty_remaining) && +d.qty_remaining <= 0;
    const name = d.drink_name || "Unnamed";
    const img = d.file_name ? `/Images/${d.file_name}` : `/Images/placeholder.png`;
    
    // Get hot_option and tea_options from drink data
    const hotOption = d.hot_option === true || d.hot_option === 't';
    const teaOptions = d.tea_options === true || d.tea_options === 't';

    // Determine category
    let drinkCategory = category;
    if (!drinkCategory && d.series_name) {
      drinkCategory = SERIES_TO_CATEGORY[d.series_name] || null;
    }

    const tile = document.createElement("div");
    tile.className = "drink-item";
    tile.dataset.name = name;
    tile.dataset.price = String(price);
    tile.dataset.imageUrl = img;
    
    // Add hot_option and tea_options as data attributes
    tile.dataset.hotOption = String(hotOption);
    tile.dataset.teaOptions = String(teaOptions);

    // Add category attribute
    if (drinkCategory) {
      tile.dataset.category = drinkCategory;
    }

    if (oos) tile.classList.add("disabled");

    tile.innerHTML = `
      <div class="drink-image-wrapper">
        <img src="${escapeAttr(img)}" alt="${escapeAttr(name)}" loading="lazy">
        ${oos ? `<div class="oos-badge">Out of stock</div>` : ``}
      </div>
      <div class="drink-name">${escapeHtml(name)}</div>
      <div class="drink-price">$${price.toFixed(2)}</div>
    `;

    const imgEl = tile.querySelector("img");
    imgEl.addEventListener("error", () => { imgEl.src = "Images/placeholder.png"; });

    // Pre-build drink object with hot_option and tea_options
    const drink = {
      id: name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
      name,
      basePrice: price,
      hot_option: hotOption,
      tea_options: teaOptions
    };

    let lastTapTime = 0;

    tile.addEventListener("click", (e) => {
      if (tile.classList.contains("disabled")) return;

      const now = Date.now();

      if (now - lastTapTime < 1000) {
        e.preventDefault();
        e.stopPropagation();
        lastTapTime = 0;

        if (typeof window.openMenuCustomizationModal === "function") {
          window.openMenuCustomizationModal(drink);
        }
      } else {
        lastTapTime = now;
      }
    });

    fr.appendChild(tile);
  });

  gridEl.appendChild(fr);
}

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(String(s)).replaceAll("`", "&#96;");
}

/* ------------------ Modal with Favorites, Temperature, and Tea Type ------------------ */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    // Inject modal + overlay if missing
    if (!document.getElementById('customizeModal')) {
      const modal = document.createElement('div');
      modal.id = 'customizeModal';
      modal.className = 'customization-popup';
      modal.style.cssText = 'display:none; position:fixed; inset:0; margin:auto; z-index:1000; max-height:80vh; overflow-y:auto;';

      modal.innerHTML = `
        <!-- ICE SECTION -->
        <div class="customization-section" id="modal-iceSection">
          <h2 class="section-title">Ice Level:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="ice-regular" name="ice-level" value="regular" checked>
            <label for="ice-regular">Regular</label>
            <input type="radio" id="ice-less" name="ice-level" value="less">
            <label for="ice-less">Less</label>
            <input type="radio" id="ice-none" name="ice-level" value="none">
            <label for="ice-none">None</label>
          </div>
        </div>

        <!-- SWEETNESS SECTION -->
        <div class="customization-section">
          <h2 class="section-title">Sweetness Level:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="sweet-normal" name="sweet-level" value="100%" checked>
            <label for="sweet-normal">Normal <span>100%</span></label>
            <input type="radio" id="sweet-80" name="sweet-level" value="80%">
            <label for="sweet-80">Less <span>80%</span></label>
            <input type="radio" id="sweet-50" name="sweet-level" value="50%">
            <label for="sweet-50">Half <span>50%</span></label>
            <input type="radio" id="sweet-30" name="sweet-level" value="30%">
            <label for="sweet-30">Light <span>30%</span></label>
            <input type="radio" id="sweet-0" name="sweet-level" value="0%">
            <label for="sweet-0">No Sugar <span>0%</span></label>
          </div>
        </div>

        <!-- TEMPERATURE SECTION -->
        <div class="customization-section" id="modal-tempSection">
          <h2 class="section-title">Temperature:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="temp-iced" name="temperature" value="iced" checked>
            <label for="temp-iced">Iced</label>
            <div id="modal-hotOption" style="display: inline-block;">
              <input type="radio" id="temp-hot" name="temperature" value="hot">
              <label for="temp-hot">Hot</label>
            </div>
          </div>
        </div>

        <!-- SIZE SECTION -->
        <div class="customization-section" id="modal-sizeSection">
          <h2 class="section-title">Size:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="size-small" name="drink-size" value="small" checked>
            <label for="size-small">Small</label>

            <input type="radio" id="size-medium" name="drink-size" value="medium">
            <label for="size-medium">Medium (+$0.20)</label>

            <input type="radio" id="size-large" name="drink-size" value="large">
            <label for="size-large">Large (+$0.40)</label>
          </div>
        </div>

        <!-- TEA TYPE SECTION -->
        <div class="customization-section" id="modal-teaSection">
          <h2 class="section-title">Tea Type:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="tea-black" name="tea-type" value="black" checked>
            <label for="tea-black">Black Tea</label>
            <input type="radio" id="tea-green" name="tea-type" value="green">
            <label for="tea-green">Green Tea</label>
            <input type="radio" id="tea-oolong" name="tea-type" value="oolong">
            <label for="tea-oolong">Oolong Tea</label>
          </div>
        </div>

        <!-- TOPPINGS -->
        <div class="customization-section">
          <h2 class="section-title">Toppings:</h2>
          <div class="options-group toppings-grid">
            <input type="checkbox" id="topping-pearls" name="toppings" value="pearls"><label for="topping-pearls">Pearls (Boba)</label>
            <input type="checkbox" id="topping-lychee" name="toppings" value="lychee"><label for="topping-lychee">Lychee Jelly</label>
            <input type="checkbox" id="topping-coffee" name="toppings" value="coffee"><label for="topping-coffee">Coffee Jelly</label>
            <input type="checkbox" id="topping-honey" name="toppings" value="honey"><label for="topping-honey">Honey Jelly</label>
            <input type="checkbox" id="topping-pudding" name="toppings" value="pudding"><label for="topping-pudding">Pudding</label>
            <input type="checkbox" id="topping-crystal" name="toppings" value="crystal"><label for="topping-crystal">Crystal Boba</label>
            <input type="checkbox" id="topping-icecream" name="toppings" value="icecream"><label for="topping-icecream">Ice Cream</label>
            <input type="checkbox" id="topping-creama" name="toppings" value="creama"><label for="topping-creama">Creama</label>
            <input type="checkbox" id="topping-mango" name="toppings" value="mango"><label for="topping-mango">Mango Pop Boba</label>
            <input type="checkbox" id="topping-strawberry" name="toppings" value="strawberry"><label for="topping-strawberry">Strawberry Pop Boba</label>
          </div>
        </div>

        <!-- FAVORITE TOGGLE BUTTON -->
        <div style="margin-top:10px;">
          <button id="toggleFavoriteBtn" class="favorite-btn">Save to Favorites</button>
          <div id="favoriteLabelDisplay"></div>
        </div>

        <div class="popup-footer" style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="cancelCustomize" class="confirm-button">✕</button>
          <button id="confirmCustomize" class="confirm-button">✓</button>
        </div>
      `;

      const dim = document.createElement('div');
      dim.id = 'modalDim';
      dim.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:999;';

      document.body.appendChild(dim);
      document.body.appendChild(modal);
    }

    // Favorite toggle state
    let isFavorited = false;
    let label = "";

    const favBtn = document.getElementById("toggleFavoriteBtn");
    if (favBtn && window.isGuestUser && window.isGuestUser()) {
      favBtn.style.display = "none";
    }

    // Favorite toggle button handler
    document.addEventListener("click", async (e) => {
      if (e.target.id !== "toggleFavoriteBtn") return;

      const btn = e.target;

      // Read current customization values
      const iceLevel = document.querySelector('input[name="ice-level"]:checked')?.value || "regular";
      const sweetness = document.querySelector('input[name="sweet-level"]:checked')?.value || "100%";
      const toppings = Array.from(
        document.querySelectorAll('input[name="toppings"]:checked')
      ).map(cb => cb.value);

      const drinkConfig = {
        name: activeDrink.name,
        iceLevel,
        sweetness,
        toppings
      };

      if (window.isFavoriteAlready && await window.isFavoriteAlready(drinkConfig)) {
        alert("This drink is already in your favorites.");
        return;
      }

      // Turning favorite OFF
      if (isFavorited) {
        isFavorited = false;
        label = "";
        btn.classList.remove("active");
        btn.textContent = "Save to Favorites";
        const labelDisplay = document.getElementById("favoriteLabelDisplay");
        if (labelDisplay) labelDisplay.textContent = "";
        return;
      }

      // Turning favorite ON — show naming popup
      const dimEl = document.getElementById("favoriteNameDim");
      const popupEl = document.getElementById("favoriteNamePopup");

      if (window.isGuestUser && window.isGuestUser()) {
        if (popupEl) popupEl.style.display = "none";
        if (dimEl) dimEl.style.display = "none";
        return;
      }

      if (dimEl) dimEl.style.display = "block";
      if (popupEl) popupEl.style.display = "block";

      const nameInputEl = document.getElementById("favoriteNameInput");

      // Auto-fill + auto-highlight
      if (activeDrink && nameInputEl) {
        setTimeout(() => {
          nameInputEl.value = activeDrink.name || "";
          nameInputEl.focus();
          nameInputEl.select();
        }, 0);
      }

      // When user confirms the name
      const confirmBtn = document.getElementById("favoriteNameConfirm");
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          if (!nameInputEl) return;

          const nameInput = nameInputEl.value.trim();
          if (!nameInput) {
            alert("Please enter a name.");
            return;
          }

          label = nameInput;
          isFavorited = true;

          btn.classList.add("active");
          btn.textContent = "Favorited";

          const labelDisplay = document.getElementById("favoriteLabelDisplay");
          if (labelDisplay) {
            labelDisplay.textContent = `Saved as: ${label}`;
          }

          if (dimEl) dimEl.style.display = "none";
          if (popupEl) popupEl.style.display = "none";
          nameInputEl.value = "";
        };
      }
    });

    const modal = document.getElementById('customizeModal');
    const dim = document.getElementById('modalDim');

    const openModal = (drink) => {
      activeDrink = drink;

      // Reset defaults
      (document.getElementById('ice-regular') || {}).checked = true;
      (document.getElementById('sweet-normal') || {}).checked = true;
      (document.getElementById('temp-iced') || {}).checked = true;
      (document.getElementById('tea-black') || {}).checked = true;
      document.querySelectorAll('input[name="toppings"]').forEach(cb => (cb.checked = false));

      // Show/hide Temperature and Tea sections based on drink capabilities
      const hotAllowed = drink.hot_option === true;
      const teaAllowed = drink.tea_options === true;

      const tempSection = document.getElementById('modal-tempSection');
      const teaSection = document.getElementById('modal-teaSection');
      const hotOption = document.getElementById('modal-hotOption');

      if (!hotAllowed && hotOption) {
        hotOption.style.display = 'none';
      } else if (hotOption) {
        hotOption.style.display = 'inline-block';
      }

      if (!teaAllowed && teaSection) {
        teaSection.style.display = 'none';
      } else if (teaSection) {
        teaSection.style.display = '';
      }

      // Hide ice if hot selected
      const tempRadios = document.querySelectorAll('input[name="temperature"]');
      const iceSection = document.getElementById('modal-iceSection');
      
      // Remove old listeners and add new ones
      tempRadios.forEach(radio => {
        const newRadio = radio.cloneNode(true);
        radio.parentNode.replaceChild(newRadio, radio);
      });

      document.querySelectorAll('input[name="temperature"]').forEach(radio => {
        radio.addEventListener('change', () => {
          if (document.getElementById('temp-hot')?.checked) {
            iceSection.style.display = 'none';
          } else {
            iceSection.style.display = '';
          }
        });
      });

      // Reset favorite state
      isFavorited = false;
      label = "";
      const favBtn = document.getElementById("toggleFavoriteBtn");
      if (favBtn) {
        favBtn.classList.remove("active");
        favBtn.textContent = "Save to Favorites";
      }
      const labelDisplay = document.getElementById("favoriteLabelDisplay");
      if (labelDisplay) labelDisplay.textContent = "";

      modal.style.display = 'block';
      dim.style.display = 'block';
    };

    const closeModal = () => {
      modal.style.display = 'none';
      dim.style.display = 'none';
      
      // Reset ice section visibility
      const iceSection = document.getElementById('modal-iceSection');
      if (iceSection) {
        iceSection.style.display = '';
      }
      
      // Reset temperature to iced
      const tempIced = document.getElementById('temp-iced');
      if (tempIced) {
        tempIced.checked = true;
      }
      
      activeDrink = null;
      isFavorited = false;
      label = "";
    };

    document.getElementById('cancelCustomize').addEventListener('click', closeModal);
    dim.addEventListener('click', closeModal);

    // Expose globally
    window.openMenuCustomizationModal = openModal;

    // Confirm → add to cart
    // Confirm → add to cart
    document.getElementById('confirmCustomize').addEventListener('click', () => {
      if (!activeDrink) return;

      const temperature = document.querySelector('input[name="temperature"]:checked')?.value || 'iced';
      
      let iceVal = 'regular';
      if (temperature !== 'hot') {
        iceVal = document.querySelector('input[name="ice-level"]:checked')?.value || 'regular';
      }

      const sweetVal = document.querySelector('input[name="sweet-level"]:checked')?.value || '100%';
      
      let teaType = null;
      if (activeDrink.tea_options === true) {
        teaType = document.querySelector('input[name="tea-type"]:checked')?.value || 'black';
      }

            const toppings = Array.from(
        document.querySelectorAll('input[name="toppings"]:checked')
      ).map(cb => cb.value);

      const toppingsCost = toppings.length * TOPPING_PRICE;

      // 🔹 SIZE LOGIC
      const sizeRadio = document.querySelector('input[name="drink-size"]:checked');
      const size = sizeRadio ? sizeRadio.value : "small";

      let sizeUpcharge = 0;
      if (size === "medium") sizeUpcharge = 0.20;
      else if (size === "large") sizeUpcharge = 0.40;

      const finalBasePrice = Number(
        (activeDrink.basePrice + sizeUpcharge).toFixed(2)
      );
      const lineTotal = +(finalBasePrice + toppingsCost).toFixed(2);

      const lineItem = {
        id: activeDrink.id,
        name: activeDrink.name,
        size,                    // store size separately
        basePrice: finalBasePrice,
        temperature,
        iceLevel: iceVal,
        sweetness: sweetVal,
        teaType,              // ← captured here
        hot_option: activeDrink.hot_option === true,
        tea_options: activeDrink.tea_options === true,
        toppings,
        toppingsCost,
        lineTotal,
        qty: 1
      };


      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      cart.push(lineItem);
      localStorage.setItem('cart', JSON.stringify(cart));

      // Save favorite if toggled
      if (!window.isGuestUser || !window.isGuestUser()) {
        if (isFavorited && window.saveFavorite) {
          const favoritePayload = {
            name: activeDrink.name,
            basePrice: activeDrink.basePrice,
            iceLevel: iceVal,
            sweetness: sweetVal,
            temperature: temperature,    // ← USE THE VARIABLE
            teaType: teaType,           // ← USE THE VARIABLE
            toppings,
            toppingsCost,
            label: label
          };
          window.saveFavorite(favoritePayload, "customize-modal");
        }
      }

      // Reset favorite state
      isFavorited = false;
      label = "";

      closeModal();
      alert('Added to cart!');

      // Update cart badge if function exists
      if (typeof updateCartBadge === 'function') updateCartBadge();

      // Refresh for recommendation page
      if (location.pathname.split("/").pop().toLowerCase() === "recommendation.html") {
        renderWeatherRecommendation(document.getElementById("menuRoot"));
      }
    });
  });
})();