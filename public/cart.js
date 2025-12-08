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
  const taxAmountEl = document.querySelector(".tax-amount");

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
    // Normalize quantity from either `quantity` or `qty`
    let q = 1;
    if (typeof item.quantity === "number" && item.quantity > 0) {
      q = item.quantity;
    } else if (typeof item.qty === "number" && item.qty > 0) {
      q = item.qty;
    }

    // Normalize unitPrice so it ALWAYS includes toppingsCost if present
    if (item.unitPrice == null) {
      if (item.lineTotal != null) {
        // If we have a lineTotal, derive unit price from it (keeps toppings)
        item.unitPrice = item.lineTotal / q;
      } else {
        const base = Number(item.basePrice || 0);
        const toppings = Number(item.toppingsCost || 0);
        item.unitPrice = base + toppings;
      }
    }

    // Ensure quantity and lineTotal are set
    item.quantity = q;
    item.lineTotal = item.unitPrice * item.quantity;

    const itemDiv = document.createElement("div");
    itemDiv.classList.add("drink-item");

    // Build options display string
        let optionsText = `Size: ${item.size || "small"}, ` + `Ice Level: ${item.iceLevel || "regular"}, ` + `Sweetness: ${item.sweetness || "100%"}`;
    // Add temperature if present
    if (item.temperature) {
      optionsText += `, Temperature: ${item.temperature}`;
    }
    
    // Add tea type if present
    if (item.teaType) {
      optionsText += `, Tea: ${item.teaType}`;
    }
    
    // Add toppings
    optionsText += `, Toppings: ${
      item.toppings && item.toppings.length
        ? item.toppings.join(", ")
        : "None"
    }`;

    itemDiv.innerHTML = `
      <div class="drink-details">
        <span class="remove-icon" data-index="${index}">❌</span>
        <div class="drink-text">
          <div class="drink-name">${item.name}</div>
          <div class="drink-options">
            ${optionsText}
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
          <div class="favorite-row">
            <button class="favorite-save-btn" data-index="${index}" style="margin-top:6px; padding:4px 8px; border-radius:6px; border:none; background:#d33; color:#fff; cursor:pointer; font-size:0.9em;">
              Save as Favorite
            </button>
          </div>
        </div>
      </div>
      <div class="drink-price">$${item.lineTotal.toFixed(2)}</div>
    `;

    cartContainer.appendChild(itemDiv);
    if (window.isGuestUser()) {
      const favBtn = itemDiv.querySelector(".favorite-save-btn");
      if (favBtn) favBtn.style.display = "none";
    }
  });

  // Save normalized cart
  localStorage.setItem("cart", JSON.stringify(cart));

  // ----- Total calculation -----
  function recalcTotal() {
    let subtotal = 0;

    cart.forEach((it) => {
      subtotal += it.lineTotal || 0;
    });

    const tax = subtotal * TAX_RATE;
    const totalWithTax = subtotal + tax;

    if (taxAmountEl) {
      taxAmountEl.textContent = `$${tax.toFixed(2)}`;
    }

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
        if (taxAmountEl) taxAmountEl.textContent = "$0.00";
      } else {
        window.location.reload(); // easiest re-render
      }
    });
  });


  // ----- Save as Favorite (per line item) -----
  cartContainer.querySelectorAll(".favorite-save-btn").forEach((btn) => {

    btn.addEventListener("click", async () => {
      const index = parseInt(btn.dataset.index, 10);
      const item = cart[index];
      if (!item) return;

      const drinkConfig = {
        name: item.name,
        iceLevel: item.iceLevel,
        sweetness: item.sweetness,
        temperature: item.temperature,
        teaType: item.teaType,
        toppings: item.toppings || []
      };

      if (await window.isFavoriteAlready(drinkConfig)) {
        alert("This drink is already in your favorites.");
        return;
      }

      if (typeof window.saveFavorite !== "function") {
        alert("Favorites are not available on this page.");
        return;
      }

      // Try to use the custom favorite popup if it exists
      const dim = document.getElementById("cartFavoriteDim");
      const popup = document.getElementById("cartFavoritePopup");
      const nameInputEl = document.getElementById("cartFavoriteNameInput");
      const confirmBtn = document.getElementById("cartFavoriteConfirm");
      const cancelBtn = document.getElementById("cartFavoriteCancel");

      // If any are missing, fall back to prompt()
      if (!dim || !popup || !nameInputEl || !confirmBtn || !cancelBtn) {
        const defaultLabel = item.name || "Favorite Drink";
        const nameInput = window.prompt(
          "Optional: Give this favorite a name:",
          defaultLabel
        );

        // If user pressed Cancel → do not save
        if (nameInput === null) return;

        const label =
          nameInput && nameInput.trim() ? nameInput.trim() : defaultLabel;

        const fallbackPayload = {
          name: item.name,
          basePrice: item.unitPrice ?? item.basePrice ?? 0,
          iceLevel: item.iceLevel || "regular",
          sweetness: item.sweetness || "100%",
          temperature: item.temperature || "iced",
          teaType: item.teaType || "black",
          toppings: item.toppings || [],
          toppingsCost: item.toppingsCost || 0,
          label: label,
        };

        window.saveFavorite(fallbackPayload, "cart");
        return;
      }

      // Use popup flow
      const defaultLabel = item.name || "Favorite Drink";
      nameInputEl.value = defaultLabel;

      dim.style.display = "block";
      popup.style.display = "block";

      // Confirm handler (overwrite each time)
      confirmBtn.onclick = () => {
        const raw = nameInputEl.value;
        const label = raw && raw.trim() ? raw.trim() : defaultLabel;

        const payload = {
          name: item.name,
          basePrice: item.unitPrice ?? item.basePrice ?? 0,
          iceLevel: item.iceLevel || "regular",
          sweetness: item.sweetness || "100%",
          temperature: item.temperature || "iced",
          teaType: item.teaType || "black",
          toppings: item.toppings || [],
          toppingsCost: item.toppingsCost || 0,
          favoriteLabel: label,
        };

        window.saveFavorite(payload, "cart");

        // Close popup
        popup.style.display = "none";
        dim.style.display = "none";
        nameInputEl.value = "";
      };

      // Cancel handler → close, do not save
      cancelBtn.onclick = () => {
        popup.style.display = "none";
        dim.style.display = "none";
        nameInputEl.value = "";
      };
    });
  });

  // ----- Payment buttons -----
  document.querySelectorAll(".payment-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
      }

      let paymentMethod = (btn.dataset.method || btn.textContent || "").toLowerCase();
      if (paymentMethod.includes("cash")) {
        paymentMethod = "cash";
      } else if (paymentMethod.includes("card")) {
        paymentMethod = "card";
      } else {
        paymentMethod = window.confirm("Are you paying with cash? Click Cancel for card.")
          ? "cash"
          : "card";
      }

      //Get customer name
      let customerName = localStorage.getItem("customerName");

      // If no stored name (guest / google), ask for it
      if (!customerName) {
        customerName = window.prompt("Please enter your name for the order:");
        if (!customerName || !customerName.trim()) {
          alert("Name is required to place an order.");
          return;
        }
        customerName = customerName.trim();
        // optional: remember it for rest of session
        localStorage.setItem("customerName", customerName);
      }

      //Receipt flow
      const storedEmail = localStorage.getItem("customerEmail") || null;
      let wantReceipt = window.confirm("Would you like your receipt emailed to you?");
      let receiptEmail = null;
      let receiptName = customerName;

      if (wantReceipt) {
        if (storedEmail) {
          // logged-in customer with known email
          receiptEmail = storedEmail;
        } else {
          // guest or no email saved → ask for name + email
          let nameInput = customerName;
          if (!nameInput) {
            nameInput = window.prompt("Please enter your name for the receipt:");
            if (!nameInput || !nameInput.trim()) {
              alert("Name is required for the receipt.");
              wantReceipt = false;
            } else {
              nameInput = nameInput.trim();
              customerName = nameInput;
              receiptName = nameInput;
              localStorage.setItem("customerName", nameInput);
            }
          }

          if (wantReceipt) {
            const emailInput = window.prompt("Please enter your email for the receipt:");
            if (!emailInput || !emailInput.trim()) {
              alert("No email entered. We will not send a receipt.");
              wantReceipt = false;
            } else {
              receiptEmail = emailInput.trim();
            }
          }
        }
      }

      //On customer side, employee is the kiosk
      const employeeName = "Kiosk";

      try {
        const res = await fetch("/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: cart,
            employee_name: employeeName,
            customer_name: customerName,
            payment_method: paymentMethod,
            want_receipt: wantReceipt,
            receipt_email: receiptEmail,
            receipt_name: receiptName
          }),
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

        const taxAmountEl2 = document.querySelector(".tax-amount");
        if (taxAmountEl2) taxAmountEl2.textContent = "$0.00";
      }
    });
  }

  // ----- Back button → customer menu -----
  const backBtn = document.getElementById("backButton");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // cart.html lives in /customer/, so go back to that folder's menu
      window.location.href = "/customer/customerallmenu.html";
    });
  }
});