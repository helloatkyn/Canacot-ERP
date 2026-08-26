--- js/app.js (原始)


+++ js/app.js (修改后)
// ==========================================
// APP.JS — Application Bootstrap & Initialization
// ==========================================

import { initBilling } from './billing.js';
import { initUI } from './ui.js';

// Configuration
const CONFIG = {
  LS_PRODUCTS: 'billing_app_products',
  LS_RECORDS: 'billing_app_records',
  LS_COUNTER: 'billing_app_invoice_counter',
  LS_TAB: 'billing_app_last_tab'
};

// Global state reference (shared across modules)
export const appState = {
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

// DOM References cache
export const domRefs = {};

/**
 * Cache all DOM references for performance
 */
export function cacheDOMRefs() {
  domRefs.tabs = document.querySelectorAll('.segment-btn');
  domRefs.pages = document.querySelectorAll('.page');
  domRefs.actionBar = document.getElementById('action-bar');

  domRefs.invoiceNumber = document.getElementById('invoice-number');
  domRefs.custName = document.getElementById('cust-name');
  domRefs.custMobile = document.getElementById('cust-mobile');
  domRefs.custAddress = document.getElementById('cust-address');
  domRefs.itemsList = document.getElementById('items-list');
  domRefs.itemCount = document.getElementById('item-count');
  domRefs.btnAddItem = document.getElementById('btn-add-item');
  domRefs.subtotal = document.getElementById('subtotal');
  domRefs.grandTotal = document.getElementById('grand-total');
  domRefs.billNotes = document.getElementById('bill-notes');
  domRefs.btnSave = document.getElementById('btn-save-bill');
  domRefs.btnPrint = document.getElementById('btn-print-bill');
  domRefs.btnThermal58 = document.getElementById('btn-thermal-58');
  domRefs.btnThermal80 = document.getElementById('btn-thermal-80');

  domRefs.searchInput = document.getElementById('search-records');
  domRefs.clearSearch = document.getElementById('clear-search');
  domRefs.searchCount = document.getElementById('search-count');
  domRefs.recordsList = document.getElementById('saved-records-list');

  domRefs.productsList = document.getElementById('products-list');
  domRefs.btnAddProduct = document.getElementById('btn-add-product');

  domRefs.autocomplete = document.getElementById('autocomplete-dropdown');

  domRefs.modalOverlay = document.getElementById('modal-overlay');
  domRefs.modalContent = document.getElementById('modal-content');

  domRefs.toastContainer = document.getElementById('toast-container');
}

/**
 * Safe localStorage parsing with error handling
 */
export function safeParse(key, fallback) {
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

/**
 * Safe localStorage save with error handling
 */
export function safeSave(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
    if (typeof window.showToast === 'function') {
      window.showToast('Storage error. Data may not persist.', 'error');
    }
  }
}

/**
 * Generate unique ID
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Load all data from localStorage
 */
export function loadData() {
  // Normalize and validate products
  const rawProducts = safeParse(CONFIG.LS_PRODUCTS, []) || [];
  appState.products = rawProducts
    .map(p => normalizeProduct(p))
    .filter(p => p && p.code && p.name);

  // Normalize and validate records
  const rawRecords = safeParse(CONFIG.LS_RECORDS, []) || [];
  appState.savedRecords = rawRecords
    .map(r => normalizeRecord(r))
    .filter(r => r)
    .sort((a, b) => b.savedAt - a.savedAt);

  // Load invoice counter
  const counter = safeParse(CONFIG.LS_COUNTER, 1);
  appState.invoiceCounter = Math.max(1, parseInt(counter) || 1);

  // Load last tab
  appState.currentTab = safeParse(CONFIG.LS_TAB, 'new-bill');
}

/**
 * Normalize product object
 */
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

/**
 * Normalize record object
 */
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

/**
 * Normalize item object
 */
function normalizeItem(i) {
  if (!i || typeof i !== 'object') {
    return { item: '', qty: 0, price: 0, total: 0 };
  }
  const qty = Math.max(0, parseFloat(i.qty) || 0);
  const price = Math.max(0, parseFloat(i.price) || 0);
  return {
    item: String(i.item || ''),
    qty: isFinite(qty) ? qty : 0,
    price: isFinite(price) ? price : 0,
    total: isFinite(qty * price) ? qty * price : 0
  };
}

/**
 * Save products to localStorage
 */
export function saveProducts() {
  safeSave(CONFIG.LS_PRODUCTS, appState.products);
}

/**
 * Save records to localStorage
 */
export function saveRecords() {
  safeSave(CONFIG.LS_RECORDS, appState.savedRecords);
}

/**
 * Save counter to localStorage
 */
export function saveCounter() {
  safeSave(CONFIG.LS_COUNTER, appState.invoiceCounter);
}

/**
 * Save tab preference to localStorage
 */
export function saveTab() {
  safeSave(CONFIG.LS_TAB, appState.currentTab);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));
}

/**
 * Format number as Indian Rupee currency
 */
export function formatCurrency(amount) {
  const num = parseFloat(amount);
  if (isNaN(num) || !isFinite(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format number for display
 */
export function formatNumber(num) {
  const n = parseFloat(num);
  if (isNaN(n) || !isFinite(n)) return '0';
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

/**
 * Main initialization function
 */
function init() {
  cacheDOMRefs();
  loadData();
  initBilling(appState, domRefs, CONFIG, {
    saveProducts,
    saveRecords,
    saveCounter,
    saveTab,
    escapeHTML,
    formatCurrency,
    formatNumber,
    generateId
  });
  initUI(appState, domRefs, CONFIG, {
    saveRecords,
    saveTab,
    escapeHTML,
    formatCurrency,
    formatNumber
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
