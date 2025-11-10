// Function to toggle the display of the dropdown menu
function toggleDropdown() {
    document.getElementById("accessibilityDropdown").classList.toggle("show");
}

// Function to handle text size changes
function changeTextSize(size) {
    const body = document.body;
    
    // Reset previous size classes
    body.classList.remove('text-small', 'text-large');
    
    if (size === 'small') {
        body.classList.add('text-small');
        alert("Text size set to Small.");
    } else if (size === 'large') {
        body.classList.add('text-large');
        alert("Text size set to Large.");
    } else {
        // Default size (do nothing or set a default class)
        alert("Text size set to Default.");
    }
}

// Attach event listeners for size options
document.addEventListener('DOMContentLoaded', () => {
    // 1. Language Options (For demonstration, they currently just alert)
    const langOptions = document.querySelectorAll('.lang-option');
    langOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = option.getAttribute('data-lang');
            alert(`Language set to ${lang.toUpperCase()}. (Requires back-end integration)`);
            toggleDropdown(); // Close dropdown after selection
        });
    });

    // 2. Size Options
    const sizeOptions = document.querySelectorAll('.size-option');
    sizeOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            const size = option.getAttribute('data-size');
            changeTextSize(size);
            toggleDropdown(); // Close dropdown after selection
        });
    });
});

// Close the dropdown if the user clicks outside of it
window.onclick = function(event) {
    if (!event.target.matches('.accessibility-btn')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            const openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.drink-items-grid') || document;
  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('.drink-item');
    if (!tile) return;

    // Prefer data-* if present
    let id = tile.dataset.drinkId || '';
    let name = tile.dataset.name || '';
    let basePrice = tile.dataset.price ? parseFloat(tile.dataset.price) : NaN;

    // Fallbacks: read from inner DOM if data-* are missing
    if (!name) {
      const nameEl = tile.querySelector('.drink-name, [data-role="drink-name"]');
      name = nameEl ? nameEl.textContent.trim() : 'Custom Drink';
    }
    if (Number.isNaN(basePrice)) {
      const priceEl = tile.querySelector('.drink-price, [data-role="drink-price"]');
      if (priceEl) {
        const m = priceEl.textContent.replace(/[^\d.]/g, '');
        basePrice = m ? parseFloat(m) : 0;
      } else {
        basePrice = 0;
      }
    }
    if (!id) {
      id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    // Persist and navigate
    const drink = { id, name, basePrice: isFinite(basePrice) ? basePrice : 0 };
    sessionStorage.setItem('selectedDrink', JSON.stringify(drink));
    window.location.href = 'drinkcustomization.html';
  });

  // Optional: cart icon -> cart
  const cartIcon = document.querySelector('.cart-icon');
  if (cartIcon) cartIcon.addEventListener('click', () => (window.location.href = 'cart.html'));

  function updateCartBadge() {
    const badge = document.getElementById('cartCount');
    if (!badge) return;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length > 0) {
      badge.textContent = cart.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
  updateCartBadge();
});

/* --- Add the following to your CSS to support the JavaScript size change --- */
/*
body.text-small {
    font-size: 0.9em;
}

body.text-large {
    font-size: 1.2em;
}
*/