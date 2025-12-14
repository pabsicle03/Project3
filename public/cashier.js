export let cart = [];

/**
 * Cart item shape:
 * {
 *   name,
 *   basePrice,
 *   qty,
 *   iceLevel,
 *   sweetness,
 *   temperature,
 *   teaType,
 *   toppings (array),
 *   toppingsCost,
 *   hot_option,
 *   tea_options,
 *   size
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

/* ---------------- Category <-> Series mapping (matches DB series_name) ---------------- */
const CATEGORY_TO_SERIES = {
  noncaf: "Non-Caffeinated Series",
  matcha: "Matcha Series",
  iceblend: "Ice Blended Series",
  fruity: "Fruit Tea Series",
  freshbrew: "Fresh Brew Series",
  milky: "Milky Series",
  seasonal: "Seasonal",
};

/* ---------------- Drinks API ---------------- */
async function fetchDrinks(category) {
  try {
    const isAll = !category || category === "all";

    // If category is a short code (noncaf/matcha/etc), map it to the real series name.
    const seriesName = !isAll ? (CATEGORY_TO_SERIES[category] || category) : null;

    const url = isAll
      ? "/api/drinks"
      : `/api/drinks?series=${encodeURIComponent(seriesName)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load drinks (${res.status})`);
    const json = await res.json();
    return json.drinks ?? json;
  } catch (err) {
    console.error("fetchDrinks:", err);
    return [];
  }
}

/* ---------------- Toast ---------------- */
function createToast(text) {
  let toast = document.createElement("div");
  toast.className = "cashier-toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => toast.classList.remove("show"), 1700);
  setTimeout(() => toast.remove(), 2100);
}

/* ---------------- Payment Popup ---------------- */
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
  if (paymentOverlay) paymentOverlay.style.display = "none";
}

/* ---------------- Cart Core ---------------- */
function addToCart(drink) {
  cart.push({
    name: drink.name,
    basePrice: drink.basePrice ?? drink.price ?? 0,
    qty: drink.qty ?? 1,
    iceLevel: drink.iceLevel ?? "Regular",
    sweetness: drink.sweetness ?? "100%",
    temperature: drink.temperature ?? "iced",
    teaType: drink.teaType ?? null,
    toppings: drink.toppings ?? [],
    toppingsCost: drink.toppingsCost ?? 0,
    hot_option: drink.hot_option ?? false,
    tea_options: drink.tea_options ?? false,
    size: drink.size ?? "small",
  });

  saveCart();
  refreshCartUI();
  createToast(`${drink.name} added to cart`);
}

function removeCartItem(index) {
  if (index < 0 || index >= cart.length) return;
  cart.splice(index, 1);
  saveCart();
  refreshCartUI();
}

function changeQty(index, delta) {
  const item = cart[index];
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) cart.splice(index, 1);
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

    const size = it.size ?? "small";
    const ice = it.iceLevel ?? "Regular";
    const sweet = it.sweetness ?? "100%";
    const temp = it.temperature ?? "iced";
    const tea = it.teaType ?? null;
    const toppingsText = it.toppings?.length ? it.toppings.join(", ") : "No toppings";

    let customizationHTML = `
      Size: ${escapeHtml(size)}<br>
      Ice: ${escapeHtml(ice)}<br>
      Sweetness: ${escapeHtml(sweet)}<br>
    `;

    if (temp) customizationHTML += `Temperature: ${escapeHtml(temp)}<br>`;
    if (tea) customizationHTML += `Tea: ${escapeHtml(tea)}<br>`;
    customizationHTML += `Toppings: ${escapeHtml(toppingsText)}`;

    li.innerHTML = `
      <div class="cart-item-left">
        <div class="cart-item-name">${escapeHtml(it.name)}</div>

        <div class="cart-item-meta">
          <div class="cart-line">
            $${(it.basePrice + (it.toppingsCost || 0)).toFixed(2)} × ${it.qty} = $${lineTotal.toFixed(2)}
          </div>

          <div class="cart-customization">
            ${customizationHTML}
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

    li.querySelector(".edit-btn").addEventListener("click", () => {
      if (typeof window.openEditDrinkModal === "function") window.openEditDrinkModal(it);
    });

    li.querySelector(".dec").addEventListener("click", () => changeQty(index, -1));
    li.querySelector(".inc").addEventListener("click", () => changeQty(index, +1));
    li.querySelector(".remove-btn").addEventListener("click", () => removeCartItem(index));

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

/* ---------------- Order Submit ---------------- */
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

  const paymentDetails = await openPaymentModal();
  if (!paymentDetails) return;

  const { customerName, paymentMethod } = paymentDetails;

  const orders = cart.map((it) => ({
    name: it.name,
    size: it.size,
    iceLevel: it.iceLevel,
    sweetness: it.sweetness,
    temperature: it.temperature ?? "iced",
    teaType: it.teaType ?? null,
    toppings: it.toppings,
    basePrice: it.basePrice,
    toppingsCost: it.toppingsCost || 0,
    hot_option: it.hot_option ?? false,
    tea_options: it.tea_options ?? false,
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

/* ---------------- Drinks UI ---------------- */
function buildDrinkId(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export async function loadDrinks(category) {
  const grid = document.querySelector(".drink-grid");
  if (!grid) return;

  grid.innerHTML = "";
  const drinks = await fetchDrinks(category);

  drinks.forEach((d) => {
    const card = document.createElement("div");
    card.className = "drink-card";

    const basePrice = Number(d.price ?? 0);
    const hotOption = d.hotOption === true;
    const teaOptions = d.teaOptions === true;

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
          hot_option: hotOption,
          tea_options: teaOptions,
        });
      } else {
        addToCart({
          name: d.name,
          price: basePrice,
          hot_option: hotOption,
          tea_options: teaOptions,
        });
      }
    });

    grid.appendChild(card);
  });
}

/* ---------------- Search (button + Enter) ---------------- */
function wireCashierSearch() {
  const input = document.getElementById("cashierSearch");
  const btn = document.getElementById("cashierSearchBtn");
  if (!input || !btn) return;

  btn.addEventListener("click", () => applyCashierSearchFilter(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCashierSearchFilter(input.value);
    }
  });
}

function normalizeWords(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function applyCashierSearchFilter(query) {
  const grid = document.querySelector(".drink-grid");
  if (!grid) return;

  const words = normalizeWords(query);
  const cards = grid.querySelectorAll(".drink-card");

  if (words.length === 0) {
    cards.forEach((c) => (c.style.display = ""));
    return;
  }

  cards.forEach((card) => {
    const nameEl = card.querySelector(".drink-name");
    const name = (nameEl?.textContent || "").toLowerCase();
    const match = words.some((w) => name.includes(w));
    card.style.display = match ? "" : "none";
  });
}

/* ---------------- POPUP / EDIT LOGIC ---------------- */
(function () {
  const TOPPING_PRICE = 0.75;

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("customizeModal")) {
      const modal = document.createElement("div");
      modal.id = "customizeModal";
      modal.className = "customization-popup";
      modal.style.cssText =
        "display:none;position:fixed;inset:0;margin:auto;z-index:1000;max-height:80vh;overflow-y:auto;";

      modal.innerHTML = `
        <!-- ICE SECTION -->
        <div class="customization-section" id="cashier-iceSection">
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

        <!-- SWEETNESS SECTION -->
        <div class="customization-section">
          <h2 class="section-title">Sweetness Level:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="sweet-extra" name="sweet-level" value="125%">
            <label for="sweet-extra">Extra 125% (+$0.20)</label>

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

        <!-- TEMPERATURE SECTION -->
        <div class="customization-section" id="cashier-tempSection">
          <h2 class="section-title">Temperature:</h2>
          <div class="options-group" role="radiogroup">
            <input type="radio" id="temp-iced" name="temperature" value="iced" checked>
            <label for="temp-iced">Iced</label>
            <div id="cashier-hotOption" style="display:inline-block;">
              <input type="radio" id="temp-hot" name="temperature" value="hot">
              <label for="temp-hot">Hot</label>
            </div>
          </div>
        </div>

        <!-- SIZE SECTION -->
        <div class="customization-section" id="cashier-sizeSection">
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
        <div class="customization-section" id="cashier-teaSection">
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
    let activeDrink = null;
    let activeCartItem = null;

    const modal = document.getElementById("customizeModal");
    const dim = document.getElementById("modalDim");

    function resetPopupSelections() {
      document.getElementById("ice-regular")?.click();
      document.getElementById("sweet-normal")?.click();
      document.getElementById("temp-iced")?.click();
      document.getElementById("tea-black")?.click();
      document.getElementById("size-small")?.click();

      document
        .querySelectorAll('input[type="checkbox"][id^="topping-"]')
        .forEach((cb) => (cb.checked = false));
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
        document.getElementById(id)?.click();
      }

      // Sweetness (includes 125%)
      if (item.sweetness) {
        const id =
          item.sweetness === "125%"
            ? "sweet-extra"
            : item.sweetness === "80%"
            ? "sweet-80"
            : item.sweetness === "50%"
            ? "sweet-50"
            : item.sweetness === "30%"
            ? "sweet-30"
            : item.sweetness === "0%"
            ? "sweet-0"
            : "sweet-normal";
        document.getElementById(id)?.click();
      }

      // Temperature
      if (item.temperature) {
        document.getElementById(item.temperature === "hot" ? "temp-hot" : "temp-iced")?.click();
      }

      // Tea Type
      if (item.teaType) {
        const id =
          item.teaType === "green"
            ? "tea-green"
            : item.teaType === "oolong"
            ? "tea-oolong"
            : "tea-black";
        document.getElementById(id)?.click();
      }

      // Size
      if (item.size) {
        const sizeId =
          item.size === "medium" ? "size-medium" : item.size === "large" ? "size-large" : "size-small";
        document.getElementById(sizeId)?.click();
      }

      // Toppings
      if (Array.isArray(item.toppings)) {
        document
          .querySelectorAll('input[type="checkbox"][id^="topping-"]')
          .forEach((cb) => (cb.checked = item.toppings.includes(cb.value)));
      }
    }

    function rewireTempListeners() {
      const iceSection = document.getElementById("cashier-iceSection");
      document.querySelectorAll('input[name="temperature"]').forEach((radio) => {
        const newRadio = radio.cloneNode(true);
        radio.parentNode.replaceChild(newRadio, radio);
      });

      document.querySelectorAll('input[name="temperature"]').forEach((radio) => {
        radio.addEventListener("change", () => {
          if (document.getElementById("temp-hot")?.checked) iceSection.style.display = "none";
          else iceSection.style.display = "";
        });
      });
    }

    const openModalForAdd = (drink) => {
      activeMode = "add";
      activeDrink = drink;
      activeCartItem = null;

      resetPopupSelections();

      const hotAllowed = drink.hot_option === true;
      const teaAllowed = drink.tea_options === true;

      const teaSection = document.getElementById("cashier-teaSection");
      const hotOption = document.getElementById("cashier-hotOption");

      if (!hotAllowed && hotOption) hotOption.style.display = "none";
      else if (hotOption) hotOption.style.display = "inline-block";

      if (!teaAllowed && teaSection) teaSection.style.display = "none";
      else if (teaSection) teaSection.style.display = "";

      rewireTempListeners();

      modal.style.display = "block";
      dim.style.display = "block";
    };

    const openModalForEdit = (cartItem) => {
      activeMode = "edit";
      activeCartItem = cartItem;
      activeDrink = {
        name: cartItem.name,
        basePrice: cartItem.basePrice,
        hot_option: cartItem.hot_option,
        tea_options: cartItem.tea_options,
      };

      resetPopupSelections();
      applyCartItemToPopup(cartItem);

      const hotAllowed = cartItem.hot_option === true;
      const teaAllowed = cartItem.tea_options === true;

      const teaSection = document.getElementById("cashier-teaSection");
      const hotOption = document.getElementById("cashier-hotOption");

      if (!hotAllowed && hotOption) hotOption.style.display = "none";
      else if (hotOption) hotOption.style.display = "inline-block";

      if (!teaAllowed && teaSection) teaSection.style.display = "none";
      else if (teaSection) teaSection.style.display = "";

      rewireTempListeners();

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

    window.openMenuCustomizationModal = openModalForAdd;
    window.openEditDrinkModal = openModalForEdit;

    document.getElementById("confirmCustomize").onclick = () => {
      if (!activeDrink) return;

      const temperature =
        document.querySelector('input[name="temperature"]:checked')?.value || "iced";

      let ice = "Regular";
      if (temperature !== "hot") {
        ice = document.querySelector('input[name="ice-level"]:checked')?.value || "Regular";
      }

      const sweet =
        document.querySelector('input[name="sweet-level"]:checked')?.value || "100%";

      let sweetnessUpcharge = 0;
      if (sweet === "125%") sweetnessUpcharge = 0.20;

      let teaType = null;
      if (activeDrink.tea_options === true) {
        teaType = document.querySelector('input[name="tea-type"]:checked')?.value || "black";
      }

      const toppings = Array.from(
        document.querySelectorAll('input[type="checkbox"][id^="topping-"]:checked')
      ).map((cb) => cb.value);

      const toppingsCost = toppings.length * TOPPING_PRICE;

      const size = document.querySelector('input[name="drink-size"]:checked')?.value || "small";
      let sizeUpcharge = 0;
      if (size === "medium") sizeUpcharge = 0.20;
      else if (size === "large") sizeUpcharge = 0.40;

      const finalBasePrice = (activeDrink.basePrice ?? 0) + sizeUpcharge + sweetnessUpcharge;

      if (activeMode === "edit" && activeCartItem) {
        // NOTE: this keeps the existing basePrice as-is unless you want edits to re-price.
        activeCartItem.iceLevel = ice;
        activeCartItem.sweetness = sweet;
        activeCartItem.temperature = temperature;
        activeCartItem.teaType = teaType;
        activeCartItem.toppings = toppings;
        activeCartItem.toppingsCost = toppingsCost;
        activeCartItem.size = size;
        saveCart();
        refreshCartUI();
      } else {
        addToCart({
          name: activeDrink.name,
          basePrice: finalBasePrice,
          iceLevel: ice,
          sweetness: sweet,
          temperature,
          teaType,
          toppings,
          toppingsCost,
          qty: 1,
          hot_option: activeDrink.hot_option,
          tea_options: activeDrink.tea_options,
          size,
        });
      }

      closeModal();
    };
  });
})();

/* ---------------- Smooth category switching (works with cashierall.html navbar) ---------------- */
function setActiveNavButton(category) {
  const buttons = document.querySelectorAll(".navbar .nav-style");
  buttons.forEach((b) => b.classList.remove("active"));

  // Prefer data-category match
  const match = Array.from(buttons).find((b) => (b.dataset.category || "").toLowerCase() === category);
  if (match) match.classList.add("active");
}

function deriveCategoryFromButton(btn) {
  const dc = (btn.dataset.category || "").trim().toLowerCase();
  if (dc) return dc;

  // If button wraps an <a href="cashier_matcha.html">Matcha</a>, derive from href
  const a = btn.querySelector("a");
  const href = (a?.getAttribute("href") || "").toLowerCase();

  // Fallback: derive from text
  const text = (btn.textContent || "").toLowerCase();

  if (href.includes("noncaf") || text.includes("non-caffeinated")) return "noncaf";
  if (href.includes("matcha") || text.includes("matcha")) return "matcha";
  if (href.includes("iceblend") || text.includes("ice-blended") || text.includes("ice blended")) return "iceblend";
  if (href.includes("fruity") || text.includes("fruity")) return "fruity";
  if (href.includes("freshbrew") || text.includes("fresh brew")) return "freshbrew";
  if (href.includes("milky") || text.includes("milky")) return "milky";
  if (href.includes("seasonal") || text.includes("seasonal")) return "seasonal";
  if (text.includes("all")) return "all";

  return "all";
}

function setupCategoryNavigation() {
  const buttons = document.querySelectorAll(".navbar .nav-style");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      // We want SINGLE PAGE behavior even if there are <a href="cashier_matcha.html"> links.
      e.preventDefault();

      const category = deriveCategoryFromButton(btn);

      setActiveNavButton(category);

      const grid = document.querySelector(".drink-grid");
      if (grid) {
        grid.style.transition = "opacity 0.15s ease";
        grid.style.opacity = "0";

        const drinksPromise = loadDrinks(category);

        setTimeout(async () => {
          await drinksPromise;
          grid.style.transition = "opacity 0.2s ease";
          grid.style.opacity = "1";
        }, 150);
      } else {
        await loadDrinks(category);
      }
    });
  });
}

/* ---------------- Init ---------------- */
async function init() {
  loadCart();
  buildCartPanel();

  // Always start on "all" so you only need cashierall.html
  await loadDrinks("all");
  refreshCartUI();

  wireCashierSearch();
  setupCategoryNavigation();
}

document.addEventListener("DOMContentLoaded", init);