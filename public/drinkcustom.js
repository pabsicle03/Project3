(function () {
  const selectedDrinkRaw = sessionStorage.getItem("selectedDrink");
  if (!selectedDrinkRaw) {
    window.location.href = "customerallmenu.html";
    return;
  }

  const selectedDrink = JSON.parse(selectedDrinkRaw);

  const confirmBtn = document.querySelector(".confirm-button");
  confirmBtn.addEventListener("click", () => {

    const ice = document.querySelector("input[name='ice-level']:checked")?.value || "regular";
    const sweet = document.querySelector("input[name='sweet-level']:checked")?.value || "100%";
    const toppings = Array.from(document.querySelectorAll("input[name='toppings']:checked"))
                          .map(cb => cb.value);

    const TOPPING_PRICE = 0.75;
    const toppingsCost = toppings.length * TOPPING_PRICE;

    const lineItem = {
      id: selectedDrink.id,
      name: selectedDrink.name,
      basePrice: selectedDrink.basePrice,
      iceLevel: ice,
      sweetness: sweet,
      toppings,
      toppingsCost,
      lineTotal: +(selectedDrink.basePrice + toppingsCost).toFixed(2),
      qty: 1
    };

    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    cart.push(lineItem);
    localStorage.setItem("cart", JSON.stringify(cart));

    // ***** IMPORTANT PART *****
    alert("Added to cart!"); // waits for OK

    const lastUrl = sessionStorage.getItem("lastMenuUrl") || "customerallmenu.html";

    // Reloads after OK is pressed
    window.location.href = lastUrl + "?refresh=" + Date.now();
  });
})();
