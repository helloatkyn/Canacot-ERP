// ==========================================
// STORAGE ADAPTER — Cloud-ready abstraction
// ==========================================
const StorageAdapter = {
    KEYS: {
        PRODUCTS: 'bq_products',
        BILLS: 'bq_bills',
        COUNTER: 'bq_bill_counter',
        TAB: 'bq_last_tab',
        // Legacy keys for migration
        LEGACY_PRODUCTS: 'billing_app_products',
        LEGACY_RECORDS: 'billing_app_records',
        LEGACY_COUNTER: 'billing_app_invoice_counter'
    },

    _get(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn(`Storage read error for ${key}`, e);
            return null;
        }
    },

    _set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`Storage write error for ${key}`, e);
            throw new Error('Storage quota exceeded or unavailable');
        }
    },

    migrate() {
        // Migrate legacy data if new keys don't exist
        if (!this._get(this.KEYS.PRODUCTS)) {
            const legacy = this._get(this.KEYS.LEGACY_PRODUCTS);
            if (legacy) this._set(this.KEYS.PRODUCTS, legacy);
        }
        if (!this._get(this.KEYS.BILLS)) {
            const legacy = this._get(this.KEYS.LEGACY_RECORDS);
            if (legacy) this._set(this.KEYS.BILLS, legacy);
        }
        if (!this._get(this.KEYS.COUNTER)) {
            const legacy = this._get(this.KEYS.LEGACY_COUNTER);
            if (legacy) this._set(this.KEYS.COUNTER, legacy);
        }
    },

    getProducts() { return this._get(this.KEYS.PRODUCTS) || []; },
    saveProducts(data) { this._set(this.KEYS.PRODUCTS, data); },
    
    getBills() { return this._get(this.KEYS.BILLS) || []; },
    saveBills(data) { this._set(this.KEYS.BILLS, data); },
    
    getCounter() { return this._get(this.KEYS.COUNTER) || 1; },
    setCounter(val) { this._set(this.KEYS.COUNTER, val); },
    
    getTab() { return this._get(this.KEYS.TAB) || 'new-bill'; },
    setTab(val) { this._set(this.KEYS.TAB, val); }
};

// Run migration on load
StorageAdapter.migrate();
