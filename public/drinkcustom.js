// drinkcustom.js
(function () {
  const selectedDrinkRaw = sessionStorage.getItem('selectedDrink');
  if (!selectedDrinkRaw) {
    // Fallback if someone lands here directly
    window.location.href = 'customerallmenu.html';
    return;
  }

  const selectedDrink = JSON.parse(selectedDrinkRaw);

  const confirmBtn = document.querySelector('.confirm-button');
  confirmBtn.addEventListener('click', () => {
    // Collect choices
    const ice = document.querySelector('input[name="ice-level"]:checked')?.value || 'regular';
    const ICE_LABELS = {regular: 'Regular', less: 'Less', none: 'None'};
    const iceLevel = ICE_LABELS[ice] || 'Regular';


    const sweet = document.querySelector('input[name="sweet-level"]:checked')?.value || '100%';

    const toppings = Array.from(document.querySelectorAll('input[name="toppings"]:checked'))
      .map(cb => cb.value);

    // Simple topping pricing model (adjust as needed)
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

    // Persist to cart in localStorage
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.push(lineItem);
    localStorage.setItem('cart', JSON.stringify(cart));

    // Done — go to cart
    window.location.href = 'customerallmenu.html';
  });
})();
