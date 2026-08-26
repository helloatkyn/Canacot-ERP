// ==========================================
// PRODUCTS MODULE — catalogue domain, CRUD, search/autocomplete cache.
// No localStorage access (goes through StorageAdapter).
// ==========================================
const ProductsModule = {
    state: { products: [] },

    defaultCatalogue: [
        { code: '1', name: 'Gadda', price: 2500 },
        { code: '2', name: 'Bedsheet', price: 800 },
        { code: '3', name: 'Pillow', price: 350 },
        { code: '4', name: 'Sofa', price: 25000 },
        { code: '5', name: 'Chair', price: 1200 },
        { code: '6', name: 'Table', price: 5000 },
        { code: '7', name: 'Double Bed', price: 18000 },
        { code: '8', name: 'Mattress', price: 6000 }
    ],

    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'p-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    },

    normalize(p) {
        if (!p || typeof p !== 'object') return null;
        const price = Math.max(0, parseFloat(p.price) || 0);
        return {
            id: p.id || this.generateId(),
            code: String(p.code || '').trim(),
            name: String(p.name || '').trim(),
            price: isFinite(price) ? price : 0
        };
    },

    load() {
        let data = StorageAdapter.getProducts();
        if (!Array.isArray(data) || data.length === 0) {
            data = this.defaultCatalogue.map(p => ({ ...p, id: this.generateId() }));
            StorageAdapter.saveProducts(data);
        }
        this.state.products = data.map(p => this.normalize(p)).filter(p => p && p.code && p.name);
    },

    persist() { StorageAdapter.saveProducts(this.state.products); },

    // Synchronous local search: exact code > code prefix > name prefix > name substring. Max 6.
    search(query) {
        if (!query || query.length < 1) return [];
        const q = query.toLowerCase().trim();
        return this.state.products
            .filter(p => {
                const code = (p.code || '').toLowerCase();
                const name = (p.name || '').toLowerCase();
                return code.includes(q) || name.includes(q);
            })
            .sort((a, b) => {
                const ac = (a.code || '').toLowerCase(), bc = (b.code || '').toLowerCase();
                const an = (a.name || '').toLowerCase(), bn = (b.name || '').toLowerCase();
                if (ac === q) return -1;
                if (bc === q) return 1;
                if (ac.startsWith(q) && !bc.startsWith(q)) return -1;
                if (!ac.startsWith(q) && bc.startsWith(q)) return 1;
                if (an.startsWith(q) && !bn.startsWith(q)) return -1;
                if (!an.startsWith(q) && bn.startsWith(q)) return 1;
                return 0;
            })
            .slice(0, 6);
    },

    addOrUpdate(id, code, name, price) {
        if (!code || !name) return { success: false, error: 'Code and Name are required' };
        const dup = this.state.products.find(p => p.code.toLowerCase() === code.toLowerCase() && p.id !== id);
        if (dup) return { success: false, error: 'Product code already exists' };
        if (id) {
            const idx = this.state.products.findIndex(p => p.id === id);
            if (idx !== -1) this.state.products[idx] = { ...this.state.products[idx], code, name, price };
        } else {
            this.state.products.push({ id: this.generateId(), code, name, price });
        }
        this.persist();
        return { success: true };
    },

    delete(id) {
        this.state.products = this.state.products.filter(p => p.id !== id);
        this.persist();
    }
};
