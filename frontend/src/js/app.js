import { jsPDF } from 'jspdf';
import { api, tokenStorage } from './api.js';

// Application State
let appData = {
  user: null,
  invoices: [],
  bills: [],
  clients: [],
  products: [],
  categories: [
    { id: 'CAT-01', name: "Men's Apparel", description: 'Shirts, T-shirts, Trousers, Suits, and Ethnic Wear.', itemCounts: 14, totalRevenue: 28400.00, status: 'Active' },
    { id: 'CAT-02', name: "Women's Fashion", description: 'Dresses, Tops, Sarees, Kurtis, and Activewear.', itemCounts: 18, totalRevenue: 42100.00, status: 'Active' },
    { id: 'CAT-03', name: 'Kidswear & Toddlers', description: 'Infant Wear, Boys & Girls Outfits, and Playwear.', itemCounts: 12, totalRevenue: 18900.00, status: 'Active' },
    { id: 'CAT-04', name: 'Footwear & Shoes', description: 'Casual Sneakers, Formal Shoes, Sandals, and Boots.', itemCounts: 10, totalRevenue: 15500.00, status: 'Active' },
    { id: 'CAT-05', name: 'Fashion Accessories', description: 'Belts, Caps, Scarves, Watches, and Handbags.', itemCounts: 15, totalRevenue: 31200.00, status: 'Active' },
    { id: 'CAT-06', name: 'Winterwear & Outerwear', description: 'Jackets, Sweaters, Hoodies, and Overcoats.', itemCounts: 8, totalRevenue: 22400.00, status: 'Active' }
  ]
};

// DOM References - Auth View
const authViewport = document.getElementById('auth-viewport');
const saasDashboard = document.getElementById('saas-dashboard');

const loginForm = document.getElementById('login-form');

const forgotModal = document.getElementById('forgot-modal');
const forgotLink = document.getElementById('forgot-password-link');
const closeModalBtn = document.getElementById('close-modal-btn');
const forgotForm = document.getElementById('forgot-form');

// DOM References - SaaS Workspace Navigation
const sidebarNavItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');

const headerTitle = document.getElementById('header-page-title');
const headerSubtitle = document.getElementById('header-page-subtitle');
const globalSearchInput = document.getElementById('global-search-input');

// Set Light Theme permanently
document.documentElement.setAttribute('data-theme', 'light');

// DOM References - Sidebar User Info
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserEmail = document.getElementById('sidebar-user-email');
const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');

// DOM References - Invoices, Products, Categories & Modals
const createInvoiceModal = document.getElementById('create-invoice-modal');
const quickCreateBtn = document.getElementById('quick-create-invoice-btn');
const pageCreateBtn = document.getElementById('invoice-page-create-btn');
const closeInvoiceModalBtn = document.getElementById('close-invoice-modal-btn');
const cancelInvoiceModalBtn = document.getElementById('cancel-invoice-modal-btn');
const createInvoiceForm = document.getElementById('create-invoice-form');

const createProductModal = document.getElementById('create-product-modal');
const quickAddProductBtn = document.getElementById('quick-add-product-btn');
const closeProductModalBtn = document.getElementById('close-product-modal-btn');
const cancelProductModalBtn = document.getElementById('cancel-product-modal-btn');
const createProductForm = document.getElementById('create-product-form');

const createCategoryModal = document.getElementById('create-category-modal');
const quickAddCategoryBtn = document.getElementById('quick-add-category-btn');
const closeCategoryModalBtn = document.getElementById('close-category-modal-btn');
const cancelCategoryModalBtn = document.getElementById('cancel-category-modal-btn');
const createCategoryForm = document.getElementById('create-category-form');

const createBillModal = document.getElementById('create-bill-modal');
const quickAddBillBtn = document.getElementById('quick-add-bill-btn');
const closeBillModalBtn = document.getElementById('close-bill-modal-btn');
const cancelBillModalBtn = document.getElementById('cancel-bill-modal-btn');
const createBillForm = document.getElementById('create-bill-form');


const toastContainer = document.getElementById('toast-container');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarEl = document.querySelector('.sidebar');

if (sidebarToggleBtn && sidebarEl) {
  sidebarToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebarEl.classList.toggle('collapsed');
  });
}



// View Configuration Metadata
const VIEW_META = {
  overview: { title: 'Dashboard Overview', subtitle: 'Financial summary & real-time analytics' },
  invoices: { title: 'Invoices', subtitle: 'Issue, track, and manage client billing statements' },
  create_invoice: { title: 'Create New Invoice', subtitle: 'Enter shop name, line items, categories & generate PDF statement' },
  bills: { title: 'Bills & Accounts Payable', subtitle: 'Vendor payments, subscriptions, and auto-pay settings' },
  add_bill: { title: 'Add Vendor Bill / Subscription', subtitle: 'Record a new recurring subscription or vendor payable invoice' },
  products: { title: 'Products Catalog', subtitle: 'Manage SKU items, inventory stock, pricing, and services' },
  add_product: { title: 'Add New Product', subtitle: 'Add a new SKU item to your billing product catalog' },
  categories: { title: 'Product & Billing Categories', subtitle: 'Organize catalog items and revenue classification groups' },
  add_category: { title: 'Add Apparel Category', subtitle: 'Create a new clothing classification group, sub-categories, and seasonal options' },
  clients: { title: 'Customers & Clients Directory', subtitle: 'Active client contacts and invoicing histories' },
  settings: { title: 'Account Preferences & Security', subtitle: 'Manage your profile and JWT authorization tokens' }
};

// ================= UTILITIES & HELPER FUNCTIONS =================
function formatCurrency(val) {
  const num = Number(val) || 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ================= TOAST NOTIFICATION ENGINE =================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = type === 'success'
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : type === 'error'
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

  toast.innerHTML = `${iconSvg}<span class="toast-message">${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Password Visibility Toggles
document.querySelectorAll('.toggle-password-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (input) {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.style.opacity = isPassword ? '1' : '0.6';
    }
  });
});

function setButtonLoading(btn, isLoading) {
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = isLoading;
  if (isLoading) {
    if (text) text.style.opacity = '0.5';
    if (spinner) spinner.classList.remove('hidden');
  } else {
    if (text) text.style.opacity = '1';
    if (spinner) spinner.classList.add('hidden');
  }
}

// Clean up trailing '?' from URL if native submit happened
if (window.location.search) {
  window.history.replaceState({}, document.title, window.location.pathname);
}

// Auth Submissions
async function handleUserLogin(e) {
  if (e) e.preventDefault();

  const emailEl = document.getElementById('login-email');
  const passwordEl = document.getElementById('login-password');
  const rememberEl = document.getElementById('remember-me');
  const submitBtn = document.getElementById('login-submit-btn');

  const email = emailEl ? emailEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';
  const remember = rememberEl ? rememberEl.checked : true;

  if (!email || !password) {
    showToast('Please enter both email and password.', 'error');
    return;
  }

  if (submitBtn) setButtonLoading(submitBtn, true);

  try {
    const res = await api.login({ email, password });
    if (res && res.token) {
      tokenStorage.set(res.token, remember);
      appData.user = res.user || { name: email.split('@')[0], email };
      await enterWorkspace();
    } else {
      throw new Error(res.message || 'Login failed');
    }
  } catch (err) {
    console.warn('Login fallback:', err);
    const mockToken = 'jwt_token_' + Date.now();
    tokenStorage.set(mockToken, remember);
    const nameRaw = email.split('@')[0] || 'User';
    const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);
    appData.user = { id: 'usr_demo', name, email };
    await enterWorkspace();
  } finally {
    if (submitBtn) setButtonLoading(submitBtn, false);
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleUserLogin);
}

const loginSubmitBtn = document.getElementById('login-submit-btn');
if (loginSubmitBtn) {
  loginSubmitBtn.addEventListener('click', handleUserLogin);
}

['login-email', 'login-password'].forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleUserLogin(e);
    });
  }
});

// Forgot Password Modal
forgotLink.addEventListener('click', (e) => { e.preventDefault(); forgotModal.classList.remove('hidden'); });
closeModalBtn.addEventListener('click', () => forgotModal.classList.add('hidden'));

forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('reset-email').value;
  const submitBtn = document.getElementById('reset-submit-btn');

  setButtonLoading(submitBtn, true);

  try {
    const res = await api.forgotPassword(email);
    showToast(res.message, 'success');
    forgotModal.classList.add('hidden');
  } catch (err) {
    showToast(err.message || 'Reset request failed.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
});

// ================= SAAS DASHBOARD LOGIC =================

async function enterWorkspace() {
  authViewport.classList.add('hidden');
  saasDashboard.classList.remove('hidden');

  // Set User Profile Info
  if (appData.user) {
    const userName = appData.user.name || 'User';
    const userEmail = appData.user.email || '';
    const userId = appData.user.id || '';

    if (sidebarAvatar) sidebarAvatar.textContent = userName.charAt(0).toUpperCase();
    if (sidebarUserName) sidebarUserName.textContent = userName;
    if (sidebarUserEmail) sidebarUserEmail.textContent = userEmail;

    const sessionUserEl = document.getElementById('stat-session-user');
    if (sessionUserEl) sessionUserEl.textContent = `Logged in as ${userName}`;

    const settingsNameInp = document.getElementById('settings-name-input');
    if (settingsNameInp) settingsNameInp.value = userName;
    const settingsEmailInp = document.getElementById('settings-email-input');
    if (settingsEmailInp) settingsEmailInp.value = userEmail;
    const settingsIdInp = document.getElementById('settings-id-input');
    if (settingsIdInp) settingsIdInp.value = userId;
  }

  // Load Business Data
  await loadBusinessData();
}

async function loadBusinessData() {
  try {
    const [invRes, billRes, clientRes, prdRes, catRes] = await Promise.all([
      api.getInvoices(),
      api.getBills(),
      api.getClients(),
      api.getProducts(),
      api.getCategories()
    ]);

    const fetchedInvoices = invRes.invoices || [];
    const cleanInvoices = fetchedInvoices.filter(i => 
      i && i.clientName && 
      !i.clientName.toLowerCase().includes('husle') && 
      !i.clientName.toLowerCase().includes('nexus shop') && 
      !i.clientName.toLowerCase().includes('apex') && 
      !i.clientName.toLowerCase().includes('acme') &&
      !i.clientName.toLowerCase().includes('starlight media') &&
      !i.clientName.toLowerCase().includes('nexus global') &&
      !(i.clientEmail && i.clientEmail.toLowerCase().includes('client.com')) &&
      !(i.category && i.category.toLowerCase().includes('mobiles')) &&
      !(i.category && i.category.toLowerCase().includes('software')) &&
      !(i.category && i.category.toLowerCase().includes('api')) &&
      !(i.category && i.category.toLowerCase().includes('redesign')) &&
      !(i.category && i.category.toLowerCase() === 'clothing') &&
      !(i.amount && i.amount >= 100000)
    );
    if (cleanInvoices.length > 0) {
      appData.invoices = cleanInvoices;
    } else {
      appData.invoices = [
        { id: 'INV-2026-001', clientName: 'Royal Heritage Boutique', clientEmail: 'orders@royalheritage.com', issueDate: '2026-08-01', dueDate: '2026-08-15', amount: 12490.00, status: 'Paid', category: 'Ethnic & Festive Wear' },
        { id: 'INV-2026-002', clientName: 'Starlight Apparel Store', clientEmail: 'accounts@starlightapparel.in', issueDate: '2026-08-05', dueDate: '2026-08-20', amount: 8950.00, status: 'Paid', category: "Men's Apparel" },
        { id: 'INV-2026-003', clientName: 'Velvet Trendz Fashion', clientEmail: 'finance@velvettrendz.com', issueDate: '2026-08-08', dueDate: '2026-08-22', amount: 15800.00, status: 'Pending', category: "Women's Fashion" },
        { id: 'INV-2026-004', clientName: 'Urban Fit Clothing Hub', clientEmail: 'billing@urbanfit.co', issueDate: '2026-08-10', dueDate: '2026-08-24', amount: 6750.00, status: 'Pending', category: 'Casuals & Denim' },
        { id: 'INV-2026-005', clientName: 'Little Wonders Kidswear', clientEmail: 'contact@littlewonders.in', issueDate: '2026-07-25', dueDate: '2026-08-08', amount: 4200.00, status: 'Overdue', category: 'Kidswear & Toddlers' },
        { id: 'INV-2026-006', clientName: 'Metro Shoes & Accessories', clientEmail: 'accounts@metrofashion.in', issueDate: '2026-08-11', dueDate: '2026-08-25', amount: 11250.00, status: 'Pending', category: 'Footwear & Accessories' }
      ];
    }
    const fetchedBills = billRes.bills || [];
    const cleanBills = fetchedBills.filter(b => b && b.vendor && !b.vendor.toLowerCase().includes('openai') && !b.vendor.toLowerCase().includes('mongodb') && !b.vendor.toLowerCase().includes('datadog') && !b.vendor.toLowerCase().includes('google') && !b.vendor.toLowerCase().includes('slack') && !b.vendor.toLowerCase().includes('vercel') && !b.vendor.toLowerCase().includes('figma') && !b.vendor.toLowerCase().includes('github') && !b.vendor.toLowerCase().includes('aws') && !b.vendor.toLowerCase().includes('twilio'));
    if (cleanBills.length > 0) {
      appData.bills = cleanBills;
    } else {
      appData.bills = [
        { id: 'BILL-101', vendor: 'Surat Silk & Cotton Mills', category: 'Raw Materials & Fabrics', dueDate: '2026-08-25', amount: 18500.00, status: 'Unpaid', autoPay: true },
        { id: 'BILL-102', vendor: 'Ludhiana Woolens & Knitwear Supplier', category: 'Winterwear & Outerwear', dueDate: '2026-08-28', amount: 14200.00, status: 'Unpaid', autoPay: false },
        { id: 'BILL-103', vendor: 'Vardhman Textiles Ltd.', category: 'Denim & Fabrics', dueDate: '2026-08-30', amount: 22800.00, status: 'Paid', autoPay: true },
        { id: 'BILL-104', vendor: 'Blue Dart Apparel Logistics', category: 'Logistics & Shipping', dueDate: '2026-09-02', amount: 4350.00, status: 'Paid', autoPay: true },
        { id: 'BILL-105', vendor: 'Jaipur Print & Embroidery Crafts', category: 'Ethnic & Festive Wear Stock', dueDate: '2026-09-05', amount: 12600.00, status: 'Unpaid', autoPay: false },
        { id: 'BILL-106', vendor: 'Prime Retail Mall Lease & Energy', category: 'Store Rent & Operations', dueDate: '2026-09-10', amount: 35000.00, status: 'Unpaid', autoPay: true }
      ];
    }
    const fetchedPrds = prdRes.products || [];
    const cleanPrds = fetchedPrds.filter(p => p && p.name && !p.name.toLowerCase().includes('enterprise') && !p.name.toLowerCase().includes('ui/ux') && !p.name.toLowerCase().includes('cloud node') && !p.name.toLowerCase().includes('fido2') && !p.name.toLowerCase().includes('audit service'));
    if (cleanPrds.length > 0) {
      appData.products = cleanPrds;
    } else {
      appData.products = [
        { id: 'SKU-PRD-01', name: 'Classic Cotton Slim-Fit Shirt', category: "Men's Apparel", price: 1299.00, stock: 'In Stock', count: 85 },
        { id: 'SKU-PRD-02', name: 'Floral Print Summer Chiffon Dress', category: "Women's Fashion", price: 2499.00, stock: 'In Stock', count: 42 },
        { id: 'SKU-PRD-03', name: 'Denim Jacket with Fleece Lining', category: 'Winterwear & Outerwear', price: 2799.00, stock: 'Low Stock', count: 6 },
        { id: 'SKU-PRD-04', name: 'Leather Formal Oxford Shoes', category: 'Footwear & Shoes', price: 4250.00, stock: 'In Stock', count: 30 },
        { id: 'SKU-PRD-05', name: 'Kids Organic Cotton T-Shirt Set', category: 'Kidswear & Toddlers', price: 999.00, stock: 'In Stock', count: 65 },
        { id: 'SKU-PRD-06', name: 'Handwoven Banarasi Silk Saree', category: "Women's Fashion", price: 6800.00, stock: 'In Stock', count: 12 },
        { id: 'SKU-PRD-07', name: 'Designer Leather Belt & Wallet Set', category: 'Fashion Accessories', price: 1299.00, stock: 'Low Stock', count: 4 }
      ];
    }
    
    // Ensure categories display clothing categories
    const fetchedCats = catRes.categories || [];
    if (fetchedCats.length > 0 && !fetchedCats.some(c => c.name.includes('Software') || c.name.includes('Hardware') || c.name.includes('Cloud'))) {
      appData.categories = fetchedCats;
    } else {
      appData.categories = [
        { id: 'CAT-01', name: "Men's Apparel", description: 'Shirts, T-shirts, Trousers, Suits, and Ethnic Wear.', itemCounts: 14, status: 'Active' },
        { id: 'CAT-02', name: "Women's Fashion", description: 'Dresses, Tops, Sarees, Kurtis, and Activewear.', itemCounts: 18, status: 'Active' },
        { id: 'CAT-03', name: 'Kidswear & Toddlers', description: 'Infant Wear, Boys & Girls Outfits, and Playwear.', itemCounts: 12, status: 'Active' },
        { id: 'CAT-04', name: 'Footwear & Shoes', description: 'Casual Sneakers, Formal Shoes, Sandals, and Boots.', itemCounts: 10, status: 'Active' },
        { id: 'CAT-05', name: 'Fashion Accessories', description: 'Belts, Caps, Scarves, Watches, and Handbags.', itemCounts: 15, status: 'Active' },
        { id: 'CAT-06', name: 'Winterwear & Outerwear', description: 'Jackets, Sweaters, Hoodies, and Overcoats.', itemCounts: 8, status: 'Active' }
      ];
    }

    renderOverview();
    renderInvoicesTable();
    renderBillsTable();
    renderProductsTable();
    renderCategoriesGrid();
    renderClientsGrid();
    updateBadges();
  } catch (error) {
    showToast('Error loading financial workspace data.', 'error');
  }
}

function updateBadges() {
  const pendingCount = appData.invoices.filter(i => i.status === 'Pending' || i.status === 'Overdue').length;
  const unpaidCount = appData.bills.filter(b => b.status === 'Unpaid').length;

  document.getElementById('nav-invoice-badge').textContent = pendingCount;
  document.getElementById('nav-bill-badge').textContent = unpaidCount;
}

// Sidebar Navigation
function switchView(viewKey) {
  sidebarNavItems.forEach(item => {
    if (item.getAttribute('data-view') === viewKey) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelectorAll('.view-panel').forEach(panel => {
    if (panel.id === `view-${viewKey}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  const meta = VIEW_META[viewKey] || VIEW_META.overview;
  headerTitle.textContent = meta.title;
  headerSubtitle.textContent = meta.subtitle;

  if (viewKey === 'create_invoice') {
    const list = document.getElementById('page-invoice-items-list');
    if (list && list.querySelectorAll('.page-invoice-item-row').length === 0) {
      initPageInvoiceForm();
    } else {
      calculatePageInvoiceTotal();
    }
  }

  if (viewKey === 'add_product') {
    populatePageProductCategoryOptions();
  }

  if (viewKey === 'add_bill') {
    populateBillCategoryOptions();
  }
}
window.switchView = switchView;

sidebarNavItems.forEach(item => {
  item.addEventListener('click', () => {
    const viewKey = item.getAttribute('data-view');
    switchView(viewKey);
  });
});

// Quick View Jump Buttons
document.querySelectorAll('.link-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    if (target) switchView(target);
  });
});

// ================= VIEW RENDERERS =================

function renderOverview() {
  // Compute Stats
  const pendingTotal = appData.invoices
    .filter(i => i.status === 'Pending' || i.status === 'Overdue')
    .reduce((sum, i) => sum + i.amount, 0);

  const unpaidBillsTotal = appData.bills
    .filter(b => b.status === 'Unpaid')
    .reduce((sum, b) => sum + b.amount, 0);

  document.getElementById('stat-pending-invoices').textContent = formatCurrency(pendingTotal);
  document.getElementById('stat-unpaid-bills').textContent = formatCurrency(unpaidBillsTotal);

  // Populate Overview Invoices Table (Top 4)
  const tbody = document.getElementById('overview-invoices-tbody');
  tbody.innerHTML = appData.invoices.slice(0, 4).map(inv => `
    <tr>
      <td class="font-mono nowrap-cell"><strong>${inv.id}</strong></td>
      <td><strong>${inv.clientName}</strong></td>
      <td class="nowrap-cell text-right"><strong>${formatCurrency(inv.amount)}</strong></td>
      <td class="nowrap-cell">${inv.dueDate}</td>
      <td class="nowrap-cell text-center"><span class="status-tag ${inv.status.toLowerCase()}">${inv.status}</span></td>
    </tr>
  `).join('');

  // Populate Overview Mini Bills List
  const billsContainer = document.getElementById('overview-bills-list');
  billsContainer.innerHTML = appData.bills.slice(0, 3).map(bill => {
    const isPaid = bill.status.toLowerCase() === 'paid';
    const tagClass = isPaid ? 'paid' : 'overdue';

    return `
      <div class="mini-bill-item toggle-bill-card" data-id="${bill.id}" style="cursor: pointer;" title="Click card to toggle payment status (Paid / Unpaid)">
        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
          <strong style="font-size: 0.94rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${bill.vendor}</strong>
          <span class="text-subtle" style="font-size: 0.78rem; font-weight: 500;">Due ${bill.dueDate}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; margin-left: 16px;">
          <span style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); font-family: var(--font-heading);">${formatCurrency(bill.amount)}</span>
          <span class="status-tag ${tagClass}">${bill.status}</span>
        </div>
      </div>
    `;
  }).join('');

  // Toggle Bill Status Click Handlers
  billsContainer.querySelectorAll('.toggle-bill-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.getAttribute('data-id');
      const bill = appData.bills.find(b => b.id === id);
      if (!bill) return;

      try {
        const res = await api.toggleBillStatus(id);
        showToast(res.message || `Bill ${id} marked as ${res.bill.status}!`, 'success');
        await loadBusinessData();
      } catch (err) {
        // Fail-safe dynamic fallback
        bill.status = bill.status === 'Paid' ? 'Unpaid' : 'Paid';
        showToast(`Bill ${bill.vendor} status updated to ${bill.status}!`, 'success');
        updateDashboardMetrics();
        renderOverviewBills();
      }
    });
  });
}

function renderInvoicesTable(filterStatus = 'all', searchQuery = '') {
  const tbody = document.getElementById('invoices-table-tbody');
  
  let list = appData.invoices;
  if (filterStatus !== 'all') {
    list = list.filter(i => i.status === filterStatus);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(i => i.id.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-subtle); padding: 32px;">No invoices found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(inv => `
    <tr>
      <td class="font-mono nowrap-cell"><strong>${inv.id}</strong></td>
      <td class="nowrap-cell">
        <span class="clickable-entity view-client-related-btn" data-client-name="${inv.clientName}" title="Click to view client related data">
          <strong>${inv.clientName}</strong>
        </span><br>
        <span class="text-subtle" style="font-size: 0.8rem;">${inv.clientEmail}</span>
      </td>
      <td class="nowrap-cell">
        <span class="status-tag clickable-badge view-category-related-btn" data-category-name="${inv.category}" style="background: rgba(124, 58, 237, 0.1); color: var(--primary-accent);" title="Click to view category items">
          ${inv.category}
        </span>
      </td>
      <td class="nowrap-cell">${inv.issueDate}</td>
      <td class="nowrap-cell">${inv.dueDate}</td>
      <td class="nowrap-cell text-right"><strong>${formatCurrency(inv.amount)}</strong></td>
      <td class="nowrap-cell text-center"><span class="status-tag ${inv.status.toLowerCase()}">${inv.status}</span></td>
      <td class="nowrap-cell text-right">
        ${inv.status !== 'Paid' ? `<button class="action-btn-sm mark-paid-btn" data-id="${inv.id}">Mark Paid</button>` : `<span class="text-emerald" style="font-size:0.82rem; font-weight:600;">Completed</span>`}
      </td>
    </tr>
  `).join('');

  // Attach Mark Paid Handlers
  tbody.querySelectorAll('.mark-paid-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const inv = appData.invoices.find(i => i.id === id);
      if (inv) {
        inv.status = 'Paid';
      }
      renderInvoicesTable(filterStatus, searchQuery);
      renderOverview();
      showToast(`Invoice ${id} marked as Paid!`, 'success');

      try {
        await api.updateInvoiceStatus(id, 'Paid');
      } catch (err) {
        console.warn('Backend update error, updated locally:', err);
      }
    });
  });
}

function renderBillsTable(searchQuery = '') {
  const tbody = document.getElementById('bills-table-tbody');
  let list = appData.bills;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(b => b.vendor.toLowerCase().includes(q) || b.category.toLowerCase().includes(q));
  }

  tbody.innerHTML = list.map(bill => `
    <tr>
      <td class="font-mono nowrap-cell"><strong>${bill.id}</strong></td>
      <td class="nowrap-cell"><strong>${bill.vendor}</strong></td>
      <td class="nowrap-cell">
        <span class="status-tag clickable-badge view-category-related-btn" data-category-name="${bill.category}" style="background: rgba(124, 58, 237, 0.1); color: var(--primary-accent);" title="Click to view category items">
          ${bill.category}
        </span>
      </td>
      <td class="nowrap-cell">${bill.dueDate}</td>
      <td class="nowrap-cell text-right"><strong>${formatCurrency(bill.amount)}</strong></td>
      <td class="nowrap-cell text-center">
        <button class="action-btn-sm toggle-autopay-btn" data-id="${bill.id}">
          ${bill.autoPay ? '⚡ Enabled' : 'Disabled'}
        </button>
      </td>
      <td class="nowrap-cell text-center"><span class="status-tag ${bill.status.toLowerCase()}">${bill.status}</span></td>
      <td class="nowrap-cell text-right">
        ${bill.status === 'Unpaid' 
          ? `<button class="action-btn-sm pay-bill-btn" data-id="${bill.id}" style="background: var(--gradient-primary); color:#fff; border:none; padding: 7px 16px; font-weight:600;">Pay Now</button>`
          : `<span class="text-emerald" style="font-size:0.82rem; font-weight:600;">Settled</span>`
        }
      </td>
    </tr>
  `).join('');

  // Pay Bill Action Handlers
  tbody.querySelectorAll('.pay-bill-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      try {
        await api.payBill(id);
        showToast(`Bill ${id} paid successfully!`, 'success');
        await loadBusinessData();
      } catch {
        showToast('Failed to process payment', 'error');
      }
    });
  });

  // Toggle Auto-Pay Handlers
  tbody.querySelectorAll('.toggle-autopay-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      try {
        await api.toggleBillAutoPay(id);
        await loadBusinessData();
      } catch {
        showToast('Failed to toggle auto-pay', 'error');
      }
    });
  });
}

function renderProductsTable(filterCategory = 'all', searchQuery = '') {
  const tbody = document.getElementById('products-table-tbody');
  if (!tbody) return;

  let list = appData.products;
  if (filterCategory !== 'all') {
    list = list.filter(p => p.category === filterCategory);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-subtle); padding: 32px;">No products found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(prd => `
    <tr>
      <td class="font-mono nowrap-cell"><strong>${prd.id}</strong></td>
      <td><strong>${prd.name}</strong></td>
      <td>
        <span class="status-tag clickable-badge view-category-related-btn" data-category-name="${prd.category}" style="background: rgba(124, 58, 237, 0.1); color: var(--primary-accent);" title="Click to view category items">
          ${prd.category}
        </span>
      </td>
      <td class="nowrap-cell text-right"><strong>${formatCurrency(prd.price)}</strong></td>
      <td class="nowrap-cell text-center"><strong>${prd.count} units</strong></td>
      <td class="nowrap-cell text-center">
        <span class="status-tag ${prd.stock === 'In Stock' ? 'paid' : 'pending'}">${prd.stock}</span>
      </td>
    </tr>
  `).join('');
}

function renderCategoriesGrid() {
  const tbody = document.getElementById('categories-table-tbody');
  if (!tbody) return;

  if (!appData.categories || appData.categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-subtle); padding: 32px;">No categories configured.</td></tr>`;
    return;
  }

  tbody.innerHTML = appData.categories.map(cat => {
    const isInactive = cat.status === 'Inactive';
    const tagClass = isInactive ? 'overdue' : 'paid';
    const displayStatus = cat.status || 'Active';
    const subs = Array.isArray(cat.subCategories) && cat.subCategories.length > 0 ? cat.subCategories : ['General'];
    const genderTag = cat.genderType || 'Unisex';
    const season = cat.seasonTag || 'All Season';

    const subPills = subs.map(s => `
      <span style="font-size: 0.72rem; padding: 2px 7px; background: rgba(124, 58, 237, 0.08); color: var(--primary-accent); border-radius: 6px; font-weight: 500;">
        ${s}
      </span>
    `).join(' ');

    return `
      <tr>
        <td class="font-mono nowrap-cell"><strong>${cat.id}</strong></td>
        <td>
          <span class="clickable-entity view-category-related-btn" data-category-name="${cat.name}" style="cursor: pointer; color: var(--primary-accent);" title="Click to view ${cat.name} products">
            <strong>${cat.name}</strong>
          </span>
          <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
            ${subPills}
          </div>
        </td>
        <td class="nowrap-cell text-center">
          <span class="status-tag" style="background: #f1f5f9; color: #475569; font-size: 0.75rem;">
            ${genderTag} • ${season}
          </span>
        </td>
        <td class="nowrap-cell text-center">
          <span class="clickable-entity view-category-related-btn" data-category-name="${cat.name}" style="cursor: pointer;" title="Click to view items">
            <strong>${cat.itemCounts || 0} items</strong>
          </span>
        </td>
        <td class="nowrap-cell text-center">
          <button class="action-btn-sm toggle-cat-status-btn" data-id="${cat.id}" style="border:none; background:transparent; padding:0; cursor:pointer;" title="Click to toggle status (Active / Inactive)">
            <span class="status-tag ${tagClass}">${displayStatus}</span>
          </button>
        </td>
        <td class="nowrap-cell text-right">
          <button class="action-btn-sm view-category-related-btn" data-category-name="${cat.name}" style="background: rgba(124, 58, 237, 0.12); color: var(--primary-accent); border: 1px solid rgba(124, 58, 237, 0.25); font-weight: 600; cursor: pointer;">
            🔗 View Items
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Toggle Category Status Handlers
  tbody.querySelectorAll('.toggle-cat-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      try {
        const res = await api.toggleCategoryStatus(id);
        showToast(res.message || `Category ${id} status updated!`, 'success');
        await loadBusinessData();
      } catch {
        showToast('Failed to update category status', 'error');
      }
    });
  });
}

// Global Category Click Handler to navigate directly to filtered Products view
document.addEventListener('click', (e) => {
  const categoryBtn = e.target.closest('.view-category-related-btn');
  if (categoryBtn) {
    const categoryName = categoryBtn.getAttribute('data-category-name') || categoryBtn.getAttribute('data-category-id');
    if (categoryName) {
      const catObj = appData.categories.find(c => c.id === categoryName || c.name === categoryName);
      const targetCategoryName = catObj ? catObj.name : categoryName;

      // 1. Switch active view to 'products' (Products Catalog)
      switchView('products');

      // 2. Select/highlight category filter button in Products view if present
      let matchedTab = false;
      document.querySelectorAll('.filter-btn[data-prd-filter]').forEach(btn => {
        if (btn.getAttribute('data-prd-filter') === targetCategoryName) {
          btn.classList.add('active');
          matchedTab = true;
        } else {
          btn.classList.remove('active');
        }
      });

      if (!matchedTab) {
        document.querySelectorAll('.filter-btn[data-prd-filter]').forEach(b => b.classList.remove('active'));
      }

      // 3. Render filtered Products table for clicked category
      renderProductsTable(targetCategoryName, globalSearchInput?.value || '');

      showToast(`Showing apparel items for "${targetCategoryName}"`, 'info');
    }
  }
});

function renderClientsGrid() {
  const tbody = document.getElementById('clients-table-tbody');
  if (!tbody) return;

  if (!appData.clients || appData.clients.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-subtle); padding: 32px;">No customers found.</td></tr>`;
    return;
  }

  tbody.innerHTML = appData.clients.map(client => {
    const statusLower = (client.status || 'Active').toLowerCase();
    const tagClass = statusLower === 'active' ? 'paid' : statusLower === 'notice' ? 'pending' : 'overdue';

    return `
      <tr>
        <td class="font-mono nowrap-cell"><strong>${client.id}</strong></td>
        <td class="nowrap-cell">
          <span class="clickable-entity view-client-related-btn" data-client-id="${client.id}">
            <strong>${client.name}</strong>
          </span>
        </td>
        <td class="nowrap-cell">${client.contact}</td>
        <td class="nowrap-cell text-right"><strong>${formatCurrency(client.totalBilled || 0)}</strong></td>
        <td class="nowrap-cell text-center">
          <button class="action-btn-sm toggle-client-status-btn" data-id="${client.id}" style="border:none; background:transparent; padding:0; cursor:pointer;" title="Click to toggle status (Active / Notice / Inactive)">
            <span class="status-tag ${tagClass}">${client.status || 'Active'}</span>
          </button>
        </td>
        <td class="nowrap-cell text-right">
          <button class="action-btn-sm view-client-related-btn" data-client-id="${client.id}" style="background: rgba(124, 58, 237, 0.12); color: var(--primary-accent); border: 1px solid rgba(124, 58, 237, 0.25); font-weight: 600;">
            🔗 Related Data
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Toggle Client Status Click Handlers
  tbody.querySelectorAll('.toggle-client-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const client = appData.clients.find(c => c.id === id);
      if (!client) return;

      try {
        const res = await api.toggleClientStatus(id);
        showToast(res.message || `Customer ${id} status updated to ${res.client.status}!`, 'success');
        await loadBusinessData();
      } catch (err) {
        if (client.status === 'Active') client.status = 'Notice';
        else if (client.status === 'Notice') client.status = 'Inactive';
        else client.status = 'Active';

        showToast(`Customer ${client.name} status updated to ${client.status}!`, 'success');
        renderClientsGrid();
      }
    });
  });
}

// Filter Tabs Handler for Invoices Page
document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.getAttribute('data-filter');
    renderInvoicesTable(filter, globalSearchInput?.value || '');
  });
});

// Filter Tabs Handler for Products Page
document.querySelectorAll('.filter-btn[data-prd-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn[data-prd-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.getAttribute('data-prd-filter');
    renderProductsTable(filter, globalSearchInput?.value || '');
  });
});

// Global Search Filter Input
if (globalSearchInput) {
  globalSearchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    const activeInvFilter = document.querySelector('.filter-btn.active[data-filter]')?.getAttribute('data-filter') || 'all';
    const activePrdFilter = document.querySelector('.filter-btn.active[data-prd-filter]')?.getAttribute('data-prd-filter') || 'all';
    renderInvoicesTable(activeInvFilter, query);
    renderBillsTable(query);
    renderProductsTable(activePrdFilter, query);
  });
}

// MODAL OPEN & CLOSE HELPERS
function openInvoiceModal() {
  switchView('create_invoice');
  initPageInvoiceForm();
}
function closeInvoiceModal() { switchView('invoices'); }

function openProductModal() {
  switchView('add_product');
  populatePageProductCategoryOptions();
}
function closeProductModal() { switchView('products'); }

function openCategoryModal() { switchView('add_category'); }
function closeCategoryModal() { switchView('categories'); }

function openBillModal() {
  switchView('add_bill');
  const dueDateInp = document.getElementById('page-bill-due-date');
  if (dueDateInp && !dueDateInp.value) {
    dueDateInp.value = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  }
}
function closeBillModal() { switchView('bills'); }

window.openInvoiceModal = openInvoiceModal;
window.openProductModal = openProductModal;
window.openCategoryModal = openCategoryModal;
window.openBillModal = openBillModal;


// RELATED DATA MODAL LOGIC & HELPERS
const relatedDataModal = document.getElementById('related-data-modal');
const closeRelatedModalBtn = document.getElementById('close-related-modal-btn');
const closeRelatedFooterBtn = document.getElementById('close-related-footer-btn');
const relatedEntityTypeChip = document.getElementById('related-entity-type-chip');
const relatedEntityTitle = document.getElementById('related-entity-title');
const relatedEntitySubtitle = document.getElementById('related-entity-subtitle');
const relatedMetricsGrid = document.getElementById('related-metrics-grid');
const relatedInvoicesTbody = document.getElementById('related-invoices-tbody');
const relatedProductsTbody = document.getElementById('related-products-tbody');
const relatedInvCountSpan = document.getElementById('related-inv-count');
const relatedPrdCountSpan = document.getElementById('related-prd-count');
const relatedProductsTabBtn = document.getElementById('related-products-tab-btn');
const relatedPrimaryActionBtn = document.getElementById('related-primary-action-btn');

function openRelatedModal() {
  if (relatedDataModal) relatedDataModal.classList.remove('hidden');
}

function closeRelatedModal() {
  if (relatedDataModal) relatedDataModal.classList.add('hidden');
}

// Tab switching inside related data modal
document.querySelectorAll('.related-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.related-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const targetTab = btn.getAttribute('data-tab');
    document.querySelectorAll('.related-tab-content').forEach(c => c.classList.add('hidden'));
    const targetEl = document.getElementById(`tab-${targetTab}`);
    if (targetEl) targetEl.classList.remove('hidden');
  });
});

async function viewClientRelatedData(clientIdOrName) {
  try {
    let data;
    try {
      const res = await api.getClientRelatedData(clientIdOrName);
      if (res.success) data = res;
    } catch (e) {
      const client = appData.clients.find(c => c.id === clientIdOrName || c.name === clientIdOrName);
      if (!client) return showToast('Client not found', 'error');
      const invoices = appData.invoices.filter(i => i.clientName === client.name || i.clientId === client.id);
      data = {
        client,
        invoices,
        metrics: {
          totalBilled: invoices.reduce((s, i) => s + i.amount, 0),
          paidAmount: invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
          pendingAmount: invoices.filter(i => i.status === 'Pending').reduce((s, i) => s + i.amount, 0),
          overdueAmount: invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0),
          invoicesCount: invoices.length
        }
      };
    }

    if (!data || !data.client) return showToast('Client data unavailable', 'error');

    relatedEntityTypeChip.textContent = 'Customer Related Data';
    relatedEntityTitle.textContent = data.client.name;
    relatedEntitySubtitle.textContent = `Contact: ${data.client.contact} • Status: ${data.client.status || 'Active'}`;

    // Metrics grid
    relatedMetricsGrid.innerHTML = `
      <div class="related-metric-card">
        <div class="related-metric-label">Total Invoiced</div>
        <div class="related-metric-val">${formatCurrency(data.metrics.totalBilled || 0)}</div>
      </div>
      <div class="related-metric-card">
        <div class="related-metric-label">Paid Revenue</div>
        <div class="related-metric-val" style="color: var(--emerald-accent);">${formatCurrency(data.metrics.paidAmount || 0)}</div>
      </div>
      <div class="related-metric-card">
        <div class="related-metric-label">Pending Balance</div>
        <div class="related-metric-val" style="color: var(--amber-accent);">${formatCurrency(data.metrics.pendingAmount || 0)}</div>
      </div>
      <div class="related-metric-card">
        <div class="related-metric-label">Invoices Count</div>
        <div class="related-metric-val">${data.metrics.invoicesCount || 0}</div>
      </div>
    `;

    // Invoices list
    relatedInvCountSpan.textContent = data.invoices.length;
    if (data.invoices.length === 0) {
      relatedInvoicesTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--text-subtle);">No invoices generated yet for this client.</td></tr>`;
    } else {
      relatedInvoicesTbody.innerHTML = data.invoices.map(inv => `
        <tr>
          <td class="font-mono"><strong>${inv.id}</strong></td>
          <td>${inv.category}</td>
          <td class="text-right"><strong>${formatCurrency(inv.amount || 0)}</strong></td>
          <td>${inv.dueDate}</td>
          <td class="text-center"><span class="status-tag ${inv.status.toLowerCase()}">${inv.status}</span></td>
        </tr>
      `).join('');
    }

    // Hide products tab for client view
    relatedProductsTabBtn.style.display = 'none';
    const firstTabBtn = document.querySelector('.related-tab-btn[data-tab="related-invoices"]');
    if (firstTabBtn) firstTabBtn.click();

    // Primary Action
    relatedPrimaryActionBtn.style.display = 'inline-flex';
    relatedPrimaryActionBtn.innerHTML = `<span>+ Create Invoice for ${data.client.name}</span>`;
    relatedPrimaryActionBtn.onclick = () => {
      closeRelatedModal();
      openInvoiceModal();
      document.getElementById('inv-client-name').value = data.client.name;
      document.getElementById('inv-client-email').value = data.client.contact || '';
    };

    openRelatedModal();
  } catch (err) {
    showToast('Error loading client related data', 'error');
  }
}

async function viewCategoryRelatedData(categoryIdOrName) {
  try {
    let data;
    try {
      const res = await api.getCategoryRelatedData(categoryIdOrName);
      if (res.success) data = res;
    } catch (e) {
      const category = appData.categories.find(c => c.id === categoryIdOrName || c.name === categoryIdOrName);
      if (!category) return showToast('Category not found', 'error');
      const products = appData.products.filter(p => p.category === category.name);
      const invoices = appData.invoices.filter(i => i.category === category.name);
      data = {
        category,
        products,
        invoices,
        metrics: {
          productCount: products.length,
          invoiceCount: invoices.length,
          categoryRevenue: invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)
        }
      };
    }

    if (!data || !data.category) return showToast('Category data unavailable', 'error');

    relatedEntityTypeChip.textContent = 'Category Related Data';
    relatedEntityTitle.textContent = data.category.name;
    relatedEntitySubtitle.textContent = data.category.description || `Category ID: ${data.category.id} • Status: ${data.category.status || 'Active'}`;

    // Metrics grid
    relatedMetricsGrid.innerHTML = `
      <div class="related-metric-card">
        <div class="related-metric-label">Products SKU</div>
        <div class="related-metric-val">${data.metrics.productCount || 0}</div>
      </div>
      <div class="related-metric-card">
        <div class="related-metric-label">Invoices Count</div>
        <div class="related-metric-val">${data.metrics.invoiceCount || 0}</div>
      </div>
      <div class="related-metric-card">
        <div class="related-metric-label">Category Revenue</div>
        <div class="related-metric-val" style="color: var(--primary-accent);">${formatCurrency(data.metrics.categoryRevenue || 0)}</div>
      </div>
    `;

    // Invoices list
    relatedInvCountSpan.textContent = data.invoices.length;
    if (data.invoices.length === 0) {
      relatedInvoicesTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--text-subtle);">No invoices under this category.</td></tr>`;
    } else {
      relatedInvoicesTbody.innerHTML = data.invoices.map(inv => `
        <tr>
          <td class="font-mono"><strong>${inv.id}</strong></td>
          <td>${inv.clientName}</td>
          <td class="text-right"><strong>${formatCurrency(inv.amount || 0)}</strong></td>
          <td>${inv.dueDate}</td>
          <td class="text-center"><span class="status-tag ${inv.status.toLowerCase()}">${inv.status}</span></td>
        </tr>
      `).join('');
    }

    // Products list
    relatedProductsTabBtn.style.display = 'inline-block';
    relatedPrdCountSpan.textContent = data.products.length;
    if (data.products.length === 0) {
      relatedProductsTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:18px; color:var(--text-subtle);">No products linked to this category.</td></tr>`;
    } else {
      relatedProductsTbody.innerHTML = data.products.map(prd => `
        <tr>
          <td class="font-mono"><strong>${prd.id}</strong></td>
          <td>${prd.name}</td>
          <td class="text-right"><strong>${formatCurrency(prd.price || 0)}</strong></td>
          <td class="text-center"><span class="status-tag ${prd.stock === 'In Stock' ? 'paid' : 'pending'}">${prd.stock}</span></td>
        </tr>
      `).join('');
    }

    const firstTabBtn = document.querySelector('.related-tab-btn[data-tab="related-invoices"]');
    if (firstTabBtn) firstTabBtn.click();

    // Primary Action
    relatedPrimaryActionBtn.style.display = 'inline-flex';
    relatedPrimaryActionBtn.innerHTML = `<span>+ Add Product to ${data.category.name}</span>`;
    relatedPrimaryActionBtn.onclick = () => {
      closeRelatedModal();
      openProductModal();
      const catSelect = document.getElementById('prd-category');
      if (catSelect) catSelect.value = data.category.name;
    };

    openRelatedModal();
  } catch (err) {
    showToast('Error loading category related data', 'error');
  }
}

// Universal Modal Event Delegation
document.addEventListener('click', (e) => {
  // Related Client Data Triggers
  const clientBtn = e.target.closest('.view-client-related-btn');
  if (clientBtn) {
    e.preventDefault();
    const id = clientBtn.getAttribute('data-client-id') || clientBtn.getAttribute('data-client-name');
    if (id) viewClientRelatedData(id);
    return;
  }

  // Related Category Data Triggers
  const catBtn = e.target.closest('.view-category-related-btn');
  if (catBtn) {
    e.preventDefault();
    const id = catBtn.getAttribute('data-category-id') || catBtn.getAttribute('data-category-name');
    if (id) viewCategoryRelatedData(id);
    return;
  }

  // Close Related Data Modal
  if (e.target.closest('#close-related-modal-btn') || e.target.closest('#close-related-footer-btn')) {
    e.preventDefault();
    closeRelatedModal();
    return;
  }

  // Product Modal Triggers & Controls
  if (e.target.closest('#quick-add-product-btn')) {
    e.preventDefault();
    openProductModal();
  }
  if (e.target.closest('#close-product-modal-btn') || e.target.closest('#cancel-product-modal-btn')) {
    e.preventDefault();
    closeProductModal();
  }

  // Category Modal Triggers & Controls
  if (e.target.closest('#quick-add-category-btn')) {
    e.preventDefault();
    openCategoryModal();
  }
  if (e.target.closest('#close-category-modal-btn') || e.target.closest('#cancel-category-modal-btn')) {
    e.preventDefault();
    closeCategoryModal();
  }

  // Invoice Modal Triggers & Controls
  if (e.target.closest('#quick-create-invoice-btn') || e.target.closest('#invoice-page-create-btn')) {
    e.preventDefault();
    openInvoiceModal();
  }
  if (e.target.closest('#close-invoice-modal-btn') || e.target.closest('#cancel-invoice-modal-btn')) {
    e.preventDefault();
    closeInvoiceModal();
  }

  // Bill Modal Triggers & Controls
  if (e.target.closest('#quick-add-bill-btn')) {
    e.preventDefault();
    openBillModal();
  }
  if (e.target.closest('#close-bill-modal-btn') || e.target.closest('#cancel-bill-modal-btn')) {
    e.preventDefault();
    closeBillModal();
  }

  // Backdrop Overlays Click-to-Close
  if (e.target === createInvoiceModal) closeInvoiceModal();
  if (e.target === createProductModal) closeProductModal();
  if (e.target === createCategoryModal) closeCategoryModal();
  if (e.target === createBillModal) closeBillModal();
  if (e.target === relatedDataModal) closeRelatedModal();
  if (e.target === forgotModal) forgotModal.classList.add('hidden');
});


// Categories & Sub-Categories Helper for Invoice Item Selection
const CLOTHING_SUBCATEGORY_MAP = {
  "Men's Apparel": ['Shirts', 'T-Shirts', 'Jeans & Trousers', 'Suits & Blazers', 'Ethnic Wear'],
  "Women's Fashion": ['Dresses & Maxis', 'Tops & Tunics', 'Sarees & Kurtis', 'Activewear'],
  "Kidswear & Toddlers": ['Infant Onesies', 'Boys Casuals', 'Girls Partywear', 'Sleepwear'],
  "Footwear & Shoes": ['Sneakers', 'Formal Shoes', 'Sandals & Slippers', 'Boots'],
  "Fashion Accessories": ['Leather Belts & Wallets', 'Caps & Hats', 'Watches', 'Handbags'],
  "Winterwear & Outerwear": ['Jackets & Coats', 'Sweaters & Cardigans', 'Fleece Hoodies', 'Thermals']
};

function getSubCategoriesForCategory(categoryName) {
  const cleanCat = (categoryName || '').trim();
  if (!cleanCat) return ['General Item'];

  if (appData.categories && appData.categories.length > 0) {
    const found = appData.categories.find(c => (c.name || '').trim().toLowerCase() === cleanCat.toLowerCase());
    if (found && Array.isArray(found.subCategories) && found.subCategories.length > 0) {
      return found.subCategories;
    }
  }

  const matchKey = Object.keys(CLOTHING_SUBCATEGORY_MAP).find(k => k.toLowerCase() === cleanCat.toLowerCase());
  return matchKey ? CLOTHING_SUBCATEGORY_MAP[matchKey] : ['General Item'];
}

function updateSubCategoryOptions(catSelectEl, subCatSelectEl) {
  if (!catSelectEl || !subCatSelectEl) return;
  const selectedCategory = catSelectEl.value;
  const subCats = getSubCategoriesForCategory(selectedCategory);
  subCatSelectEl.innerHTML = subCats.map(sub => `<option value="${sub}">${sub}</option>`).join('');
}

function calculateInvoiceTotal() {
  return calculatePageInvoiceTotal();
}

function populateInvoiceCategoriesInRow(row) {
  if (!row) return;
  const catSelect = row.querySelector('.item-category-select');
  const subCatSelect = row.querySelector('.item-subcategory-select');
  if (!catSelect || !subCatSelect) return;

  const activeCategories = (appData.categories && appData.categories.length > 0)
    ? appData.categories.map(c => c.name)
    : ["Men's Apparel", "Women's Fashion", "Kidswear & Toddlers", "Footwear & Shoes", "Fashion Accessories", "Winterwear & Outerwear"];

  const currentCatVal = catSelect.value || activeCategories[0];
  catSelect.innerHTML = activeCategories.map(c => `<option value="${c}" ${c === currentCatVal ? 'selected' : ''}>${c}</option>`).join('');
  updateSubCategoryOptions(catSelect, subCatSelect);
}

// Global Document listeners for category & sub-category sync
document.addEventListener('change', (e) => {
  if (e.target && e.target.classList.contains('item-category-select')) {
    const row = e.target.closest('.invoice-item-row');
    if (row) {
      const subCatSelect = row.querySelector('.item-subcategory-select');
      if (subCatSelect) {
        updateSubCategoryOptions(e.target, subCatSelect);
      }
    }
  }
});

document.addEventListener('focusin', (e) => {
  if (e.target && e.target.classList.contains('item-subcategory-select')) {
    const row = e.target.closest('.invoice-item-row');
    if (row) {
      const catSelect = row.querySelector('.item-category-select');
      if (catSelect) {
        const subCats = getSubCategoriesForCategory(catSelect.value);
        const currentSubVal = e.target.value;
        if (subCats.length > 0 && !subCats.includes(currentSubVal)) {
          e.target.innerHTML = subCats.map(sub => `<option value="${sub}">${sub}</option>`).join('');
        }
      }
    }
  }
});

const invoiceItemsList = document.getElementById('invoice-items-list');
const addInvoiceItemBtn = document.getElementById('add-invoice-item-btn');

if (invoiceItemsList) {
  invoiceItemsList.addEventListener('input', calculateInvoiceTotal);

  invoiceItemsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item-btn')) {
      const rows = invoiceItemsList.querySelectorAll('.invoice-item-row');
      if (rows.length > 1) {
        e.target.closest('.invoice-item-row').remove();
        calculateInvoiceTotal();
      } else {
        showToast('At least one product item is required.', 'info');
      }
    }
  });
}

if (addInvoiceItemBtn) {
  addInvoiceItemBtn.addEventListener('click', () => {
    const newRow = document.createElement('div');
    newRow.className = 'invoice-item-row';
    newRow.style.cssText = 'display: grid; grid-template-columns: 1.8fr 1.3fr 1.3fr 0.7fr 1fr 34px; gap: 8px; align-items: center;';
    
    const activeCategories = (appData.categories && appData.categories.length > 0)
      ? appData.categories.map(c => c.name)
      : ["Men's Apparel", "Women's Fashion", "Kidswear & Toddlers", "Footwear & Shoes", "Fashion Accessories", "Winterwear & Outerwear"];

    const catOptions = activeCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    const firstCatSubs = getSubCategoriesForCategory(activeCategories[0]);
    const defaultSubOptions = firstCatSubs.map(sub => `<option value="${sub}">${sub}</option>`).join('');

    newRow.innerHTML = `
      <input type="text" class="item-name-input" placeholder="e.g. Cotton Shirt" style="padding: 9px 10px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.85rem; outline: none; color: var(--text-main);" required />
      
      <select class="item-category-select" style="padding: 9px 8px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.82rem; outline: none; color: var(--text-main);">
        ${catOptions}
      </select>

      <select class="item-subcategory-select" style="padding: 9px 8px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.82rem; outline: none; color: var(--text-main);">
        ${defaultSubOptions}
      </select>

      <input type="number" class="item-qty-input" placeholder="1" min="1" value="1" style="padding: 9px 6px; text-align: center; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.85rem; outline: none; color: var(--text-main);" required />
      
      <input type="number" step="0.01" class="item-price-input" placeholder="0.00" style="padding: 9px 10px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.85rem; outline: none; color: var(--text-main);" required />
      
      <button type="button" class="remove-item-btn" style="background: var(--rose-bg); color: var(--rose); border: none; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; font-weight: bold; flex-shrink: 0;" title="Remove Item">&times;</button>
    `;
    invoiceItemsList.appendChild(newRow);
  });
}

// CREATE NEW INVOICE DEDICATED PAGE LOGIC
const pageInvoiceItemsList = document.getElementById('page-invoice-items-list');
const pageInvTotalDisplay = document.getElementById('page-inv-total-display');
const pageAddInvoiceItemBtn = document.getElementById('page-add-invoice-item-btn');
const createInvoicePageForm = document.getElementById('create-invoice-page-form');

function calculatePageInvoiceTotal() {
  if (!pageInvoiceItemsList || !pageInvTotalDisplay) return 0;
  let total = 0;
  pageInvoiceItemsList.querySelectorAll('.page-invoice-item-row').forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty-input')?.value || 1);
    const price = parseFloat(row.querySelector('.item-price-input')?.value || 0);
    const subtotal = qty * price;
    const subtotalEl = row.querySelector('.item-subtotal-display');
    if (subtotalEl) {
      subtotalEl.textContent = formatCurrency(subtotal);
    }
    total += subtotal;
  });
  pageInvTotalDisplay.textContent = formatCurrency(total);
  return total;
}

function createPageInvoiceRow() {
  const activeProducts = (appData.products && appData.products.length > 0)
    ? appData.products
    : [
        { name: 'Classic Cotton Slim-Fit Shirt', category: "Men's Apparel", price: 1299.00 },
        { name: 'Floral Print Summer Chiffon Dress', category: "Women's Fashion", price: 2499.00 },
        { name: 'Denim Jacket with Fleece Lining', category: 'Winterwear & Outerwear', price: 2799.00 },
        { name: 'Leather Formal Oxford Shoes', category: 'Footwear & Shoes', price: 4250.00 },
        { name: 'Kids Organic Cotton T-Shirt Set', category: 'Kidswear & Toddlers', price: 999.00 },
        { name: 'Handwoven Banarasi Silk Saree', category: "Women's Fashion", price: 6800.00 },
        { name: 'Designer Leather Belt & Wallet Set', category: 'Fashion Accessories', price: 1299.00 }
      ];

  const activeCategories = (appData.categories && appData.categories.length > 0)
    ? appData.categories.map(c => c.name)
    : ["Men's Apparel", "Women's Fashion", "Kidswear & Toddlers", "Footwear & Shoes", "Fashion Accessories", "Winterwear & Outerwear"];

  const prdOptions = activeProducts.map(p =>
    `<option value="${p.name}" data-price="${p.price}" data-category="${p.category}">${p.name} (₹${Number(p.price).toLocaleString('en-IN')})</option>`
  ).join('');

  const catOptions = activeCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  const firstCatSubs = getSubCategoriesForCategory(activeCategories[0]);
  const defaultSubOptions = firstCatSubs.map(sub => `<option value="${sub}">${sub}</option>`).join('');

  const row = document.createElement('div');
  row.className = 'invoice-item-row page-invoice-item-row';
  row.style.cssText = 'display: grid; grid-template-columns: minmax(180px, 2fr) minmax(140px, 1.3fr) minmax(140px, 1.2fr) 65px 110px 110px 36px; gap: 10px; align-items: center; background: #ffffff; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border-light);';

  row.innerHTML = `
    <div>
      <select class="item-name-select" style="padding: 9px 8px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.82rem; outline: none; color: var(--text-main); width: 100%;">
        <option value="" disabled selected>-- Select Product --</option>
        ${prdOptions}
        <option value="custom">+ Custom Product...</option>
      </select>
      <input type="text" class="item-name-input" placeholder="Type item name" style="display: none; padding: 8px 10px; margin-top: 4px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.82rem; outline: none; color: var(--text-main); width: 100%;" />
    </div>
    
    <select class="item-category-select" style="padding: 9px 8px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.81rem; outline: none; color: var(--text-main); width: 100%;">
      ${catOptions}
    </select>

    <select class="item-subcategory-select" style="padding: 9px 8px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.81rem; outline: none; color: var(--text-main); width: 100%;">
      ${defaultSubOptions}
    </select>

    <input type="number" class="item-qty-input" placeholder="1" min="1" value="1" style="padding: 9px 4px; text-align: center; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.83rem; outline: none; color: var(--text-main); width: 100%;" required />
    
    <input type="number" step="0.01" class="item-price-input" placeholder="0.00" style="padding: 9px 8px; text-align: right; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; font-family: inherit; font-size: 0.83rem; outline: none; color: var(--text-main); width: 100%;" required />

    <div class="item-subtotal-display" style="text-align: right; font-weight: 700; font-size: 0.88rem; color: var(--text-main); font-family: monospace;">₹0.00</div>
    
    <button type="button" class="remove-item-btn" style="background: var(--rose-bg); color: var(--rose); border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-weight: bold; flex-shrink: 0; display: flex; align-items: center; justify-content: center;" title="Remove Item">&times;</button>
  `;

  return row;
}

// Product catalog auto-fill Unit Price & Category listener
document.addEventListener('change', (e) => {
  if (e.target && e.target.classList.contains('item-name-select')) {
    const row = e.target.closest('.invoice-item-row');
    if (!row) return;

    const selectedOption = e.target.options[e.target.selectedIndex];
    const priceInput = row.querySelector('.item-price-input');
    const catSelect = row.querySelector('.item-category-select');
    const customInput = row.querySelector('.item-name-input');

    if (e.target.value === 'custom') {
      if (customInput) {
        customInput.style.display = 'block';
        customInput.focus();
      }
      if (priceInput && !priceInput.value) priceInput.value = '0.00';
    } else {
      if (customInput) customInput.style.display = 'none';
      const price = selectedOption.getAttribute('data-price');
      const category = selectedOption.getAttribute('data-category');

      if (price && priceInput) {
        priceInput.value = parseFloat(price).toFixed(2);
      }
      if (category && catSelect) {
        catSelect.value = category;
        const subCatSelect = row.querySelector('.item-subcategory-select');
        if (subCatSelect) updateSubCategoryOptions(catSelect, subCatSelect);
      }
      calculatePageInvoiceTotal();
    }
  }
});

function initPageInvoiceForm() {
  if (!pageInvoiceItemsList) return;
  pageInvoiceItemsList.innerHTML = '';
  pageInvoiceItemsList.appendChild(createPageInvoiceRow());
  const clientNameInput = document.getElementById('page-inv-client-name');
  if (clientNameInput) clientNameInput.value = '';
  calculatePageInvoiceTotal();
}

if (pageInvoiceItemsList) {
  pageInvoiceItemsList.addEventListener('input', calculatePageInvoiceTotal);

  pageInvoiceItemsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item-btn')) {
      const rows = pageInvoiceItemsList.querySelectorAll('.page-invoice-item-row');
      if (rows.length > 1) {
        e.target.closest('.page-invoice-item-row').remove();
        calculatePageInvoiceTotal();
      } else {
        showToast('At least one product item is required.', 'info');
      }
    }
  });
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#page-add-invoice-item-btn')) {
    e.preventDefault();
    const list = document.getElementById('page-invoice-items-list');
    if (list) {
      list.appendChild(createPageInvoiceRow());
      calculatePageInvoiceTotal();
    }
    return;
  }

  if (e.target.closest('.back-to-invoices-btn')) {
    e.preventDefault();
    switchView('invoices');
    return;
  }

  if (e.target.closest('.back-to-bills-btn')) {
    e.preventDefault();
    switchView('bills');
    return;
  }

  if (e.target.closest('.back-to-products-btn')) {
    e.preventDefault();
    switchView('products');
    return;
  }

  if (e.target.closest('.back-to-categories-btn')) {
    e.preventDefault();
    switchView('categories');
    return;
  }
});

if (createInvoicePageForm) {
  createInvoicePageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const shopNameInput = document.getElementById('page-inv-client-name');
    const shopName = (shopNameInput && shopNameInput.value.trim()) ? shopNameInput.value.trim() : 'Walk-in Retail Customer';
    
    // Gather Products List
    const items = [];
    pageInvoiceItemsList.querySelectorAll('.page-invoice-item-row').forEach(row => {
      const nameSelect = row.querySelector('.item-name-select');
      const nameInput = row.querySelector('.item-name-input');
      let name = 'Product Item';
      if (nameSelect && nameSelect.value && nameSelect.value !== 'custom') {
        name = nameSelect.value;
      } else if (nameInput && nameInput.value.trim()) {
        name = nameInput.value.trim();
      }
      const category = row.querySelector('.item-category-select')?.value || "Men's Apparel";
      const subCategory = row.querySelector('.item-subcategory-select')?.value || 'Shirts';
      const qty = parseFloat(row.querySelector('.item-qty-input')?.value || 1);
      const price = parseFloat(row.querySelector('.item-price-input')?.value || 0);
      items.push({ name, category, subCategory, qty, price });
    });

    const totalAmount = calculatePageInvoiceTotal();
    const dateStr = new Date().toISOString().split('T')[0];

    try {
      const categorySummary = items.map(i => i.name).join(', ') || 'Retail Sale';
      const res = await api.createInvoice({
        clientName: shopName,
        clientEmail: '',
        amount: totalAmount,
        dueDate: dateStr,
        category: categorySummary
      });

      const generatedInvId = res.invoice?.id || `INV-${Date.now().toString().slice(-4)}`;

      // Download PDF File
      downloadInvoicePDF({
        shopName,
        items,
        totalAmount,
        invoiceId: generatedInvId,
        date: dateStr
      });

      showToast('Invoice created & PDF downloaded successfully!', 'success');
      switchView('invoices');
      await loadBusinessData();
    } catch (err) {
      const generatedInvId = `INV-${Date.now().toString().slice(-4)}`;
      downloadInvoicePDF({
        shopName,
        items,
        totalAmount,
        invoiceId: generatedInvId,
        date: dateStr
      });
      showToast('Invoice created & PDF downloaded!', 'success');
      switchView('invoices');
    }
  });
}

// PDF Export Generator Engine - Clean Full-Width Professional Layout
function downloadInvoicePDF({ shopName, items, totalAmount, invoiceId, date }) {
  const doc = new jsPDF();
  const formattedShopName = (shopName || 'Starlight Apparel Shop').trim();
  const cleanInvId = invoiceId || `INV-${Date.now().toString().slice(-4)}`;
  const cleanDate = date || new Date().toISOString().split('T')[0];

  // Formatting date helper for display (e.g. 11 Aug 2026)
  let displayDate = cleanDate;
  try {
    const d = new Date(cleanDate);
    if (!isNaN(d.getTime())) {
      displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch (e) {
    displayDate = cleanDate;
  }

  // Colors
  const purplePrimary = [124, 58, 237];   // #7c3aed
  const textDark = [15, 23, 42];          // #0f172a
  const textMuted = [100, 116, 139];      // #64748b
  const borderLight = [226, 232, 240];    // #e2e8f0
  const bgSoft = [248, 247, 255];         // #f8f7ff

  let y = 18;

  // 1. TOP HEADER BLOCK
  // Brand Logo / Title (Left)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...purplePrimary);
  doc.text('Nexus', 14, y);
  doc.setTextColor(...textDark);
  doc.text('Suite', 40, y);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Enterprise Billing & Apparel Suite', 14, y + 6);
  doc.text('123 Tech Park, Whitefield, Bangalore, Karnataka 560066', 14, y + 11);
  doc.text('GSTIN: 29ABCDE1234F1Z5 | contact@nexussuite.com', 14, y + 16);

  // Document Title: INVOICE & Badge (Right)
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...purplePrimary);
  doc.text('INVOICE', 196, y + 2, { align: 'right' });

  // Invoice ID Pill Badge
  doc.setFillColor(243, 232, 255); // #f3e8ff
  doc.roundedRect(148, y + 6, 48, 8, 3, 3, 'F');
  doc.setDrawColor(216, 180, 254);
  doc.roundedRect(148, y + 6, 48, 8, 3, 3, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...purplePrimary);
  doc.text(cleanInvId, 172, y + 11.5, { align: 'center' });

  y += 28;

  // Top Divider Line
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);

  y += 12;

  // 2. BILLED TO & INVOICE DETAILS SECTION
  // Left Box: Billed To / Client
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...purplePrimary);
  doc.text('BILLED TO / CUSTOMER', 14, y);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(formattedShopName, 14, y + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('123 Business Park, Commercial District', 14, y + 13);
  doc.text('Bangalore, Karnataka 560001, India', 14, y + 18);

  // Right Box: Dates & Details
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textMuted);
  doc.text('Invoice Date:', 140, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text(displayDate, 196, y, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textMuted);
  doc.text('Due Date:', 140, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text(displayDate, 196, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textMuted);
  doc.text('Payment Status:', 140, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6); // amber text
  doc.text('Pending', 196, y + 12, { align: 'right' });

  y += 30;

  // 3. FULL-WIDTH PRODUCTS LINE ITEMS TABLE
  // Table Header Bar (Solid Purple)
  doc.setFillColor(...purplePrimary);
  doc.roundedRect(14, y, 182, 10, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', 18, y + 6.5);
  doc.text('PRODUCT DESCRIPTION', 28, y + 6.5);
  doc.text('CATEGORY & SUB-CATEGORY', 98, y + 6.5);
  doc.text('QTY', 145, y + 6.5, { align: 'center' });
  doc.text('UNIT PRICE (₹)', 168, y + 6.5, { align: 'right' });
  doc.text('AMOUNT (₹)', 192, y + 6.5, { align: 'right' });

  y += 16;
  let itemIdx = 1;

  items.forEach((item) => {
    const qty = Number(item.qty || 1);
    const price = Number(item.price || 0);
    const subtotal = qty * price;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textDark);

    doc.text(String(itemIdx), 18, y);
    const itemName = String(item.name || 'Product Item');
    const displayItemName = itemName.length > 32 ? itemName.substring(0, 32) + '...' : itemName;
    doc.text(displayItemName, 28, y);

    const catSubTag = `${item.category || "Men's Apparel"} • ${item.subCategory || 'Shirts'}`;
    const displayCatSub = catSubTag.length > 26 ? catSubTag.substring(0, 26) + '...' : catSubTag;
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(displayCatSub, 98, y);

    doc.setFontSize(9);
    doc.setTextColor(...textDark);
    doc.text(String(qty), 145, y, { align: 'center' });
    doc.text(`Rs. ${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 168, y, { align: 'right' });
    doc.text(`Rs. ${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, y, { align: 'right' });

    // Subtle Row Divider Line
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(14, y + 5, 196, y + 5);

    y += 12;
    itemIdx++;
  });

  // Table Bottom Border
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);

  // 4. SUMMARY TOTALS SECTION (Right Aligned)
  y += 10;

  // Notes Box (Left)
  doc.setFillColor(...bgSoft);
  doc.roundedRect(14, y, 100, 32, 3, 3, 'F');
  doc.setDrawColor(237, 233, 254);
  doc.roundedRect(14, y, 100, 32, 3, 3, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...purplePrimary);
  doc.text('Terms & Notes:', 20, y + 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('• Thank you for choosing Nexus Suite.', 20, y + 16);
  doc.text('• Payment is due within 14 days of invoice issuance.', 20, y + 22);

  // Totals Box (Right)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textMuted);
  doc.text('Subtotal:', 155, y + 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text(`Rs. ${Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 196, y + 8, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textMuted);
  doc.text('Tax (0%):', 155, y + 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text('Rs. 0.00', 196, y + 16, { align: 'right' });

  // Total Card Highlight
  doc.setFillColor(...purplePrimary);
  doc.roundedRect(135, y + 22, 61, 12, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Total Amount:', 140, y + 30);
  doc.text(`Rs. ${Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 192, y + 30, { align: 'right' });

  // SAVE & DOWNLOAD PDF FILE
  const cleanShopFilename = formattedShopName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Invoice_${cleanInvId}_${cleanShopFilename}.pdf`);
}

// Form Submission Handlers
createInvoiceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const shopName = document.getElementById('inv-client-name').value.trim();
  
  // Gather Products List
  const items = [];
  invoiceItemsList.querySelectorAll('.invoice-item-row').forEach(row => {
    const name = row.querySelector('.item-name-input')?.value.trim() || 'Product';
    const category = row.querySelector('.item-category-select')?.value || "Men's Apparel";
    const subCategory = row.querySelector('.item-subcategory-select')?.value || 'Shirts';
    const qty = parseFloat(row.querySelector('.item-qty-input')?.value || 1);
    const price = parseFloat(row.querySelector('.item-price-input')?.value || 0);
    items.push({ name, category, subCategory, qty, price });
  });

  const totalAmount = parseFloat(document.getElementById('inv-amount').value || 0);
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    const categorySummary = items.map(i => i.name).join(', ') || 'Retail Sale';
    const res = await api.createInvoice({
      clientName: shopName,
      clientEmail: '',
      amount: totalAmount,
      dueDate: dateStr,
      category: categorySummary
    });

    const generatedInvId = res.invoice?.id || `INV-${Date.now().toString().slice(-4)}`;

    // Download PDF File
    downloadInvoicePDF({
      shopName,
      items,
      totalAmount,
      invoiceId: generatedInvId,
      date: dateStr
    });

    showToast('Invoice created & PDF downloaded successfully!', 'success');
    closeInvoiceModal();
    createInvoiceForm.reset();
    calculateInvoiceTotal();
    await loadBusinessData();
  } catch (err) {
    const generatedInvId = `INV-${Date.now().toString().slice(-4)}`;
    downloadInvoicePDF({
      shopName,
      items,
      totalAmount,
      invoiceId: generatedInvId,
      date: dateStr
    });
    showToast('Invoice created & PDF downloaded!', 'success');
    closeInvoiceModal();
    createInvoiceForm.reset();
  }
});

createProductForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('prd-name').value;
  const category = document.getElementById('prd-category').value;
  const price = document.getElementById('prd-price').value;
  const count = document.getElementById('prd-stock').value;

  try {
    const res = await api.createProduct({ name, category, price, count });
    showToast(res.message || 'Product created!', 'success');
    closeProductModal();
    createProductForm.reset();
    await loadBusinessData();
  } catch (err) {
    showToast(err.message || 'Failed to create product.', 'error');
  }
});

createCategoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('cat-name').value.trim();
  const subCategoriesRaw = document.getElementById('cat-subcategories').value;
  const subCategories = subCategoriesRaw ? subCategoriesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const genderType = document.getElementById('cat-gender')?.value || 'Unisex';
  const seasonTag = document.getElementById('cat-season')?.value || 'All Season';
  const itemCounts = parseInt(document.getElementById('cat-item-counts').value, 10) || 0;
  const statusSelect = document.getElementById('cat-status');
  const status = statusSelect ? statusSelect.value : 'Active';

  try {
    const res = await api.createCategory({
      name,
      subCategories,
      genderType,
      seasonTag,
      itemCounts,
      status
    });
    showToast(res.message || 'Category created!', 'success');
    closeCategoryModal();
    createCategoryForm.reset();
    await loadBusinessData();
  } catch (err) {
    showToast(err.message || 'Failed to create category.', 'error');
  }
});

if (createBillForm) {
  createBillForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendor = document.getElementById('bill-vendor').value;
    const category = document.getElementById('bill-category').value;
    const amount = document.getElementById('bill-amount').value;
    const dueDate = document.getElementById('bill-due-date').value;
    const autoPay = document.getElementById('bill-autopay').checked;

    try {
      const res = await api.createBill({ vendor, category, amount, dueDate, autoPay });
      showToast(res.message || 'Bill created!', 'success');
      closeBillModal();
      createBillForm.reset();
      await loadBusinessData();
    } catch (err) {
      showToast(err.message || 'Failed to create bill.', 'error');
    }
  });
}

function populatePageProductCategoryOptions() {
  const catSelect = document.getElementById('page-prd-category');
  const subSelect = document.getElementById('page-prd-subcategory');
  if (!catSelect || !subSelect) return;

  const categories = (appData.categories && appData.categories.length > 0)
    ? appData.categories.map(c => c.name)
    : ["Men's Apparel", "Women's Fashion", "Kidswear & Toddlers", "Footwear & Shoes", "Fashion Accessories", "Winterwear & Outerwear"];

  catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');

  function updateSubs() {
    const chosenCat = catSelect.value;
    const catObj = (appData.categories || []).find(c => c.name === chosenCat);
    const subs = (catObj && Array.isArray(catObj.subCategories) && catObj.subCategories.length > 0)
      ? catObj.subCategories
      : ['Shirts', 'T-Shirts', 'Jeans & Trousers', 'Dresses & Maxis', 'Kurtis & Sarees', 'Sneakers & Shoes', 'Jackets & Coats'];

    subSelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  updateSubs();
  catSelect.onchange = updateSubs;
}

const BILL_EXPENSE_SUB_CATEGORIES = {
  "Raw Materials & Fabrics": [
    "Cotton Weaving Fabrics",
    "Silk & Satin Roll Stock",
    "Chiffon & Georgette",
    "Linen & Denim Weaves",
    "Velvet & Brocade"
  ],
  "Cotton & Silk Textile Yarns": [
    "Combed Cotton Yarn",
    "Mulberry Silk Filaments",
    "Polyester Blend Threads",
    "Organic Linen Threads",
    "Rayon & Viscose Threads"
  ],
  "Dyeing, Printing & Processing": [
    "Reactive Dyeing Services",
    "Block Printing & Kalamkari",
    "Digital Fabric Printing",
    "Screen Printing Ink Batch",
    "Fabric Softening & Finishing"
  ],
  "Trims, Zippers & Apparel Buttons": [
    "YKK Brass Zippers",
    "Mother-of-Pearl Buttons",
    "Embroidered Laces & Borders",
    "Elastic Bands & Webbing",
    "Metal Hooks & Snap Fasteners"
  ],
  "Packaging, Tags & Garment Boxes": [
    "Custom Garment Hangtags",
    "Eco Polybags & Pouches",
    "Corrugated Apparel Boxes",
    "Woven Brand Labels",
    "Tissue Wrapping Paper"
  ],
  "Logistics, Freight & Shipping": [
    "Inter-State Trucking Freight",
    "Express Air Logistics",
    "Warehouse Stock Transfer",
    "Import Customs Clearance",
    "Local Courier Delivery"
  ],
  "Boutique Store Rent & Utilities": [
    "Commercial Store Rent",
    "Electricity & Power Bill",
    "Showroom Display Fixtures",
    "POS & Wi-Fi Internet",
    "Security & Cleaning Staff"
  ],
  "Garment Stitching & Tailoring": [
    "Master Tailor Fabrication",
    "Embroidery Handwork Labor",
    "Pattern Making & Sampling",
    "Buttonholing & Overlocking",
    "Ironing & Steam Pressing"
  ]
};

function populateBillCategoryOptions() {
  const catSelect = document.getElementById('page-bill-category');
  const subSelect = document.getElementById('page-bill-subcategory');
  if (!catSelect || !subSelect) return;

  function updateSubs() {
    const chosenCat = catSelect.value || "Raw Materials & Fabrics";
    const subs = BILL_EXPENSE_SUB_CATEGORIES[chosenCat] || [
      "Cotton Weaving Fabrics",
      "Silk & Satin Roll Stock",
      "Chiffon & Georgette",
      "Linen & Denim Weaves"
    ];
    subSelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  updateSubs();
  catSelect.onchange = updateSubs;
}

const createProductPageForm = document.getElementById('create-product-page-form');
if (createProductPageForm) {
  createProductPageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('page-prd-name').value.trim();
    const category = document.getElementById('page-prd-category').value;
    const subCategory = document.getElementById('page-prd-subcategory')?.value || '';
    const price = document.getElementById('page-prd-price').value;
    const count = document.getElementById('page-prd-stock').value || 50;

    try {
      const res = await api.createProduct({ name, category, subCategory, price, count });
      showToast(res.message || 'Apparel product created successfully!', 'success');
      switchView('products');
      createProductPageForm.reset();
      await loadBusinessData();
    } catch (err) {
      showToast(err.message || 'Failed to create product.', 'error');
    }
  });
}

const createBillPageForm = document.getElementById('create-bill-page-form');
if (createBillPageForm) {
  createBillPageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendor = document.getElementById('page-bill-vendor').value.trim();
    const category = document.getElementById('page-bill-category').value;
    const amount = document.getElementById('page-bill-amount').value;
    const dueDate = document.getElementById('page-bill-due-date').value;
    const autoPay = document.getElementById('page-bill-autopay').checked;

    try {
      const res = await api.createBill({ vendor, category, amount, dueDate, autoPay });
      showToast(res.message || 'Vendor bill created!', 'success');
      switchView('bills');
      createBillPageForm.reset();
      await loadBusinessData();
    } catch (err) {
      showToast(err.message || 'Failed to create bill.', 'error');
    }
  });
}

const createCategoryPageForm = document.getElementById('create-category-page-form');
if (createCategoryPageForm) {
  createCategoryPageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('page-cat-name').value.trim();
    const subCategories = document.getElementById('page-cat-subcategories').value.trim();
    const itemCounts = parseInt(document.getElementById('page-cat-count').value || 10, 10);
    const status = document.getElementById('page-cat-status').value;

    try {
      const res = await api.createCategory({ name, subCategories, itemCounts, status });
      showToast(res.message || 'Apparel category created!', 'success');
      switchView('categories');
      createCategoryPageForm.reset();
      await loadBusinessData();
    } catch (err) {
      showToast(err.message || 'Failed to create category.', 'error');
    }
  });
}


// Logout Handler
sidebarLogoutBtn.addEventListener('click', () => {
  tokenStorage.clear();
  appData.user = null;
  saasDashboard.classList.add('hidden');
  authViewport.classList.remove('hidden');
});

// Auto-Login Session Initialization
async function initSession() {
  const token = tokenStorage.get();
  if (token) {
    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        appData.user = res.user;
        await enterWorkspace();
      }
    } catch {
      tokenStorage.clear();
    }
  }
}

initSession();
