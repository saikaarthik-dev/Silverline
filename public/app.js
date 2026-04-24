const app = {
    // --- Firebase Configuration ---
    // TODO: Replace with your actual config from Firebase Console
    firebaseConfig: {
        apiKey: "AIzaSyAHrgcoicSRR3ZoTGEG33sDuyAYB4Ffxq0",
        authDomain: "silverline-9d7ad.firebaseapp.com",
        projectId: "silverline-9d7ad",
        storageBucket: "silverline-9d7ad.firebasestorage.app",
        messagingSenderId: "166197330634"
    },

    db: null,
    auth: null,
    unsubProducts: null,
    isLoadingProducts: true,

    products: [],
    sales: [],
    cart: [],
    wishlist: [],
    orders: [],
    recentlyViewed: [],
    savedOutfits: [],
    notifications: [],
    theme: 'dark',
    currentUser: null,
    currentRole: null,
    filters: {
        search: '',
        category: 'all',
        minPrice: 0,
        maxPrice: Infinity,
        sort: 'newest'
    },

    vocab: {
        nav_boutique: { customer: "Gallery", seller: "Storefront", admin: "Showroom" },
        nav_atelier: { customer: "", seller: "Workshop", admin: "" },
        nav_intelligence: { customer: "", seller: "Intelligence", admin: "Analytics" },
        nav_management: { customer: "", seller: "", admin: "Maison Control" },
        items_label: { customer: "Treasures", seller: "Items", admin: "Assets" },
        boutique_title: { customer: "The Exquisite Curation", seller: "Active Stock" },
        boutique_sub: { customer: "Personalized ensembles selected for your unique aesthetic profile. A silent dialogue between fabric and form.", seller: "List of all products currently in the database." },
        empty_title: { customer: "Awaiting the Curator's Touch", seller: "Inventory is empty." },
        empty_sub: { customer: "The gallery is currently awaiting the season's next masterpieces.", seller: "Use the Workshop to add items to the store." },
        price_label: { customer: "Valuation", seller: "Cost" }
    },

    init() {
        // Initialize Firebase (mandatory)
        try {
            firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.firestore();
            this.auth = firebase.auth();
        } catch (err) {
            console.error('Firebase init failed:', err);
            alert('Firebase initialization failed. Check console for details.');
            return;
        }

        this.initTheme();
        this.checkAuth();
        this.bindEvents();

        // Remove Splash Screen
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) splash.classList.add('fade-out');
        }, 2000);
    },

    async loadData() {
        // Theme stays in localStorage (client preference)
        this.theme = localStorage.getItem('silverline_theme') || 'dark';

        if (!this.db || !this.currentUser) return;
        const uid = this.currentUser.uid;

        // Listen to products collection in real-time
        if (this.unsubProducts) this.unsubProducts();
        this.unsubProducts = this.db.collection('products').onSnapshot(snap => {
            this.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.isLoadingProducts = false;
            this.render();
        });

        // Load user-specific data from Firestore
        const userDoc = await this.db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            this.cart = data.cart || [];
            this.wishlist = data.wishlist || [];
            this.orders = data.orders || [];
            this.sales = data.sales || [];
            this.notifications = data.notifications || [];
            this.savedOutfits = data.savedOutfits || [];
            this.recentlyViewed = data.recentlyViewed || [];
        }
    },

    checkAuth() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {

                // 🔥 BLOCK UNVERIFIED USERS
                if (!user.emailVerified) {
                    document.getElementById('login-overlay').classList.remove('hidden');

                    this.showToast({
                        title: 'Email Not Verified',
                        message: 'Verify your email first ',
                        type: 'info'
                    });

                    try {
                        await user.sendEmailVerification(); // resend automatically
                    } catch (e) { }

                    await this.auth.signOut();
                    return;
                }
            } else {
                this.currentUser = null;
                this.currentRole = null;
                document.getElementById('login-overlay').classList.remove('hidden');
            }
        });
    },

    toggleAuth(view) {
        document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`auth-${view}`).classList.add('active');
    },

    async signup(e) {
        e.preventDefault();
        const email = document.getElementById('s-email').value;
        const pass = document.getElementById('s-pass').value;
        const role = document.getElementById('s-role').value;

        try {
            const res = await this.auth.createUserWithEmailAndPassword(email, pass);

            // 🔥 SEND VERIFICATION EMAIL
            await res.user.sendEmailVerification();

            await this.db.collection('users').doc(res.user.uid).set({
                email,
                role,
                cart: [],
                wishlist: [],
                orders: [],
                sales: [],
                notifications: [],
                savedOutfits: [],
                recentlyViewed: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showToast({
                title: 'Verify Your Email',
                message: 'Verification link sent Check inbox before login.',
                type: 'info'
            });

            // 🔥 FORCE LOGOUT UNTIL VERIFIED
            await this.auth.signOut();

        } catch (err) {
            alert(err.message);
        }
    },

    async resendVerification() {
        const user = this.auth.currentUser;

        if (user && !user.emailVerified) {
            await user.sendEmailVerification();
            this.showToast({
                title: 'Email Sent Again',
                message: 'Check your inbox machi 📩',
                type: 'info'
            });
        } else {
            alert("Login again to resend verification.");
        }
    },

    async login(e) {
        e.preventDefault();
        const email = document.getElementById('l-email').value;
        const pass = document.getElementById('l-pass').value;

        try {
            await this.auth.signInWithEmailAndPassword(email, pass);
            // onAuthStateChanged will handle the rest
        } catch (err) {
            alert(err.message);
        }
    },

    async logout() {
        if (this.unsubProducts) this.unsubProducts();
        await this.auth.signOut();
        window.location.reload();
    },

    updateRoleUI() {
        if (!this.currentRole) return;
        document.querySelectorAll('[data-key]').forEach(el => {
            const key = el.dataset.key;
            if (this.vocab[key]) {
                el.textContent = this.vocab[key][this.currentRole];
            }
        });
    },

    async saveData() {
        if (!this.db || !this.currentUser) return;
        const uid = this.currentUser.uid;
        await this.db.collection('users').doc(uid).update({
            cart: this.cart,
            wishlist: this.wishlist,
            orders: this.orders,
            sales: this.sales,
            notifications: this.notifications,
            savedOutfits: this.savedOutfits,
            recentlyViewed: this.recentlyViewed
        });
    },

    bindEvents() {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');

        if (loginForm) loginForm.addEventListener('submit', (e) => this.login(e));
        if (signupForm) signupForm.addEventListener('submit', (e) => this.signup(e));

        // Sidebar & Menu Toggles
        const menuBtn = document.getElementById('mobile-menu-btn');
        const navContainer = document.getElementById('nav-container');
        const filterBtn = document.getElementById('filter-toggle-btn');
        const filterSidebar = document.querySelector('.filter-sidebar');

        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                navContainer.classList.toggle('open');
                menuBtn.textContent = navContainer.classList.contains('open') ? '✕' : '☰';
            });
        }

        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                filterSidebar.classList.toggle('open');
                filterBtn.textContent = filterSidebar.classList.contains('open') ? 'Close Filters' : 'Filter';
            });
        }

        // Close menu/filter when clicking links or outside
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navContainer.classList.remove('open');
                if (menuBtn) menuBtn.textContent = '☰';
            });
        });

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        document.querySelectorAll('.mob-nav-item, .header-action-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.section) {
                    this.switchSection(item.dataset.section);
                }
            });
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.dataset.section;
                if (section === 'atelier' && this.currentRole !== 'seller') return;
                if (section === 'intelligence' && this.currentRole !== 'seller') return;
                this.switchSection(section);
            });
        });

        const productForm = document.getElementById('product-form');
        if (productForm) {
            productForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addProduct();
            });
        }

        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filters.category = e.target.dataset.filter;
                this.renderBoutique();
            });
        });

        // Advanced Filters
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.renderBoutique();
            });
        }

        // Global Search
        const globalSearchInput = document.getElementById('global-search-input');
        if (globalSearchInput) {
            globalSearchInput.addEventListener('input', () => {
                this.renderSearch();
            });
        }

        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        if (minPrice) minPrice.addEventListener('input', (e) => {
            this.filters.minPrice = Number(e.target.value) || 0;
            this.renderBoutique();
        });
        if (maxPrice) maxPrice.addEventListener('input', (e) => {
            this.filters.maxPrice = Number(e.target.value) || Infinity;
            this.renderBoutique();
        });

        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) sortSelect.addEventListener('change', (e) => {
            this.filters.sort = e.target.value;
            this.renderBoutique();
        });

        // Cursor Logic
        const cursor = document.getElementById('custom-cursor');
        const cursorInner = document.getElementById('custom-cursor-inner');

        document.addEventListener('mousemove', (e) => {
            cursor.style.left = `${e.clientX}px`;
            cursor.style.top = `${e.clientY}px`;
            cursorInner.style.left = `${e.clientX}px`;
            cursorInner.style.top = `${e.clientY}px`;
        });

        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('a, button, input, select, .product-overlay, .filter-btn')) {
                cursor.classList.add('hover');
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('a, button, input, select, .product-overlay, .filter-btn')) {
                cursor.classList.remove('hover');
            }
        });
    },

    initTheme() {
        if (this.theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    },

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('silverline_theme', this.theme);
        this.initTheme();
        this.showToast({
            title: 'Maison Aesthetic',
            message: `Atmosphere shifted to ${this.theme.toUpperCase()}`,
            type: 'info'
        });
    },

    switchSection(sectionId) {
        if (sectionId === 'atelier' && this.currentRole !== 'seller') return;
        if (sectionId === 'intelligence' && this.currentRole !== 'seller' && this.currentRole !== 'admin') return;
        if (sectionId === 'management' && this.currentRole !== 'admin') return;

        document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(sectionId);
        if (target) target.classList.add('active');

        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active');
            if (l.dataset.section === sectionId) l.classList.add('active');
        });

        document.querySelectorAll('.mob-nav-item').forEach(l => {
            l.classList.remove('active');
            if (l.dataset.section === sectionId) l.classList.add('active');
        });

        this.render();
    },

    async addProduct() {
        const name = document.getElementById('p-name').value;
        const price = document.getElementById('p-price').value;
        const category = document.getElementById('p-category').value;
        const image = document.getElementById('p-image').value;

        try {
            await this.db.collection('products').add({
                name,
                price: Number(price),
                category,
                image,
                sellerEmail: this.currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            document.getElementById('product-form').reset();
            this.showToast({ title: 'Asset Registered', message: `"${name}" added to the registry.`, type: 'info' });
            // Real-time listener will auto-update the UI
        } catch (err) {
            alert('Error adding product: ' + err.message);
        }
    },

    async deleteProduct(id) {
        if (confirm('Delete this item from inventory?')) {
            try {
                await this.db.collection('products').doc(id).delete();
                this.showToast({ title: 'Asset Removed', message: 'Item deleted from registry.', type: 'info' });
            } catch (err) {
                alert('Error deleting product: ' + err.message);
            }
        }
    },

    render() {
        if (!this.currentUser) return;
        this.renderHome();
        this.renderSearch();
        this.renderBoutique();
        this.renderInventory();
        this.renderIntelligence();
        this.renderManagement();
        this.renderNotifications();
        this.renderProfile();
        this.renderWishlist();
        this.renderCart();
        this.renderOrders();
        this.renderRecentlyViewed();
        this.renderSavedOutfits();

        const bagCount = document.getElementById('bag-count');
        if (bagCount) bagCount.textContent = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        this.updateRoleUI();
    },

    // Profile Management
    async saveProfile() {
        const profile = {
            name: document.getElementById('pr-name').value,
            phone: document.getElementById('pr-phone').value,
            gender: document.getElementById('pr-gender').value,
            dob: document.getElementById('pr-dob').value,
            photo: document.getElementById('pr-photo').value,
            // Sizes
            shirtSize: document.getElementById('pr-shirt-size').value,
            pantSize: document.getElementById('pr-pant-size').value,
            shoeSize: document.getElementById('pr-shoe-size').value,
            bodyFit: document.getElementById('pr-body-fit').value,
            // Preferences
            categories: Array.from(document.querySelectorAll('.pref-cat:checked')).map(cb => cb.value),
            colors: document.getElementById('pr-colors').value,
            brands: document.getElementById('pr-brands').value,
            budget: document.getElementById('pr-budget').value,
            // Addresses
            homeAddress: document.getElementById('pr-home-address').value,
            workAddress: document.getElementById('pr-work-address').value,
            pincode: document.getElementById('pr-pincode').value
        };

        this.currentUser.profile = profile;
        try {
            await this.db.collection('users').doc(this.currentUser.uid).update({ profile });
            this.notify('Identity Refined', 'Your bespoke profile has been updated.', 'info');
        } catch (err) {
            alert('Error saving profile: ' + err.message);
        }
        this.render();
    },

    renderProfile() {
        if (!this.currentUser || !this.currentUser.profile) return;
        const p = this.currentUser.profile;

        const fields = [
            'name', 'phone', 'gender', 'dob', 'photo',
            'shirt-size', 'pant-size', 'shoe-size', 'body-fit',
            'colors', 'brands', 'budget', 'home-address', 'work-address', 'pincode'
        ];

        fields.forEach(f => {
            const el = document.getElementById(`pr-${f}`);
            if (el) el.value = p[f.replace(/-([a-z])/g, g => g[1].toUpperCase())] || '';
        });

        // Categories checkboxes
        if (p.categories) {
            document.querySelectorAll('.pref-cat').forEach(cb => {
                cb.checked = p.categories.includes(cb.value);
            });
        }
    },

    // Wishlist Logic
    toggleWishlist(id) {
        const index = this.wishlist.indexOf(id);
        if (index > -1) {
            this.wishlist.splice(index, 1);
        } else {
            this.wishlist.push(id);
        }
        this.saveData();
        this.render();
    },

    renderWishlist() {
        const display = document.getElementById('wishlist-display');
        if (!display) return;

        const filtered = this.products.filter(p => this.wishlist.includes(p.id));
        if (filtered.length === 0) {
            display.innerHTML = '<p class="empty-msg">Your collection is currently empty.</p>';
        } else {
            display.innerHTML = filtered.map(p => this.generateProductHTML(p, true)).join('');
        }
    },

    // Cart & Checkout Logic
    addToCart(id) {
        const existing = this.cart.find(item => item.productId === id);
        if (existing) {
            existing.quantity++;
        } else {
            this.cart.push({ productId: id, quantity: 1 });
        }
        this.saveData();
        alert('Added to your collection.');
        this.render();
    },

    removeFromCart(id) {
        this.cart = this.cart.filter(item => item.productId !== id);
        this.saveData();
        this.render();
    },

    renderCart() {
        const display = document.getElementById('cart-display');
        const checkoutItems = document.getElementById('checkout-items');
        if (!display) return;

        const cartItems = this.cart.map(item => {
            const product = this.products.find(p => p.id === item.productId);
            return { ...product, quantity: item.quantity };
        }).filter(p => p.id);

        const total = cartItems.reduce((sum, p) => sum + (p.price * p.quantity), 0);

        display.innerHTML = cartItems.map(p => `
            <div class="cart-item">
                <img src="${p.image}" alt="${p.name}">
                <div class="item-info">
                    <h4>${p.name}</h4>
                    <p>₹${Number(p.price).toLocaleString()} x ${p.quantity}</p>
                </div>
                <button onclick="app.removeFromCart('${p.id}')">×</button>
            </div>
        `).join('');

        if (checkoutItems) {
            checkoutItems.innerHTML = display.innerHTML;
            document.getElementById('checkout-total').textContent = `₹${total.toLocaleString()}`;
        }

        document.getElementById('cart-total-value').textContent = `₹${total.toLocaleString()}`;
        document.getElementById('cart-count').textContent = cartItems.length;
    },

    checkout(e) {
        if (e) e.preventDefault();
        if (this.cart.length === 0) return;

        const total = this.cart.reduce((sum, item) => {
            const product = this.products.find(p => p.id === item.productId);
            return sum + (product ? product.price * item.quantity : 0);
        }, 0);

        const order = {
            id: Date.now(),
            items: [...this.cart],
            total,
            status: 'Processing',
            timestamp: Date.now(),
            payment: document.querySelector('input[name="payment"]:checked').value,
            address: document.getElementById('pr-home-address') ? document.getElementById('pr-home-address').value : '',
            customerEmail: this.currentUser.email
        };

        this.orders.push(order);

        // Notify Sellers
        this.cart.forEach(item => {
            const product = this.products.find(p => p.id === item.productId);
            if (product) {
                this.notify(
                    'New Acquisition',
                    `Your piece "${product.name}" has been selected for acquisition.`,
                    'sale',
                    product.sellerEmail
                );
            }
        });

        this.sales.push(...this.cart.map(item => {
            const product = this.products.find(p => p.id === item.productId);
            return {
                ...item,
                id: Date.now() + Math.random(),
                price: product.price,
                productName: product.name,
                timestamp: Date.now(),
                sellerEmail: product.sellerEmail
            };
        }));

        this.cart = [];
        this.saveData();
        this.notify('Order Confirmed', 'Your bespoke order is now being processed.', 'info');
        this.switchSection('orders');
        this.render();
    },

    renderOrders() {
        const display = document.getElementById('orders-display');
        if (!display) return;

        if (this.orders.length === 0) {
            display.innerHTML = '<p class="empty-msg">No past acquisitions found.</p>';
        } else {
            display.innerHTML = this.orders.reverse().map(o => `
                <div class="order-card">
                    <div class="order-header">
                        <span>#${o.id}</span>
                        <span class="status-tag status-${o.status.toLowerCase()}">${o.status}</span>
                    </div>
                    <div class="order-details">
                        <p>Total: ₹${o.total.toLocaleString()}</p>
                        <p>Placed: ${new Date(o.timestamp).toLocaleDateString()}</p>
                    </div>
                    <div class="order-actions">
                        <button class="btn-sm" onclick="alert('Return request initiated.')">Request Return</button>
                    </div>
                </div>
            `).join('');
        }
    },

    // AI Logic
    getRecommendation(product) {
        if (!this.currentUser || !this.currentUser.profile) return "";
        const p = this.currentUser.profile;

        let recommendation = "";
        let details = [];

        if (p.shirtSize && (product.category === 'Formal' || product.category === 'Casual')) {
            details.push(`Perfect fit: ${p.shirtSize}`);
        }
        if (p.categories && p.categories.includes(product.category)) {
            details.push(`Matches your style profile`);
        }

        // Outfit Suggestion
        const pairing = this.products.find(prod => prod.category !== product.category && prod.id !== product.id);
        if (pairing) {
            details.push(`Pairs brilliantly with "${pairing.name}"`);
        }

        if (details.length > 0) {
            recommendation = `
                <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), transparent); border: 1px solid rgba(212, 175, 55, 0.3); padding: 1rem; margin-bottom: 1rem; border-radius: 4px;">
                    <div style="color: var(--accent); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        ✨ AI Stylist
                    </div>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        ${details.map(d => `<li style="font-size: 0.7rem; color: #ccc; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.5rem;"><span style="color: var(--accent); font-size: 0.5rem;">❖</span> ${d}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        return recommendation;
    },

    // Recently Viewed Logic
    addToRecentlyViewed(id) {
        if (this.recentlyViewed.includes(id)) {
            this.recentlyViewed = this.recentlyViewed.filter(rv => rv !== id);
        }
        this.recentlyViewed.unshift(id);
        if (this.recentlyViewed.length > 5) this.recentlyViewed.pop();
        this.saveData();
        this.renderRecentlyViewed();
    },

    renderRecentlyViewed() {
        const display = document.getElementById('recently-viewed-display');
        if (!display) return;
        const items = this.products.filter(p => this.recentlyViewed.includes(p.id));
        display.innerHTML = items.length === 0
            ? '<p class="empty-msg">No recent history.</p>'
            : items.map(p => this.generateProductHTML(p)).join('');
    },

    // Saved Outfits Logic
    saveOutfit() {
        if (this.cart.length < 2) {
            alert('Add at least 2 items to curate an outfit.');
            return;
        }
        const outfit = {
            id: Date.now(),
            name: `Outfit #${this.savedOutfits.length + 1}`,
            items: [...this.cart]
        };
        this.savedOutfits.push(outfit);
        this.saveData();
        this.notify('Outfit Curated', 'Your ensemble has been saved to the vault.', 'info');
        this.renderSavedOutfits();
    },

    renderSavedOutfits() {
        const display = document.getElementById('saved-outfits-display');
        if (!display) return;
        display.innerHTML = this.savedOutfits.length === 0
            ? '<p class="empty-msg">No curated outfits yet.</p>'
            : this.savedOutfits.map(o => `
                <div class="outfit-card">
                    <h4>${o.name}</h4>
                    <p>${o.items.length} Elements</p>
                    <button class="btn-sm" onclick="app.loadOutfit(${o.id})">Wear Ensemble</button>
                </div>
            `).join('');
    },

    loadOutfit(id) {
        const outfit = this.savedOutfits.find(o => o.id === id);
        if (outfit) {
            this.cart = [...outfit.items];
            this.saveData();
            this.switchSection('cart');
            this.render();
        }
    },

    generateProductHTML(p, inWishlist = false) {
        const priceLabel = this.vocab.price_label[this.currentRole];
        const isWishlisted = this.wishlist.includes(p.id);
        const aiAdvice = this.getRecommendation(p);

        return `
            <div class="product-card" onclick="app.addToRecentlyViewed('${p.id}')">
                <div class="image-container">
                    <img src="${p.image}" alt="${p.name}" class="product-image" onerror="this.src='https://via.placeholder.com/600x800?text=Awaiting+Visual'">
                    <div class="wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="event.stopPropagation(); app.toggleWishlist('${p.id}')">❤️</div>
                    <div class="product-overlay" onclick="event.stopPropagation(); app.addToCart('${p.id}')">
                        <span>Acquire Piece</span>
                    </div>
                </div>
                <div class="product-info">
                    ${aiAdvice}
                    <div class="product-category">${p.category}</div>
                    <h3 class="product-name">${p.name}</h3>
                    <div class="product-price">${priceLabel}: ₹${Number(p.price).toLocaleString()}</div>
                </div>
            </div>
        `;
    },

    purchaseProduct(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;

        const sale = {
            id: Date.now(),
            productId: product.id,
            productName: product.name,
            price: Number(product.price),
            timestamp: Date.now(),
            quantity: 1
        };

        this.sales.push(sale);
        this.saveData();
        alert(`Acquisition complete: ${product.name}`);
        this.render();
    },

    renderHome() {
        const display = document.getElementById('home-featured-display');
        if (!display) return;

        if (this.isLoadingProducts) {
            display.innerHTML = Array(4).fill('<div class="product-card shimmer-card" style="border-radius: 8px;"></div>').join('');
            return;
        }

        // Show 4 newest products
        const featured = [...this.products]
            .sort((a, b) => {
                const timeA = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
                const timeB = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
                return timeB - timeA;
            })
            .slice(0, 4);

        display.innerHTML = featured.length === 0
            ? '<p class="empty-msg">No pieces available yet.</p>'
            : featured.map(p => this.generateProductHTML(p)).join('');
    },

    renderSearch() {
        const display = document.getElementById('search-results-display');
        const input = document.getElementById('global-search-input');
        if (!display || !input) return;

        if (this.isLoadingProducts) {
            display.innerHTML = Array(4).fill('<div class="product-card shimmer-card" style="border-radius: 8px;"></div>').join('');
            return;
        }

        const query = input.value.toLowerCase().trim();
        if (!query) {
            display.innerHTML = '<p class="empty-msg">Begin typing to uncover treasures.</p>';
            return;
        }

        const results = this.products.filter(p => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));

        display.innerHTML = results.length === 0
            ? '<p class="empty-msg">No results found.</p>'
            : results.map(p => this.generateProductHTML(p)).join('');
    },

    renderBoutique() {
        const display = document.getElementById('product-display');
        const emptyState = document.getElementById('empty-state');
        if (!display) return;

        if (this.isLoadingProducts) {
            display.innerHTML = Array(6).fill('<div class="product-card shimmer-card" style="border-radius: 8px;"></div>').join('');
            if (emptyState) emptyState.style.display = 'none';
            return;
        }

        let filtered = this.products.filter(p => {
            const matchesCategory = this.filters.category === 'all' || p.category === this.filters.category;
            const matchesSearch = p.name.toLowerCase().includes(this.filters.search);
            const matchesPrice = Number(p.price) >= this.filters.minPrice && Number(p.price) <= this.filters.maxPrice;
            return matchesCategory && matchesSearch && matchesPrice;
        });

        // Sorting
        filtered.sort((a, b) => {
            if (this.filters.sort === 'price-low') return Number(a.price) - Number(b.price);
            if (this.filters.sort === 'price-high') return Number(b.price) - Number(a.price);
            if (this.filters.sort === 'name') return a.name.localeCompare(b.name);
            const timeA = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA; // Newest
        });

        if (filtered.length === 0) {
            display.innerHTML = '';
            if (emptyState) {
                display.appendChild(emptyState);
                emptyState.style.display = 'block';
            }
        } else {
            if (emptyState) emptyState.style.display = 'none';
            display.innerHTML = filtered.map(p => this.generateProductHTML(p)).join('');
        }
    },

    renderInventory() {
        const display = document.getElementById('inventory-display');
        if (!display || (this.currentRole !== 'seller' && this.currentRole !== 'admin')) return;

        const vendorProducts = this.currentRole === 'admin'
            ? this.products
            : this.products.filter(p => p.sellerEmail === this.currentUser.email);

        if (vendorProducts.length === 0) {
            display.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: #444; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase;">Inventory is currently empty.</p>';
        } else {
            display.innerHTML = vendorProducts.map(p => `
                <div class="product-card" style="height: auto; border: 1px solid #111; padding: 1.5rem; background: #0D0D0D;">
                    <img src="${p.image}" alt="${p.name}" class="product-image" style="height: 150px; filter: grayscale(0);">
                    <div class="product-info" style="padding: 1.5rem 0; text-align: left;">
                        <h3 class="product-name" style="font-size: 0.9rem; margin-bottom: 0.5rem;">${p.name}</h3>
                        <p style="font-size: 0.7rem; color: var(--accent);">₹${Number(p.price).toLocaleString()}</p>
                        ${this.currentRole === 'admin' ? `<p style="font-size: 0.5rem; color: #555;">Seller: ${p.sellerEmail}</p>` : ''}
                        <button class="btn" style="padding: 0.4rem; font-size: 0.5rem; border-color: #333; margin-top: 1.5rem; width: auto;" onclick="app.deleteProduct('${p.id}')">Remove Asset</button>
                    </div>
                </div>
            `).join('');
        }
    },

    animateValue(id, start, end, duration, isCurrency = false) {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            obj.textContent = isCurrency ? `₹${value.toLocaleString()}` : value.toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    },

    renderIntelligence() {
        const display = document.getElementById('intelligence-stats');
        if (!display || (this.currentRole !== 'seller' && this.currentRole !== 'admin')) return;

        const vendorSales = this.currentRole === 'admin'
            ? this.sales
            : this.sales.filter(s => s.sellerEmail === this.currentUser.email);

        const totalRevenue = vendorSales.reduce((sum, s) => sum + s.price, 0);
        const totalOrders = vendorSales.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Top Products Logic
        const productStats = {};
        vendorSales.forEach(s => {
            const name = s.productName || `Asset #${s.productId}`;
            productStats[name] = (productStats[name] || 0) + s.price;
        });
        const topProducts = Object.entries(productStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Render Stats with Animation
        this.animateValue('stat-revenue', 0, totalRevenue, 1500, true);
        this.animateValue('stat-orders', 0, totalOrders, 1500, false);
        this.animateValue('stat-aov', 0, Math.round(avgOrderValue), 1500, true);

        // Render Top Products Table
        const topProductsList = document.getElementById('top-products-list');
        topProductsList.innerHTML = topProducts.map(([name, value]) => `
            <div style="display: flex; justify-content: space-between; padding: 1.5rem 0; border-bottom: 1px solid #111;">
                <span style="font-size: 0.8rem; color: #eee;">${name}</span>
                <span style="font-size: 0.8rem; color: var(--accent);">₹${value.toLocaleString()}</span>
            </div>
        `).join('');

        this.renderChart(vendorSales);
    },

    renderChart(filteredSales) {
        const chartContainer = document.getElementById('sales-chart');
        if (!chartContainer) return;

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            last7Days.push({
                label: days[d.getDay()],
                date: d.toDateString(),
                value: 0
            });
        }

        filteredSales.forEach(s => {
            const saleDate = new Date(s.timestamp).toDateString();
            const dayObj = last7Days.find(d => d.date === saleDate);
            if (dayObj) dayObj.value += s.price;
        });

        const maxVal = Math.max(...last7Days.map(d => d.value), 1000);

        chartContainer.innerHTML = last7Days.map(d => {
            const height = (d.value / maxVal) * 100;
            return `
                <div class="chart-bar-container">
                    <div class="chart-bar" style="--h: ${height}%">
                        <div class="chart-tooltip">₹${d.value.toLocaleString()}</div>
                    </div>
                    <div class="chart-label">${d.label}</div>
                </div>
            `;
        }).join('');
    },

    async renderManagement() {
        const display = document.getElementById('management-display');
        if (!display || this.currentRole !== 'admin') return;

        // Fetch all users from Firestore
        const usersSnap = await this.db.collection('users').get();
        const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

        display.innerHTML = `
            <div class="admin-user-list">
                <h3 style="margin-bottom: 4rem;">System User Registry</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 1px solid #222; color: #555; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.2em;">
                            <th style="padding: 2rem;">Identity</th>
                            <th style="padding: 2rem;">Persona</th>
                            <th style="padding: 2rem;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allUsers.map(u => `
                            <tr style="border-bottom: 1px solid #111;">
                                <td style="padding: 2rem; font-size: 0.8rem;">${u.email}</td>
                                <td style="padding: 2rem; font-size: 0.8rem;"><span class="role-tag role-${u.role}">${u.role}</span></td>
                                <td style="padding: 2rem;">
                                    <select onchange="app.updateUserRole('${u.uid}', this.value)" style="font-size: 0.6rem; padding: 0.5rem;">
                                        <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>Connoisseur</option>
                                        <option value="seller" ${u.role === 'seller' ? 'selected' : ''}>Curator</option>
                                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async updateUserRole(uid, newRole) {
        try {
            await this.db.collection('users').doc(uid).update({ role: newRole });
            this.showToast({ title: 'Role Updated', message: `User role changed to ${newRole}.`, type: 'info' });
            this.render();
        } catch (err) {
            alert('Error updating role: ' + err.message);
        }
    },

    // Notification System
    notify(title, message, type = 'info', targetEmail = null) {
        const notification = {
            id: Date.now(),
            title,
            message,
            type,
            targetEmail,
            timestamp: Date.now(),
            read: false
        };
        this.notifications.push(notification);
        this.saveData();
        this.showToast(notification);
        this.renderNotifications();
    },

    showToast(n) {
        const toast = document.createElement('div');
        const isString = typeof n === 'string';
        const type = isString ? 'info' : (n.type || 'info');
        const title = isString ? 'System' : (n.title || 'Notification');
        const message = isString ? n : (n.message || '');

        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <strong>${title}</strong>
                <p>${message}</p>
            </div>
        `;
        const container = document.getElementById('toast-container');
        if (container) container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    },

    renderNotifications() {
        const display = document.getElementById('notification-list');
        const count = document.getElementById('notif-count');
        if (!display) return;

        const userNotifs = this.notifications.filter(n =>
            !n.targetEmail || n.targetEmail === this.currentUser.email
        ).reverse();

        const unreadCount = userNotifs.filter(n => !n.read).length;
        if (count) count.textContent = unreadCount;

        display.innerHTML = userNotifs.length === 0
            ? '<p class="empty-msg">No new alerts.</p>'
            : userNotifs.map(n => `
                <div class="notif-item ${n.read ? 'read' : ''}" onclick="app.markAsRead(${n.id})">
                    <div class="notif-header">
                        <span class="notif-type">${n.type}</span>
                        <span class="notif-time">${new Date(n.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <h4>${n.title}</h4>
                    <p>${n.message}</p>
                </div>
            `).join('');
    },

    markAsRead(id) {
        const n = this.notifications.find(notif => notif.id === id);
        if (n) {
            n.read = true;
            this.saveData();
            this.render();
        }
    },
};

document.addEventListener('DOMContentLoaded', () => app.init());
window.app = app;