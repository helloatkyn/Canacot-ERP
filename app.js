// ==========================================
// CONFIG
// ==========================================
const CONFIG = {
  LS_PRODUCTS: 'billing_app_products',
  LS_RECORDS: 'billing_app_records',
  LS_COUNTER: 'billing_app_invoice_counter',
  LS_TAB: 'billing_app_last_tab'
};

// ==========================================
// STATE
// ==========================================
const state = {
  currentTab: 'new-bill',
  currentBill: {
    customer: { name: '', mobile: '', address: '' },
    items: [],
    notes: '',
    isEditing: false,
    editingId: null
  },
  savedRecords: [],
  products: [],
  invoiceCounter: 1,
  searchQuery: '',
  autocomplete: {
    activeIndex: -1,
    targetInput: null,
    matches: []
  }
};

// ==========================================
// DOM REFERENCES
// ==========================================
const DOM = {};
function cacheDOMRefs() {
  DOM.tabs = document.querySelectorAll('.segment-btn');
  DOM.pages = document.querySelectorAll('.page');
  DOM.actionBar = document.getElementById('action-bar');
  
  DOM.invoiceNumber = document.getElementById('invoice-number');
  DOM.custName = document.getElementById('cust-name');
  DOM.custMobile = document.getElementById('cust-mobile');
  DOM.custAddress = document.getElementById('cust-address');
  DOM.itemsList = document.getElementById('items-list');
  DOM.itemCount = document.getElementById('item-count');
  DOM.btnAddItem = document.getElementById('btn-add-item');
  DOM.subtotal = document.getElementById('subtotal');
  DOM.grandTotal = document.getElementById('grand-total');
  DOM.billNotes = document.getElementById('bill-notes');
  DOM.btnSave = document.getElementById('btn-save-bill');
  DOM.btnPrint = document.getElementById('btn-print-bill');
  DOM.btnThermal58 = document.getElementById('btn-thermal-58');
  DOM.btnThermal80 = document.getElementById('btn-thermal-80');
  
  DOM.searchInput = document.getElementById('search-records');
  DOM.clearSearch = document.getElementById('clear-search');
  DOM.searchCount = document.getElementById('search-count');
  DOM.recordsList = document.getElementById('saved-records-list');
  
  DOM.productsList = document.getElementById('products-list');
  DOM.btnAddProduct = document.getElementById('btn-add-product');
  
  DOM.autocomplete = document.getElementById('autocomplete-dropdown');
  
  DOM.modalOverlay = document.getElementById('modal-overlay');
  DOM.modalContent = document.getElementById('modal-content');
  
  DOM.toastContainer = document.getElementById('toast-container');
}

// ==========================================
// STORAGE & NORMALIZATION
// ==========================================
function safeParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null ? parsed : fallback;
  } catch (e) {
    console.warn(`Failed to parse ${key}, using fallback.`, e);
    return fallback;
  }
}

function safeSave(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
    showToast('Storage error. Data may not persist.', 'error');
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function normalizeItem(i) {
  if (!i || typeof i !== 'object') return { item: '', qty: 0, price: 0, total: 0 };
  const qty = Math.max(0, parseFloat(i.qty) || 0);
  const price = Math.max(0, parseFloat(i.price) || 0);
  return {
    item: String(i.item || ''),
    qty: isFinite(qty) ? qty : 0,
    price: isFinite(price) ? price : 0,
    total: isFinite(qty * price) ? qty * price : 0
  };
}

function normalizeRecord(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    id: r.id || generateId(),
    billNumber: String(r.billNumber || 'INV-0000'),
    date: r.date || new Date().toISOString(),
    savedAt: r.savedAt || Date.now(),
    customer: {
      name: String(r.customer?.name || ''),
      mobile: String(r.customer?.mobile || ''),
      address: String(r.customer?.address || '')
    },
    items: Array.isArray(r.items) ? r.items.map(normalizeItem) : [],
    grand: Math.max(0, parseFloat(r.grand) || 0),
    notes: String(r.notes || '')
  };
}

function normalizeProduct(p) {
  if (!p || typeof p !== 'object') return null;
  const price = Math.max(0, parseFloat(p.price) || 0);
  return {
    id: p.id || generateId(),
    code: String(p.code || '').trim(),
    name: String(p.name || '').trim(),
    price: isFinite(price) ? price : 0
  };
}

function loadData() {
  state.products = (safeParse(CONFIG.LS_PRODUCTS, []) || [])
    .map(normalizeProduct)
    .filter(p => p && p.code && p.name);
    
  state.savedRecords = (safeParse(CONFIG.LS_RECORDS, []) || [])
    .map(normalizeRecord)
    .filter(r => r)
    .sort((a, b) => b.savedAt - a.savedAt);
    
  const counter = safeParse(CONFIG.LS_COUNTER, 1);
  state.invoiceCounter = Math.max(1, parseInt(counter) || 1);
  
  state.currentTab = safeParse(CONFIG.LS_TAB, 'new-bill');
}

function saveProducts() { safeSave(CONFIG.LS_PRODUCTS, state.products); }
function saveRecords() { safeSave(CONFIG.LS_RECORDS, state.savedRecords); }
function saveCounter() { safeSave(CONFIG.LS_COUNTER, state.invoiceCounter); }
function saveTab() { safeSave(CONFIG.LS_TAB, state.currentTab); }

// ==========================================
// UTILS & FORMATTING
// ==========================================
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[match]));
}

function formatCurrency(amount) {
  const num = parseFloat(amount);
  if (isNaN(num) || !isFinite(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(num) {
  const n = parseFloat(num);
  if (isNaN(n) || !isFinite(n)) return '0';
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

// ==========================================
// BILL CALCULATIONS
// ==========================================
function calculateRowTotal(qty, price) {
  const q = Math.max(0, parseFloat(qty) || 0);
  const p = Math.max(0, parseFloat(price) || 0);
  const total = q * p;
  return isFinite(total) ? total : 0;
}

function calculateBillTotals() {
  let subtotal = 0;
  state.currentBill.items.forEach(item => {
    item.total = calculateRowTotal(item.qty, item.price);
    subtotal += item.total;
  });
  return isFinite(subtotal) ? subtotal : 0;
}

// ==========================================
// PRODUCT LOGIC
// ==========================================
function renderProducts() {
  if (state.products.length === 0) {
    DOM.productsList.innerHTML = `<div class="empty-state">No products yet</div>`;
    return;
  }
  
  const html = state.products.map(p => `
    <div class="product-row" data-id="${p.id}">
      <div class="product-info">
        <div class="product-name">${escapeHTML(p.name)}</div>
        <div class="product-meta">${escapeHTML(p.code)} • ${formatCurrency(p.price)}</div>
      </div>
      <div class="product-actions">
        <button class="btn-icon btn-edit-product" aria-label="Edit product">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="btn-icon btn-delete-product" aria-label="Delete product">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `).join('');
  
  DOM.productsList.innerHTML = html;
}

function openProductModal(product = null) {
  const isEdit = !!product;
  const html = `
    <div class="modal-header">
      <h2>${isEdit ? 'Edit Product' : 'Add Product'}</h2>
      <button class="btn-close-modal" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Product Code *</label>
        <input type="text" id="prod-code" class="input" value="${isEdit ? escapeHTML(product.code) : ''}" placeholder="e.g. SKU001">
      </div>
      <div class="form-group">
        <label>Product Name *</label>
        <input type="text" id="prod-name" class="input" value="${isEdit ? escapeHTML(product.name) : ''}" placeholder="e.g. Wooden Sofa">
      </div>
      <div class="form-group">
        <label>Default Price</label>
        <input type="number" id="prod-price" class="input" value="${isEdit ? product.price : '0'}" placeholder="0.00" step="0.01" min="0">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" data-action="close-modal">Cancel</button>
      <button class="btn btn-primary" data-action="save-product" data-id="${isEdit ? product.id : ''}">Save</button>
    </div>
  `;
  openModal(html);
  setTimeout(() => document.getElementById('prod-code').focus(), 100);
}

function saveProduct(id) {
  const code = document.getElementById('prod-code').value.trim();
  const name = document.getElementById('prod-name').value.trim();
  const price = Math.max(0, parseFloat(document.getElementById('prod-price').value) || 0);
  
  if (!code || !name) {
    showToast('Code and Name are required', 'error');
    return;
  }
  
  const duplicate = state.products.find(p => p.code.toLowerCase() === code.toLowerCase() && p.id !== id);
  if (duplicate) {
    showToast('Product code already exists', 'error');
    return;
  }
  
  if (id) {
    const idx = state.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      state.products[idx] = { ...state.products[idx], code, name, price };
    }
  } else {
    state.products.push({ id: generateId(), code, name, price });
  }
  
  saveProducts();
  renderProducts();
  closeModal();
  showToast('Product saved', 'success');
}

function deleteProduct(id) {
  openConfirm('Delete Product?', 'This cannot be undone.', () => {
    state.products = state.products.filter(p => p.id !== id);
    saveProducts();
    renderProducts();
    showToast('Product deleted', 'success');
  });
}

// ==========================================
// AUTOCOMPLETE
// ==========================================
function showAutocomplete(input, query) {
  if (!query || query.length < 1) {
    hideAutocomplete();
    return;
  }
  
  const q = query.toLowerCase().trim();
  const matches = state.products.filter(p => {
    const code = (p.code || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    return code.includes(q) || name.includes(q);
  }).sort((a, b) => {
    const aCode = (a.code || '').toLowerCase();
    const bCode = (b.code || '').toLowerCase();
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    
    if (aCode === q) return -1;
    if (bCode === q) return 1;
    if (aCode.startsWith(q) && !bCode.startsWith(q)) return -1;
    if (!aCode.startsWith(q) && bCode.startsWith(q)) return 1;
    if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
    if (!aName.startsWith(q) && bName.startsWith(q)) return 1;
    return 0;
  }).slice(0, 10);
  
  if (matches.length === 0) {
    hideAutocomplete();
    return;
  }
  
  state.autocomplete.targetInput = input;
  state.autocomplete.activeIndex = -1;
  state.autocomplete.matches = matches;
  
  const html = matches.map((p, i) => `
    <div class="ac-item" data-index="${i}">
      <div class="ac-name">${escapeHTML(p.name)}</div>
      <div class="ac-meta">${escapeHTML(p.code)} • ${formatCurrency(p.price)}</div>
    </div>
  `).join('');
  
  DOM.autocomplete.innerHTML = html;
  DOM.autocomplete.classList.remove('hidden');
  
  const rect = input.getBoundingClientRect();
  let top = rect.bottom + window.scrollY + 4;
  let left = rect.left + window.scrollX;
  let width = rect.width;
  
  requestAnimationFrame(() => {
    const acRect = DOM.autocomplete.getBoundingClientRect();
    if (left + acRect.width > window.innerWidth - 8) {
      left = window.innerWidth - acRect.width - 8;
    }
    if (top + acRect.height > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - acRect.height - 4;
    }
    DOM.autocomplete.style.top = `${top}px`;
    DOM.autocomplete.style.left = `${left}px`;
    DOM.autocomplete.style.width = `${width}px`;
  });
}

function hideAutocomplete() {
  DOM.autocomplete.classList.add('hidden');
  DOM.autocomplete.innerHTML = '';
  state.autocomplete.targetInput = null;
  state.autocomplete.activeIndex = -1;
  state.autocomplete.matches = [];
}

function selectAutocompleteItem(index) {
  const product = state.autocomplete.matches[index];
  const input = state.autocomplete.targetInput;
  if (!product || !input) return;
  
  const row = input.closest('.item-row');
  const nameInput = row.querySelector('.item-name');
  const priceInput = row.querySelector('.item-price');
  const qtyInput = row.querySelector('.item-qty');
  
  nameInput.value = product.name;
  priceInput.value = product.price;
  
  if (!qtyInput.value || parseFloat(qtyInput.value) === 0) {
    qtyInput.value = 1;
  }
  
  updateItemFromRow(row);
  hideAutocomplete();
  qtyInput.focus();
  qtyInput.select();
}

// ==========================================
// BILL LOGIC
// ==========================================
function renderBillUI() {
  DOM.custName.value = state.currentBill.customer.name;
  DOM.custMobile.value = state.currentBill.customer.mobile;
  DOM.custAddress.value = state.currentBill.customer.address;
  DOM.billNotes.value = state.currentBill.notes;
  
  if (state.currentBill.isEditing) {
    const record = state.savedRecords.find(r => r.id === state.currentBill.editingId);
    DOM.invoiceNumber.textContent = record ? record.billNumber : 'INV-EDIT';
  } else {
    DOM.invoiceNumber.textContent = `INV-${String(state.invoiceCounter).padStart(4, '0')}`;
  }
  
  renderItems();
  updateTotals();
}

function renderItems() {
  if (state.currentBill.items.length === 0) {
    DOM.itemsList.innerHTML = `<div class="empty-state" style="padding: 20px 0;">No items added</div>`;
    DOM.itemCount.textContent = '0 items';
    return;
  }
  
  const html = state.currentBill.items.map((item, i) => `
    <div class="item-row" data-index="${i}">
      <input type="text" class="input item-name" value="${escapeHTML(item.item)}" placeholder="Item name" autocomplete="off">
      <input type="number" class="input item-qty" value="${formatNumber(item.qty)}" placeholder="Qty" min="0" step="any">
      <input type="number" class="input item-price" value="${formatNumber(item.price)}" placeholder="Price" min="0" step="any">
      <button class="btn-icon btn-remove-item" aria-label="Remove item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="item-row" style="border-bottom: 1px solid var(--border-color); padding-top: 0; padding-bottom: 10px; grid-template-columns: 1fr 36px;">
      <div class="item-total">Total: ${formatCurrency(item.total)}</div>
      <div></div>
    </div>
  `).join('');
  
  DOM.itemsList.innerHTML = html;
  DOM.itemCount.textContent = `${state.currentBill.items.length} item${state.currentBill.items.length !== 1 ? 's' : ''}`;
}

function updateItemFromRow(row) {
  const index = parseInt(row.dataset.index);
  if (isNaN(index)) return;
  
  const name = row.querySelector('.item-name').value;
  const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
  const price = parseFloat(row.querySelector('.item-price').value) || 0;
  
  state.currentBill.items[index].item = name;
  state.currentBill.items[index].qty = Math.max(0, qty);
  state.currentBill.items[index].price = Math.max(0, price);
  state.currentBill.items[index].total = calculateRowTotal(qty, price);
  
  const totalRow = row.nextElementSibling;
  if (totalRow && totalRow.classList.contains('item-row')) {
    totalRow.querySelector('.item-total').textContent = `Total: ${formatCurrency(state.currentBill.items[index].total)}`;
  }
  
  updateTotals();
}

function updateTotals() {
  const subtotal = calculateBillTotals();
  DOM.subtotal.textContent = formatCurrency(subtotal);
  DOM.grandTotal.textContent = formatCurrency(subtotal);
}

function addItem() {
  state.currentBill.items.push({ item: '', qty: 0, price: 0, total: 0 });
  renderItems();
  const inputs = DOM.itemsList.querySelectorAll('.item-name');
  if (inputs.length > 0) {
    const lastInput = inputs[inputs.length - 1];
    lastInput.focus();
    lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function removeItem(index) {
  state.currentBill.items.splice(index, 1);
  renderItems();
  updateTotals();
}

function hasUnsavedData() {
  const b = state.currentBill;
  return b.items.length > 0 || 
         b.customer.name.trim() !== '' || 
         b.customer.mobile.trim() !== '' || 
         b.customer.address.trim() !== '' || 
         b.notes.trim() !== '';
}

function resetCurrentBill() {
  state.currentBill = {
    customer: { name: '', mobile: '', address: '' },
    items: [],
    notes: '',
    isEditing: false,
    editingId: null
  };
  renderBillUI();
}

function saveBill() {
  if (state.currentBill.items.length === 0) {
    showToast('Add at least one item', 'error');
    return;
  }
  
  const hasValidItem = state.currentBill.items.some(i => i.item.trim() !== '' && i.total > 0);
  if (!hasValidItem) {
    showToast('Items must have name and total', 'error');
    return;
  }
  
  const billNumber = state.currentBill.isEditing 
    ? state.savedRecords.find(r => r.id === state.currentBill.editingId).billNumber 
    : `INV-${String(state.invoiceCounter).padStart(4, '0')}`;
    
  const record = {
    id: state.currentBill.editingId || generateId(),
    billNumber: billNumber,
    date: state.currentBill.isEditing 
      ? state.savedRecords.find(r => r.id === state.currentBill.editingId).date 
      : new Date().toISOString(),
    savedAt: Date.now(),
    customer: { ...state.currentBill.customer },
    items: state.currentBill.items.map(i => ({ ...i })),
    grand: calculateBillTotals(),
    notes: state.currentBill.notes
  };
  
  if (state.currentBill.isEditing) {
    const idx = state.savedRecords.findIndex(r => r.id === state.currentBill.editingId);
    if (idx !== -1) state.savedRecords[idx] = record;
  } else {
    state.savedRecords.unshift(record);
    state.invoiceCounter++;
    saveCounter();
  }
  
  saveRecords();
  resetCurrentBill();
  showToast('Bill saved successfully', 'success');
  switchTab('saved-bills');
}

// ==========================================
// SAVED RECORDS
// ==========================================
function filterRecords() {
  const q = state.searchQuery.toLowerCase().trim();
  if (!q) {
    DOM.clearSearch.classList.add('hidden');
    DOM.searchCount.textContent = `${state.savedRecords.length} bills`;
    return state.savedRecords;
  }
  
  DOM.clearSearch.classList.remove('hidden');
  
  const filtered = state.savedRecords.filter(r => {
    const inv = (r.billNumber || '').toLowerCase();
    const name = (r.customer?.name || '').toLowerCase();
    const mobile = (r.customer?.mobile || '').toLowerCase();
    const address = (r.customer?.address || '').toLowerCase();
    const notes = (r.notes || '').toLowerCase();
    const dateStr = new Date(r.date).toLocaleDateString('en-IN').toLowerCase();
    const itemsStr = r.items.map(i => (i.item || '').toLowerCase()).join(' ');
    
    return inv.includes(q) || name.includes(q) || mobile.includes(q) || 
           address.includes(q) || notes.includes(q) || dateStr.includes(q) || itemsStr.includes(q);
  });
  
  DOM.searchCount.textContent = `${filtered.length} bill${filtered.length !== 1 ? 's' : ''}`;
  return filtered;
}

function renderSavedRecords() {
  const records = filterRecords();
  
  if (records.length === 0) {
    DOM.recordsList.innerHTML = `<div class="empty-state">${state.searchQuery ? 'No matching records' : 'No saved records'}</div>`;
    return;
  }
  
  const html = records.map(r => `
    <div class="record-row" data-id="${r.id}">
      <div class="record-main" data-action="view">
        <div class="record-header">
          <span class="record-inv">${escapeHTML(r.billNumber)}</span>
          <span class="record-date">${new Date(r.date).toLocaleDateString('en-IN')}</span>
        </div>
        <div class="record-customer">${escapeHTML(r.customer.name || 'Guest')}</div>
        <div class="record-items-preview">${r.items.map(i => escapeHTML(i.item)).filter(Boolean).join(', ')}</div>
      </div>
      <div class="record-total">${formatCurrency(r.grand)}</div>
    </div>
  `).join('');
  
  DOM.recordsList.innerHTML = html;
}

function viewRecord(id) {
  const record = state.savedRecords.find(r => r.id === id);
  if (!record) return;
  
  const itemsHTML = record.items.map(i => `
    <tr>
      <td>${escapeHTML(i.item)}</td>
      <td class="num">${formatNumber(i.qty)}</td>
      <td class="num">${formatCurrency(i.price)}</td>
      <td class="num">${formatCurrency(i.total)}</td>
    </tr>
  `).join('');
  
  const html = `
    <div class="modal-header">
      <h2>${escapeHTML(record.billNumber)}</h2>
      <button class="btn-close-modal" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="record-details">
        <div><strong>${escapeHTML(record.customer.name || 'Guest')}</strong></div>
        ${record.customer.mobile ? `<div>${escapeHTML(record.customer.mobile)}</div>` : ''}
        ${record.customer.address ? `<div>${escapeHTML(record.customer.address)}</div>` : ''}
        <div class="text-secondary">${new Date(record.date).toLocaleString('en-IN')}</div>
      </div>
      <table class="items-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
        <tfoot>
          <tr><td colspan="3" class="text-right">Grand Total</td><td class="num"><strong>${formatCurrency(record.grand)}</strong></td></tr>
        </tfoot>
      </table>
      ${record.notes ? `<div class="record-notes"><strong>Notes:</strong> ${escapeHTML(record.notes)}</div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" data-action="edit-record" data-id="${record.id}">Edit</button>
      <button class="btn btn-outline" data-action="print-record" data-id="${record.id}">Print</button>
      <button class="btn btn-outline" data-action="thermal-record" data-id="${record.id}">Thermal</button>
      <button class="btn btn-danger" data-action="delete-record" data-id="${record.id}">Delete</button>
    </div>
  `;
  
  openModal(html);
}

function editRecord(id) {
  const record = state.savedRecords.find(r => r.id === id);
  if (!record) return;
  
  state.currentBill = {
    customer: { ...record.customer },
    items: record.items.map(i => ({ ...i })),
    notes: record.notes || '',
    isEditing: true,
    editingId: record.id
  };
  
  closeModal();
  switchTab('new-bill');
  renderBillUI();
  showToast('Editing ' + record.billNumber);
}

function deleteRecord(id) {
  openConfirm('Delete Record?', 'This cannot be undone.', () => {
    state.savedRecords = state.savedRecords.filter(r => r.id !== id);
    saveRecords();
    closeModal();
    renderSavedRecords();
    showToast('Record deleted', 'success');
  });
}

// ==========================================
// PRINTING
// ==========================================
function generateReceiptHTML(bill, invoiceNum) {
  const date = new Date().toLocaleString('en-IN');
  let itemsHTML = bill.items.map(i => `
    <div class="receipt-item">
      <div style="flex:1; word-break:break-word;">${escapeHTML(i.item)}</div>
      <div style="text-align:right; white-space:nowrap; margin-left:8px;">${formatNumber(i.qty)}×${formatCurrency(i.price)}<br><strong>${formatCurrency(i.total)}</strong></div>
    </div>
  `).join('');
  
  return `
    <div class="receipt">
      <div class="receipt-header">
        <div style="font-weight:bold; font-size:1.2em;">INVOICE</div>
        <div>${invoiceNum}</div>
        <div>${date}</div>
      </div>
      <div class="receipt-customer" style="margin-bottom:10px; border-bottom:1px dashed #000; padding-bottom:10px;">
        <div><strong>${escapeHTML(bill.customer.name || 'Guest')}</strong></div>
        ${bill.customer.mobile ? `<div>${escapeHTML(bill.customer.mobile)}</div>` : ''}
        ${bill.customer.address ? `<div>${escapeHTML(bill.customer.address)}</div>` : ''}
      </div>
      <div class="receipt-items" style="margin: 10px 0; border-bottom:1px dashed #000; padding-bottom:10px;">
        ${itemsHTML}
      </div>
      <div class="receipt-row" style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>Subtotal</span>
        <span>${formatCurrency(bill.grand)}</span>
      </div>
      <div class="receipt-row" style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.2em; margin-top:8px;">
        <span>Grand Total</span>
        <span>${formatCurrency(bill.grand)}</span>
      </div>
      ${bill.notes ? `<div style="margin-top:12px; font-size:0.9em; border-top:1px dashed #000; padding-top:8px;">Notes: ${escapeHTML(bill.notes)}</div>` : ''}
    </div>
  `;
}

function printContent(html, isThermal = false, thermalSize = '80mm') {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print</title>
      <style>
        @page { margin: 0; ${isThermal ? `size: ${thermalSize} auto;` : ''} }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
          margin: 0; padding: ${isThermal ? '4mm' : '20mm'}; 
          color: #000; background: #fff; 
          ${isThermal ? `width: ${thermalSize}; box-sizing: border-box;` : ''}
        }
        .receipt { font-size: ${isThermal ? '12px' : '14px'}; line-height: 1.4; }
        .receipt-header { text-align: center; margin-bottom: 10px; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  doc.close();
  
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  
  iframe.contentWindow.addEventListener('afterprint', () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  });
  
  setTimeout(() => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 2000);
}

function getCurrentBillForPrint() {
  if (state.currentBill.items.length > 0 || hasUnsavedData()) {
    return { bill: state.currentBill, num: DOM.invoiceNumber.textContent };
  }
  return null;
}

function printNormal(id = null) {
  let bill, num;
  if (id) {
    const r = state.savedRecords.find(r => r.id === id);
    if (!r) return;
    bill = r; num = r.billNumber;
  } else {
    const current = getCurrentBillForPrint();
    if (!current) { showToast('Nothing to print', 'error'); return; }
    bill = current.bill; num = current.num;
  }
  printContent(generateReceiptHTML(bill, num), false);
}

function printThermal(id = null, size = '80mm') {
  let bill, num;
  if (id) {
    const r = state.savedRecords.find(r => r.id === id);
    if (!r) return;
    bill = r; num = r.billNumber;
  } else {
    const current = getCurrentBillForPrint();
    if (!current) { showToast('Nothing to print', 'error'); return; }
    bill = current.bill; num = current.num;
  }
  printContent(generateReceiptHTML(bill, num), true, size);
}

// ==========================================
// MODALS & TOASTS
// ==========================================
function openModal(html) {
  DOM.modalContent.innerHTML = html;
  DOM.modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  DOM.modalOverlay.classList.add('hidden');
  DOM.modalContent.innerHTML = '';
  document.body.style.overflow = '';
}

function openConfirm(title, message, onConfirm) {
  const html = `
    <div class="modal-header">
      <h2>${escapeHTML(title)}</h2>
      <button class="btn-close-modal" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <p>${escapeHTML(message)}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" data-action="close-modal">Cancel</button>
      <button class="btn btn-danger" data-action="confirm-action">Confirm</button>
    </div>
  `;
  openModal(html);
  
  const confirmBtn = DOM.modalContent.querySelector('[data-action="confirm-action"]');
  confirmBtn.addEventListener('click', () => {
    closeModal();
    onConfirm();
  }, { once: true });
}

let toastTimeout;
function showToast(message, type = 'info') {
  clearTimeout(toastTimeout);
  DOM.toastContainer.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);
  
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ==========================================
// NAVIGATION
// ==========================================
function switchTab(tabName) {
  if (tabName === state.currentTab && !state.currentBill.isEditing) return;
  
  if (state.currentTab === 'new-bill' && tabName !== 'new-bill') {
    if (hasUnsavedData() && !state.currentBill.isEditing) {
      openConfirm('Discard Bill?', 'You have unsaved data. Do you want to discard it?', () => {
        resetCurrentBill();
        performSwitch(tabName);
      });
      return;
    }
  }
  
  performSwitch(tabName);
}

function performSwitch(tabName) {
  state.currentTab = tabName;
  saveTab();
  
  DOM.tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  DOM.pages.forEach(page => page.classList.toggle('active', page.id === `page-${tabName}`));
  
  if (tabName === 'saved-bills') renderSavedRecords();
  if (tabName === 'products') renderProducts();
  if (tabName === 'new-bill') renderBillUI();
  
  window.scrollTo(0, 0);
}

// ==========================================
// EVENT HANDLERS
// ==========================================
function initEvents() {
  // Tab Navigation
  document.getElementById('tab-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.segment-btn');
    if (btn) switchTab(btn.dataset.tab);
  });
  
  // New Bill Inputs
  DOM.custName.addEventListener('input', () => state.currentBill.customer.name = DOM.custName.value);
  DOM.custMobile.addEventListener('input', () => state.currentBill.customer.mobile = DOM.custMobile.value);
  DOM.custAddress.addEventListener('input', () => state.currentBill.customer.address = DOM.custAddress.value);
  DOM.billNotes.addEventListener('input', () => state.currentBill.notes = DOM.billNotes.value);
  
  DOM.btnAddItem.addEventListener('click', addItem);
  DOM.btnSave.addEventListener('click', saveBill);
  DOM.btnPrint.addEventListener('click', () => printNormal());
  DOM.btnThermal58.addEventListener('click', () => printThermal(null, '58mm'));
  DOM.btnThermal80.addEventListener('click', () => printThermal(null, '80mm'));
  
  // Items List Delegation
  DOM.itemsList.addEventListener('input', (e) => {
    const row = e.target.closest('.item-row');
    if (!row) return;
    
    if (e.target.classList.contains('item-name')) {
      showAutocomplete(e.target, e.target.value);
    }
    
    if (e.target.classList.contains('item-name') || 
        e.target.classList.contains('item-qty') || 
        e.target.classList.contains('item-price')) {
      updateItemFromRow(row);
    }
  });
  
  DOM.itemsList.addEventListener('click', (e) => {
    if (e.target.closest('.btn-remove-item')) {
      const row = e.target.closest('.item-row');
      if (row) removeItem(parseInt(row.dataset.index));
    }
  });
  
  // Autocomplete
  DOM.autocomplete.addEventListener('click', (e) => {
    const item = e.target.closest('.ac-item');
    if (item) selectAutocompleteItem(parseInt(item.dataset.index));
  });
  
  document.addEventListener('keydown', (e) => {
    if (DOM.autocomplete.classList.contains('hidden')) return;
    const items = DOM.autocomplete.querySelectorAll('.ac-item');
    if (items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.autocomplete.activeIndex = Math.min(state.autocomplete.activeIndex + 1, items.length - 1);
      updateAutocompleteActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.autocomplete.activeIndex = Math.max(state.autocomplete.activeIndex - 1, -1);
      updateAutocompleteActive(items);
    } else if (e.key === 'Enter' && state.autocomplete.activeIndex >= 0) {
      e.preventDefault();
      selectAutocompleteItem(state.autocomplete.activeIndex);
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-dropdown') && !e.target.closest('.item-name')) {
      hideAutocomplete();
    }
  });
  
  // Saved Records Search
  DOM.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderSavedRecords();
  });
  
  DOM.clearSearch.addEventListener('click', () => {
    DOM.searchInput.value = '';
    state.searchQuery = '';
    renderSavedRecords();
    DOM.searchInput.focus();
  });
  
  // Saved Records List Delegation
  DOM.recordsList.addEventListener('click', (e) => {
    const row = e.target.closest('.record-row');
    if (!row) return;
    const id = row.dataset.id;
    const action = e.target.closest('[data-action]')?.dataset.action;
    
    if (action === 'view' || e.target.closest('.record-main')) viewRecord(id);
  });
  
  // Products List Delegation
  DOM.productsList.addEventListener('click', (e) => {
    const row = e.target.closest('.product-row');
    if (!row) return;
    const id = row.dataset.id;
    
    if (e.target.closest('.btn-edit-product')) {
      const p = state.products.find(p => p.id === id);
      if (p) openProductModal(p);
    }
    if (e.target.closest('.btn-delete-product')) {
      deleteProduct(id);
    }
  });
  
  DOM.btnAddProduct.addEventListener('click', () => openProductModal());
  
  // Modal Delegation
  DOM.modalOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.modalOverlay || e.target.closest('.btn-close-modal') || e.target.closest('[data-action="close-modal"]')) {
      closeModal();
    }
    
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    
    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;
    
    if (action === 'save-product') saveProduct(id || null);
    if (action === 'edit-record') editRecord(id);
    if (action === 'delete-record') deleteRecord(id);
    if (action === 'print-record') printNormal(id);
    if (action === 'thermal-record') printThermal(id, '80mm');
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !DOM.modalOverlay.classList.contains('hidden')) {
      closeModal();
    }
  });
  
  // Prevent zoom on double tap (iOS)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}

function updateAutocompleteActive(items) {
  items.forEach((item, i) => {
    item.classList.toggle('active', i === state.autocomplete.activeIndex);
  });
  if (state.autocomplete.activeIndex >= 0 && items[state.autocomplete.activeIndex]) {
    items[state.autocomplete.activeIndex].scrollIntoView({ block: 'nearest' });
  }
}

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
  cacheDOMRefs();
  loadData();
  initEvents();
  performSwitch(state.currentTab);
}

document.addEventListener('DOMContentLoaded', init);
