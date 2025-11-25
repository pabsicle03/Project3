// menu.js
document.addEventListener("DOMContentLoaded", initMenu);

let MENU_CACHE = null;

async function initMenu() {

  const root = document.getElementById("menuRoot") ||
               document.querySelector(".drink-items-grid");
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

    // Render:
    if (document.getElementById("menuRoot")) {
      const container = document.getElementById("menuRoot");
      container.innerHTML = "";
      const grid = document.createElement("div");
      grid.className = "drink-items-grid";
      container.appendChild(grid);

      const allDrinks = Object.values(MENU_CACHE.series).flat();
      appendDrinks(grid, allDrinks);
    } else {
      const drinks = getDrinksForSeries(PAGE_SERIES, MENU_CACHE.series);
      appendDrinks(root, drinks);
    }
  } catch (err) {
    console.error(err);
    const target = document.getElementById("menuRoot") || document.querySelector(".drink-items-grid");
    if (target) {
      target.innerHTML = `<p style="padding:1rem;color:#b00;">
        Failed to load menu from <code>http://localhost:3000/api/menu</code>. Is the backend running?
      </p>`;
    }
  }
}

/** Series detection with a simple filename → series map **/
function detectSeriesFromUrl() {
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  const base = file.replace(/\.html?$/i, "");

  // Map page filenames to the exact series keys your backend returns
  const SERIES_MAP = {
    "/Customer/custnoncaf":   "Non-Caffeinated Series",
    "/Customr/custiceblend": "Ice Blended Series",
    "/Customer/custmatcha":   "Matcha Series",
    "/Customer/custfruity":   "Fruit Tea Series",
    "/Customer/custfreshbrew":"Fresh Brew Series",
    "/Customer/custmilky":    "Milky Series",

    // Treat these as "ALL" pages:
    "/Customer/customerallmenu": null,
    "index":           null,
    "all":             null
  };

  // If filename isn’t in the map, default to ALL
  return Object.prototype.hasOwnProperty.call(SERIES_MAP, base)
    ? SERIES_MAP[base]
    : null;
}

function getDrinksForSeries(seriesName, seriesObj) {
  if (!seriesName) {
    // ALL: flatten everything (used only if you link to an ALL page without #menuRoot)
    return Object.values(seriesObj).flat();
  }
  return Array.isArray(seriesObj[seriesName]) ? seriesObj[seriesName] : [];
}

/** Helpers**/
function appendDrinks(gridEl, drinks) {
  if (!Array.isArray(drinks) || drinks.length === 0) {
    gridEl.innerHTML = `<p class="empty">No drinks available.</p>`;
    return;
  }

  const fr = document.createDocumentFragment();

  drinks.forEach(d => {
    const price = toNumber(d.drink_price);
    const oos = isFinite(+d.qty_remaining) && +d.qty_remaining <= 0;
    const name = d.drink_name || "Unnamed";
    const img = d.file_name ? `/Images/${d.file_name}` : `/Images/placeholder.png`;

    const tile = document.createElement("div");
    tile.className = "drink-item";
    tile.dataset.name = name;
    tile.dataset.price = String(price);
    tile.dataset.imageUrl = img;

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

    // CLICK → open modal (no navigation)
    tile.addEventListener("click", (e) => {
      if (tile.classList.contains("disabled")) return;

      e.preventDefault();
      e.stopPropagation();

      const drink = {
        id: name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        name,
        basePrice: price
      };

      if (typeof window.openMenuCustomizationModal === "function") {
        window.openMenuCustomizationModal(drink);
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

// === Popup for drink customization (shared across all menu pages) ===
(function () {
  const TOPPING_PRICE = 0.75; // match your drinkcustom.js pricing

  document.addEventListener('DOMContentLoaded', () => {
    // 1) Inject modal + overlay if missing
    if (!document.getElementById('customizeModal')) {
      const modal = document.createElement('div');
      modal.id = 'customizeModal';
      modal.className = 'customization-popup';
      modal.style.cssText = 'display:none; position:fixed; inset:0; margin:auto; z-index:1000;';

      modal.innerHTML = `
        <div class="customization-section">
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

        <div class="popup-footer" style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="cancelCustomize" class="confirm-button" aria-label="Cancel" title="Cancel">✕</button>
          <button id="confirmCustomize" class="confirm-button" aria-label="Confirm Selection" title="Add to Cart">✓</button>
        </div>
      `;

      const dim = document.createElement('div');
      dim.id = 'modalDim';
      dim.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:999;';

      document.body.appendChild(dim);
      document.body.appendChild(modal);
    }

    let activeDrink = null;
    const modal = document.getElementById('customizeModal');
    const dim = document.getElementById('modalDim');

    const openModal = (drink) => {
      activeDrink = drink;

      // Reset defaults each open
      (document.getElementById('ice-regular') || {}).checked = true;
      (document.getElementById('sweet-normal') || {}).checked = true;
      document.querySelectorAll('input[name="toppings"]').forEach(cb => (cb.checked = false));

      modal.style.display = 'block';
      dim.style.display = 'block';
    };

    const closeModal = () => {
      modal.style.display = 'none';
      dim.style.display = 'none';
      activeDrink = null;
    };

    document.getElementById('cancelCustomize').addEventListener('click', closeModal);
    dim.addEventListener('click', closeModal);

    // Expose the opener globally so tiles can call it directly
    window.openMenuCustomizationModal = openModal;

    // Confirm → add to cart (matches cart.js schema)
    document.getElementById('confirmCustomize').addEventListener('click', () => {
      if (!activeDrink) return;

      const iceVal = document.querySelector('input[name="ice-level"]:checked')?.value || 'regular';
      const sweetVal = document.querySelector('input[name="sweet-level"]:checked')?.value || '100%';
      const toppings = Array.from(document.querySelectorAll('input[name="toppings"]:checked')).map(cb => cb.value);

      const toppingsCost = toppings.length * TOPPING_PRICE;
      const lineTotal = +(activeDrink.basePrice + toppingsCost).toFixed(2);

      const lineItem = {
        id: activeDrink.id,
        name: activeDrink.name,
        basePrice: activeDrink.basePrice,
        iceLevel: iceVal,
        sweetness: sweetVal,
        toppings,
        toppingsCost,
        lineTotal,
        qty: 1
      };

      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      cart.push(lineItem);
      localStorage.setItem('cart', JSON.stringify(cart));

      closeModal();
      alert('Added to cart!');
    });
  });
})();