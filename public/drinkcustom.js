// drinkcustom.js
(function () {
  const selectedDrinkRaw = sessionStorage.getItem('selectedDrink');
  if (!selectedDrinkRaw) {
    // Redirect if someone lands here directly
    window.location.href = 'customerallmenu.html';
    return;
  }

  const selectedDrink = JSON.parse(selectedDrinkRaw);

  // --- HIGH CONTRAST TOGGLE ---
  const contrastToggle = document.getElementById('contrastToggle');
  if (contrastToggle) {
    contrastToggle.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.classList.toggle('high-contrast'); // Only toggle on click
      const isHighContrast = document.body.classList.contains('high-contrast');
      localStorage.setItem('highContrast', isHighContrast); // Save for next page
    });
  }

  // --- CONFIRM BUTTON ---
  const confirmBtn = document.querySelector('.confirm-button');
  confirmBtn.addEventListener('click', () => {
    const ice = document.querySelector('input[name="ice-level"]:checked')?.value || 'regular';
    const sweet = document.querySelector('input[name="sweet-level"]:checked')?.value || '100%';
    const toppings = Array.from(document.querySelectorAll('input[name="toppings"]:checked')).map(cb => cb.value);

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

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.push(lineItem);
    localStorage.setItem('cart', JSON.stringify(cart));

    window.location.href = 'customerallmenu.html';
  });
})();


function applyTextSizeDC(size) {
  const b = document.body;
  b.classList.remove('text-large', 'text-small');

  if (size === 'small') b.classList.add('text-small');
  else { b.classList.add('text-large'); }
}

const savedSizeDC = localStorage.getItem('textSize') || 'normal';
applyTextSizeDC(savedSizeDC);

window.addEventListener('storage', (e) => {
  if (e.key === 'textSize') {
    applyTextSizeDC(e.newValue);
  }
});
