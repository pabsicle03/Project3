// cart.js
document.addEventListener('DOMContentLoaded', () => {
  const cartContainer = document.querySelector('.drink-items-section');
  const totalPriceEl = document.querySelector('.total-price');

  let cart = JSON.parse(localStorage.getItem('cart') || '[]');
  cartContainer.innerHTML = ''; // clear placeholder

  if (cart.length === 0) {
    cartContainer.innerHTML = '<p>Your cart is empty.</p>';
    totalPriceEl.textContent = '$0.00';
    return;
  }

  let total = 0;
  cart.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('drink-item');

    itemDiv.innerHTML = `
      <div class="drink-details">
        <span class="remove-icon" data-index="${index}">❌</span>
        <div class="drink-text">
          <div class="drink-name">${item.name}</div>
          <div class="drink-options">
            Ice Level: ${item.iceLevel}, Sweetness: ${item.sweetness}, 
            Toppings: ${item.toppings.join(', ') || 'None'}
          </div>
        </div>
      </div>
      <div class="drink-price">$${item.lineTotal.toFixed(2)}</div>
    `;

    total += item.lineTotal;
    cartContainer.appendChild(itemDiv);
  });

  totalPriceEl.textContent = `$${total.toFixed(2)}`;

  // Remove individual item
  document.querySelectorAll('.remove-icon').forEach(icon => {
    icon.addEventListener('click', e => {
      const index = e.target.dataset.index;
      cart.splice(index, 1);
      localStorage.setItem('cart', JSON.stringify(cart));
      location.reload();
    });
  });

  // Payment buttons
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
      }

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ orders: cart })
        });

        if (!res.ok) throw new Error('Failed to submit order');

        alert('Order placed successfully!');
        localStorage.removeItem('cart');

        // Redirect to startpage.html
        window.location.href = 'startpage.html';
      } catch (err) {
        console.error(err);
        alert('Error sending order. Please try again.');
      }
    });
  });

  const cancelBtn = document.querySelector('.cancel-order-btn');
  cancelBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel all orders?')) {
      localStorage.removeItem('cart');
      cartContainer.innerHTML = '<p>Your cart is empty.</p>';
      totalPriceEl.textContent = '$0.00';
    }
  });
});

