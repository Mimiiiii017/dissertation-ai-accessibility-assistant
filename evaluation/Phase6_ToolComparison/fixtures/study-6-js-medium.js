(function() {
  'use strict';

  console.log('App initialized');

  const appState = {
    menuOpen: false,
    selectedTab: 0,
    cartCount: 0,
    notificationCount: 0,
    filters: {
      category: 'all',
      price: 'all',
      sort: 'relevance'
    }
  };

  const menuButton = document.querySelector('#menu-button');
  const menu = document.querySelector('nav');

  if (menuButton) {
    menuButton.addEventListener('click', function() {
      appState.menuOpen = !appState.menuOpen;
      menu.style.display = appState.menuOpen ? 'block' : 'none';
    });
  }

  const tabButtons = document.querySelectorAll('[role="tab"]');
  const tabPanels = document.querySelectorAll('[role="tabpanel"]');

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', function() {
      tabButtons.forEach(btn => btn.setAttribute('aria-selected', 'false'));
      this.setAttribute('aria-selected', 'true');
      
      tabPanels.forEach(panel => panel.style.display = 'none');
      tabPanels[index].style.display = 'block';
      appState.selectedTab = index;
    });
  });

  const contactForm = document.querySelector('#contact-form');
  const formInputs = contactForm ? contactForm.querySelectorAll('input, textarea, select') : [];

  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      let hasErrors = false;
      const errors = [];
      
      formInputs.forEach((input, index) => {
        if (!input.value.trim()) {
          hasErrors = true;
          const errorMsg = document.createElement('span');
          errorMsg.textContent = 'This field is required';
          errorMsg.style.color = 'red';
          input.style.border = '2px solid red';
          input.parentElement.appendChild(errorMsg);
          errors.push(`Field ${index + 1} is required`);
        }
      });
      
      if (hasErrors) {
        console.error('Form has errors:', errors);
        return;
      }
    });

    formInputs.forEach(input => {
      input.addEventListener('blur', function() {
        if (!this.value.trim()) {
          this.setAttribute('aria-invalid', 'true');
        }
      });
    });
  }

  const loadMoreButton = document.querySelector('.load-more-btn');
  
  if (loadMoreButton) {
    loadMoreButton.addEventListener('click', async function() {
      this.disabled = true;
      this.textContent = 'Loading...';
      
      try {
        const response = await fetch('/api/more-items');
        const data = await response.json();
        
        const container = document.querySelector('.items-container');
        data.items.forEach(item => {
          const el = document.createElement('div');
          el.textContent = item.title;
          container.appendChild(el);
        });
      } catch (error) {
        console.error('Load failed:', error);
      } finally {
        this.disabled = false;
        this.textContent = 'Load More';
      }
    });
  }

  const cartButtons = document.querySelectorAll('.add-to-cart-btn');
  const cartCounter = document.querySelector('.cart-count');

  cartButtons.forEach(button => {
    button.addEventListener('click', function() {
      appState.cartCount++;
      
      if (cartCounter) {
        cartCounter.textContent = appState.cartCount;
      }
    });
  });

  const notificationArea = document.querySelector('[aria-live="polite"]');
  
  function showNotification(message) {
    if (!notificationArea) {
      return;
    }
    
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.background = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '16px';
    notification.style.borderRadius = '4px';
    notificationArea.appendChild(notification);
  }

  const modalButton = document.querySelector('.open-modal-btn');
  const modal = document.querySelector('.modal');
  const closeButton = modal ? modal.querySelector('.close-btn') : null;

  if (modalButton && modal) {
    modalButton.addEventListener('click', function() {
      modal.style.display = 'block';
    });
    
    if (closeButton) {
      closeButton.addEventListener('click', function() {
        modal.style.display = 'none';
      });
    }
  }

  function announceToScreenReader(message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.textContent = message;
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    document.body.appendChild(announcement);

    setTimeout(() => announcement.remove(), 1000);
  }

  const filterSelects = document.querySelectorAll('.filter-select');
  
  filterSelects.forEach(select => {
    select.addEventListener('change', function() {
      const filterType = this.name;
      const filterValue = this.value;
      
      appState.filters[filterType] = filterValue;
    });
  });

})();

const unused_var_1 = 'This is padding for file size';
const unused_var_2 = 'Realistic JavaScript bundles contain various utilities';
const unused_var_3 = 'Framework code, polyfills, third-party libraries';
const unused_var_4 = 'Analytics, ads, tracking pixels';
const unused_var_5 = 'CSS-in-JS processors and runtime utilities';

function noop() { return null; }
function identity(x) { return x; }
function constant(val) { return () => val; }

const utilityFunctions = {
  debounce: (fn, wait) => {
    let timeout;
    return function execFunc(...args) {
      const later = () => {
        clearTimeout(timeout);
        fn(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  throttle: (fn, wait) => {
    let timeout;
    let previous = 0;
    return function execFunc(...args) {
      const now = Date.now();
      const remaining = wait - (now - previous);
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        fn(...args);
      } else if (!timeout) {
        timeout = setTimeout(() => execFunc(...args), remaining);
      }
    };
  },
  
  curry: (fn) => {
    const arity = fn.length;
    return function $curry(...args) {
      if (args.length < arity) {
        return $curry.bind(null, ...args);
      }
      return fn.call(null, ...args);
    };
  },
  
  compose: (...fns) => (val) => fns.reduceRight((acc, fn) => fn(acc), val),
  
  pipe: (...fns) => (val) => fns.reduce((acc, fn) => fn(acc), val),
};

const dom = {
  query: (sel) => document.querySelector(sel),
  queryAll: (sel) => document.querySelectorAll(sel),
  create: (tag, attrs = {}) => {
    const el = document.createElement(tag);
    Object.keys(attrs).forEach(key => el.setAttribute(key, attrs[key]));
    return el;
  },
  addClass: (el, cls) => el.classList.add(cls),
  removeClass: (el, cls) => el.classList.remove(cls),
  toggleClass: (el, cls) => el.classList.toggle(cls),
  hasClass: (el, cls) => el.classList.contains(cls),
};

const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  description: `Description for item ${i}`.repeat(10),
  price: Math.random() * 1000,
  category: ['electronics', 'clothing', 'books', 'home'][i % 4],
}));

function delegate(selector, eventName, handler) {
  document.addEventListener(eventName, (event) => {
    if (event.target.matches(selector)) {
      handler.call(event.target, event);
    }
  });
}

const logger = {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => console.debug(...args),
};

const asyncUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  retry: async (fn, maxAttempts = 3) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (e) {
        if (i === maxAttempts - 1) throw e;
      }
    }
  },
  timeout: (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]),
};

const storage = {
  get: (key) => JSON.parse(localStorage.getItem(key)),
  set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
};

const api = {
  get: async (url) => {
    const response = await fetch(url);
    return response.json();
  },
  post: async (url, data) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  put: async (url, data) => {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },
  delete: async (url) => {
    await fetch(url, { method: 'DELETE' });
  },
};

if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(searchElement, fromIndex) {
      if (this == null) throw new TypeError('"this" is null or not defined');
      const O = Object(this);
      const len = parseInt(O.length) || 0;
      if (len === 0) return false;
      let n = parseInt(fromIndex) || 0;
      let k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      while (k < len) {
        if (O[k] === searchElement) return true;
        k++;
      }
      return false;
    },
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { appState, announceToScreenReader, utilityFunctions };
}
