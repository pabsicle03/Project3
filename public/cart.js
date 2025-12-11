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
    alert(tr("Text size set to Small.", "Tamaño de texto establecido a Pequeño."));
  } else if (size === "large") {
    alert(tr("Text size set to Large.", "Tamaño de texto establecido a Grande."));
  } else {
    alert(tr("Text size set to Default.", "Tamaño de texto establecido a Predeterminado."));
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
      // Add smooth transition effect
      taxAmountEl.style.transition = "opacity 0.3s ease";
      taxAmountEl.style.opacity = "0.5";
      
      setTimeout(() => {
        taxAmountEl.textContent = `$${tax.toFixed(2)}`;
        taxAmountEl.style.opacity = "1";
      }, 150);
    }

    // Add smooth transition effect to total
    totalPriceEl.style.transition = "opacity 0.3s ease";
    totalPriceEl.style.opacity = "0.5";
    
    setTimeout(() => {
      totalPriceEl.textContent = `$${totalWithTax.toFixed(2)}`;
      totalPriceEl.style.opacity = "1";
    }, 150);
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

  // ----- Remove single item with smooth animation -----
  cartContainer.querySelectorAll(".remove-icon").forEach((icon) => {
    icon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const index = parseInt(icon.getAttribute("data-index"), 10);
      const itemDiv = icon.closest(".drink-item");
      
      // Update cart data and totals IMMEDIATELY (before animation)
      cart.splice(index, 1);
      localStorage.setItem("cart", JSON.stringify(cart));
      
      // Update totals immediately so they change with the animation
      recalcTotal();
      
      // Add smooth fade-out and slide animation
      itemDiv.style.transition = "opacity 0.5s ease, transform 0.5s ease, max-height 0.5s ease, margin 0.5s ease, padding 0.5s ease";
      itemDiv.style.opacity = "0";
      itemDiv.style.transform = "translateX(-20px)";
      itemDiv.style.maxHeight = itemDiv.offsetHeight + "px";
      
      // Trigger reflow to ensure initial state is applied
      itemDiv.offsetHeight;
      
      // Collapse the height
      setTimeout(() => {
        itemDiv.style.maxHeight = "0";
        itemDiv.style.marginBottom = "0";
        itemDiv.style.paddingTop = "0";
        itemDiv.style.paddingBottom = "0";
      }, 10);
      
      // If this was the last item, show empty message immediately
      if (cart.length === 0) {
        // Create empty message element
        const emptyMsg = document.createElement("p");
        emptyMsg.textContent = "Your cart is empty.";
        emptyMsg.style.opacity = "0";
        emptyMsg.style.transition = "opacity 0.3s ease";
        
        // Add it to the container right away
        cartContainer.appendChild(emptyMsg);
        
        // Fade it in quickly
        setTimeout(() => {
          emptyMsg.style.opacity = "1";
        }, 100);
      }
      
      // Wait for animation to complete before cleaning up DOM
      setTimeout(() => {
        if (cart.length === 0) {
          // Clean up - remove the faded item and keep only the empty message
          cartContainer.innerHTML = "<p>Your cart is empty.</p>";
        } else {
          // Remove the element from DOM
          itemDiv.remove();
          
          // Update all remaining data-index attributes
          cartContainer.querySelectorAll(".drink-item").forEach((item, newIndex) => {
            item.querySelector(".remove-icon").setAttribute("data-index", newIndex);
            const qtyInput = item.querySelector(".qty-input");
            if (qtyInput) qtyInput.setAttribute("data-index", newIndex);
            const favBtn = item.querySelector(".favorite-save-btn");
            if (favBtn) favBtn.setAttribute("data-index", newIndex);
          });
        }
      }, 520); // Slightly longer than transition to ensure smooth completion
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
        alert(tr("This drink is already in your favorites.", "Este bebida ya está en tus favoritos."));
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
          tr("Optional: Give this favorite a name:", "Opcional: Darle un nombre a este favorito:"),
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
        alert(tr("Your cart is empty!", "Tu carrito está vacío."));
        return;
      }

      let paymentMethod = (btn.dataset.method || btn.textContent || "").toLowerCase();
      if (paymentMethod.includes("cash")) {
        paymentMethod = "cash";
      } else if (paymentMethod.includes("card")) {
        paymentMethod = "card";
      } else {
        paymentMethod = window.confirm(tr("Are you paying with cash? Click Cancel for card.", "¿Estás pagando en efectivo? Haz clic en Cancelar para pagar con tarjeta."))
          ? "cash"
          : "card";
      }

      //Get customer name
      let customerName = localStorage.getItem("customerName");

      // If no stored name (guest / google), ask for it
      if (!customerName) {
        customerName = window.prompt(tr("Please enter your name for the order:", "Por favor ingrese su nombre para el pedido:"));
        if (!customerName || !customerName.trim()) {
          alert(tr("Name is required to place an order.", "Se requiere un nombre para realizar el pedido."));
          return;
        }
        customerName = customerName.trim();
        // optional: remember it for rest of session
        localStorage.setItem("customerName", customerName);
      }

      //Receipt flow
      const storedEmail = localStorage.getItem("customerEmail") || null;
      let wantReceipt = window.confirm(tr("Would you like your receipt emailed to you?", "¿Te gustaría que se te envíe el recibo por correo electrónico?"));
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
            nameInput = window.prompt(tr("Please enter your name for the receipt:", "Por favor ingrese su nombre para el recibo:"));
            if (!nameInput || !nameInput.trim()) {
              alert(tr("Name is required for the receipt.", "Se requiere un nombre para el recibo."));
              wantReceipt = false;
            } else {
              nameInput = nameInput.trim();
              customerName = nameInput;
              receiptName = nameInput;
              localStorage.setItem("customerName", nameInput);
            }
          }

          if (wantReceipt) {
            const emailInput = window.prompt(tr("Please enter your email for the receipt:", "Por favor ingrese su correo electrónico para el recibo:"));
            if (!emailInput || !emailInput.trim()) {
              alert(tr("No email entered. We will not send a receipt.", "No se ingresó correo electrónico. No se enviará un recibo."));
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

        alert(tr("Order placed successfully!", "¡Pedido realizado con éxito!"));
        localStorage.removeItem("cart");
        window.location.href = "/startpage.html";
      } catch (err) {
        console.error(err);
        alert(tr("Error sending order. Please try again.", "Error al enviar el pedido. Por favor inténtelo de nuevo."));
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
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Add fade-out effect
      document.body.style.transition = "opacity 0.3s ease";
      document.body.style.opacity = "0";
      
      // Navigate after animation completes
      setTimeout(() => {
        window.location.href = "/customer/customerallmenu.html";
      }, 300);
    });
  }
  
  // ----- Add fade-in effect on page load -----
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.3s ease";
  
  // Trigger fade-in after a brief delay to ensure styles are applied
  setTimeout(() => {
    document.body.style.opacity = "1";
  }, 50);
});