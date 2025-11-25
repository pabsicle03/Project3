// public/cashier.js
export let cart = [];

/**
 * Cart item shape:
 * { name, basePrice, qty, iceLevel, sweetness, toppings (array), toppingsCost }
 */

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
    const url = series === "all" ? "/api/drinks" : `/api/drinks?series=${encodeURIComponent(series)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load drinks (${res.status})`);
    const json = await res.json();
    return json.drinks ?? json;
  } catch (err) {
    console.error("fetchDrinks", err);
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

function findCartItem(name) {
  return cart.find(it => it.name === name);
}

function addToCart(drink) {
  const existing = findCartItem(drink.name);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      name: drink.name,
      basePrice: drink.price ?? 0,
      qty: 1,
      iceLevel: "Regular",
      sweetness: "Regular",
      toppings: [],
      toppingsCost: 0
    });
  }
  refreshCartUI();
  createToast(`${drink.name} added to cart`);
}

function removeCartItem(name) {
  cart = cart.filter(it => it.name !== name);
  refreshCartUI();
}

function changeQty(name, delta) {
  const it = findCartItem(name);
  if (!it) return;
  it.qty = Math.max(0, it.qty + delta);
  if (it.qty === 0) removeCartItem(name);
  else refreshCartUI();
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
  for (const it of cart) {
    const li = document.createElement("li");
    li.className = "cart-item";
    const lineTotal = (it.basePrice + (it.toppingsCost ?? 0)) * it.qty;
    total += lineTotal;
    li.innerHTML = `
      <div class="cart-item-left">
        <div class="cart-item-name">${escapeHtml(it.name)}</div>
        <div class="cart-item-meta">$${(it.basePrice + (it.toppingsCost||0)).toFixed(2)} x ${it.qty} = $${lineTotal.toFixed(2)}</div>
      </div>
      <div class="cart-item-actions">
        <button class="qty-btn dec">−</button>
        <button class="qty-btn inc">+</button>
        <button class="remove-btn">✕</button>
      </div>
    `;
    li.querySelector(".dec").addEventListener("click", () => changeQty(it.name, -1));
    li.querySelector(".inc").addEventListener("click", () => changeQty(it.name, +1));
    li.querySelector(".remove-btn").addEventListener("click", () => { removeCartItem(it.name); });
    list.appendChild(li);
  }
  document.querySelector(".cart-total").textContent = `Total: $${total.toFixed(2)}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function submitCart() {
  if (!cart.length) {
    alert("Cart is empty!");
    return;
  }
  if (!confirm("Submit order to backend?")) return;

  const orders = cart.map(it => ({
    name: it.name,
    iceLevel: it.iceLevel,
    sweetness: it.sweetness,
    toppings: it.toppings,
    basePrice: it.basePrice,
    toppingsCost: it.toppingsCost || 0
  }));

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Server error: ${res.status} ${txt}`);
    }
    const json = await res.json();
    createToast("Order submitted!");
    cart = [];
    refreshCartUI();
  } catch (err) {
    console.error("submitCart:", err);
    alert("Failed to submit order: " + err.message);
  }
}

export async function loadDrinks(series) {
  const grid = document.querySelector(".drink-grid");
  if (!grid) return;
  grid.innerHTML = ""; 
  const drinks = await fetchDrinks(series);
  drinks.forEach(d => {
    const card = document.createElement("div");
    card.className = "drink-card";
    card.innerHTML = `
      <div class="drink-inner">
        <div class="drink-name">${escapeHtml(d.name)}</div>
        <div class="drink-price">$${Number(d.price ?? 0).toFixed(2)}</div>
        <button class="add-to-cart">Add to Cart</button>
      </div>
    `;
    card.querySelector(".add-to-cart").addEventListener("click", () => addToCart({name: d.name, price: Number(d.price ?? 0)}));
    grid.appendChild(card);
  });
}

async function init() {
  buildCartPanel();
  const series = pageSeriesFromPath();
  await loadDrinks(series);
  refreshCartUI();
}

document.addEventListener("DOMContentLoaded", init);
