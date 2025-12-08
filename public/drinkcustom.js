console.log("=== DRINKCUSTOM.JS LOADED ===");

(function () {
  // Get selected drink from sessionStorage
  const selectedDrinkRaw = sessionStorage.getItem("selectedDrink");
  console.log("1. Raw sessionStorage data:", selectedDrinkRaw);
  
  if (!selectedDrinkRaw) {
    console.log("2. No drink found, redirecting...");
    window.location.href = "customerallmenu.html";
    return;
  }
  
  const selectedDrink = JSON.parse(selectedDrinkRaw);
  console.log("3. Parsed drink object:", selectedDrink);
  console.log("4. hot_option value:", selectedDrink.hot_option);
  console.log("5. tea_options value:", selectedDrink.tea_options);

  // Apply accessibility settings
  const savedSize = localStorage.getItem("textSize") || "normal";
  if (savedSize === "small") document.body.classList.add("text-small");
  else if (savedSize === "large") document.body.classList.add("text-large");

  if (localStorage.getItem("highContrast") === "true") {
    document.body.classList.add("high-contrast");
  }

  const contrastToggle = document.getElementById("contrastToggle");
  if (contrastToggle) {
    contrastToggle.addEventListener("click", () => {
      document.body.classList.toggle("high-contrast");
      localStorage.setItem(
        "highContrast",
        document.body.classList.contains("high-contrast")
      );
    });
  }

  // Get DOM elements
  const iceSection = document.getElementById("iceSection");
  const hotOptionDiv = document.getElementById("hotOption");
  const teaSection = document.getElementById("teaSection");
  const tempRadios = document.querySelectorAll("input[name='temperature']");

  console.log("6. DOM elements found:");
  console.log("   - iceSection:", iceSection);
  console.log("   - hotOptionDiv:", hotOptionDiv);
  console.log("   - teaSection:", teaSection);
  console.log("   - tempRadios count:", tempRadios.length);

  // Show/hide hot and tea based on backend flags
  const hotAllowed = selectedDrink.hot_option === true;
  const teaAllowed = selectedDrink.tea_options === true;

  console.log("7. Calculated permissions:");
  console.log("   - hotAllowed:", hotAllowed);
  console.log("   - teaAllowed:", teaAllowed);

  if (!hotAllowed) {
    console.log("8. Hiding hot option");
    if (hotOptionDiv) hotOptionDiv.style.display = "none";
  } else {
    console.log("8. Hot option SHOULD be visible");
  }
  
  if (!teaAllowed) {
    console.log("9. Hiding tea section");
    if (teaSection) teaSection.style.display = "none";
  } else {
    console.log("9. Tea section SHOULD be visible");
  }

  // Hide ice if hot selected
  tempRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (document.getElementById("temp-hot")?.checked) {
        if (iceSection) iceSection.style.display = "none";
      } else {
        if (iceSection) iceSection.style.display = "";
      }
    });
  });

  // Confirm button logic
  const confirmBtn = document.querySelector(".confirm-button");
  confirmBtn.addEventListener("click", () => {
    const temperature =
      document.querySelector("input[name='temperature']:checked")?.value ||
      "iced";

    let ice = "regular";
    if (temperature !== "hot") {
      ice =
        document.querySelector("input[name='ice-level']:checked")?.value ||
        "regular";
    }

    const sweet =
      document.querySelector("input[name='sweet-level']:checked")?.value ||
      "100%";

    let teaType = null;
    if (teaAllowed) {
      teaType =
        document.querySelector("input[name='tea-type']:checked")?.value ||
        "black";
    }

    const toppings = Array.from(
      document.querySelectorAll("input[name='toppings']:checked")
    ).map((cb) => cb.value);

    const TOPPING_PRICE = 0.75;
    const toppingsCost = toppings.length * TOPPING_PRICE;

    // === SIZE LOGIC ===
    const size =
      document.querySelector("input[name='drink-size']:checked")?.value ||
      "small";

    let sizeUpcharge = 0;
    if (size === "medium") sizeUpcharge = 0.20;
    else if (size === "large") sizeUpcharge = 0.40;

    const finalBasePrice = Number(
      (selectedDrink.basePrice + sizeUpcharge).toFixed(2)
    );

    const lineItem = {
      id: selectedDrink.id,
      name: selectedDrink.name,
      size,
      basePrice: finalBasePrice,
      temperature,
      iceLevel: ice,
      sweetness: sweet,
      teaType,
      hot_option: hotAllowed,
      tea_options: teaAllowed,
      toppings,
      toppingsCost,
      lineTotal: +(finalBasePrice + toppingsCost).toFixed(2),
      qty: 1,
    };

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    cart.push(lineItem);
    localStorage.setItem("cart", JSON.stringify(cart));

    alert("Added to cart!");
    const lastUrl =
      sessionStorage.getItem("lastMenuUrl") || "customerallmenu.html";
    window.location.href = lastUrl + "?refresh=" + Date.now();
  });
})();
