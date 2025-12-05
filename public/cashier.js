export let cart = [];

/**
 * Cart item shape:
 * {
 *   name,
 *   basePrice,
 *   qty,
 *   iceLevel,
 *   sweetness,
 *   toppings (array),
 *   toppingsCost
 * }
 */

/* ---------------- SessionStorage Helpers ---------------- */
function saveCart() {
  try {
    sessionStorage.setItem("cashierCart", JSON.stringify(cart));
  } catch (e) {
    console.error("Failed to save cart:", e);
  }
}

function loadCart() {
  try {
    const raw = sessionStorage.getItem("cashierCart");
    if (raw) cart = JSON.parse(raw) || [];
  } catch (e) {
    console.error("Failed to load cart:", e);
  }
}

function pageSeriesFromPath() {
  const p = window.location.pathname.toLowerCase();

  if (p.endsWith("cashierall.html") || p.endsWith("cashierall")) return "all";
  if (p.endsWith("cashiernoncaf.html")) return "Non-Caffeinated Series";
  if (p.endsWith("cashier_matcha.html")) return "Matcha Series";
  if (p.endsWith("cashier_iceblend.html")) return "Ice Blended Series";
  if (p.endsWith("cashier_fruity.html")) return "Fruit Tea Series";
  if (p.endsWith("cashier_freshbrew.html")) return "Fresh Brew Series";
  if (p.endsWith("cashier_milky.html")) return "Milky Series";
  return "all";
}

async function fetchDrinks(series) {
  try {
    const url =
      series === "all"
        ? "/api/drinks"
        : `/api/drinks?series=${encodeURIComponent(series)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load drinks (${res.status})`);
    const json = await res.json();
    return json.drinks ?? json;
  } catch (err) {
    console.error("fetchDrinks:", err);
    return [];
  }
}

function createToast(text) {
  let toast = document.createElement("div");
  toast.className = "cashier-toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => toast.classList.remove("show"), 1700);
  setTimeout(() => toast.remove(), 2100);
}

// ❗ NEW: Payment popup helpers
let paymentOverlay = null;
let paymentNameInput = null;
let paymentMethodSelect = null;
let paymentResolve = null;

function ensurePaymentModal() {
  if (paymentOverlay) return;

  paymentOverlay = document.createElement("div");
  paymentOverlay.className = "payment-overlay";
  paymentOverlay.innerHTML = `
    <div class="payment-modal">
      <h2>Payment Details</h2>
      <label for="paymentCustomerName">Customer Name</label>
      <input type="text" id="paymentCustomerName" placeholder="Enter customer name">

      <label for="paymentMethod">Payment Method</label>
      <select id="paymentMethod">
        <option value="cash">Cash</option>
        <option value="card">Card</option>
      </select>

      <div class="payment-actions">
        <button type="button" id="paymentCancel">Cancel</button>
        <button type="button" id="paymentOk">Submit</button>
      </div>
    </div>
  `;

  document.body.appendChild(paymentOverlay);

  paymentNameInput = paymentOverlay.querySelector("#paymentCustomerName");
  paymentMethodSelect = paymentOverlay.querySelector("#paymentMethod");

  const cancelBtn = paymentOverlay.querySelector("#paymentCancel");
  const okBtn = paymentOverlay.querySelector("#paymentOk");

  cancelBtn.addEventListener("click", () => {
    closePaymentModal();
    if (paymentResolve) paymentResolve(null);
  });

  paymentOverlay.addEventListener("click", (e) => {
    if (e.target === paymentOverlay) {
      closePaymentModal();
      if (paymentResolve) paymentResolve(null);
    }
  });

  okBtn.addEventListener("click", () => {
    const name = paymentNameInput.value.trim();
    const method = paymentMethodSelect.value;

    if (!name) {
      alert("Please enter a customer name.");
      return;
    }

    closePaymentModal();
    if (paymentResolve) paymentResolve({ customerName: name, paymentMethod: method });
  });
}

function openPaymentModal() {
  ensurePaymentModal();
  return new Promise((resolve) => {
    paymentResolve = resolve;
    paymentOverlay.style.display = "flex";
    paymentNameInput.value = "";
    paymentMethodSelect.value = "cash";
    paymentNameInput.focus();
  });
}

function closePaymentModal() {
  if (paymentOverlay) {
    paymentOverlay.style.display = "none";
  }
}

// ❗ always add as a separate cart line, no merging by name
function addToCart(drink) {
  cart.push({
    name: drink.name,
    basePrice: drink.basePrice ?? drink.price ?? 0,
    qty: drink.qty ?? 1,
    iceLevel: drink.iceLevel ?? "Regular",
    sweetness: drink.sweetness ?? "Regular",
    toppings: drink.toppings ?? [],
    toppingsCost: drink.toppingsCost ?? 0,
  });

  saveCart();
  refreshCartUI();
  createToast(`${drink.name} added to cart`);
}

// ❗ Change to index-based removal
function removeCartItem(index) {
  if (index < 0 || index >= cart.length) return;
  cart.splice(index, 1);
  saveCart();
  refreshCartUI();
}

// ❗ Change to index-based qty change
function changeQty(index, delta) {
  const item = cart[index];
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) {
    cart.splice(index, 1);
  }
  saveCart();
  refreshCartUI();
}

function buildCartPanel() {
  if (document.querySelector(".cashier-cart-panel")) return;

  const panel = document.createElement("aside");
  panel.className = "cashier-cart-panel";

  panel.innerHTML = `
    <div class="cart-head">
      <h2>Cart</h2>
      <button class="cart-clear">Clear</button>
    </div>

    <ul class="cart-list"></ul>

    <div class="cart-footer">
      <div class="cart-total">Total: $0.00</div>
      <div class="cart-actions">
        <button class="cart-submit">Submit Order</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  panel.querySelector(".cart-clear").addEventListener("click", () => {
    if (!cart.length) return;
    if (!confirm("Clear cart?")) return;
    cart = [];
    saveCart();
    refreshCartUI();
  });

  panel.querySelector(".cart-submit").addEventListener("click", submitCart);

  refreshCartUI();
}

function refreshCartUI() {
  const list = document.querySelector(".cart-list");
  if (!list) return;

  list.innerHTML = "";
  let total = 0;

  for (let index = 0; index < cart.length; index++) {
    const it = cart[index];

    const li = document.createElement("li");
    li.className = "cart-item";

    const lineTotal = (it.basePrice + (it.toppingsCost || 0)) * it.qty;
    total += lineTotal;

    const ice = it.iceLevel ?? "Regular";
    const sweet = it.sweetness ?? "Regular";
    const toppingsText =
      it.toppings?.length ? it.toppings.join(", ") : "No toppings";

    li.innerHTML = `
      <div class="cart-item-left">
        <div class="cart-item-name">${escapeHtml(it.name)}</div>

        <div class="cart-item-meta">
          <div class="cart-line">
            $${(it.basePrice + (it.toppingsCost || 0)).toFixed(2)} × ${
      it.qty
    } = $${lineTotal.toFixed(2)}
          </div>

          <div class="cart-customization">
            Ice: ${escapeHtml(ice)}<br>
            Sweetness: ${escapeHtml(sweet)}<br>
            Toppings: ${escapeHtml(toppingsText)}
          </div>
        </div>
      </div>

      <div class="cart-item-actions">
        <button class="edit-btn">Edit</button>
        <button class="qty-btn dec">−</button>
        <button class="qty-btn inc">+</button>
        <button class="remove-btn">✕</button>
      </div>
    `;

    const editBtn = li.querySelector(".edit-btn");
    editBtn.addEventListener("click", () => {
      if (typeof window.openEditDrinkModal === "function") {
        window.openEditDrinkModal(it);
      }
    });

    li.querySelector(".dec").addEventListener("click", () =>
      changeQty(index, -1)
    );
    li.querySelector(".inc").addEventListener("click", () =>
      changeQty(index, +1)
    );
    li.querySelector(".remove-btn").addEventListener("click", () =>
      removeCartItem(index)
    );

    list.appendChild(li);
  }

  const totalEl = document.querySelector(".cart-total");
  if (totalEl) totalEl.textContent = `Total: $${total.toFixed(2)}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

async function getEmployeeName() {
  const id = localStorage.getItem("userId");
  if (!id || id === "0") return "Guest";

  const res = await fetch(`/api/employee/${id}`);
  const data = await res.json();
  return data.ok ? data.name : "Unknown";
}

async function submitCart() {
  if (!cart.length) {
    alert("Cart is empty!");
    return;
  }

  // 🔹 Open payment popup
  const paymentDetails = await openPaymentModal();
  if (!paymentDetails) {
    // user cancelled popup
    return;
  }
  const { customerName, paymentMethod } = paymentDetails;

  const orders = cart.map((it) => ({
    name: it.name,
    iceLevel: it.iceLevel,
    sweetness: it.sweetness,
    toppings: it.toppings,
    basePrice: it.basePrice,
    toppingsCost: it.toppingsCost || 0,
  }));

  const employeeName = await getEmployeeName();

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders,
        employee_name: employeeName,
        customer_name: customerName,
        payment_method: paymentMethod,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Error: ${res.status} ${msg}`);
    }

    await res.json();
    createToast("Order submitted!");
    cart = [];
    saveCart();
    refreshCartUI();
  } catch (err) {
    console.error(err);
    alert("Failed to submit order: " + err.message);
  }
}

// Build drink ID (for popup system)
function buildDrinkId(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// Load drinks onto screen
export async function loadDrinks(series) {
  const grid = document.querySelector(".drink-grid");
  if (!grid) return;

  grid.innerHTML = "";
  const drinks = await fetchDrinks(series);

  drinks.forEach((d) => {
    const card = document.createElement("div");
    card.className = "drink-card";

    const basePrice = Number(d.price ?? 0);

    card.innerHTML = `
      <div class="drink-inner">
        <div class="drink-name">${escapeHtml(d.name)}</div>
        <div class="drink-price">$${basePrice.toFixed(2)}</div>
        <button class="add-to-cart">Add to Cart</button>
      </div>
    `;

    const addBtn = card.querySelector(".add-to-cart");

    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (typeof window.openMenuCustomizationModal === "function") {
        window.openMenuCustomizationModal({
          id: buildDrinkId(d.name),
          name: d.name,
          basePrice,
        });
      } else {
        addToCart({ name: d.name, price: basePrice });
      }
    });

    grid.appendChild(card);
  });
}

// ======================= POPUP / EDIT LOGIC =======================
(function () {
  const TOPPING_PRICE = 0.75;

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("customizeModal")) {
      const modal = document.createElement("div");
      modal.id = "customizeModal";
      modal.className = "customization-popup";
      modal.style.cssText =
        "display:none;position:fixed;inset:0;margin:auto;z-index:1000;";

      modal.innerHTML = `
        <div class="customization-section">
          <h2 class="section-title">Ice Level:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="ice-regular" name="ice-level" value="Regular" checked>
            <label for="ice-regular">Regular</label>
            <input type="radio" id="ice-less" name="ice-level" value="Less">
            <label for="ice-less">Less</label>
            <input type="radio" id="ice-none" name="ice-level" value="None">
            <label for="ice-none">None</label>
          </div>
        </div>

        <div class="customization-section">
          <h2 class="section-title">Sweetness Level:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="sweet-normal" name="sweet-level" value="100%" checked>
            <label for="sweet-normal">Normal 100%</label>
            <input type="radio" id="sweet-80" name="sweet-level" value="80%">
            <label for="sweet-80">Less 80%</label>
            <input type="radio" id="sweet-50" name="sweet-level" value="50%">
            <label for="sweet-50">Half 50%</label>
            <input type="radio" id="sweet-30" name="sweet-level" value="30%">
            <label for="sweet-30">Light 30%</label>
            <input type="radio" id="sweet-0" name="sweet-level" value="0%">
            <label for="sweet-0">No Sugar</label>
          </div>
        </div>

        <div class="customization-section">
          <h2 class="section-title">Toppings:</h2>
          <div class="options-group toppings-grid">
            <input type="checkbox" id="topping-pearls" value="Pearls (Boba)"><label for="topping-pearls">Pearls (Boba)</label>
            <input type="checkbox" id="topping-lychee" value="Lychee Jelly"><label for="topping-lychee">Lychee Jelly</label>
            <input type="checkbox" id="topping-coffee" value="Coffee Jelly"><label for="topping-coffee">Coffee Jelly</label>
            <input type="checkbox" id="topping-honey" value="Honey Jelly"><label for="topping-honey">Honey Jelly</label>
            <input type="checkbox" id="topping-pudding" value="Pudding"><label for="topping-pudding">Pudding</label>
            <input type="checkbox" id="topping-crystal" value="Crystal Boba"><label for="topping-crystal">Crystal Boba</label>
            <input type="checkbox" id="topping-icecream" value="Ice Cream"><label for="topping-icecream">Ice Cream</label>
            <input type="checkbox" id="topping-creama" value="Creama"><label for="topping-creama">Creama</label>
            <input type="checkbox" id="topping-mango" value="Mango Pop Boba"><label for="topping-mango">Mango Pop Boba</label>
            <input type="checkbox" id="topping-strawberry" value="Strawberry Pop Boba"><label for="topping-strawberry">Strawberry Pop Boba</label>
          </div>
        </div>

        <div class="popup-footer">
          <button id="cancelCustomize" class="confirm-button">✕</button>
          <button id="confirmCustomize" class="confirm-button">✓</button>
        </div>
      `;

      const dim = document.createElement("div");
      dim.id = "modalDim";
      dim.style.cssText =
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999;";

      document.body.appendChild(dim);
      document.body.appendChild(modal);
    }

    let activeMode = "add"; // "add" or "edit"
    let activeDrink = null; // used in add mode
    let activeCartItem = null; // used in edit mode

    const modal = document.getElementById("customizeModal");
    const dim = document.getElementById("modalDim");

    function resetPopupSelections() {
      const iceRegular = document.getElementById("ice-regular");
      const sweetNormal = document.getElementById("sweet-normal");
      if (iceRegular) iceRegular.checked = true;
      if (sweetNormal) sweetNormal.checked = true;

      document
        .querySelectorAll('input[type="checkbox"][id^="topping-"]')
        .forEach((cb) => {
          cb.checked = false;
        });
    }

    function applyCartItemToPopup(item) {
      // Ice
      if (item.iceLevel) {
        const id =
          item.iceLevel === "Less"
            ? "ice-less"
            : item.iceLevel === "None"
            ? "ice-none"
            : "ice-regular";
        const radio = document.getElementById(id);
        if (radio) radio.checked = true;
      }

      // Sweetness
      if (item.sweetness) {
        const id =
          item.sweetness === "80%"
            ? "sweet-80"
            : item.sweetness === "50%"
            ? "sweet-50"
            : item.sweetness === "30%"
            ? "sweet-30"
            : item.sweetness === "0%"
            ? "sweet-0"
            : "sweet-normal";
        const radio = document.getElementById(id);
        if (radio) radio.checked = true;
      }

      // Toppings
      if (Array.isArray(item.toppings)) {
        document
          .querySelectorAll('input[type="checkbox"][id^="topping-"]')
          .forEach((cb) => {
            cb.checked = item.toppings.includes(cb.value);
          });
      }
    }

    const openModalForAdd = (drink) => {
      activeMode = "add";
      activeDrink = drink;
      activeCartItem = null;

      resetPopupSelections();

      modal.style.display = "block";
      dim.style.display = "block";
    };

    const openModalForEdit = (cartItem) => {
      activeMode = "edit";
      activeCartItem = cartItem;
      activeDrink = {
        name: cartItem.name,
        basePrice: cartItem.basePrice,
      };

      resetPopupSelections();
      applyCartItemToPopup(cartItem);

      modal.style.display = "block";
      dim.style.display = "block";
    };

    const closeModal = () => {
      modal.style.display = "none";
      dim.style.display = "none";
      activeDrink = null;
      activeCartItem = null;
      activeMode = "add";
    };

    document.getElementById("cancelCustomize").onclick = closeModal;
    dim.onclick = closeModal;

    // Global hooks used elsewhere
    window.openMenuCustomizationModal = openModalForAdd;
    window.openEditDrinkModal = openModalForEdit;

    document.getElementById("confirmCustomize").onclick = () => {
      if (!activeDrink) return;

      const ice = document.querySelector('input[name="ice-level"]:checked')
        ?.value;
      const sweet = document.querySelector('input[name="sweet-level"]:checked')
        ?.value;

      const toppings = Array.from(
        document.querySelectorAll(
          'input[type="checkbox"][id^="topping-"]:checked'
        )
      ).map((cb) => cb.value);

      const toppingsCost = toppings.length * TOPPING_PRICE;

      if (activeMode === "edit" && activeCartItem) {
        activeCartItem.iceLevel = ice;
        activeCartItem.sweetness = sweet;
        activeCartItem.toppings = toppings;
        activeCartItem.toppingsCost = toppingsCost;
        saveCart();
        refreshCartUI();
      } else {
        addToCart({
          name: activeDrink.name,
          basePrice: activeDrink.basePrice,
          iceLevel: ice,
          sweetness: sweet,
          toppings,
          toppingsCost,
          qty: 1,
        });
      }

      closeModal();
    };
  });
})();

// Initialize cashier page
async function init() {
  loadCart();
  buildCartPanel();
  const series = pageSeriesFromPath();
  await loadDrinks(series);
  refreshCartUI();
}

document.addEventListener("DOMContentLoaded", init);
