// =========================================================
// KONFIGURASI KEAMANAN OWNER
// =========================================================
// Ganti dengan SATU-SATUNYA email Google yang diizinkan mengakses Owner Dashboard!
const ALLOWED_OWNER_EMAIL = "aquacidcraft66@gmail.com"; 

// =========================================================
// KONFIGURASI NOMOR WHATSAPP PEMILIK TOKO
// =========================================================
// Ganti dengan nomor WhatsApp asli pemilik toko.
// Format: kode negara TANPA tanda "+" dan TANPA angka 0 di depan.
// Contoh: nomor 0812-3456-7890 -> ditulis "6281234567890"
const OWNER_WHATSAPP_NUMBER = "62859196437043";

let isOwnerAuthenticated = false;
let currentRole = 'buyer';

// =========================================================
// STATE DATA APLIKASI
// =========================================================
let products = [
  {
    id: 'p1',
    name: 'Dimsum Goreng Keju',
    price: 15000,
    stock: 10,
    tag: 'Bestseller',
    desc: 'Dimsum yang digoreng dengan isian keju lumer, lezat dan gurih.',
    img: 'images/Dimsum Goreng Keju.jpg'
  },
  {
    id: 'p2',
    name: 'Dimsum Goreng Mentai',
    price: 20000,
    stock: 5,
    tag: 'Favorit',
    desc: 'Dimsum yang digoreng dengan disirami saus mentai, lezat dan pedas.',
    img: 'images/Dimsum Goreng Mentai.jpg'
  },
  {
    id: 'p3',
    name: 'Dimsum Goreng Original',
    price: 10000,
    stock: 1,
    tag: 'Basic',
    desc: 'Dimsum yang digoreng dengan isian original, lezat dan klasik.',
    img: 'images/Dimsum Goreng.jpg'
  },
];

let cart = [];
let orders = [];

// =========================================================
// INISIALISASI
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  renderBuyerMenu();
});

// Helper Decode Token Google (JWT)
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

// Callback Respon Login Google
function handleGoogleLogin(response) {
  const userData = parseJwt(response.credential);
  const loggedEmail = userData.email;

  // Verifikasi Email
  if (loggedEmail === ALLOWED_OWNER_EMAIL) {
    isOwnerAuthenticated = true;
    showToast(`Login Berhasil! Selamat datang, Owner.`);
    
    document.getElementById('owner-email-display').innerText = loggedEmail;
    switchToOwnerView();
  } else {
    isOwnerAuthenticated = false;
    alert(`❌ AKSES DITOLAK!\n\nEmail (${loggedEmail}) bukan akun Owner resmi.\nHanya ${ALLOWED_OWNER_EMAIL} yang berhak mengakses.`);
  }
}

// =========================================================
// NAVIGASI & GANTI PERAN
// =========================================================
function selectRole(role) {
  if (role === 'buyer') {
    switchToBuyerView();
  }
}

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

function logoutOwner() {
  isOwnerAuthenticated = false;
  showToast("Owner berhasil logout.");
  switchToBuyerView();
  openRoleModal();
}

function openRoleModal() {
  if (currentRole === 'owner' && !isOwnerAuthenticated) {
    switchToBuyerView();
  }
  document.getElementById('role-modal').classList.remove('hidden');
}

// =========================================================
// RENDER MENU PEMBELI & DASHBOARD OWNER
// =========================================================
function renderBuyerMenu() {
  const container = document.getElementById('buyer-menu-grid');
  
  container.innerHTML = products.map(p => {
    const isOutOfStock = p.stock <= 0;
    return `
      <div class="card">
        <div class="card-img" style="background-image: url('${p.img}');">
          <span class="tag">${p.tag}</span>
          <span class="stock-badge ${isOutOfStock ? 'out' : ''}">
            ${isOutOfStock ? 'Stok Habis' : `Sisa Stok: ${p.stock}`}
          </span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${p.name}</h3>
          <p class="card-desc">${p.desc}</p>
          <div class="card-footer">
            <span class="price">Rp ${p.price.toLocaleString('id-ID')}</span>
            <button 
              class="add-btn ${isOutOfStock ? 'preorder' : ''}" 
              onclick="addToCart('${p.id}')"
            >
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
        <td><strong>${p.name}</strong></td>
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
            <input 
              type="number" 
              class="input-stock" 
              value="${p.stock}" 
              onchange="setDirectStock('${p.id}', this.value)" 
              min="0"
            >
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
        <span>ID: <strong>${ord.id}</strong></span>
        <span>🕒 ${ord.time}</span>
      </div>
      <div class="order-customer">
        <h4>👤 ${ord.customerName}</h4>
        <p>📍 ${ord.address}</p>
      </div>
      <div class="order-items-summary">
        <ul>
          ${ord.items.map(item => `<li>• ${item.name}${item.isPreOrder ? ' <span class="preorder-tag">Pre-Order</span>' : ''} x${item.qty} (Rp ${(item.price * item.qty).toLocaleString('id-ID')})</li>`).join('')}
        </ul>
      </div>
      <div class="summary-row">
        <span>Total Pesanan:</span>
        <span class="total-price">Rp ${ord.total.toLocaleString('id-ID')}</span>
      </div>
    </div>
  `).join('');
}

// =========================================================
// LOGIKA EDIT STOK DARI OWNER
// =========================================================
function updateStock(productId, delta) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  product.stock = Math.max(0, product.stock + delta);
  
  // Refresh UI kedua tampilan
  renderOwnerStockTable();
  renderBuyerMenu();
  showToast(`Stok ${product.name}: ${product.stock}`);
}

function setDirectStock(productId, value) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  product.stock = Math.max(0, parseInt(value) || 0);

  renderOwnerStockTable();
  renderBuyerMenu();
  showToast(`Stok ${product.name}: ${product.stock}`);
}

// =========================================================
// KERANJANG & CHECKOUT PEMBELI
// =========================================================
function toggleCart() {
  document.getElementById('cart-drawer').classList.toggle('active');
  document.getElementById('cart-overlay').classList.toggle('active');
}

// Poin 3 & 4: menambahkan item ke keranjang.
// Jika stok produk sedang habis, item otomatis ditandai sebagai Pre-Order
// (tidak dibatasi oleh jumlah stok).
function addToCart(productId) {
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
}

function changeQty(productId, delta) {
  const cartItem = cart.find(item => item.id === productId);
  const product = products.find(p => p.id === productId);
  if (!cartItem) return;

  // Batas stok hanya berlaku untuk item yang BUKAN pre-order
  if (delta > 0 && !cartItem.isPreOrder && cartItem.qty + 1 > product.stock) {
    alert(`Mencapai stok maksimum (${product.stock} pcs)`);
    return;
  }

  cartItem.qty += delta;
  if (cartItem.qty <= 0) {
    cart = cart.filter(item => item.id !== productId);
  }

  updateCartUI();
}

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
        <h4>${item.name}${item.isPreOrder ? ' <span class="preorder-tag">Pre-Order</span>' : ''}</h4>
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

// Poin 3 & 4: Proses Checkout.
// Setelah data diri diisi dan tombol "Proses Pesanan Sekarang" ditekan,
// pembeli diarahkan ke WhatsApp pemilik dengan template chat yang sudah
// berisi data diri & rincian pesanan, sehingga pembeli tinggal menekan "send".
function handleCheckout(e) {
  e.preventDefault();
  if (cart.length === 0) return;

  const name = document.getElementById('customer-name').value;
  const address = document.getElementById('customer-address').value;
  const mapsLink = document.getElementById('maps-link').value;
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // 1. Kurangi stok asli HANYA untuk item yang bukan pre-order
  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (product && !item.isPreOrder) {
      product.stock = Math.max(0, product.stock - item.qty);
    }
  });

  // 2. Buat objek pesanan baru untuk Dashboard Owner
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const orderId = `ORD-${Math.floor(100 + Math.random() * 900)}`;

  orders.unshift({
    id: orderId,
    time: timeStr,
    customerName: name,
    address: mapsLink ? `${address} (Maps: ${mapsLink})` : address,
    items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, isPreOrder: i.isPreOrder })),
    total: total
  });

  // 3. Susun template chat WhatsApp otomatis
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

  // 4. Reset state & refresh UI
  cart = [];
  updateCartUI();
  renderBuyerMenu();
  renderOwnerStockTable();
  renderOwnerOrders();
  document.getElementById('checkout-form').reset();
  toggleCart();

  // 5. Arahkan pembeli ke WhatsApp Owner dengan chat yang siap dikirim
  showToast('Pesanan dibuat! Mengarahkan ke WhatsApp...');
  window.open(waUrl, '_blank');
}

// Deteksi GPS Google Maps
function getGoogleMapsLocation() {
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
}

// Toast Notifikasi
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.className = "show";
  setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}