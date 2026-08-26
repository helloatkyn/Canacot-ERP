// ==========================================
// PRODUCTS MODULE
// ==========================================
const ProductsModule = {
    state: {
        products: [],
        searchQuery: ''
    },

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

    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'p-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    },

    load() {
        let data = StorageAdapter.getProducts();
        if (!data || data.length === 0) {
            data = this.defaultCatalogue.map(p => ({ ...p, id: this.generateId() }));
            this.save();
        }
        this.state.products = data.map(p => this.normalize(p)).filter(p => p && p.code && p.name);
    },

    save() {
        StorageAdapter.saveProducts(this.state.products);
    },

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
                const aCode = (a.code || '').toLowerCase();
                const bCode = (b.code || '').toLowerCase();
                if (aCode === q) return -1;
                if (bCode === q) return 1;
                if (aCode.startsWith(q) && !bCode.startsWith(q)) return -1;
                if (!aCode.startsWith(q) && bCode.startsWith(q)) return 1;
                return 0;
            })
            .slice(0, 6);
    },

    addOrUpdate(id, code, name, price) {
        if (!code || !name) return { success: false, error: 'Code and Name are required' };
        const duplicate = this.state.products.find(p => p.code.toLowerCase() === code.toLowerCase() && p.id !== id);
        if (duplicate) return { success: false, error: 'Product code already exists' };

        if (id) {
            const idx = this.state.products.findIndex(p => p.id === id);
            if (idx !== -1) this.state.products[idx] = { ...this.state.products[idx], code, name, price };
        } else {
            this.state.products.push({ id: this.generateId(), code, name, price });
        }
        this.save();
        return { success: true };
    },

    delete(id) {
        this.state.products = this.state.products.filter(p => p.id !== id);
        this.save();
    }
};
