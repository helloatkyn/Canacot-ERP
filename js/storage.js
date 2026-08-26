// ==========================================
// STORAGE ADAPTER — single persistence boundary.
// ONLY file allowed to touch localStorage.
// Future: swap internals for a Cloudflare Worker/D1 adapter without touching UI.
// ==========================================
const StorageAdapter = {
    KEYS: {
        PRODUCTS: 'bq_products',
        BILLS: 'bq_bills',
        COUNTER: 'bq_bill_counter',
        TAB: 'bq_last_tab',
        LEGACY_PRODUCTS: 'billing_app_products',
        LEGACY_RECORDS: 'billing_app_records',
        LEGACY_COUNTER: 'billing_app_invoice_counter',
        LEGACY_TAB: 'billing_app_last_tab'
    },

    _read(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn(`Storage read failed for ${key}`, e);
            return null;
        }
    },

    _write(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error(`Storage write failed for ${key}`, e);
            return false;
        }
    },

    // Safe in-place migration: never deletes legacy data, only seeds new keys.
    migrate() {
        const pairs = [
            [this.KEYS.PRODUCTS, this.KEYS.LEGACY_PRODUCTS],
            [this.KEYS.BILLS, this.KEYS.LEGACY_RECORDS],
            [this.KEYS.COUNTER, this.KEYS.LEGACY_COUNTER],
            [this.KEYS.TAB, this.KEYS.LEGACY_TAB]
        ];
        pairs.forEach(([next, legacy]) => {
            if (this._read(next) === null) {
                const old = this._read(legacy);
                if (old !== null) this._write(next, old);
            }
        });
    },

    getProducts() { return this._read(this.KEYS.PRODUCTS) || []; },
    saveProducts(data) { return this._write(this.KEYS.PRODUCTS, data); },

    getBills() { return this._read(this.KEYS.BILLS) || []; },
    saveBills(data) { return this._write(this.KEYS.BILLS, data); },

    getBillCounter() { return this._read(this.KEYS.COUNTER) || 1; },
    setBillCounter(v) { return this._write(this.KEYS.COUNTER, v); },

    getTab() { return this._read(this.KEYS.TAB) || 'new-bill'; },
    setTab(v) { return this._write(this.KEYS.TAB, v); }
};

StorageAdapter.migrate();
