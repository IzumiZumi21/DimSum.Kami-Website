import {
  auth, db, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, onSnapshot, setDoc, runTransaction,
  query, orderBy, serverTimestamp
} from "./firebase.js";

// =========================================================
// KONFIGURASI
// =========================================================
const OWNER_EMAIL = "aquacidcraft66@gmail.com"; // hanya untuk UI, penjaga sebenarnya = Security Rules
const OWNER_WHATSAPP_NUMBER = "62859196437043";

let isOwnerAuthenticated = false;
let currentRole = 'buyer';
let products = [];
let cart = [];
let orders = [];
let unsubOrders = null;

// Cegah XSS: data dari pembeli tidak boleh dirender sebagai HTML
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// =========================================================
// PRODUK REALTIME DARI FIRESTORE
// =========================================================
onSnapshot(collection(db, "products"), (snap) => {
  products = snap.docs.map(d => d.data()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  renderBuyerMenu();
  if (currentRole === 'owner') renderOwnerStockTable();
}, (err) => {
  console.error(err);
  showToast("Gagal memuat produk: " + err.code);
});

// =========================================================
// LOGIN OWNER (FIREBASE AUTH)
// =========================================================
window.loginOwner = async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    alert("Login dibatalkan atau gagal: " + e.code);
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user && user.email === OWNER_EMAIL && user.emailVerified) {
    isOwnerAuthenticated = true;
    document.getElementById('owner-email-display').innerText = user.email;
    showToast("Login berhasil! Selamat datang, Owner.");
    switchToOwnerView();

    if (unsubOrders) unsubOrders();
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    unsubOrders = onSnapshot(q, (snap) => {
      orders = snap.docs.map(d => d.data());
      renderOwnerOrders();
    }, (err) => console.error(err));
  } else if (user) {
    await signOut(auth);
    alert("❌ AKSES DITOLAK!\n\nAkun ini bukan Owner resmi.");
  } else {
    isOwnerAuthenticated = false;
    if (unsubOrders) { unsubOrders(); unsubOrders = null; }
    orders = [];
  }
});

window.logoutOwner = async () => {
  await signOut(auth);
  showToast("Owner berhasil logout.");
  switchToBuyerView();
  openRoleModal();
};

// =========================================================
// NAVIGASI & GANTI PERAN
// =========================================================
window.selectRole = (role) => {
  if (role === 'buyer') switchToBuyerView();
};

function switchToBuyerView() {
  currentRole = 'buyer';
  document.getElementById('role-modal').classList.add('hidden');
  document.getElementById('current-role-label').innerText = 'Pembeli';

  document.getElementById('buyer-view').classList.remove('hidden');
  document.getElementById('owner-view').classList.add('hidden');
  document.getElementById('nav-cart-btn').classList.remove('hidden');
  document.getElementById('owner-logout-btn').classList.add('hidden');

  renderBuyerMenu();
}

function switchToOwnerView() {
  currentRole = 'owner';
  document.getElementById('role-modal').classList.add('hidden');
  document.getElementById('current-role-label').innerText = 'Owner';

  document.getElementById('buyer-view').classList.add('hidden');
  document.getElementById('owner-view').classList.remove('hidden');
  document.getElementById('nav-cart-btn').classList.add('hidden');
  document.getElementById('owner-logout-btn').classList.remove('hidden');

  renderOwnerStockTable();
  renderOwnerOrders();
}

window.openRoleModal = () => {
  if (currentRole === 'owner' && !isOwnerAuthenticated) switchToBuyerView();
  document.getElementById('role-modal').classList.remove('hidden');
};

// =========================================================
// RENDER
// =========================================================
function renderBuyerMenu() {
  const container = document.getElementById('buyer-menu-grid');

  if (products.length === 0) {
    container.innerHTML = '<p class="empty-msg">Memuat menu...</p>';
    return;
  }

  container.innerHTML = products.map(p => {
    const isOutOfStock = p.stock <= 0;
    return `
      <div class="card">
        <div class="card-img" style="background-image: url('${escapeHtml(p.img)}');">
          <span class="tag">${escapeHtml(p.tag)}</span>
          <span class="stock-badge ${isOutOfStock ? 'out' : ''}">
            ${isOutOfStock ? 'Stok Habis' : `Sisa Stok: ${p.stock}`}
          </span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(p.name)}</h3>
          <p class="card-desc">${escapeHtml(p.desc)}</p>
          <div class="card-footer">
            <span class="price">Rp ${p.price.toLocaleString('id-ID')}</span>
            <button class="add-btn ${isOutOfStock ? 'preorder' : ''}" onclick="addToCart('${p.id}')">
              ${isOutOfStock ? '🔄 Pre-Order Now' : '+ Tambah'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderOwnerStockTable() {
  const tbody = document.getElementById('stock-table-body');

  tbody.innerHTML = products.map(p => {
    const isAvailable = p.stock > 0;
    return `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>Rp ${p.price.toLocaleString('id-ID')}</td>
        <td><strong>${p.stock} pcs</strong></td>
        <td>
          <span class="badge-status ${isAvailable ? 'available' : 'empty'}">
            ${isAvailable ? 'Tersedia' : 'Habis'}
          </span>
        </td>
        <td>
          <div class="stock-control">
            <button class="btn-stock" onclick="updateStock('${p.id}', -1)">-</button>
            <input type="number" class="input-stock" value="${p.stock}"
              onchange="setDirectStock('${p.id}', this.value)" min="0">
            <button class="btn-stock" onclick="updateStock('${p.id}', 1)">+</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderOwnerOrders() {
  const container = document.getElementById('owner-orders-list');

  if (orders.length === 0) {
    container.innerHTML = '<p class="empty-msg">Belum ada pesanan masuk.</p>';
    return;
  }

  container.innerHTML = orders.map(ord => `
    <div class="order-card-item">
      <div class="order-meta">
        <span>ID: <strong>${escapeHtml(ord.id)}</strong></span>
        <span>🕒 ${escapeHtml(ord.time)}</span>
      </div>
      <div class="order-customer">
        <h4>👤 ${escapeHtml(ord.customerName)}</h4>
        <p>📍 ${escapeHtml(ord.address)}</p>
      </div>
      <div class="order-items-summary">
        <ul>
          ${ord.items.map(item => `<li>• ${escapeHtml(item.name)}${item.isPreOrder ? ' <span class="preorder-tag">Pre-Order</span>' : ''} x${Number(item.qty)} (Rp ${(Number(item.price) * Number(item.qty)).toLocaleString('id-ID')})</li>`).join('')}
        </ul>
      </div>
      <div class="summary-row">
        <span>Total Pesanan:</span>
        <span class="total-price">Rp ${Number(ord.total).toLocaleString('id-ID')}</span>
      </div>
    </div>
  `).join('');
}

// =========================================================
// EDIT STOK OLEH OWNER
// =========================================================
window.updateStock = async (id, delta) => {
  const p = products.find(x => x.id === id);
  if (!p) return;
  try {
    await setDoc(doc(db, "products", id), { stock: Math.max(0, p.stock + delta) }, { merge: true });
  } catch (e) {
    showToast("Gagal ubah stok: " + e.code);
  }
};

window.setDirectStock = async (id, value) => {
  try {
    await setDoc(doc(db, "products", id), { stock: Math.max(0, parseInt(value) || 0) }, { merge: true });
  } catch (e) {
    showToast("Gagal ubah stok: " + e.code);
  }
};

// =========================================================
// KERANJANG
// =========================================================
window.toggleCart = () => {
  document.getElementById('cart-drawer').classList.toggle('active');
  document.getElementById('cart-overlay').classList.toggle('active');
};

window.addToCart = (productId) => {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const isPreOrder = product.stock <= 0;
  const cartItem = cart.find(item => item.id === productId);

  if (cartItem) {
    if (!isPreOrder && cartItem.qty + 1 > product.stock) {
      alert(`Maaf, stok hanya tersisa ${product.stock} pcs!`);
      return;
    }
    cartItem.qty++;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1, isPreOrder });
  }

  updateCartUI();
  showToast(isPreOrder ? `${product.name} ditambahkan sebagai Pre-Order!` : `${product.name} ditambahkan!`);
};

window.changeQty = (productId, delta) => {
  const cartItem = cart.find(item => item.id === productId);
  const product = products.find(p => p.id === productId);
  if (!cartItem || !product) return;

  if (delta > 0 && !cartItem.isPreOrder && cartItem.qty + 1 > product.stock) {
    alert(`Mencapai stok maksimum (${product.stock} pcs)`);
    return;
  }

  cartItem.qty += delta;
  if (cartItem.qty <= 0) cart = cart.filter(item => item.id !== productId);

  updateCartUI();
};

function updateCartUI() {
  const container = document.getElementById('cart-items');
  const countBadge = document.getElementById('cart-count');
  const totalPriceElem = document.getElementById('cart-total-price');

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  countBadge.innerText = totalItems;
  totalPriceElem.innerText = `Rp ${totalPrice.toLocaleString('id-ID')}`;

  if (cart.length === 0) {
    container.innerHTML = '<p class="empty-msg">Keranjang belanjaanmu masih kosong.</p>';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <h4>${escapeHtml(item.name)}${item.isPreOrder ? ' <span class="preorder-tag">Pre-Order</span>' : ''}</h4>
        <p>Rp ${item.price.toLocaleString('id-ID')} x ${item.qty}</p>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty('${item.id}', -1)">-</button>
        <span>${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

// =========================================================
// CHECKOUT (TRANSAKSI FIRESTORE)
// =========================================================
window.handleCheckout = async (e) => {
  e.preventDefault();
  if (cart.length === 0) return;

  const name = document.getElementById('customer-name').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const mapsLink = document.getElementById('maps-link').value;
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const orderId = `ORD-${Math.floor(100 + Math.random() * 900)}`;
  const items = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, isPreOrder: !!i.isPreOrder }));
  const fullAddress = mapsLink ? `${address} (Maps: ${mapsLink})` : address;

  const stockItems = cart.filter(i => !i.isPreOrder);
  const btn = document.querySelector('.btn-checkout');
  btn.disabled = true;

  try {
    await runTransaction(db, async (tx) => {
      const refs = stockItems.map(i => doc(db, "products", i.id));
      const snaps = await Promise.all(refs.map(r => tx.get(r)));   // semua BACA dulu

      snaps.forEach((s, idx) => {
        if (!s.exists() || s.data().stock < stockItems[idx].qty) {
          throw new Error(`Stok ${stockItems[idx].name} tidak cukup. Silakan kurangi jumlah atau pesan sebagai Pre-Order.`);
        }
      });

      snaps.forEach((s, idx) => {                                  // baru TULIS
        tx.update(refs[idx], { stock: s.data().stock - stockItems[idx].qty });
      });

      tx.set(doc(collection(db, "orders")), {
        id: orderId, customerName: name, address: fullAddress,
        items, total, time: timeStr, createdAt: serverTimestamp()
      });
    });
  } catch (err) {
    alert(err.message || "Gagal memproses pesanan. Coba lagi.");
    btn.disabled = false;
    return;
  }
  btn.disabled = false;

  // Template WhatsApp
  const itemLines = cart.map(item =>
    `- ${item.name}${item.isPreOrder ? ' (Pre-Order)' : ''} x${item.qty} (Rp ${(item.price * item.qty).toLocaleString('id-ID')})`
  ).join('\n');

  const waMessageRaw =
`Halo, saya ingin memesan dari DimSum.kami

*ID Pesanan:* ${orderId}
*Nama:* ${name}
*Alamat:* ${address}${mapsLink ? ` (Lokasi: ${mapsLink})` : ''}

*Pesanan:*
${itemLines}

*Total:* Rp ${total.toLocaleString('id-ID')}`;

  const waUrl = `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessageRaw)}`;

  cart = [];
  updateCartUI();
  document.getElementById('checkout-form').reset();
  window.toggleCart();

  showToast('Pesanan dibuat! Mengarahkan ke WhatsApp...');
  window.open(waUrl, '_blank');
};

// =========================================================
// LOKASI & TOAST
// =========================================================
window.getGoogleMapsLocation = () => {
  const statusElem = document.getElementById('location-status');
  const mapsInput = document.getElementById('maps-link');

  if (!navigator.geolocation) {
    statusElem.innerText = "GPS tidak didukung di browser ini.";
    return;
  }

  statusElem.innerText = "Mengambil koordinat...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      mapsInput.value = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      statusElem.innerText = "✅ Lokasi ditemukan!";
      statusElem.style.color = "green";
    },
    () => {
      statusElem.innerText = "❌ Gagal mengambil lokasi.";
      statusElem.style.color = "red";
    }
  );
};

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.className = "show";
  setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// =========================================================
// ISI DATA PRODUK AWAL (jalankan SEKALI dari Console, sebagai owner)
// =========================================================
window.seedProducts = async () => {
  if (!isOwnerAuthenticated) { console.warn("Login sebagai owner dulu."); return; }
  const data = [
    { id: 'p1', name: 'Dimsum Goreng Keju', price: 15000, stock: 10, tag: 'Bestseller', desc: 'Dimsum yang digoreng dengan isian keju lumer, lezat dan gurih.', img: 'images/Dimsum Goreng Keju.jpg', order: 1 },
    { id: 'p2', name: 'Dimsum Goreng Mentai', price: 20000, stock: 5, tag: 'Favorit', desc: 'Dimsum yang digoreng dengan disirami saus mentai, lezat dan pedas.', img: 'images/Dimsum Goreng Mentai.jpg', order: 2 },
    { id: 'p3', name: 'Dimsum Goreng Original', price: 10000, stock: 1, tag: 'Basic', desc: 'Dimsum yang digoreng dengan isian original, lezat dan klasik.', img: 'images/Dimsum Goreng.jpg', order: 3 }
  ];
  for (const p of data) await setDoc(doc(db, "products", p.id), p);
  console.log("Produk berhasil diisi.");
};