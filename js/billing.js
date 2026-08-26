// ==========================================
// BILLING.JS — Business Logic Module
// ==========================================

let state, dom, config, utils;

/**
 * Initialize billing module
 */
export function initBilling(appState, domRefs, cfg, utilFns) {
  state = appState;
  dom = domRefs;
  config = cfg;
  utils = utilFns;
  
  setupBillingEvents();
  renderBillUI();
}

/**
 * Calculate row total
 */
function calculateRowTotal(qty, price) {
  const q = Math.max(0, parseFloat(qty) || 0);
  const p = Math.max(0, parseFloat(price) || 0);
  const total = q * p;
  return isFinite(total) ? total : 0;
}

/**
 * Calculate bill totals
 */
function calculateBillTotals() {
  let subtotal = 0;
  state.currentBill.items.forEach(item => {
    item.total = calculateRowTotal(item.qty, item.price);
    subtotal += item.total;
  });
  return isFinite(subtotal) ? subtotal : 0;
}

/**
 * Render bill UI
 */
function renderBillUI() {
  dom.custName.value = state.currentBill.customer.name;
  dom.custMobile.value = state.currentBill.customer.mobile;
  dom.custAddress.value = state.currentBill.customer.address;
  dom.billNotes.value = state.currentBill.notes;
  
  if (state.currentBill.isEditing) {
    const record = state.savedRecords.find(r => r.id === state.currentBill.editingId);
    dom.invoiceNumber.textContent = record ? record.billNumber : 'INV-EDIT';
  } else {
    dom.invoiceNumber.textContent = `INV-${String(state.invoiceCounter).padStart(4, '0')}`;
  }
  
  renderItems();
  updateTotals();
}

/**
 * Render items list
 */
function renderItems() {
  if (state.currentBill.items.length === 0) {
    dom.itemsList.innerHTML = `<div class="empty-state" style="padding: 20px 0;">No items added</div>`;
    dom.itemCount.textContent = '0 items';
    return;
  }
  
  const html = state.currentBill.items.map((item, i) => `
    <div class="item-row" data-index="${i}">
      <input type="text" class="input item-name" value="${utils.escapeHTML(item.item)}" placeholder="Item name" autocomplete="off" inputmode="text">
      <input type="number" class="input item-qty" value="${utils.formatNumber(item.qty)}" placeholder="Qty" min="0" step="any" inputmode="decimal">
      <input type="number" class="input item-price" value="${utils.formatNumber(item.price)}" placeholder="Price" min="0" step="any" inputmode="decimal">
      <button class="btn-icon btn-remove-item" aria-label="Remove item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="item-row" style="border-bottom: 1px solid var(--border-color); padding-top: 0; padding-bottom: 10px; grid-template-columns: 1fr 36px;">
      <div class="item-total">Total: ${utils.formatCurrency(item.total)}</div>
      <div></div>
    </div>
  `).join('');
  
  dom.itemsList.innerHTML = html;
  dom.itemCount.textContent = `${state.currentBill.items.length} item${state.currentBill.items.length !== 1 ? 's' : ''}`;
}

/**
 * Update item from row
 */
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
    totalRow.querySelector('.item-total').textContent = `Total: ${utils.formatCurrency(state.currentBill.items[index].total)}`;
  }
  
  updateTotals();
}

/**
 * Update totals display
 */
function updateTotals() {
  const subtotal = calculateBillTotals();
  dom.subtotal.textContent = utils.formatCurrency(subtotal);
  dom.grandTotal.textContent = utils.formatCurrency(subtotal);
}

/**
 * Add new item
 */
function addItem() {
  state.currentBill.items.push({ item: '', qty: 0, price: 0, total: 0 });
  renderItems();
  const inputs = dom.itemsList.querySelectorAll('.item-name');
  if (inputs.length > 0) {
    const lastInput = inputs[inputs.length - 1];
    lastInput.focus();
    // Use requestAnimationFrame for smoother scroll
    requestAnimationFrame(() => {
      lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

/**
 * Remove item
 */
function removeItem(index) {
  state.currentBill.items.splice(index, 1);
  renderItems();
  updateTotals();
}

/**
 * Check if bill has unsaved data
 */
function hasUnsavedData() {
  const b = state.currentBill;
  return b.items.length > 0 || 
         b.customer.name.trim() !== '' || 
         b.customer.mobile.trim() !== '' || 
         b.customer.address.trim() !== '' || 
         b.notes.trim() !== '';
}

/**
 * Reset current bill
 */
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

/**
 * Save bill
 */
function saveBill() {
  if (state.currentBill.items.length === 0) {
    window.showToast('Add at least one item', 'error');
    return;
  }
  
  const hasValidItem = state.currentBill.items.some(i => i.item.trim() !== '' && i.total > 0);
  if (!hasValidItem) {
    window.showToast('Items must have name and total', 'error');
    return;
  }
  
  const billNumber = state.currentBill.isEditing 
    ? state.savedRecords.find(r => r.id === state.currentBill.editingId).billNumber 
    : `INV-${String(state.invoiceCounter).padStart(4, '0')}`;
    
  const record = {
    id: state.currentBill.editingId || utils.generateId(),
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
    utils.saveCounter();
  }
  
  utils.saveRecords();
  resetCurrentBill();
  window.showToast('Bill saved successfully', 'success');
  window.switchTab('saved-bills');
}

/**
 * Show autocomplete dropdown
 */
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
    <div class="ac-item" data-index="${i}" role="option">
      <div class="ac-name">${utils.escapeHTML(p.name)}</div>
      <div class="ac-meta">${utils.escapeHTML(p.code)} • ${utils.formatCurrency(p.price)}</div>
    </div>
  `).join('');
  
  dom.autocomplete.innerHTML = html;
  dom.autocomplete.classList.remove('hidden');
  
  const rect = input.getBoundingClientRect();
  let top = rect.bottom + window.scrollY + 4;
  let left = rect.left + window.scrollX;
  let width = rect.width;
  
  requestAnimationFrame(() => {
    const acRect = dom.autocomplete.getBoundingClientRect();
    if (left + acRect.width > window.innerWidth - 8) {
      left = window.innerWidth - acRect.width - 8;
    }
    if (top + acRect.height > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - acRect.height - 4;
    }
    dom.autocomplete.style.top = `${top}px`;
    dom.autocomplete.style.left = `${left}px`;
    dom.autocomplete.style.width = `${width}px`;
  });
}

/**
 * Hide autocomplete
 */
function hideAutocomplete() {
  dom.autocomplete.classList.add('hidden');
  dom.autocomplete.innerHTML = '';
  state.autocomplete.targetInput = null;
  state.autocomplete.activeIndex = -1;
  state.autocomplete.matches = [];
}

/**
 * Select autocomplete item
 */
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

/**
 * Setup billing events
 */
function setupBillingEvents() {
  // Add item button
  dom.btnAddItem.addEventListener('click', addItem);
  
  // Items list delegation
  dom.itemsList.addEventListener('input', (e) => {
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
  
  dom.itemsList.addEventListener('click', (e) => {
    if (e.target.closest('.btn-remove-item')) {
      const row = e.target.closest('.item-row');
      if (row) removeItem(parseInt(row.dataset.index));
    }
  });
  
  // Autocomplete click
  dom.autocomplete.addEventListener('click', (e) => {
    const item = e.target.closest('.ac-item');
    if (item) selectAutocompleteItem(parseInt(item.dataset.index));
  });
  
  // Keyboard navigation for autocomplete
  document.addEventListener('keydown', (e) => {
    if (dom.autocomplete.classList.contains('hidden')) return;
    const items = dom.autocomplete.querySelectorAll('.ac-item');
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
  
  // Click outside to close autocomplete
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-dropdown') && !e.target.closest('.item-name')) {
      hideAutocomplete();
    }
  });
}

/**
 * Update active autocomplete item
 */
function updateAutocompleteActive(items) {
  items.forEach((item, i) => {
    item.classList.toggle('active', i === state.autocomplete.activeIndex);
  });
  if (state.autocomplete.activeIndex >= 0 && items[state.autocomplete.activeIndex]) {
    items[state.autocomplete.activeIndex].scrollIntoView({ block: 'nearest' });
  }
}

// Export functions needed by other modules
window.renderBillUI = renderBillUI;
window.updateItemFromRow = updateItemFromRow;
window.updateTotals = updateTotals;
window.addItem = addItem;
window.removeItem = removeItem;
window.hasUnsavedData = hasUnsavedData;
window.resetCurrentBill = resetCurrentBill;
window.saveBill = saveBill;
window.showAutocomplete = showAutocomplete;
window.hideAutocomplete = hideAutocomplete;
window.selectAutocompleteItem = selectAutocompleteItem;
window.calculateBillTotals = calculateBillTotals;
