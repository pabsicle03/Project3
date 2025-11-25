// cart.js

// -------- Accessibility: dropdown + text size --------
function toggleDropdown() {
  const dropdown = document.getElementById("accessibilityDropdown");
  if (dropdown) {
    dropdown.classList.toggle("show");
  }
}

// Apply a saved text size to <body>
function applyTextSize(size) {
  document.body.classList.remove("text-small", "text-large");
  if (size === "small") {
    document.body.classList.add("text-small");
  } else if (size === "large") {
    document.body.classList.add("text-large");
  }
}

// Called from the accessibility menu
function changeTextSize(size) {
  applyTextSize(size);
  try {
    localStorage.setItem("textSize", size);
  } catch (e) {}

  if (size === "small") {
    alert("Text size set to Small.");
  } else if (size === "large") {
    alert("Text size set to Large.");
  } else {
    alert("Text size set to Default.");
  }
}

// -------- Main cart logic --------
document.addEventListener("DOMContentLoaded", () => {
  const TAX_RATE = 0.0825;

  // ----- Accessibility state on load -----
  const savedSize = localStorage.getItem("textSize") || "normal";
  applyTextSize(savedSize);

  const savedHighContrast = localStorage.getItem("highContrast");
  if (savedHighContrast === "true") {
    document.body.classList.add("high-contrast");
  } else {
    document.body.classList.remove("high-contrast");
  }

  // Sync across tabs/pages
  window.addEventListener("storage", (e) => {
    if (e.key === "textSize") {
      applyTextSize(e.newValue);
    } else if (e.key === "highContrast") {
      if (e.newValue === "true") {
        document.body.classList.add("high-contrast");
      } else {
        document.body.classList.remove("high-contrast");
      }
    }
  });

  // ----- Cart elements -----
  const cartContainer = document.querySelector(".drink-items-section");
  const totalPriceEl = document.querySelector(".total-price");

  if (!cartContainer || !totalPriceEl) {
    console.warn("Cart container or total price element not found on this page.");
    return;
  }

  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  cartContainer.innerHTML = "";

  // Empty cart
  if (cart.length === 0) {
    cartContainer.innerHTML = "<p>Your cart is empty.</p>";
    totalPriceEl.textContent = "$0.00";
    return;
  }

  // ----- Render all cart items -----
  cart.forEach((item, index) => {
    // Normalize for older cart data
    if (item.unitPrice == null) {
      if (item.lineTotal != null && item.quantity) {
        item.unitPrice = item.lineTotal / item.quantity;
      } else if (item.basePrice != null) {
        item.unitPrice = item.basePrice;
      } else {
        item.unitPrice = 0;
      }
    }

    if (item.quantity == null || item.quantity < 1) {
      item.quantity = item.qty && item.qty > 0 ? item.qty : 1;
    }

    item.lineTotal = item.unitPrice * item.quantity;

    const itemDiv = document.createElement("div");
    itemDiv.classList.add("drink-item");

    itemDiv.innerHTML = `
      <div class="drink-details">
        <span class="remove-icon" data-index="${index}">❌</span>
        <div class="drink-text">
          <div class="drink-name">${item.name}</div>
          <div class="drink-options">
            Ice Level: ${item.iceLevel || "regular"},
            Sweetness: ${item.sweetness || "100%"},
            Toppings: ${
              item.toppings && item.toppings.length
                ? item.toppings.join(", ")
                : "None"
            }
          </div>
          <div class="quantity-row">
            Quantity:
            <input
              type="number"
              min="1"
              value="${item.quantity}"
              class="qty-input"
              data-index="${index}"
            >
          </div>
        </div>
      </div>
      <div class="drink-price">$${item.lineTotal.toFixed(2)}</div>
    `;

    cartContainer.appendChild(itemDiv);
  });

  // Save normalized cart
  localStorage.setItem("cart", JSON.stringify(cart));

  // ----- Total calculation -----
  function recalcTotal() {
    let subtotal = 0;
    cart.forEach((it) => {
      subtotal += it.lineTotal || 0;
    });
    const totalWithTax = subtotal * (1 + TAX_RATE);
    totalPriceEl.textContent = `$${totalWithTax.toFixed(2)}`;
  }

  recalcTotal();

  // ----- Quantity change -----
  cartContainer.querySelectorAll(".qty-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const index = parseInt(e.target.dataset.index, 10);
      let qty = parseInt(e.target.value, 10);

      if (isNaN(qty) || qty < 1) {
        qty = 1;
        e.target.value = qty;
      }

      cart[index].quantity = qty;
      cart[index].lineTotal = cart[index].unitPrice * qty;

      const priceEl = e.target
        .closest(".drink-item")
        .querySelector(".drink-price");
      priceEl.textContent = `$${cart[index].lineTotal.toFixed(2)}`;

      localStorage.setItem("cart", JSON.stringify(cart));
      recalcTotal();
    });
  });

  // ----- Remove single item -----
  cartContainer.querySelectorAll(".remove-icon").forEach((icon) => {
    icon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const index = parseInt(icon.getAttribute("data-index"), 10);
      cart.splice(index, 1);
      localStorage.setItem("cart", JSON.stringify(cart));

      if (cart.length === 0) {
        cartContainer.innerHTML = "<p>Your cart is empty.</p>";
        totalPriceEl.textContent = "$0.00";
      } else {
        window.location.reload(); // easiest re-render
      }
    });
  });

  // ----- Payment buttons -----
  document.querySelectorAll(".payment-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
      }

      try {
        const res = await fetch("/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders: cart }),
        });

        if (!res.ok) throw new Error("Order submission failed");

        alert("Order placed successfully!");
        localStorage.removeItem("cart");
        window.location.href = "/startpage.html";
      } catch (err) {
        console.error(err);
        alert("Error sending order. Please try again.");
      }
    });
  });

  // ----- Cancel all orders -----
  const cancelBtn = document.querySelector(".cancel-order-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to cancel all orders?")) {
        localStorage.removeItem("cart");
        cart = [];
        cartContainer.innerHTML = "<p>Your cart is empty.</p>";
        totalPriceEl.textContent = "$0.00";
      }
    });
  }

  // ----- Back button → customer menu -----
  const backBtn = document.getElementById("backButton");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // cart.html lives in /customer/, so go back to that folder’s menu
      window.location.href = "/customer/customerallmenu.html";
    });
  }
});