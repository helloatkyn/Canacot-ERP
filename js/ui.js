// ==========================================
// UI.JS — Presentation & UI Module
// ==========================================

let state, dom, config, utils;

/**
 * Initialize UI module
 */
export function initUI(appState, domRefs, cfg, utilFns) {
  state = appState;
  dom = domRefs;
  config = cfg;
  utils = utilFns;
  
  setupNavigation();
  setupSavedRecords();
  setupProducts();
  setupModals();
  setupPrint();
  setupGlobalEvents();
}

// ==========================================
// NAVIGATION
// ==========================================
function setupNavigation() {
  dom.tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      window.switchTab(btn.dataset.tab);
    });
  });
}

window.switchTab = function(tabName) {
  if (tabName === state.currentTab && !state.currentBill.isEditing) return;
  
  // Check for unsaved data when leaving new-bill tab
  if (state.currentTab === 'new-bill' && tabName !== 'new-bill') {
    if (window.hasUnsavedData() && !state.currentBill.isEditing) {
      window.openConfirm('Discard Bill?', 'You have unsaved data. Do you want to discard it?', () => {
        window.resetCurrentBill();
        performSwitch(tabName);
      });
      return;
    }
  }
  
  performSwitch(tabName);
};

function performSwitch(tabName) {
  state.currentTab = tabName;
  utils.saveTab();
  
  dom.tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
    btn.setAttribute('aria-selected', btn.dataset.tab === tabName ? 'true' : 'false');
  });
  
  dom.pages.forEach(page => {
    page.classList.toggle('active', page.id === `page-${tabName}`);
  });
  
  if (tabName === 'saved-bills') {
    renderSavedRecords();
  }
  if (tabName === 'products') {
    renderProducts();
  }
  if (tabName === 'new-bill') {
    window.renderBillUI();
  }
  
  window.scrollTo(0, 0);
}

// ==========================================
// SAVED RECORDS
// ==========================================
function setupSavedRecords() {
  // Search input
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderSavedRecords();
  });
  
  // Clear search button
  dom.clearSearch.addEventListener('click', () => {
    dom.searchInput.value = '';
    state.searchQuery = '';
    renderSavedRecords();
    dom.searchInput.focus();
  });
  
  // Records list delegation
  dom.recordsList.addEventListener('click', (e) => {
    const row = e.target.closest('.record-row');
    if (!row) return;
    const id = row.dataset.id;
    const actionEl = e.target.closest('[data-action]');
    const action = actionEl?.dataset.action;
    
    // View record (clicking on main area)
    if (action === 'view' || e.target.closest('.record-main')) {
      viewRecord(id);
    }
  });
}

function filterRecords() {
  const q = state.searchQuery.toLowerCase().trim();
  if (!q) {
    dom.clearSearch.classList.add('hidden');
    return state.savedRecords;
  }
  
  dom.clearSearch.classList.remove('hidden');
  
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
  
  return filtered;
}

function renderSavedRecords() {
  const records = filterRecords();
  const count = records.length;
  
  dom.searchCount.textContent = `${count} bill${count !== 1 ? 's' : ''}`;
  
  if (records.length === 0) {
    dom.recordsList.innerHTML = `<div class="empty-state">${state.searchQuery ? 'No matching records' : 'No saved records'}</div>`;
    return;
  }
  
  const html = records.map(r => `
    <div class="record-row" data-id="${r.id}">
      <div class="record-main" data-action="view">
        <div class="record-header">
          <span class="record-inv">${utils.escapeHTML(r.billNumber)}</span>
          <span class="record-date">${new Date(r.date).toLocaleDateString('en-IN')}</span>
        </div>
        <div class="record-customer">${utils.escapeHTML(r.customer.name || 'Guest')}</div>
        <div class="record-items-preview">${r.items.map(i => utils.escapeHTML(i.item)).filter(Boolean).join(', ')}</div>
      </div>
      <div class="record-total">${utils.formatCurrency(r.grand)}</div>
    </div>
  `).join('');
  
  dom.recordsList.innerHTML = html;
}

function viewRecord(id) {
  const record = state.savedRecords.find(r => r.id === id);
  if (!record) return;
  
  const itemsHTML = record.items.map(i => `
    <tr>
      <td>${utils.escapeHTML(i.item)}</td>
      <td class="num">${utils.formatNumber(i.qty)}</td>
      <td class="num">${utils.formatCurrency(i.price)}</td>
      <td class="num">${utils.formatCurrency(i.total)}</td>
    </tr>
  `).join('');
  
  const html = `
    <div class="modal-header">
      <h2>${utils.escapeHTML(record.billNumber)}</h2>
      <button class="btn-close-modal" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="record-details">
        <div><strong>${utils.escapeHTML(record.customer.name || 'Guest')}</strong></div>
        ${record.customer.mobile ? `<div>${utils.escapeHTML(record.customer.mobile)}</div>` : ''}
        ${record.customer.address ? `<div>${utils.escapeHTML(record.customer.address)}</div>` : ''}
        <div class="text-secondary">${new Date(record.date).toLocaleString('en-IN')}</div>
      </div>
      <table class="items-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
        <tfoot>
          <tr><td colspan="3" class="text-right">Grand Total</td><td class="num"><strong>${utils.formatCurrency(record.grand)}</strong></td></tr>
        </tfoot>
      </table>
      ${record.notes ? `<div class="record-notes"><strong>Notes:</strong> ${utils.escapeHTML(record.notes)}</div>` : ''}
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

window.viewRecord = viewRecord;

window.editRecord = function(id) {
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
  window.switchTab('new-bill');
  window.renderBillUI();
  window.showToast('Editing ' + record.billNumber);
};

window.deleteRecord = function(id) {
  window.openConfirm('Delete Record?', 'This cannot be undone.', () => {
    state.savedRecords = state.savedRecords.filter(r => r.id !== id);
    utils.saveRecords();
    closeModal();
    renderSavedRecords();
    window.showToast('Record deleted', 'success');
  });
};

// ==========================================
// PRODUCTS
// ==========================================
function setupProducts() {
  dom.btnAddProduct.addEventListener('click', () => openProductModal());
  
  dom.productsList.addEventListener('click', (e) => {
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
}

function renderProducts() {
  if (state.products.length === 0) {
    dom.productsList.innerHTML = `<div class="empty-state">No products yet</div>`;
    return;
  }
  
  const html = state.products.map(p => `
    <div class="product-row" data-id="${p.id}">
      <div class="product-info">
        <div class="product-name">${utils.escapeHTML(p.name)}</div>
        <div class="product-meta">${utils.escapeHTML(p.code)} • ${utils.formatCurrency(p.price)}</div>
      </div>
      <div class="product-actions">
        <button class="btn-icon btn-edit-product" aria-label="Edit product">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="btn-icon btn-delete-product" aria-label="Delete product">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `).join('');
  
  dom.productsList.innerHTML = html;
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
        <input type="text" id="prod-code" class="input" value="${isEdit ? utils.escapeHTML(product.code) : ''}" placeholder="e.g. SKU001" autocomplete="off">
      </div>
      <div class="form-group">
        <label>Product Name *</label>
        <input type="text" id="prod-name" class="input" value="${isEdit ? utils.escapeHTML(product.name) : ''}" placeholder="e.g. Wooden Sofa" autocomplete="off">
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
    window.showToast('Code and Name are required', 'error');
    return;
  }
  
  const duplicate = state.products.find(p => p.code.toLowerCase() === code.toLowerCase() && p.id !== id);
  if (duplicate) {
    window.showToast('Product code already exists', 'error');
    return;
  }
  
  if (id) {
    const idx = state.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      state.products[idx] = { ...state.products[idx], code, name, price };
    }
  } else {
    state.products.push({ id: utils.generateId(), code, name, price });
  }
  
  utils.saveProducts();
  renderProducts();
  closeModal();
  window.showToast('Product saved', 'success');
}

function deleteProduct(id) {
  window.openConfirm('Delete Product?', 'This cannot be undone.', () => {
    state.products = state.products.filter(p => p.id !== id);
    utils.saveProducts();
    renderProducts();
    window.showToast('Product deleted', 'success');
  });
}

// ==========================================
// MODALS & TOASTS
// ==========================================
function setupModals() {
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay || e.target.closest('.btn-close-modal') || e.target.closest('[data-action="close-modal"]')) {
      closeModal();
    }
    
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    
    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;
    
    if (action === 'save-product') saveProduct(id || null);
    if (action === 'edit-record') window.editRecord(id);
    if (action === 'delete-record') window.deleteRecord(id);
    if (action === 'print-record') window.printNormal(id);
    if (action === 'thermal-record') window.printThermal(id, '80mm');
  });
}

function openModal(html) {
  dom.modalContent.innerHTML = html;
  dom.modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  dom.modalOverlay.classList.add('hidden');
  dom.modalContent.innerHTML = '';
  document.body.style.overflow = '';
}

window.openModal = openModal;
window.closeModal = closeModal;

window.openConfirm = function(title, message, onConfirm) {
  const html = `
    <div class="modal-header">
      <h2>${utils.escapeHTML(title)}</h2>
      <button class="btn-close-modal" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <p>${utils.escapeHTML(message)}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" data-action="close-modal">Cancel</button>
      <button class="btn btn-danger" data-action="confirm-action">Confirm</button>
    </div>
  `;
  openModal(html);
  
  const confirmBtn = dom.modalContent.querySelector('[data-action="confirm-action"]');
  confirmBtn.addEventListener('click', () => {
    closeModal();
    onConfirm();
  }, { once: true });
};

let toastTimeout;
window.showToast = function(message, type = 'info') {
  clearTimeout(toastTimeout);
  dom.toastContainer.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
};

// ==========================================
// PRINTING
// ==========================================
function setupPrint() {
  dom.btnSave.addEventListener('click', window.saveBill);
  dom.btnPrint.addEventListener('click', () => window.printNormal());
  dom.btnThermal58.addEventListener('click', () => window.printThermal(null, '58mm'));
  dom.btnThermal80.addEventListener('click', () => window.printThermal(null, '80mm'));
}

function generateReceiptHTML(bill, invoiceNum) {
  const date = new Date().toLocaleString('en-IN');
  let itemsHTML = bill.items.map(i => `
    <div class="receipt-item">
      <div style="flex:1; word-break:break-word;">${utils.escapeHTML(i.item)}</div>
      <div style="text-align:right; white-space:nowrap; margin-left:8px;">${utils.formatNumber(i.qty)}×${utils.formatCurrency(i.price)}<br><strong>${utils.formatCurrency(i.total)}</strong></div>
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
        <div><strong>${utils.escapeHTML(bill.customer.name || 'Guest')}</strong></div>
        ${bill.customer.mobile ? `<div>${utils.escapeHTML(bill.customer.mobile)}</div>` : ''}
        ${bill.customer.address ? `<div>${utils.escapeHTML(bill.customer.address)}</div>` : ''}
      </div>
      <div class="receipt-items" style="margin: 10px 0; border-bottom:1px dashed #000; padding-bottom:10px;">
        ${itemsHTML}
      </div>
      <div class="receipt-row" style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>Subtotal</span>
        <span>${utils.formatCurrency(bill.grand)}</span>
      </div>
      <div class="receipt-row" style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.2em; margin-top:8px;">
        <span>Grand Total</span>
        <span>${utils.formatCurrency(bill.grand)}</span>
      </div>
      ${bill.notes ? `<div style="margin-top:12px; font-size:0.9em; border-top:1px dashed #000; padding-top:8px;">Notes: ${utils.escapeHTML(bill.notes)}</div>` : ''}
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
  if (state.currentBill.items.length > 0 || window.hasUnsavedData()) {
    return { bill: state.currentBill, num: dom.invoiceNumber.textContent };
  }
  return null;
}

window.printNormal = function(id = null) {
  let bill, num;
  if (id) {
    const r = state.savedRecords.find(r => r.id === id);
    if (!r) return;
    bill = r; num = r.billNumber;
  } else {
    const current = getCurrentBillForPrint();
    if (!current) { window.showToast('Nothing to print', 'error'); return; }
    bill = current.bill; num = current.num;
  }
  printContent(generateReceiptHTML(bill, num), false);
};

window.printThermal = function(id = null, size = '80mm') {
  let bill, num;
  if (id) {
    const r = state.savedRecords.find(r => r.id === id);
    if (!r) return;
    bill = r; num = r.billNumber;
  } else {
    const current = getCurrentBillForPrint();
    if (!current) { window.showToast('Nothing to print', 'error'); return; }
    bill = current.bill; num = current.num;
  }
  printContent(generateReceiptHTML(bill, num), true, size);
};

// ==========================================
// GLOBAL EVENTS
// ==========================================
function setupGlobalEvents() {
  // Customer inputs
  dom.custName.addEventListener('input', () => {
    state.currentBill.customer.name = dom.custName.value;
  });
  dom.custMobile.addEventListener('input', () => {
    state.currentBill.customer.mobile = dom.custMobile.value;
  });
  dom.custAddress.addEventListener('input', () => {
    state.currentBill.customer.address = dom.custAddress.value;
  });
  dom.billNotes.addEventListener('input', () => {
    state.currentBill.notes = dom.billNotes.value;
  });
  
  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.modalOverlay.classList.contains('hidden')) {
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
