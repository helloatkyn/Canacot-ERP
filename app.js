/**
 * InventoryOS — Dashboard App
 * ───────────────────────────────────────────────────────────────────
 * Vanilla JavaScript — No frameworks, no libraries except Lucide icons.
 * Handles: sidebar toggle, nav highlighting, counter animation,
 * data rendering, progress bars, time greeting, search focus, keyboard.
 */

/* ═══════════════════════════════════════════════════════════════════
   1. CONSTANTS & DATA
═══════════════════════════════════════════════════════════════════ */

/** Recent activity table data */
const ACTIVITY_DATA = [
  {
    time:     '14:32',
    product:  'Springfit Latex Mattress',
    code:     'SKU-M4821',
    company:  'Sleepwell',
    action:   'in',
    qty:      '+240',
    status:   'completed',
  },
  {
    time:     '13:58',
    product:  'Nilkamal Office Chair',
    code:     'SKU-C9034',
    company:  'Nilkamal',
    action:   'out',
    qty:      '−18',
    status:   'completed',
  },
  {
    time:     '13:21',
    product:  'Kurlon Dream Foam 6"',
    code:     'SKU-M2201',
    company:  'Kurlon',
    action:   'in',
    qty:      '+120',
    status:   'completed',
  },
  {
    time:     '12:45',
    product:  'Godrej Interio Wardrobe',
    code:     'SKU-W7712',
    company:  'Godrej',
    action:   'out',
    qty:      '−4',
    status:   'pending',
  },
  {
    time:     '12:08',
    product:  'Wooden Dining Table 6S',
    code:     'SKU-T3390',
    company:  'Furniture World',
    action:   'in',
    qty:      '+32',
    status:   'completed',
  },
  {
    time:     '11:34',
    product:  'Sleepwell Nexa 8" King',
    code:     'SKU-M5503',
    company:  'Sleepwell',
    action:   'out',
    qty:      '−10',
    status:   'completed',
  },
  {
    time:     '11:02',
    product:  'Kurlon Natural Fresh',
    code:     'SKU-M1170',
    company:  'Kurlon',
    action:   'adj',
    qty:      '+5',
    status:   'pending',
  },
  {
    time:     '10:48',
    product:  'Nilkamal Plastic Shelf Unit',
    code:     'SKU-S6641',
    company:  'Nilkamal',
    action:   'in',
    qty:      '+300',
    status:   'completed',
  },
  {
    time:     '10:15',
    product:  'Godrej Lush Plus Memory',
    code:     'SKU-M9920',
    company:  'Godrej',
    action:   'out',
    qty:      '−22',
    status:   'completed',
  },
  {
    time:     '09:50',
    product:  'Engineered Wood Bookshelf',
    code:     'SKU-B2288',
    company:  'Furniture World',
    action:   'in',
    qty:      '+60',
    status:   'cancelled',
  },
];

/** Low stock items */
const LOW_STOCK_DATA = [
  { name: 'Sleepwell Nexa 6" Queen',  sku: 'SKU-M5501', qty: 3 },
  { name: 'Godrej Smart TV Unit',      sku: 'SKU-U4410', qty: 5 },
  { name: 'Kurlon Ortho Spring 5"',    sku: 'SKU-M1130', qty: 2 },
  { name: 'Nilkamal Folding Table',    sku: 'SKU-T8821', qty: 7 },
  { name: 'Furniture World Bunk Bed',  sku: 'SKU-B5590', qty: 4 },
];

/** Top companies by volume */
const COMPANIES_DATA = [
  { name: 'Sleepwell',       pct: 88 },
  { name: 'Kurlon',          pct: 73 },
  { name: 'Godrej',          pct: 61 },
  { name: 'Nilkamal',        pct: 47 },
  { name: 'Furniture World', pct: 35 },
];

/* ═══════════════════════════════════════════════════════════════════
   2. DOM REFERENCES
═══════════════════════════════════════════════════════════════════ */
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const hamburger      = document.getElementById('hamburger');
const sidebarClose   = document.getElementById('sidebarClose');
const navLinks       = document.querySelectorAll('.nav-link');
const statValues     = document.querySelectorAll('.stat-value[data-target]');
const activityBody   = document.getElementById('activityTableBody');
const lowStockList   = document.getElementById('lowStockList');
const companiesList  = document.getElementById('companiesList');
const globalSearch   = document.getElementById('globalSearch');
const welcomeTitle   = document.getElementById('welcomeTitle');

/* ═══════════════════════════════════════════════════════════════════
   3. SIDEBAR TOGGLE (mobile)
═══════════════════════════════════════════════════════════════════ */

/**
 * Opens the sidebar on mobile.
 */
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
  sidebarClose.focus();
}

/**
 * Closes the sidebar on mobile.
 */
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
  document.body.style.overflow = '';
  hamburger.focus();
}

hamburger.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

/* Close sidebar on Escape key */
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' && sidebar.classList.contains('open')) {
    closeSidebar();
  }
});

/* ═══════════════════════════════════════════════════════════════════
   4. NAV LINK ACTIVE STATE
═══════════════════════════════════════════════════════════════════ */

navLinks.forEach(function(link) {
  link.addEventListener('click', function(event) {
    event.preventDefault();

    /* Remove active from all */
    navLinks.forEach(function(l) { l.classList.remove('active'); });

    /* Set active on clicked */
    link.classList.add('active');

    /* Close mobile sidebar after nav tap */
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════
   5. TIME-BASED GREETING
═══════════════════════════════════════════════════════════════════ */

/**
 * Returns a greeting based on the current hour.
 * @returns {string}
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

if (welcomeTitle) {
  welcomeTitle.textContent = getGreeting();
}

/* ═══════════════════════════════════════════════════════════════════
   6. ANIMATED STAT COUNTERS
═══════════════════════════════════════════════════════════════════ */

/**
 * Animates a number from 0 to target over `duration` ms.
 * Uses easeOutQuart for a premium deceleration feel.
 *
 * @param {HTMLElement} el      - Target DOM element
 * @param {number}      target  - End value
 * @param {number}      duration- Animation duration in ms
 */
function animateCounter(el, target, duration) {
  const startTime = performance.now();

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function tick(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value    = Math.round(easeOutQuart(progress) * target);

    /* Format large numbers with commas */
    el.textContent = value.toLocaleString('en-IN');

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

/**
 * Uses IntersectionObserver to trigger counters when stat cards are visible.
 */
function initCounters() {
  const observer = new IntersectionObserver(
    function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const el     = entry.target;
          const target = parseInt(el.dataset.target, 10);
          animateCounter(el, target, 1200);
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.3 }
  );

  statValues.forEach(function(el) {
    observer.observe(el);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   7. RENDER ACTIVITY TABLE
═══════════════════════════════════════════════════════════════════ */

/**
 * Maps action type to CSS modifier class and icon name.
 * @param {string} action
 * @returns {{ cls: string, icon: string, label: string }}
 */
function getActionMeta(action) {
  const map = {
    'in':  { cls: 'action-badge--in',  icon: 'arrow-down',  label: 'Stock In' },
    'out': { cls: 'action-badge--out', icon: 'arrow-up',    label: 'Stock Out' },
    'adj': { cls: 'action-badge--adj', icon: 'refresh-cw',  label: 'Adjusted' },
  };
  return map[action] || map['adj'];
}

/**
 * Maps status string to CSS modifier.
 * @param {string} status
 * @returns {string}
 */
function getStatusClass(status) {
  const map = {
    'completed': 'status-pill--completed',
    'pending':   'status-pill--pending',
    'cancelled': 'status-pill--cancelled',
  };
  return map[status] || 'status-pill--pending';
}

/**
 * Renders the recent activity table body.
 */
function renderActivityTable() {
  if (!activityBody) return;

  const rows = ACTIVITY_DATA.map(function(row) {
    const actionMeta  = getActionMeta(row.action);
    const statusClass = getStatusClass(row.status);
    const statusLabel = row.status.charAt(0).toUpperCase() + row.status.slice(1);
    const qtyClass    = row.action === 'out' ? 'color: var(--color-danger);' : '';

    return `
      <tr>
        <td class="td-time">${row.time}</td>
        <td>
          <span class="td-product">${row.product}</span>
          <span class="td-product-code">${row.code}</span>
        </td>
        <td class="td-company">${row.company}</td>
        <td>
          <span class="action-badge ${actionMeta.cls}">
            <i data-lucide="${actionMeta.icon}"></i>
            ${actionMeta.label}
          </span>
        </td>
        <td class="td-quantity" style="${qtyClass}">${row.qty}</td>
        <td>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </td>
      </tr>
    `;
  });

  activityBody.innerHTML = rows.join('');
}

/* ═══════════════════════════════════════════════════════════════════
   8. RENDER LOW STOCK LIST
═══════════════════════════════════════════════════════════════════ */

/**
 * Renders the low stock alerts list.
 */
function renderLowStock() {
  if (!lowStockList) return;

  const items = LOW_STOCK_DATA.map(function(item) {
    return `
      <li class="low-stock-item">
        <div class="low-stock-info">
          <span class="low-stock-name">${item.name}</span>
          <span class="low-stock-sku">${item.sku}</span>
        </div>
        <div class="low-stock-qty">
          <span class="qty-value">${item.qty}</span>
          <span class="qty-label">units left</span>
        </div>
      </li>
    `;
  });

  lowStockList.innerHTML = items.join('');
}

/* ═══════════════════════════════════════════════════════════════════
   9. RENDER TOP COMPANIES WITH PROGRESS BARS
═══════════════════════════════════════════════════════════════════ */

/**
 * Renders company list with percentage bars.
 * Progress bar widths animate in after a short delay via JS.
 */
function renderCompanies() {
  if (!companiesList) return;

  const items = COMPANIES_DATA.map(function(company, index) {
    return `
      <li class="company-item">
        <div class="company-item-header">
          <span class="company-name">${company.name}</span>
          <span class="company-pct">${company.pct}%</span>
        </div>
        <div class="progress-track" role="progressbar"
             aria-valuenow="${company.pct}" aria-valuemin="0" aria-valuemax="100"
             aria-label="${company.name} inventory volume ${company.pct}%">
          <div class="progress-fill"
               data-width="${company.pct}"
               style="transition-delay: ${index * 120}ms;">
          </div>
        </div>
      </li>
    `;
  });

  companiesList.innerHTML = items.join('');

  /* Animate bars after brief delay so transitions run */
  requestAnimationFrame(function() {
    setTimeout(function() {
      const fills = companiesList.querySelectorAll('.progress-fill');
      fills.forEach(function(fill) {
        fill.style.width = fill.dataset.width + '%';
      });
    }, 200);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   10. GLOBAL SEARCH — Keyboard shortcut (⌘K / Ctrl+K)
═══════════════════════════════════════════════════════════════════ */

/**
 * Focuses the global search on ⌘K or Ctrl+K.
 */
document.addEventListener('keydown', function(event) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? event.metaKey : event.ctrlKey;

  if (modKey && event.key === 'k') {
    event.preventDefault();
    if (globalSearch) {
      globalSearch.focus();
      globalSearch.select();
    }
  }
});

/* ═══════════════════════════════════════════════════════════════════
   11. LOGOUT BUTTON
═══════════════════════════════════════════════════════════════════ */

const logoutBtn = document.querySelector('.logout-btn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', function() {
    /* In production: confirm + redirect to login. */
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (confirmed) {
      /* Replace with your actual logout URL */
      console.info('InventoryOS: User logged out.');
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   12. WELCOME QUICK-ACTION BUTTONS — feedback stub
═══════════════════════════════════════════════════════════════════ */

/**
 * Binds quick-action buttons in the welcome card.
 * In production, replace stubs with routing / modal logic.
 */
function bindQuickActionButtons() {
  const actions = {
    'Add Product':   function() { console.info('Action: Add Product'); },
    'Stock In':      function() { console.info('Action: Stock In'); },
    'Stock Out':     function() { console.info('Action: Stock Out'); },
    'Add Company':   function() { console.info('Action: Add Company'); },
    'Create Sale':   function() { console.info('Action: Create Sale'); },
    'Generate Report': function() { console.info('Action: Generate Report'); },
  };

  document.querySelectorAll('.btn, .quick-action-btn').forEach(function(btn) {
    const label = btn.textContent.trim();
    if (actions[label]) {
      btn.addEventListener('click', actions[label]);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   13. HEADER SCROLL SHADOW
═══════════════════════════════════════════════════════════════════ */

/**
 * Adds a subtle elevated shadow to the header when user scrolls down,
 * reinforcing the sticky header layering.
 */
function initHeaderScroll() {
  const header = document.getElementById('topHeader');
  if (!header) return;

  const scrollRoot = document.querySelector('.main-wrapper') || window;

  function onScroll() {
    const scrollY = scrollRoot.scrollTop !== undefined
      ? scrollRoot.scrollTop
      : window.scrollY;

    if (scrollY > 4) {
      header.style.boxShadow = '0 1px 0 #E5E7EB, 0 4px 12px rgba(0,0,0,0.04)';
    } else {
      header.style.boxShadow = '';
    }
  }

  scrollRoot.addEventListener('scroll', onScroll, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════════
   14. INIT
═══════════════════════════════════════════════════════════════════ */

/**
 * Main initialisation — runs after DOM is ready.
 */
function init() {
  /* Render all dynamic content first */
  renderActivityTable();
  renderLowStock();
  renderCompanies();

  /* Re-initialise Lucide icons to pick up dynamically inserted icons */
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  /* Start counter animations */
  initCounters();

  /* Bind interactions */
  bindQuickActionButtons();
  initHeaderScroll();
}

/* Wait for DOM */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
