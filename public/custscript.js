// Function to toggle the display of the dropdown menu
function toggleDropdown() {
    document.getElementById("accessibilityDropdown").classList.toggle("show");
}

(function applySavedTextSizeEarly() {
  try {
    const saved = localStorage.getItem('textSize');
    const html = document.documentElement;
    const body = document.body;

    html.classList.remove('text-small', 'text-large');
    body.classList.remove('text-small', 'text-large');

    if (saved === 'small') {
      html.classList.add('text-small');
      body.classList.add('text-small');

    } else if (saved === 'large') {
      html.classList.add('text-large');
      body.classList.add('text-large');
    }
    body.classList.remove('text-small', 'text-large');
    if (size === 'small') {
        body.classList.add('text-small');
        alert("Text size set to Small.");
    } else if (size === 'large') {
        body.classList.add('text-large');
        alert("Text size set to Large.");
    } else {
        alert("Text size set to Default.");
    }
  } catch (e) {
    // ignore
  }
})();

function applyTextSize(size) {
  const html = document.documentElement;
  const body = document.body;

  html.classList.remove('text-small', 'text-large');
  body.classList.remove('text-small', 'text-large');

  if (size === 'small') {
    html.classList.add('text-small');
    body.classList.add('text-small');

  } else if (size === 'large') {
    html.classList.add('text-large');
    body.classList.add('text-large');
  }
}

function changeTextSize(size) {
  try { localStorage.setItem('textSize', size); } catch (e) {}
  applyTextSize(size);
}

// Smooth page navigation for category buttons
function navigateSmoothly(url) {
    const grid = document.querySelector('.drink-items-grid');
    if (!grid) {
        window.location.href = url; // fallback
        return;
    }

    grid.style.transition = 'opacity 0.3s';
    grid.style.opacity = 0;

    setTimeout(() => {
        window.location.href = url;
    }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- LOAD HIGH CONTRAST PREFERENCE ON PAGE LOAD ---
    const savedHighContrast = sessionStorage.getItem('highContrast');
    if (savedHighContrast === 'true') {
        document.body.classList.add('high-contrast');
    }

    // --- LANGUAGE OPTIONS ---
    const langOptions = document.querySelectorAll('.lang-option');
    langOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = option.getAttribute('data-lang');
            alert(`Language set to ${lang.toUpperCase()}. (Requires back-end integration)`);
            toggleDropdown();
        });
    });

    // --- TEXT SIZE OPTIONS ---
    const sizeOptions = document.querySelectorAll('.size-option');
    sizeOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            const size = option.getAttribute('data-size');
            changeTextSize(size);
            toggleDropdown();
        });
    });

    const saved = localStorage.getItem('textSize');
    if (saved === 'large' || saved === 'small') {
      applyTextSize(saved);
    }  
    // --- HIGH CONTRAST TOGGLE ---
    const contrastToggle = document.getElementById('contrastToggle');
    if (contrastToggle) {
        contrastToggle.addEventListener('click', (e) => {
            e.preventDefault();
            document.body.classList.toggle('high-contrast');
            const isHighContrast = document.body.classList.contains('high-contrast');
            sessionStorage.setItem('highContrast', isHighContrast); // Save preference to sessionStorage
            toggleDropdown();
        });
    }

    // --- CATEGORY NAVIGATION ---
    const navButtons = document.querySelectorAll('.nav-button a');
    navButtons.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = link.getAttribute('href');
            navigateSmoothly(url);
        });
    });

    // --- DRINK TILE CLICK HANDLING ---
    const grid = document.querySelector('.drink-items-grid') || document;
    grid.addEventListener('click', (e) => {
        const tile = e.target.closest('.drink-item');
        if (!tile) return;

        let id = tile.dataset.drinkId || '';
        let name = tile.dataset.name || '';
        let basePrice = tile.dataset.price ? parseFloat(tile.dataset.price) : NaN;

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

        const drink = { id, name, basePrice: isFinite(basePrice) ? basePrice : 0 };
        sessionStorage.setItem('selectedDrink', JSON.stringify(drink));
        window.location.href = 'drinkcustomization.html';
    });

    // --- CART ICON & BADGE ---
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

// Close dropdown if clicking outside
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
