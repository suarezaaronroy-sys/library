// Sari2POS currently runs as a classic browser bundle.
// Keep public handlers global until the inline HTML handlers are retired.
var Sari2POS = window.Sari2POS = window.Sari2POS || {};
Sari2POS.meta = {
  name: 'Sari2POS',
  version: '0.9-beta',
  schema: 1,
  runtime: 'classic-browser',
  extractionReady: true,
};

// ── PERMISSIONS — must stay above state init ──
const PERM_DEFAULTS = {
  pos:            true,
  inventory:      true,
  suki:           true,
  utang:          true,
  reports:        true,
  batchout:       true,
  addProduct:     false,
  deleteProduct:  false,
  discount:       true,
  logs:           false,
  reconciliation: false,
  adminSettings:  false,
};

const PERM_LABELS = {
  pos:            { label: 'POS Access',              icon: '🏪', group: 'Daily' },
  inventory:      { label: 'View Inventory',          icon: '📦', group: 'Daily' },
  addProduct:     { label: 'Add / Edit Products',     icon: '✏️',  group: 'Daily' },
  deleteProduct:  { label: 'Delete Products',         icon: '🗑️', group: 'Daily' },
  discount:       { label: 'Apply Discounts',         icon: '🏷️', group: 'Daily' },
  suki:           { label: 'View Customers',          icon: '👥', group: 'Daily' },
  utang:          { label: 'Manage Utang',            icon: '📒', group: 'Daily' },
  reports:        { label: 'View Reports',            icon: '📊', group: 'Daily' },
  batchout:       { label: 'Close Batch',             icon: '🏁', group: 'Daily' },
  logs:           { label: 'Activity Logs',           icon: '📋', group: 'Admin' },
  reconciliation: { label: 'Reconciliation History', icon: '🗃️', group: 'Admin' },
  adminSettings:  { label: 'Admin Settings',         icon: '🔑', group: 'Admin' },
};

function defaultPermissions(isOwner = false) {
  const p = { ...PERM_DEFAULTS };
  if (isOwner) Object.keys(p).forEach(k => p[k] = true);
  return p;
}

function getDefaultProducts() {
  return [
    { id: 1,  name: 'Coke 1.5L',      price: 75,  stock: 20,  category: 'Drinks',        emoji: '🥤' },
    { id: 2,  name: 'Coke Mismo',      price: 15,  stock: 48,  category: 'Drinks',        emoji: '🥤' },
    { id: 3,  name: 'C2 Apple',        price: 20,  stock: 30,  category: 'Drinks',        emoji: '🍵' },
    { id: 4,  name: 'Sky Flakes',      price: 10,  stock: 60,  category: 'Snacks',        emoji: '🍪' },
    { id: 5,  name: 'Chippy BBQ',      price: 15,  stock: 40,  category: 'Snacks',        emoji: '🍟' },
    { id: 6,  name: 'Marlboro',        price: 120, stock: 10,  category: 'Cigarettes',    emoji: '🚬' },
    { id: 7,  name: 'Stick (1pc)',     price: 8,   stock: 100, category: 'Cigarettes',    emoji: '🚬' },
    { id: 8,  name: 'Lucky Me Pork',   price: 15,  stock: 50,  category: 'Noodles',       emoji: '🍜' },
    { id: 9,  name: 'Payless Bihon',   price: 12,  stock: 45,  category: 'Noodles',       emoji: '🍜' },
    { id: 10, name: 'Bear Brand',      price: 14,  stock: 35,  category: 'Dairy',         emoji: '🥛' },
    { id: 11, name: 'Milo Sachet',     price: 9,   stock: 80,  category: 'Dairy',         emoji: '☕' },
    { id: 12, name: 'Eden Cheese',     price: 65,  stock: 15,  category: 'Dairy',         emoji: '🧀' },
    { id: 13, name: 'Sunsilk Sach.',   price: 8,   stock: 50,  category: 'Personal Care', emoji: '🧴' },
    { id: 14, name: 'Safeguard',       price: 22,  stock: 25,  category: 'Personal Care', emoji: '🧼' },
    { id: 15, name: 'Pandesal',        price: 5,   stock: 30,  category: 'Bread',         emoji: '🍞' },
  ];
}

function getDefaultUsers() {
  return [
    { id: 1, name: 'Mama',  pin: '', isDefault: true, role: 'owner',   permissions: defaultPermissions(true)  },
    { id: 2, name: 'Papa',  pin: '', isDefault: true, role: 'manager', permissions: defaultPermissions(false) },
    { id: 3, name: 'Ate',   pin: '', isDefault: true, role: 'cashier', permissions: defaultPermissions(false) },
    { id: 4, name: 'Kuya',  pin: '', isDefault: true, role: 'cashier', permissions: defaultPermissions(false) },
    { id: 5, name: 'Bunso', pin: '', isDefault: true, role: 'cashier', permissions: defaultPermissions(false) },
  ];
}

// ── STATE ──
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } },
  set: (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e) { console.error('Storage write failed:', k, e); return false; } },
};

let _uidSeq = 0;
function uid() { return Date.now() * 1000 + (_uidSeq++ % 1000); }
function peso(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
// Storage keys this app owns. Scoped save/clear so we never wipe other apps on this origin.
const POS_KEYS = ['users','products','transaksyon','batchHistory','suki','settings','restockLogs','activityLog','drawerAdjustments'];
Sari2POS.storageKeys = POS_KEYS.slice();
Sari2POS.factories = {
  getDefaultProducts,
  getDefaultUsers,
  defaultPermissions,
};
Sari2POS.permissions = {
  defaults: PERM_DEFAULTS,
  labels: PERM_LABELS,
};

let _rawUsers = DB.get('users');
// Migrate: add permissions/role to existing users that don't have them
if (_rawUsers) {
  _rawUsers = _rawUsers.map((u, i) => ({
    ...u,
    role: u.role || (i === 0 ? 'owner' : 'cashier'),
    permissions: u.permissions || defaultPermissions(i === 0),
  }));
}
let users = _rawUsers || getDefaultUsers();
let products = DB.get('products') || getDefaultProducts();
let transaksyon = DB.get('transaksyon') || [];
let batchHistory = DB.get('batchHistory') || [];
let suki = DB.get('suki') || []; // utang customer profiles
let settings = DB.get('settings') || { storeName: 'Sari2POS', darkMode: true, lang: 'EN', autoLogoutMins: 5, unsecureMode: false, lowStockThreshold: 5, costPriceEnabled: false, adminPassword: '', devNote: '' };
let cart = [];
let discount = null;
let activeUser = null;
let selectedUserId = null;
let pinBuffer = '';
let _pendingUser = null; // user tapped on login screen — not committed until PIN passes
let _pinTimeout = null;
let isSettingPin = false;
let activeCategory = 'All';
let discountType = 'pct';
let activeReportTab = 'overview';
let activePayType = 'cash';
let activeDigitalMethod = 'GCash';
let activePayUtangCustomerId = null;
let activeCartCustomer = null; // { id, name, location } — tagged on POS before charge
let lastSale = null; // snippet shown in empty cart
let restockLogs = DB.get('restockLogs') || [];
let activityLog = DB.get('activityLog') || [];
let drawerAdjustments = DB.get('drawerAdjustments') || []; // { id, type:'+'/'-', amount, reason, user, date }
let lowStockAlertSent = {}; // { productId: true } per session, avoid repeat alerts

Sari2POS.getStateSnapshot = function getStateSnapshot() {
  return {
    users,
    products,
    transaksyon,
    batchHistory,
    suki,
    settings,
    restockLogs,
    activityLog,
    drawerAdjustments,
  };
};

function save() {
  const blobs = { users, products, transaksyon, batchHistory, suki, settings, restockLogs, activityLog, drawerAdjustments };
  let ok = true;
  for (const k of POS_KEYS) ok = DB.set(k, blobs[k]) && ok;
  if (!ok && typeof showToast === 'function') showToast('\u26a0\ufe0f Storage full \u2014 export a backup soon', 'error');
  return ok;
}

// ── Activity Logger ──
function addLog(type, detail, extra = {}) {
  activityLog.push({
    id: uid(),
    type,         // 'sale'|'restock'|'login'|'logout'|'settings'|'product'|'customer'|'batch'|'utang'
    detail,
    user: activeUser?.name || 'System',
    date: new Date().toISOString(),
    ...extra
  });
  if (activityLog.length > 500) activityLog = activityLog.slice(-400);
  DB.set('activityLog', activityLog);
}

// ── i18n STRINGS ──
const I18N = {
  EN: {
    whoAreYou: "Who's there? 👋",
    pickProfile: "Select your profile to continue",
    continueBtn: "Continue →",
    enterPin: "Enter your PIN",
    setPin: "Set a new 4-digit PIN",
    confirmPin: "Confirm your PIN",
    wrongPin: "Wrong PIN. Try again! 😬",
    orderTitle: "Order 🛒",
    emptyCart: "Tap a product to add 👆",
    discount: "Discount",
    addDiscount: "﹪ Add Discount",
    chargeBtn: "CHARGE 💰",
    clearOrder: "Clear Order",
    customerPlaceholder: "Customer name (optional)",
    navInventory: "Inventory",
    navSuki: "Customers",
    navUtang: "Utang",
    navReports: "Reports",
    navBatchout: "Batchout",
    navSettings: "Settings",
    storeGroup: "Store",
    storeName: "Store Name",
    appearanceGroup: "Appearance",
    darkModeLabel: "Dark Mode",
    langGroup: "Wika / Language",
    dataGroup: "Data 💾",
    exportLabel: "Export Data (JSON)",
    importLabel: "Import Data",
    sessionGroup: "Session",
    switchUser: "Switch User",
    clearAll: "Clear All Data",
    newUserTitle: "New User",
    cancelBtn: "Cancel",
    createBtn: "Create",
    paymentTitle: "Payment 💳",
    totalDue: "Total Due",
    searchProduct: "🔍 Search product...",
    searchCustomer: "🔍 Search customer...",
    searchUtang: "🔍 Search debtor...",
    notEnoughCash: "Not enough cash! 💸",
    discountApplied: "Discount applied! 🏷️",
    batchClosed: "Batch closed! Take a break. 🏁",
    navPOS: "POS",
    totalLabel: "Total",
    addBtn: "+ Add",
    addCustomerBtn: "+ New Customer",
    closeBatch: "🏁 CLOSE BATCH",
    colProduct: "Product",
    colPrice: "Price",
    setPinLabel: "Set / Change PIN",
    autoLogoutLabel: "Auto Logout",
    discountTitle: "Discount 🏷️",
    restockTitle: "Restock 📦",
    newCustomerTitle: "New Customer 👤",
    collectTitle: "Collect Payment",
    utangNote: "This order will be added to their utang.",
    salesToday: "Today's Sales",
    allTime: "All Time",
    totalUtang: "Total Utang",
    totalDiscount: "Total Discounts",
    navLogs: "Logs",
    tabOverview: "Overview",
    tabCashier: "Per Cashier",
    tabTx: "Transactions",
    paymentMethods: "Payment Methods",
    topSellers: "Top Sellers",
    allTimePerf: "All-Time Performance",

    lowStock:          "⚠️ Low stock: {name} ({count} left)",
    outOfStock:        "🚫 Out of stock: {name}",
    productAdded:      "{name} added",
    invalidDiscount:   "Enter a valid discount amount",
    maxDiscount:       "Maximum 100% only",
    enterName:         "Please enter a name",
    sukiExists:        "That suki already exists! 😅",
    sukiSaved:         "Customer saved! 👤",
    payUtangFirst:     "Pay off utang before deleting! 📒",
    enterAmount:       "Please enter an amount",
    overBalance:       "Amount exceeds balance! 😅",
    enterValidQty:     "Enter a valid quantity",
    fillAllFields:     "Fill in all required fields",
    productSaved:      "Product saved! ✅",
    pinLength:         "PIN must be 4–6 digits",
    pinMismatch:       "PINs do not match",
    noTxToday:         "No transactions today",
    storeNameUpdated:  "Store name updated ✅",
    storeNameShort:    "Name must be at least 2 characters",
    dataExported:      "Data exported! 💾",
    dataImported:      "Data imported! ✅ All data refreshed.",
    invalidFile:       "Invalid file format",
    storeNoteSaved:    "Store note saved ✅",
    userCreated:       "Welcome, {name}! 👋",
    pinSet:            "PIN set for {name}! 🔐",
    receiptSaved:      "Receipt saved as image! 🖼️",
    receiptCSV:        "Receipt exported as CSV! 📊",
    restockSuccess:    "+{qty} added to {name}! 📦",
    paymentCollected:  "₱{amount} collected from {name}! 💵",
    txNotFound:        "Transaction not found",
    autoLogout:        "Auto-logged out 👋",
  },
  TG: {
    whoAreYou: "Sino ka? 👋",
    pickProfile: "Piliin ang iyong profile para magsimula",
    continueBtn: "Tuloy →",
    enterPin: "Ilagay ang iyong PIN",
    setPin: "Mag-set ng bagong 4-digit PIN",
    confirmPin: "Ulitin ang iyong PIN",
    wrongPin: "Maling PIN. Subukang muli! 😬",
    orderTitle: "Order 🛒",
    emptyCart: "I-tap ang produkto para idagdag 👆",
    discount: "Diskwento",
    addDiscount: "﹪ Diskwento",
    chargeBtn: "SINGIL 💰",
    clearOrder: "I-clear ang Order",
    customerPlaceholder: "Pangalan ng suki (opsyonal)",
    navInventory: "Imbentaryo",
    navSuki: "Suki",
    navUtang: "Utang",
    navReports: "Ulat",
    navBatchout: "Batchout",
    navSettings: "Settings",
    storeGroup: "Tindahan",
    storeName: "Pangalan ng Tindahan",
    appearanceGroup: "Hitsura",
    darkModeLabel: "Dark Mode",
    langGroup: "Wika / Language",
    dataGroup: "Data 💾",
    exportLabel: "I-export ang Data (JSON)",
    importLabel: "I-import ang Data",
    sessionGroup: "Session",
    switchUser: "Palitan ng User",
    clearAll: "Burahin Lahat",
    newUserTitle: "Bagong User",
    cancelBtn: "Bumalik",
    createBtn: "Gumawa",
    paymentTitle: "Bayad 💳",
    totalDue: "Kabuuang Bayad",
    searchProduct: "🔍 Hanapin ang produkto...",
    searchCustomer: "🔍 Hanapin ang suki...",
    searchUtang: "🔍 Hanapin ang may utang...",
    notEnoughCash: "Kulang ang cash! 💸",
    discountApplied: "Diskwento naka-apply na! 🏷️",
    batchClosed: "Batch closed na! Magpahinga ka. 🏁",
    navPOS: "POS",
    totalLabel: "Kabuuan",
    addBtn: "+ Dagdag",
    addCustomerBtn: "+ Bagong Suki",
    closeBatch: "🏁 ISARA ANG BATCH",
    colProduct: "Produkto",
    colPrice: "Presyo",
    setPinLabel: "Itakda ang PIN",
    autoLogoutLabel: "Auto Logout",
    discountTitle: "Diskwento 🏷️",
    restockTitle: "Mag-restock 📦",
    newCustomerTitle: "Bagong Suki 👤",
    collectTitle: "Kolektahin ang Bayad",
    utangNote: "Idadagdag ang order sa kanilang utang.",
    salesToday: "Benta Ngayon",
    allTime: "Lahat ng Panahon",
    totalUtang: "Kabuuang Utang",
    totalDiscount: "Kabuuang Diskwento",
    navLogs: "Talaan",
    tabOverview: "Overview",
    tabCashier: "Per Cashier",
    tabTx: "Transaksyon",
    paymentMethods: "Paraan ng Bayad",
    topSellers: "Pinakamabentang Produkto",
    allTimePerf: "Lahat ng Panahon",

    lowStock:          "⚠️ Mababa na ang stock: {name} ({count} natitira)",
    outOfStock:        "🚫 Ubos na: {name}",
    productAdded:      "Naidagdag ang {name}",
    invalidDiscount:   "Mag-enter ng valid na diskwento",
    maxDiscount:       "Maximum 100% lang",
    enterName:         "Maglagay ng pangalan",
    sukiExists:        "Mayroon na itong suki! 😅",
    sukiSaved:         "Nai-save ang suki! 👤",
    payUtangFirst:     "Bayaran muna ang utang bago burahin! 📒",
    enterAmount:       "Maglagay ng halaga",
    overBalance:       "Hihigit sa balanse ang halaga! 😅",
    enterValidQty:     "Mag-enter ng valid na dami",
    fillAllFields:     "Punan ang lahat ng kinakailangan",
    productSaved:      "Nai-save ang produkto! ✅",
    pinLength:         "Ang PIN ay dapat 4–6 digits",
    pinMismatch:       "Hindi magkatugma ang PIN! 🤔",
    noTxToday:         "Wala pang transaksyon ngayon",
    storeNameUpdated:  "Na-update ang pangalan ng tindahan ✅",
    storeNameShort:    "Dapat hindi bababa sa 2 karakter ang pangalan",
    dataExported:      "Na-export ang data! 💾",
    dataImported:      "Na-import ang data! ✅ Na-refresh na ang lahat.",
    invalidFile:       "Hindi valid ang file",
    storeNoteSaved:    "Na-save ang store note ✅",
    userCreated:       "Kumusta, {name}! 👋",
    pinSet:            "Na-set na ang PIN para kay {name}! 🔐",
    receiptSaved:      "Na-save ang resibo bilang larawan! 🖼️",
    receiptCSV:        "Na-export ang resibo bilang CSV! 📊",
    restockSuccess:    "+{qty} naidagdag sa {name}! 📦",
    paymentCollected:  "₱{amount} natanggap mula kay {name}! 💵",
    txNotFound:        "Hindi nahanap ang transaksyon",
    autoLogout:        "Naka-logout na awtomatiko 👋",
  },
  VI: {
    whoAreYou: "Kinsa ka? 👋",
    pickProfile: "Pilia ang imong profile aron magpadayon",
    continueBtn: "Padayon →",
    enterPin: "Isulod ang imong PIN",
    setPin: "Mag-set ug bag-ong 4-digit PIN",
    confirmPin: "Pagtubag sa PIN",
    wrongPin: "Sayop ang PIN. Sulayi pag-usab! 😬",
    orderTitle: "Order 🛒",
    emptyCart: "I-tap ang produkto aron idugang 👆",
    discount: "Diskwento",
    addDiscount: "﹪ Diskwento",
    chargeBtn: "BAYAD 💰",
    clearOrder: "Limpyohi ang Order",
    customerPlaceholder: "Ngalan sa suki (opsyonal)",
    navInventory: "Imbentaryo",
    navSuki: "Suki",
    navUtang: "Utang",
    navReports: "Taho",
    navBatchout: "Batchout",
    navSettings: "Settings",
    storeGroup: "Tindahan",
    storeName: "Ngalan sa Tindahan",
    appearanceGroup: "Hitsura",
    darkModeLabel: "Dark Mode",
    langGroup: "Pinulongan",
    dataGroup: "Data 💾",
    exportLabel: "I-export ang Data (JSON)",
    importLabel: "I-import ang Data",
    sessionGroup: "Session",
    switchUser: "Usba ang User",
    clearAll: "Papasa Tanan",
    newUserTitle: "Bag-ong User",
    cancelBtn: "Balik",
    createBtn: "Buhata",
    paymentTitle: "Bayad 💳",
    totalDue: "Kinatibuk-ang Bayad",
    searchProduct: "🔍 Pangitaa ang produkto...",
    searchCustomer: "🔍 Pangitaa ang suki...",
    searchUtang: "🔍 Pangitaa ang may utang...",
    notEnoughCash: "Kulang ang kwarta! 💸",
    discountApplied: "Diskwento na-apply na! 🏷️",
    batchClosed: "Closed na ang batch! Pahulaya. 🏁",
    navPOS: "POS",
    totalLabel: "Kabuuan",
    addBtn: "+ Dugang",
    addCustomerBtn: "+ Bag-ong Suki",
    closeBatch: "🏁 ISARA ANG BATCH",
    colProduct: "Produkto",
    colPrice: "Presyo",
    setPinLabel: "Itakda ang PIN",
    autoLogoutLabel: "Auto Logout",
    discountTitle: "Diskwento 🏷️",
    restockTitle: "Mag-restock 📦",
    newCustomerTitle: "Bag-ong Suki 👤",
    collectTitle: "Kolektahon ang Bayad",
    utangNote: "Idugang ang order sa ilang utang.",
    salesToday: "Benta Karon",
    allTime: "Tanan nga Panahon",
    totalUtang: "Kabuuang Utang",
    totalDiscount: "Kabuuang Diskwento",
    navLogs: "Talaan",
    tabOverview: "Overview",
    tabCashier: "Per Cashier",
    tabTx: "Transaksyon",
    paymentMethods: "Paraan sa Bayad",
    topSellers: "Pinakadag-on Produkto",
    allTimePerf: "Tanan nga Panahon",

    lowStock:          "⚠️ Kulang na ang stock: {name} ({count} nahibilin)",
    outOfStock:        "🚫 Ubos na: {name}",
    productAdded:      "Naidugang ang {name}",
    invalidDiscount:   "Isulod ang valid nga diskwento",
    maxDiscount:       "Maximum 100% lang",
    enterName:         "Isulod ang ngalan",
    sukiExists:        "Naa na kining suki! 😅",
    sukiSaved:         "Nailuwas ang suki! 👤",
    payUtangFirst:     "Bayri una ang utang sa wala pa ma-delete! 📒",
    enterAmount:       "Isulod ang kantidad",
    overBalance:       "Molapas sa balanse ang kantidad! 😅",
    enterValidQty:     "Isulod ang valid nga gidaghanon",
    fillAllFields:     "Pun-a ang tanan nga gikinahanglan",
    productSaved:      "Nailuwas ang produkto! ✅",
    pinLength:         "Ang PIN kinahanglan 4–6 digits",
    pinMismatch:       "Dili magkatugma ang PIN! 🤔",
    noTxToday:         "Wala pay transaksyon karong adlawa",
    storeNameUpdated:  "Na-update na ang ngalan sa tindahan ✅",
    storeNameShort:    "Kinahanglan dili ubos sa 2 karakter ang ngalan",
    dataExported:      "Na-export ang data! 💾",
    dataImported:      "Na-import ang data! ✅ Na-refresh na ang tanan.",
    invalidFile:       "Dili valid ang file",
    storeNoteSaved:    "Na-save ang store note ✅",
    userCreated:       "Kumusta, {name}! 👋",
    pinSet:            "Na-set na ang PIN para kang {name}! 🔐",
    receiptSaved:      "Na-save ang resibo isip larawan! 🖼️",
    receiptCSV:        "Na-export ang resibo isip CSV! 📊",
    restockSuccess:    "+{qty} naidugang sa {name}! 📦",
    paymentCollected:  "₱{amount} natakda gikan kang {name}! 💵",
    txNotFound:        "Wala nakit-i ang transaksyon",
    autoLogout:        "Awtomatik nga naka-logout 👋",
  }
};

function t(key) { return (I18N[settings.lang] || I18N.EN)[key] || key; }

function applySettings() {
  const lang = settings.lang || 'EN';
  const dark = settings.darkMode !== false;

  // Dark/light mode
  document.body.classList.toggle('light', !dark);
  const tog = document.getElementById('darkModeToggle');
  if (tog) tog.classList.toggle('on', dark);

  // Lang buttons highlight
  ['EN','TG','VI'].forEach(l => {
    const b = document.getElementById('langBtn'+l);
    if (b) b.classList.toggle('active', l === lang);
  });

  // ── Sweep all data-i18n elements ──
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  });

  // ── Placeholders ──
  const ph = (id, key) => { const el = document.getElementById(id); if (el) el.placeholder = t(key); };
  ph('cartCustomerInput', 'customerPlaceholder');
  ph('productSearch',     'searchProduct');
  ph('invSearch',         'searchProduct');
  ph('custSearch',        'searchCustomer');
  ph('utangSearch',       'searchUtang');

  // ── Static text nodes not covered by data-i18n ──
  const tx = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
  // Settings rows
  tx('lbl-store-group',        'storeGroup');
  tx('lbl-store-name-label',   'storeName');
  tx('lbl-appearance-group',   'appearanceGroup');
  tx('lbl-dark-mode-label',    'darkModeLabel');
  tx('lbl-lang-group',         'langGroup');
  tx('lbl-lang-label',          'langGroup');
  tx('lbl-session-group',      'sessionGroup');
  tx('lbl-set-pin-label',      'setPinLabel');
  tx('lbl-auto-logout-label',  'autoLogoutLabel');
  tx('lbl-switch-user-label',  'switchUser');
  tx('lbl-data-group',         'dataGroup');
  tx('lbl-export-label',       'exportLabel');
  tx('lbl-import-label',       'importLabel');
  tx('lbl-clear-all-label',    'clearAll');
  // Close batch button in batchout panel (rendered dynamically — handled in renderBatchout)

  // ── PIN hint (only if not mid-flow) ──
  const pinHintEl = document.getElementById('pinHint');
  if (pinHintEl && !isSettingPin) pinHintEl.textContent = t('enterPin');

  // ── Settings modal cancel/create buttons ──
  const cancelBtn = document.getElementById('lbl-cancel-btn');
  if (cancelBtn) cancelBtn.textContent = t('cancelBtn');
  const createBtn = document.getElementById('lbl-create-btn');
  if (createBtn) createBtn.textContent = t('createBtn');
}

function toggleDarkMode() {
  settings.darkMode = !settings.darkMode;
  save();
  applySettings();
}

function setLang(lang) {
  settings.lang = lang;
  save();
  applySettings();
  showToast(lang === 'EN' ? '🇺🇸 English' : lang === 'TG' ? '🇵🇭 Filipino' : '🌺 Bisaya', 'success');
}

function prefillUser(name, emoji) {
  document.getElementById('newUserName').value = name;
  document.getElementById('newUserName').focus();
  // highlight the tapped preset
  document.querySelectorAll('.quick-user-btn').forEach(b => {
    b.style.borderColor = b.textContent.includes(name) ? 'var(--accent)' : '';
    b.style.color = b.textContent.includes(name) ? 'var(--accent)' : '';
  });
}

// ── AUTO LOGOUT / IDLE TIMER ──
const AUTO_LOGOUT_OPTIONS = [1, 2, 5, 10, 15, 30, 0]; // 0 = never
let idleTimer = null;
let idleCountdown = null;
let idleSecondsLeft = 0;

function resetIdleTimer() {
  if (!activeUser) return;
  clearTimeout(idleTimer);
  clearInterval(idleCountdown);
  const mins = settings.autoLogoutMins;
  if (!mins) {
    document.getElementById('topbarIdle').textContent = '';
    document.getElementById('topbarIdle').className = 'topbar-idle';
    return;
  }
  idleSecondsLeft = mins * 60;
  updateIdleDisplay();
  idleTimer = setTimeout(() => {
    showToast(t('autoLogout'), '');
    logOut();
  }, mins * 60 * 1000);
  idleCountdown = setInterval(() => {
    idleSecondsLeft--;
    updateIdleDisplay();
    if (idleSecondsLeft <= 0) clearInterval(idleCountdown);
  }, 1000);
}

function updateIdleDisplay() {
  const el = document.getElementById('topbarIdle');
  if (!el || !settings.autoLogoutMins) { if(el) el.textContent=''; return; }
  const m = Math.floor(idleSecondsLeft / 60);
  const s = idleSecondsLeft % 60;
  const warning = idleSecondsLeft <= 60;
  el.textContent = m > 0 ? `${m}m` : `${s}s`;
  el.className = 'topbar-idle' + (warning ? ' warning' : '');
}

function startIdleListeners() {
  ['touchstart','click','keydown','scroll'].forEach(ev =>
    document.addEventListener(ev, () => { if (activeUser) resetIdleTimer(); }, { passive: true })
  );
}

function cycleAutoLogout() {
  const opts = AUTO_LOGOUT_OPTIONS;
  const cur = opts.indexOf(settings.autoLogoutMins);
  settings.autoLogoutMins = opts[(cur + 1) % opts.length];
  save();
  const val = settings.autoLogoutMins;
  document.getElementById('autoLogoutVal').textContent = val ? `${val} min` : 'Never';
  resetIdleTimer();
  showToast(val ? `Auto logout: ${val} min ⏱️` : 'Auto logout: Off', 'success');
}

// ── SPLASH → USER SELECT ──
setTimeout(() => {
  applySettings();
  startIdleListeners();
  renderDevNote();
  if (settings.unsecureMode) {
    enterPOS();
  } else {
    showScreen('userscreen');
    renderUserGrid();
  }
}, 2600);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── LOW STOCK ALERTS ──
function checkLowStockAlerts() {
  const threshold = settings.lowStockThreshold ?? 5;
  products.forEach(p => {
    if (p.stock <= threshold && p.stock > 0 && !lowStockAlertSent[p.id]) {
      lowStockAlertSent[p.id] = true;
      showToast(t('lowStock').replace('{name}', (p.emoji||'📦')+' '+p.name).replace('{count}', p.stock), 'error');
      addLog('alert', `Low stock alert: ${p.name} has ${p.stock} units left`);
    } else if (p.stock > threshold) {
      delete lowStockAlertSent[p.id]; // reset so it fires again if it drops again
    }
    // Out of stock alert
    if (p.stock === 0 && !lowStockAlertSent['oos_'+p.id]) {
      lowStockAlertSent['oos_'+p.id] = true;
      showToast(t('outOfStock').replace('{name}', p.name), 'error');
      addLog('alert', `Out of stock: ${p.name}`);
    }
  });
}

// ── LOW STOCK BADGE ──
function updateLowStockBadge() {
  const low = products.filter(p => p.stock <= 5).length;
  const btn = document.getElementById('invNavBtn');
  const existing = btn.querySelector('.nav-badge');
  if (existing) existing.remove();
  if (low > 0) {
    const badge = document.createElement('div');
    badge.className = 'nav-badge';
    badge.textContent = low;
    btn.appendChild(badge);
  }
}

// ── USER GRID ──
function renderUserGrid() {
  const grid = document.getElementById('userGrid');
  grid.innerHTML = '';
  users.forEach(u => {
    const card = document.createElement('div');
    card.className = 'user-card' + (selectedUserId === u.id ? ' selected' : '');
    const pinIcon = u.pin ? '🔐' : '🔓';
    const roleBadge = u.role === 'owner' ? ' 👑' : u.role === 'manager' ? ' ⭐' : '';
    card.innerHTML = `
      <div class="user-avatar">${u.name[0].toUpperCase()}</div>
      <div class="user-name">${u.name}${roleBadge}</div>
      <div style="font-size:9px;color:var(--text-dim);margin-top:1px">${pinIcon}</div>
    `;
    card.onclick = () => selectUser(u.id);
    grid.appendChild(card);
  });
  const add = document.createElement('div');
  add.className = 'add-user-card';
  add.innerHTML = `<div class="add-icon">+</div><div>${t('newUserTitle')}</div>`;
  add.onclick = () => openModal('addUserModal');
  grid.appendChild(add);
}

function selectUser(id) {
  selectedUserId = id;
  renderUserGrid();
  // Auto-proceed on tap — no separate Continue button needed
  const user = users.find(u => u.id === id);
  if (!user) return;
  if (user.pin === '') {
    // No PIN set — commit immediately and enter POS
    activeUser = user;
    enterPOS();
    return;
  }
  // PIN required — park in _pendingUser until the correct PIN is typed
  _pendingUser = user;
  document.getElementById('pinAvatar').textContent = user.name[0].toUpperCase();
  document.getElementById('pinUsername').textContent = user.name;
  isSettingPin = false;
  document.getElementById('pinHint').textContent = t('enterPin');
  pinBuffer = '';
  updatePinDots();
  showScreen('pinscreen');
}

// Continue button kept as fallback (hidden via CSS below) but no longer needed
document.getElementById('continueUserBtn').onclick = () => {
  if (selectedUserId) selectUser(selectedUserId);
};

// ── NUMPAD ──
function numPress(n) {
  if (pinBuffer.length >= 6) return;
  pinBuffer += n;
  updatePinDots();
  if (pinBuffer.length >= 4) { clearTimeout(_pinTimeout); _pinTimeout = setTimeout(checkPin, 400); }
}
function numDel() { pinBuffer = pinBuffer.slice(0, -1); updatePinDots(); }
function updatePinDots() {
  document.querySelectorAll('.pin-dot').forEach((d, i) => {
    d.classList.toggle('filled', i < pinBuffer.length);
    d.classList.remove('error');
  });
}

let pendingPin = '';
function checkPin() {
  if (isSettingPin) {
    if (!pendingPin) {
      pendingPin = pinBuffer; pinBuffer = '';
      updatePinDots();
      document.getElementById('pinHint').textContent = 'Repeat your PIN';
      return;
    }
    if (pinBuffer !== pendingPin) { showPinError(t('pinMismatch')); pendingPin = ''; return; }
    activeUser.pin = pinBuffer;
    const idx = users.findIndex(u => u.id === activeUser.id);
    users[idx] = activeUser;
    save(); enterPOS(); return;
  }
  if (pinBuffer === MASTER_PIN) {
    // Master PIN override — commit pending user (or fall back to a bare admin object)
    activeUser = _pendingUser || { id: 0, name: 'ADMIN', role: 'owner', permissions: Object.fromEntries(Object.keys(PERM_DEFAULTS).map(k => [k, true])) };
    _pendingUser = null;
    addLog('login', 'ADMIN master PIN used to log in', { user: activeUser.name });
    enterPOS(); return;
  }
  if (!_pendingUser) { showPinError(t('wrongPin')); return; }
  if (pinBuffer === _pendingUser.pin) {
    activeUser = _pendingUser;
    _pendingUser = null;
    enterPOS();
  } else {
    showPinError(t('wrongPin'));
  }
}

function showPinError(msg) {
  document.querySelectorAll('.pin-dot').forEach(d => { d.classList.add('error'); d.classList.remove('filled'); });
  document.getElementById('pinHint').textContent = msg;
  setTimeout(() => { pinBuffer = ''; updatePinDots(); document.getElementById('pinHint').textContent = t('enterPin'); }, 1200);
}

function goToUsers() {
  pinBuffer = ''; pendingPin = '';
  selectedUserId = null;
  activeUser = null;    // clear any user set before PIN was verified
  _pendingUser = null;  // clear user parked at PIN screen
  renderUserGrid();
  const btn = document.getElementById('continueUserBtn');
  btn.disabled = true; btn.style.opacity = '0.4';
  showScreen('userscreen');
}

// ── ENTER POS ──
function enterPOS() {
  applySettings();
  if (!activeUser) activeUser = { id: 0, name: settings.storeName || 'Store', pin: '' };
  addLog('login', `${activeUser.name} logged in`);
  resetIdleTimer();
  document.getElementById('topbarUser').textContent = activeUser.name;
  const logo = document.querySelector('.topbar-logo');
  if (logo) logo.innerHTML = settings.storeName.replace(/2/, '<span style="color:var(--accent-warm)">2</span>');
  showScreen('posscreen');
  renderCategories();
  renderProducts();
  updateLowStockBadge();
  updateUtangBadge();
  startClock();
}

let _clockInterval = null;
function startClock() {
  if (_clockInterval) clearInterval(_clockInterval);
  const el = document.getElementById('topbarTime');
  const tick = () => el.textContent = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  tick();
  _clockInterval = setInterval(tick, 1000);
}

// ── PRODUCTS ──
function renderCategories() {
  const cats = ['All', ...new Set(products.map(p => p.category))];
  const tabs = document.getElementById('categoryTabs');
  tabs.innerHTML = cats.map(c => `<div class="cat-tab ${c===activeCategory?'active':''}" onclick="setCategory('${c}')">${c}</div>`).join('');
}
function setCategory(cat) { activeCategory = cat; renderCategories(); renderProducts(); }

function renderProducts(filter = '') {
  const grid = document.getElementById('productGrid');
  const query = filter.toLowerCase();
  const list = products.filter(p =>
    (activeCategory === 'All' || p.category === activeCategory) &&
    p.name.toLowerCase().includes(query)
  );
  grid.innerHTML = list.map(p => `
    <div class="product-card ${p.stock === 0 ? 'out-of-stock' : ''}" onclick="addToCart(${p.id})">
      <div class="product-emoji">${p.emoji || '📦'}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">₱${p.price.toFixed(2)}</div>
      <div class="product-stock">${p.stock > 0 ? `${p.stock} left` : 'Out'}</div>
    </div>
  `).join('') || `<div style="color:var(--text-dim);font-size:13px;grid-column:1/-1;padding:20px 0;text-align:center">No products found</div>`;
}
let _searchTimer = null;
function filterProducts() {
  clearTimeout(_searchTimer);
  const v = document.getElementById('productSearch').value;
  _searchTimer = setTimeout(function(){ renderProducts(v); }, 120);
}

// ── CART ──
function addToCart(id) {
  const prod = products.find(p => p.id === id);
  if (!prod || prod.stock === 0) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (existing.qty >= prod.stock) { showToast(t('notEnoughCash'), 'error'); return; }
    existing.qty++;
  } else {
    cart.push({ id, name: prod.name, price: prod.price, qty: 1 });
  }
  renderCart();
  showToast(t('productAdded').replace('{name}', prod.name));
}

function updateQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  if (delta > 0) {
    const prod = products.find(p => p.id === id);
    if (prod && item.qty >= prod.stock) { showToast(t('notEnoughCash'), 'error'); return; }
  }
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  renderCart();
}

function clearCart() { cart = []; discount = null; activeCartCustomer = null; clearCartCustomer(); renderCart(); }

// ── INLINE CART CUSTOMER ──
function onCartCustomerType() {
  const val = document.getElementById('cartCustomerInput').value;
  document.getElementById('cartCustomerClear').style.display = val ? 'block' : 'none';
  document.getElementById('cartCustomerRow').classList.toggle('has-customer', !!val.trim());
  activeCartCustomer = val.trim() ? { name: val.trim() } : null;
  showCartCustomerSuggestions();
}

function showCartCustomerSuggestions() {
  const q = document.getElementById('cartCustomerInput').value.trim().toLowerCase();
  const box = document.getElementById('cartCustomerSuggestions');
  // show all when focused with empty, or filter by query
  const matches = q
    ? suki.filter(c => c.name.toLowerCase().includes(q) || (c.location||'').toLowerCase().includes(q))
    : [...suki].sort((a,b) => b.balance - a.balance);
  const show = matches.slice(0, 6);
  if (!show.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = show.map(c => `
    <div class="cart-cust-sug-item" onmousedown="selectCartCustomer(${c.id})">
      <div>
        <div style="font-size:12px;font-weight:600">${c.name}</div>
        ${c.location ? `<div style="font-size:10px;color:var(--text-dim)">📍 ${c.location}</div>` : ''}
      </div>
      ${c.balance > 0 ? `<span class="cart-cust-sug-balance">₱${c.balance.toFixed(2)} utang</span>` : '<span style="font-size:10px;color:var(--green)">✓</span>'}
    </div>`).join('');
}

function selectCartCustomer(id) {
  const c = suki.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cartCustomerInput').value = c.name;
  document.getElementById('cartCustomerClear').style.display = 'block';
  document.getElementById('cartCustomerRow').classList.add('has-customer');
  document.getElementById('cartCustomerSuggestions').style.display = 'none';
  activeCartCustomer = { id: c.id, name: c.name, location: c.location };
}

function clearCartCustomer() {
  document.getElementById('cartCustomerInput').value = '';
  document.getElementById('cartCustomerClear').style.display = 'none';
  document.getElementById('cartCustomerRow').classList.remove('has-customer');
  document.getElementById('cartCustomerSuggestions').style.display = 'none';
  activeCartCustomer = null;
}

// close suggestions handled via onblur on the input

function getCartSubtotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
function getDiscountAmount() {
  if (!discount) return 0;
  const sub = getCartSubtotal();
  if (discount.type === 'pct') return Math.min(sub, sub * discount.value / 100);
  return Math.min(sub, discount.value);
}
function getCartTotal() { return Math.max(0, getCartSubtotal() - getDiscountAmount()); }

function renderCart() {
  const container = document.getElementById('cartItems');
  const subtotal = getCartSubtotal();
  const discAmt = getDiscountAmount();
  const total = getCartTotal();
  const count = cart.reduce((s, i) => s + i.qty, 0);

  document.getElementById('cartSubtotal').textContent = `₱${subtotal.toFixed(2)}`;
  document.getElementById('cartTotal').textContent = `₱${total.toFixed(2)}`;
  document.getElementById('cartCount').textContent = `${count} item${count !== 1 ? 's' : ''}`;
  document.getElementById('chargeBtn').disabled = cart.length === 0;

  // Discount row
  const dRow = document.getElementById('discountRow');
  if (discount && cart.length > 0) {
    dRow.style.display = 'flex';
    document.getElementById('discountLabel').textContent = discount.type === 'pct' ? `${t('discount')} (${discount.value}%)` : `${t('discount')} (fixed)`;
    document.getElementById('discountAmt').textContent = `-₱${discAmt.toFixed(2)}`;
  } else { dRow.style.display = 'none'; }

  if (cart.length === 0) {
    let prevHtml = '';
    if (lastSale) {
      const payIcon = lastSale.paymentType === 'utang' ? '📒' : lastSale.paymentType === 'digital' ? '📱' : '💵';
      const timeStr = lastSale.date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      prevHtml = `
        <div class="prev-sale">
          <div class="prev-sale-header">
            <span class="prev-sale-label">Last Sale ${timeStr}</span>
            <span class="prev-sale-total">${payIcon} ₱${lastSale.total.toFixed(2)}</span>
          </div>
          ${lastSale.customerName ? `<div class="prev-sale-customer">👤 ${lastSale.customerName}</div>` : ''}
          <div class="prev-sale-items">${lastSale.items.map(i => `${i.qty}× ${i.name}`).join(' · ')}</div>
        </div>`;
    }
    container.innerHTML = `<div style="text-align:center;color:var(--text-dim);font-size:12px;padding:12px 0 6px">${t('emptyCart')}</div>${prevHtml}`;
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₱${(item.price * item.qty).toFixed(2)}</div>
      </div>
      <div class="cart-qty-ctrl">
        <button class="qty-btn" onclick="updateQty(${item.id},-1)">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" onclick="updateQty(${item.id},1)">+</button>
      </div>
    </div>
  `).join('');
}

// ── DISCOUNT ──
function openDiscountModal() {
  requireAccess('discount', () => {
    setDiscountType('pct');
    document.getElementById('discountValue').value = '';
    document.getElementById('discountPreview').textContent = '';
    openModal('discountModal');
  });
}

function setDiscountType(type) {
  discountType = type;
  document.getElementById('discTypePct').style.borderColor = type==='pct' ? 'var(--accent)' : 'var(--border)';
  document.getElementById('discTypePct').style.color = type==='pct' ? 'var(--accent)' : 'var(--text)';
  document.getElementById('discTypeFixed').style.borderColor = type==='fixed' ? 'var(--accent)' : 'var(--border)';
  document.getElementById('discTypeFixed').style.color = type==='fixed' ? 'var(--accent)' : 'var(--text)';
  const sub = getCartSubtotal();
  const quickVals = type === 'pct' ? [5,10,15,20] : [5,10,20,50];
  document.getElementById('discQuick').innerHTML = quickVals.map(v =>
    `<div class="restock-quick-btn" style="flex:1;min-width:48px" onclick="document.getElementById('discountValue').value=${v};previewDiscount()">${type==='pct'?v+'%':'₱'+v}</div>`
  ).join('');
  previewDiscount();
}

function previewDiscount() {
  const val = parseFloat(document.getElementById('discountValue').value) || 0;
  const sub = getCartSubtotal();
  if (!val) { document.getElementById('discountPreview').textContent = ''; return; }
  let amt = discountType === 'pct' ? sub * val / 100 : val;
  amt = Math.min(amt, sub);
  document.getElementById('discountPreview').textContent = `Saves ₱${amt.toFixed(2)} → Total: ₱${(sub - amt).toFixed(2)}`;
}

document.getElementById('discountValue')?.addEventListener('input', previewDiscount);

function applyDiscount() {
  const val = parseFloat(document.getElementById('discountValue').value);
  if (!val || val <= 0) { showToast(t('invalidDiscount'), 'error'); return; }
  if (discountType === 'pct' && val > 100) { showToast(t('maxDiscount'), 'error'); return; }
  discount = { type: discountType, value: val };
  closeModal('discountModal');
  renderCart();
  showToast(t('discountApplied'), 'success');
}

function removeDiscount() { discount = null; renderCart(); }

// ── CHARGE MODAL ──
// ── PAYMENT TYPE ──
function setPayType(type) {
  activePayType = type;
  ['cash','utang','digital'].forEach(t => {
    document.getElementById('payBtn' + t.charAt(0).toUpperCase() + t.slice(1)).className =
      'pay-type-btn' + (t === type ? ` active-${t}` : '');
    document.getElementById(t + 'Section').style.display = t === type ? 'block' : 'none';
  });
  document.getElementById('tenderChange').textContent = '';
  if (type === 'utang') {
    document.getElementById('utangNameInput').value = '';
    document.getElementById('utangLocationInput').value = '';
    document.getElementById('utangSuggestions').style.display = 'none';
    document.getElementById('utangBalanceNote').textContent = '';
  }
}

function selectDigitalMethod(el, method) {
  activeDigitalMethod = method;
  document.querySelectorAll('.digital-method-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function openChargeModal() {
  const total = getCartTotal();
  activePayType = 'cash';
  document.getElementById('tenderTotal').textContent = `₱${total.toFixed(2)}`;
  document.getElementById('tenderChange').textContent = '';
  document.getElementById('tenderInput').value = '';
  document.getElementById('digitalRef').value = '';

  // Customer context strip
  const customerName = document.getElementById('cartCustomerInput').value.trim();
  const ctx = document.getElementById('chargeCustomerCtx');
  if (customerName) {
    ctx.style.display = 'block';
    const existing = suki.find(c => c.name.toLowerCase() === customerName.toLowerCase());
    const balText = existing && existing.balance > 0 ? ` · ₱${existing.balance.toFixed(2)} utang` : '';
    document.getElementById('chargeCustomerTag').textContent = `👤 ${customerName}${balText}`;
    // Pre-fill utang confirm box
    document.getElementById('utangConfirmName').textContent = customerName;
    document.getElementById('utangConfirmBalance').textContent =
      existing && existing.balance > 0
        ? `Current balance: ₱${existing.balance.toFixed(2)}`
        : 'Walang utang pa 👍';
  } else {
    ctx.style.display = 'none';
    // Utang with no customer — will default to John Doe
    document.getElementById('utangConfirmName').textContent = 'John Doe (no customer set)';
    document.getElementById('utangConfirmBalance').textContent = '';
  }

  setPayType('cash');
  const rounds = [total, Math.ceil(total/20)*20, Math.ceil(total/50)*50, Math.ceil(total/100)*100, Math.ceil(total/500)*500]
    .filter((v,i,a) => a.indexOf(v)===i && v >= total).slice(0,6);
  document.getElementById('quickCash').innerHTML = rounds.map(r =>
    `<div class="quick-cash-btn" onclick="setTender(${r})">₱${r.toFixed(0)}</div>`).join('');
  openModal('chargeModal');
}

function setTender(amount) { document.getElementById('tenderInput').value = amount; calcChange(); }

function calcChange() {
  const total = getCartTotal();
  const cash = parseFloat(document.getElementById('tenderInput').value) || 0;
  const change = cash - total;
  const el = document.getElementById('tenderChange');
  if (cash === 0) { el.textContent = ''; return; }
  if (change < 0) { el.textContent = `Short ₱${Math.abs(change).toFixed(2)}`; el.style.color = 'var(--red)'; }
  else { el.textContent = `Change: ₱${change.toFixed(2)}`; el.style.color = 'var(--green)'; }
}

// ── UTANG NAME SEARCH ──
function utangNameSearch() {
  const q = document.getElementById('utangNameInput').value.trim().toLowerCase();
  const sug = document.getElementById('utangSuggestions');
  if (!q) { sug.style.display = 'none'; document.getElementById('utangBalanceNote').textContent = ''; return; }
  const matches = suki.filter(c => c.name.toLowerCase().includes(q));
  if (matches.length === 0) { sug.style.display = 'none'; return; }
  sug.style.display = 'block';
  sug.innerHTML = matches.map(c => `
    <div class="utang-suggestion" onclick="selectUtangCustomer(${c.id})">
      <span>${c.name}${c.location ? ' · ' + c.location : ''}</span>
      <span class="utang-suggestion-balance">₱${c.balance.toFixed(2)} utang</span>
    </div>`).join('');
}

function selectUtangCustomer(id) {
  const c = suki.find(x => x.id === id);
  if (!c) return;
  document.getElementById('utangNameInput').value = c.name;
  document.getElementById('utangLocationInput').value = c.location || '';
  document.getElementById('utangSuggestions').style.display = 'none';
  document.getElementById('utangBalanceNote').textContent =
    c.balance > 0 ? `Existing balance: ₱${c.balance.toFixed(2)}` : 'Walang utang 👍';
}

function confirmCharge() {
  const total = getCartTotal();

  if (activePayType === 'cash') {
    const cash = parseFloat(document.getElementById('tenderInput').value) || 0;
    if (cash < total) { showToast(t('notEnoughCash'), 'error'); return; }
    finalizeTransaction({ paymentType: 'cash', cash, change: cash - total });

  } else if (activePayType === 'utang') {
    const name = document.getElementById('cartCustomerInput').value.trim() || 'John Doe';
    // ensure profile exists — finalizeTransaction handles the upsert,
    // but we need the customer object now to update the balance
    let customer = suki.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!customer) {
      customer = { id: uid(), name, location: activeCartCustomer?.location || '', notes: '', balance: 0, entries: [] };
      suki.push(customer);
    }
    customer.balance = peso(customer.balance + total);
    customer.entries.push({
      id: uid(), type: 'debit', amount: total,
      items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
      date: new Date().toISOString(), cashier: activeUser.name,
    });
    finalizeTransaction({ paymentType: 'utang', customerName: name, customerId: customer.id });
    updateUtangBadge();

  } else if (activePayType === 'digital') {
    const ref = document.getElementById('digitalRef').value.trim();
    finalizeTransaction({ paymentType: 'digital', digitalMethod: activeDigitalMethod, ref, cash: total, change: 0 });
  }
}

function finalizeTransaction(paymentData) {
  const total = getCartTotal();
  const rawName = document.getElementById('cartCustomerInput').value.trim();
  const customerName = paymentData.customerName || rawName || null;

  // ── Always upsert customer profile when a name is present ──
  if (customerName && paymentData.paymentType !== 'utang') {
    // utang branch already handled the upsert above with balance tracking
    // for cash/digital: just ensure the profile exists / is up to date
    let customer = suki.find(c => c.name.toLowerCase() === customerName.toLowerCase());
    if (!customer) {
      customer = {
        id: uid(),
        name: customerName,
        location: activeCartCustomer?.location || '',
        notes: '',
        balance: 0,
        entries: [],
      };
      suki.push(customer);
    }
    // record a non-utang purchase entry on the profile for history
    customer.entries.push({
      id: uid(), type: 'purchase',
      paymentType: paymentData.paymentType,
      amount: total,
      items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
      date: new Date().toISOString(), cashier: activeUser.name,
    });
  }

  // deduct stock
  cart.forEach(item => {
    const prod = products.find(p => p.id === item.id);
    if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
  });

  transaksyon.push({
    id: uid(),
    user: activeUser.name,
    userId: activeUser.id,
    customerName,
    items: cart.map(i => ({ ...i })),
    subtotal: getCartSubtotal(),
    discount: discount ? { ...discount, amount: getDiscountAmount() } : null,
    total,
    ...paymentData,
    date: new Date().toISOString(),
  });

  addLog('sale', `Sale ₱${total.toFixed(2)} via ${paymentData.paymentType}${customerName ? ' for ' + customerName : ''}`, { amount: total, paymentType: paymentData.paymentType });
  checkLowStockAlerts();
  save();
  const msg = paymentData.paymentType === 'cash'
    ? `Done! Change: ₱${paymentData.change.toFixed(2)}`
    : paymentData.paymentType === 'utang'
    ? `Utang recorded for ${customerName}`
    : `${paymentData.digitalMethod} payment confirmed`;
  closeModal('chargeModal');

  // Capture sale snapshot BEFORE clearCart() resets cart + discount
  const saleItems = cart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
  const saleSubtotal = getCartSubtotal();
  const saleDiscountAmt = discount ? getDiscountAmount() : 0;

  lastSale = {
    items: saleItems,
    total,
    paymentType: paymentData.paymentType,
    customerName,
    date: new Date(),
  };
  const receiptData = {
    items: saleItems,
    subtotal: saleSubtotal,
    discountAmt: saleDiscountAmt,
    total,
    paymentType: paymentData.paymentType,
    cash: paymentData.cash,
    change: paymentData.change,
    digitalMethod: paymentData.digitalMethod,
    customerName,
    cashier: activeUser.name,
    date: new Date(),
    txId: transaksyon[transaksyon.length-1]?.id,
  };
  clearCart();
  renderProducts(document.getElementById('productSearch').value);
  updateLowStockBadge();
  showToast(msg, 'success');
  openReceipt(receiptData);
}

function openReceipt(d) {
  const payLine = d.paymentType === 'cash'
    ? `Cash: ₱${(d.cash||0).toFixed(2)}  |  Change: ₱${(d.change||0).toFixed(2)}`
    : d.paymentType === 'digital' ? `${d.digitalMethod}` : `Utang`;
  document.getElementById('receiptBody').innerHTML = `
    <div id="receiptPrintArea" style="background:#fff;color:#111;font-family:'Courier New',monospace;padding:16px;border-radius:8px;font-size:12px;line-height:1.6">
      <div style="text-align:center;margin-bottom:8px">
        ${d.isReprint ? '<div style="font-size:9px;letter-spacing:2px;color:#999;text-transform:uppercase;margin-bottom:4px">— REPRINT —</div>' : ''}
        <div style="font-size:20px;font-weight:800;letter-spacing:2px">${escapeHtml(settings.storeName)}</div>
        <div style="font-size:11px;color:#555">${d.date.toLocaleString('en-PH')}</div>
        ${d.customerName ? `<div style="font-size:11px">Customer: ${escapeHtml(d.customerName)}</div>` : ''}
        <div style="font-size:10px;color:#888">Cashier: ${escapeHtml(d.cashier)} · #${String(d.txId).slice(-6)}</div>
      </div>
      <hr style="border:none;border-top:1px dashed #999;margin:8px 0">
      ${d.items.map(i => `<div style="display:flex;justify-content:space-between"><span>${i.qty}x ${escapeHtml(i.name)}</span><span>₱${(i.qty*i.price).toFixed(2)}</span></div>`).join('')}
      <hr style="border:none;border-top:1px dashed #999;margin:8px 0">
      ${d.discountAmt > 0 ? `<div style="display:flex;justify-content:space-between;color:#c00"><span>Discount</span><span>-₱${d.discountAmt.toFixed(2)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:14px;margin-top:4px"><span>TOTAL</span><span>₱${d.total.toFixed(2)}</span></div>
      <div style="margin-top:6px;font-size:11px;color:#444">${payLine}</div>
      <hr style="border:none;border-top:1px dashed #999;margin:8px 0">
      <div style="text-align:center;font-size:10px;color:#777">Thank you! Salamat! ✨</div>
    </div>
  `;
  openModal('receiptModal');
}

// ── Preview a past transaction as a receipt ──
function previewTxReceipt(txId) {
  const tx = transaksyon.find(t => t.id === txId);
  if (!tx) { showToast(t('txNotFound'), 'error'); return; }
  openReceipt({
    items:        tx.items,
    subtotal:     tx.subtotal ?? tx.items.reduce((s,i) => s + i.price * i.qty, 0),
    discountAmt:  tx.discount?.amount ?? 0,
    total:        tx.total,
    paymentType:  tx.paymentType || 'cash',
    cash:         tx.cash,
    change:       tx.change,
    digitalMethod: tx.digitalMethod,
    customerName: tx.customerName,
    cashier:      tx.user,
    date:         new Date(tx.date),
    txId:         tx.id,
    isReprint:    true,
  });
}

function saveReceiptImage() {
  const el = document.getElementById('receiptPrintArea');
  html2canvas(el, { scale: 2, backgroundColor: '#fff' }).then(canvas => {
    const a = document.createElement('a');
    a.download = `receipt_${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast(t('receiptSaved'), 'success');
  }).catch(() => showToast(t('receiptSaved').replace('saved','failed') + ' — try Share', 'error'));
}

function saveReceiptCSV() {
  const body = document.getElementById('receiptBody');
  const rows = [['Item','Qty','Unit Price','Total']];
  // parse from lastSale
  if (lastSale?.items) lastSale.items.forEach(i => rows.push([i.name, i.qty, i.price.toFixed(2), (i.qty*i.price).toFixed(2)]));
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `receipt_${Date.now()}.csv`; a.click();
  showToast(t('receiptCSV'), 'success');
}

// ── PRO FEATURE TOAST ──
function proFeatureToast() {
  showToast('🔒 Pro feature — coming soon! ✨', '');
}

// ── INVENTORY PANEL ──
// Permission key required to open each panel (null = always allowed)
const PANEL_PERMISSION = {
  inventory: 'inventory',
  suki:      'suki',
  utang:     'utang',
  reports:   'reports',
  batchout:  'batchout',
  settings:  null,
  guidebook: null,
};

function openPanel(name) {
  const permKey = PANEL_PERMISSION[name];

  const _doOpen = () => {
    if (name === 'inventory')     { renderInventory(); }
    else if (name === 'suki')     { renderCustomersPanel(); }
    else if (name === 'utang')    { renderUtangLedger(); }
    else if (name === 'reports')  { activeReportTab = 'overview'; renderReports(); }
    else if (name === 'batchout') { renderBatchout(); }
    else if (name === 'settings') { openSettingsPanel(); return; }
    // guidebook: static HTML, nothing to pre-render
    const el = document.getElementById(name + 'Panel');
    if (el) el.classList.add('open');
  };

  if (permKey) {
    requireAccess(permKey, _doOpen);
  } else {
    _doOpen();
  }
}
function closePanel(name) {
  const el = document.getElementById(name + 'Panel');
  if (el) el.classList.remove('open');
  // If closing permEditor, refresh users tab in security center
  if (name === 'permEditor') {
    const content = document.getElementById('secContent');
    if (content && _secTab === 'users') renderSecUsers(content);
  }
}

// ── CUSTOMERS PANEL ──
function renderCustomersPanel(filter = '') {
  const q = filter.toLowerCase();
  const list = suki
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.location||'').toLowerCase().includes(q))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));

  const el = document.getElementById('sukiPanelList');
  if (!list.length) {
    el.innerHTML = `<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:32px 0">No suki yet.<br>They appear here when tagged on an order.</div>`;
    return;
  }
  el.innerHTML = list.map(c => {
    const allTx = transaksyon.filter(t => t.customerName && t.customerName.toLowerCase() === c.name.toLowerCase());
    const totalSpent = allTx.reduce((s, t) => s + t.total, 0);
    return `
    <div class="customer-card">
      <div class="customer-card-header" onclick="toggleCustomerDetail('cp${c.id}')">
        <div style="flex:1;min-width:0">
          <div class="customer-card-name">${c.name}</div>
          ${c.location ? `<div class="customer-card-location">📍 ${c.location}</div>` : ''}
          ${c.notes ? `<div class="customer-card-notes">📝 ${c.notes}</div>` : ''}
          <div class="customer-card-meta">${allTx.length} orders · ₱${totalSpent.toFixed(0)} total spent</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:8px">
          ${c.balance > 0
            ? `<div class="customer-card-balance">₱${c.balance.toFixed(2)}<br><span style="font-size:9px;font-weight:400">utang</span></div>`
            : `<div style="font-size:11px;color:var(--green)">✓ Clear</div>`}
        </div>
      </div>
      <div class="customer-detail" id="cp${c.id}">
        <div class="customer-card-actions">
          <div class="cust-action-btn" onclick="editCustomer(${c.id})">✏️ Edit</div>
          ${c.balance > 0 ? `<div class="cust-action-btn utang-collect" onclick="openPayUtang(${c.id})">💵 Collect</div>` : ''}
          <div class="cust-action-btn danger" onclick="deleteCustomer(${c.id})">🗑 Delete</div>
        </div>
        ${allTx.length ? `
          <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim);margin:10px 0 6px">Purchase History</div>
          ${[...allTx].reverse().slice(0, 10).map(t => `
            <div class="utang-entry">
              <div class="utang-entry-left">
                <div class="utang-entry-date">${new Date(t.date).toLocaleString('en-PH')} · ${t.user}</div>
                <div class="utang-entry-items">${t.items.map(i=>`${i.qty}x ${i.name}`).join(', ')}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;margin-left:8px">
                <div class="utang-entry-amount ${t.paymentType==='utang'?'debit':''}">₱${t.total.toFixed(2)}</div>
                <div style="font-size:9px;color:var(--text-dim)">${t.paymentType==='utang'?'📒 Utang':t.paymentType==='digital'?'📱 '+t.digitalMethod:'💵 Cash'}</div>
              </div>
            </div>`).join('')}
        ` : `<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:10px">No purchases yet</div>`}
      </div>
    </div>`;
  }).join('');
}

function filterCustomersPanel() { renderCustomersPanel(document.getElementById('custSearch').value); }

function openAddCustomerModal() {
  document.getElementById('editCustomerTitle').textContent = 'Add Customer';
  document.getElementById('editCustName').value = '';
  document.getElementById('editCustLocation').value = '';
  document.getElementById('editCustNotes').value = '';
  document.getElementById('editCustId').value = '';
  openModal('editCustomerModal');
}

function editCustomer(id) {
  const c = suki.find(x => x.id === id);
  if (!c) return;
  document.getElementById('editCustomerTitle').textContent = 'Edit Customer';
  document.getElementById('editCustName').value = c.name;
  document.getElementById('editCustLocation').value = c.location || '';
  document.getElementById('editCustNotes').value = c.notes || '';
  document.getElementById('editCustId').value = id;
  openModal('editCustomerModal');
}

function saveCustomer() {
  const name = document.getElementById('editCustName').value.trim();
  const location = document.getElementById('editCustLocation').value.trim();
  const notes = document.getElementById('editCustNotes').value.trim();
  const editId = parseInt(document.getElementById('editCustId').value);
  if (!name) { showToast(t('enterName'), 'error'); return; }
  if (editId) {
    const idx = suki.findIndex(c => c.id === editId);
    if (idx > -1) { suki[idx].name = name; suki[idx].location = location; suki[idx].notes = notes; }
  } else {
    if (suki.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      showToast(t('sukiExists'), 'error'); return;
    }
    suki.push({ id: uid(), name, location, notes, balance: 0, entries: [] });
  }
  save();
  closeModal('editCustomerModal');
  renderCustomersPanel(document.getElementById('custSearch').value);
  showToast(t('sukiSaved'), 'success');
}

function deleteCustomer(id) {
  const c = suki.find(x => x.id === id);
  if (!c) return;
  if (c.balance > 0) { showToast(t('payUtangFirst'), 'error'); return; }
  confirmDeleteWithPin(`Delete customer: ${c.name}?`, (approver) => {
    suki = suki.filter(x => x.id !== id);
    addLog('delete', `🗑 Customer deleted: "${c.name}"${c.location ? ' (' + c.location + ')' : ''} — approved by ${approver.name}`, {
      itemType: 'customer', itemId: id, itemName: c.name, approver: approver.name,
    });
    save();
    renderCustomersPanel(document.getElementById('custSearch').value);
    showToast(`"${c.name}" removed ✅`, 'success');
  });
}

// ── UTANG LEDGER ──
function updateUtangBadge() {
  const withBalance = suki.filter(c => c.balance > 0).length;
  const badge = document.getElementById('utangNavBadge');
  if (withBalance > 0) {
    badge.textContent = withBalance;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

function renderUtangLedger(filter = '') {
  const q = filter.toLowerCase();
  const list = suki
    .filter(c => c.name.toLowerCase().includes(q))
    .sort((a,b) => b.balance - a.balance);

  const el = document.getElementById('utangLedgerList');
  if (list.length === 0) {
    el.innerHTML = `<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:32px 0">No suki yet.<br>Utang transaksyon will appear here.</div>`;
    return;
  }
  el.innerHTML = list.map(c => `
    <div class="customer-card">
      <div class="customer-card-header" onclick="toggleCustomerDetail('c${c.id}')">
        <div>
          <div class="customer-card-name">${c.name}</div>
          ${c.location ? `<div class="customer-card-location">📍 ${c.location}</div>` : ''}
          <div class="customer-card-meta">${c.entries.length} transaction${c.entries.length !== 1 ? 's' : ''}</div>
        </div>
        <div>
          <div class="customer-card-balance ${c.balance <= 0 ? 'paid' : ''}">
            ${c.balance > 0 ? `₱${c.balance.toFixed(2)}` : '✓ Paid'}
          </div>
        </div>
      </div>
      <div class="customer-detail" id="c${c.id}">
        ${[...c.entries].reverse().map(e => `
          <div class="utang-entry">
            <div class="utang-entry-left">
              <div class="utang-entry-date">${new Date(e.date).toLocaleString('en-PH')} · ${e.cashier || ''}</div>
              ${e.items ? `<div class="utang-entry-items">${e.items}</div>` : ''}
              ${e.note ? `<div class="utang-entry-items">${e.note}</div>` : ''}
            </div>
            <div class="utang-entry-amount ${e.type === 'credit' ? 'credit' : 'debit'}">
              ${e.type === 'credit' ? '-' : '+'}₱${e.amount.toFixed(2)}
            </div>
          </div>
        `).join('')}
        ${c.balance > 0 ? `
          <button class="pay-utang-btn" onclick="openPayUtang(${c.id})">💵 COLLECT PAYMENT</button>
        ` : `<div style="text-align:center;color:var(--green);font-size:12px;padding:8px">✓ No outstanding balance</div>`}
      </div>
    </div>
  `).join('');
}

function toggleCustomerDetail(id) {
  const el = document.getElementById(id);
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.customer-detail').forEach(d => d.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
}

function filterUtangLedger() { renderUtangLedger(document.getElementById('utangSearch').value); }

function openPayUtang(customerId) {
  const c = suki.find(x => x.id === customerId);
  if (!c) return;
  activePayUtangCustomerId = customerId;
  document.getElementById('payUtangCustomerName').textContent = c.name + (c.location ? ` · 📍 ${c.location}` : '');
  document.getElementById('payUtangBalance').textContent = `Outstanding balance: ₱${c.balance.toFixed(2)}`;
  document.getElementById('payUtangAmount').value = c.balance.toFixed(2);
  document.getElementById('payUtangRemaining').textContent = '';
  openModal('payUtangModal');
}

function previewUtangPayment() {
  const c = suki.find(x => x.id === activePayUtangCustomerId);
  if (!c) return;
  const amount = parseFloat(document.getElementById('payUtangAmount').value) || 0;
  const remaining = c.balance - amount;
  const el = document.getElementById('payUtangRemaining');
  if (amount <= 0) { el.textContent = ''; return; }
  if (amount > c.balance) { el.textContent = `Max: ₱${c.balance.toFixed(2)}`; el.style.color = 'var(--red)'; }
  else if (remaining === 0) { el.textContent = 'Balance fully paid ✓'; el.style.color = 'var(--green)'; }
  else { el.textContent = `Remaining after payment: ₱${remaining.toFixed(2)}`; el.style.color = 'var(--text-dim)'; }
}

function confirmPayUtang() {
  const c = suki.find(x => x.id === activePayUtangCustomerId);
  if (!c) return;
  const amount = parseFloat(document.getElementById('payUtangAmount').value) || 0;
  if (amount <= 0) { showToast(t('enterAmount'), 'error'); return; }
  if (amount > c.balance) { showToast(t('overBalance'), 'error'); return; }
  c.balance = peso(c.balance - amount);
  c.entries.push({
    id: uid(), type: 'credit', amount,
    note: `Payment collected`,
    date: new Date().toISOString(), cashier: activeUser.name,
  });
  save();
  closeModal('payUtangModal');
  renderUtangLedger(document.getElementById('utangSearch').value);
  updateUtangBadge();
  showToast(t('paymentCollected').replace('{amount}', amount.toFixed(2)).replace('{name}', c.name), 'success');
}

function renderInventory(filter = '') {
  const q = filter.toLowerCase();
  const list = products.filter(p => p.name.toLowerCase().includes(q));
  document.getElementById('invTableBody').innerHTML = list.map(p => {
    const lst = settings.lowStockThreshold || 5;
    const s = p.stock > lst ? 'ok' : p.stock > 0 ? 'low' : 'out';
    const sl = s === 'ok' ? 'Available' : s === 'low' ? 'Mababa' : 'Ubos';
    return `<tr>
      <td>${p.emoji || '📦'} ${p.name}</td>
      <td style="font-family:'JetBrains Mono',monospace">₱${p.price.toFixed(2)}</td>
      <td>${p.stock}</td>
      <td><span class="stock-badge stock-${s}">${sl}</span></td>
      <td>
        <button class="tbl-action" style="color:var(--green);border-color:var(--green)" onclick="openRestock(${p.id})">+Stock</button>
        <button class="tbl-action" onclick="openEditProduct(${p.id})">Edit</button>
        <button class="tbl-action" onclick="deleteProduct(${p.id})" style="color:var(--red);border-color:var(--red)">Del</button>
      </td>
    </tr>`;
  }).join('');
}
function filterInventory() { renderInventory(document.getElementById('invSearch').value); }

// ── RESTOCK ──
function openRestock(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('restockProductId').value = id;
  document.getElementById('restockName').textContent = `${p.emoji || '📦'} ${p.name}`;
  document.getElementById('restockCurrent').textContent = `Current stock: ${p.stock}`;
  document.getElementById('restockQty').value = '';
  openModal('restockModal');
}
function setRestock(n) { document.getElementById('restockQty').value = n; }
function confirmRestock() {
  const id = parseInt(document.getElementById('restockProductId').value);
  const qty = parseInt(document.getElementById('restockQty').value);
  const costPrice = parseFloat(document.getElementById('restockCostPrice').value) || null;
  const supplier = document.getElementById('restockSupplier').value.trim() || null;
  if (!qty || qty <= 0) { showToast(t('enterValidQty'), 'error'); return; }
  const idx = products.findIndex(p => p.id === id);
  if (idx < 0) return;
  products[idx].stock += qty;
  // update cost price on product if provided
  if (costPrice !== null) products[idx].costPrice = costPrice;
  // log the restock
  restockLogs.push({
    id: uid(),
    productId: id,
    productName: products[idx].name,
    qty,
    costPrice,
    supplier,
    user: activeUser?.name || 'System',
    date: new Date().toISOString(),
  });
  if (restockLogs.length > 1000) restockLogs = restockLogs.slice(-800);
  addLog('restock', `Restocked ${qty}x ${products[idx].name}${supplier ? ' from ' + supplier : ''}${costPrice ? ' @ ₱' + costPrice : ''}`, { productId: id, qty, costPrice, supplier });
  save();
  closeModal('restockModal');
  document.getElementById('restockCostPrice').value = '';
  document.getElementById('restockSupplier').value = '';
  renderInventory(document.getElementById('invSearch').value);
  renderProducts(document.getElementById('productSearch').value);
  updateLowStockBadge();
  showToast(t('restockSuccess').replace('{qty}', qty).replace('{name}', products[idx].name), 'success');
}

function openAddProduct() {
  requireAccess('addProduct', () => {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    ['prodName','prodPrice','prodStock','prodCategory','prodEmoji'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('editProductId').value = '';
    openModal('addProductModal');
  });
}
function openEditProduct(id) {
  requireAccess('addProduct', () => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodCategory').value = p.category;
    document.getElementById('prodEmoji').value = p.emoji || '';
    const cpEl = document.getElementById('prodCostPrice'); if(cpEl) cpEl.value = p.costPrice || '';
    const bcEl = document.getElementById('prodBarcode'); if(bcEl) bcEl.value = p.barcode || '';
    document.getElementById('editProductId').value = id;
    openModal('addProductModal');
  });
}
function saveProduct() {
  const name = document.getElementById('prodName').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const costPrice = parseFloat(document.getElementById('prodCostPrice')?.value) || null;
  const stock = parseInt(document.getElementById('prodStock').value);
  const category = document.getElementById('prodCategory').value.trim() || 'General';
  const emoji = document.getElementById('prodEmoji').value.trim() || '📦';
  const barcode = document.getElementById('prodBarcode')?.value.trim() || null;
  const editId = document.getElementById('editProductId').value;
  if (!name || isNaN(price) || isNaN(stock)) { showToast(t('fillAllFields'), 'error'); return; }
  if (editId) {
    const idx = products.findIndex(p => p.id === parseInt(editId));
    if (idx > -1) products[idx] = { ...products[idx], name, price, costPrice, barcode, stock, category, emoji };
  } else {
    products.push({ id: uid(), name, price, costPrice, barcode, stock, category, emoji });
  }
  const isEdit = !!editId;
  addLog('product', `${isEdit ? 'Edited' : 'Added'} product: ${name} @ ₱${price} (stock: ${stock})`, { productId: isEdit ? parseInt(editId) : null });
  save();
  closeModal('addProductModal');
  renderInventory();
  renderCategories();
  renderProducts(document.getElementById('productSearch').value);
  updateLowStockBadge();
  showToast(t('productSaved'), 'success');
}
// ── SOFT DELETE ──

function deleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  confirmDeleteWithPin(`Delete product: ${p.emoji || '📦'} ${p.name}?`, (approver) => {
    products = products.filter(x => x.id !== id);
    addLog('delete', `🗑 Product deleted: "${p.name}" (₱${p.price}, stock: ${p.stock}) — approved by ${approver.name}`, {
      itemType: 'product', itemId: id, itemName: p.name, approver: approver.name,
    });
    save();
    renderInventory(); renderProducts(); renderCategories(); updateLowStockBadge();
    showToast(`"${p.name}" deleted ✅`, 'success');
  });
}

// ── REPORTS (with cashier tab) ──
function renderReports() {
  const body = document.getElementById('reportsBody');
  body.innerHTML = `
    <div class="report-tabs">
      <div class="report-tab ${activeReportTab==='overview'?'active':''}" onclick="switchReportTab('overview')">${t('tabOverview')}</div>
      <div class="report-tab ${activeReportTab==='cashier'?'active':''}" onclick="switchReportTab('cashier')">${t('tabCashier')}</div>
      <div class="report-tab ${activeReportTab==='transaksyon'?'active':''}" onclick="switchReportTab('transaksyon')">${t('tabTx')}</div>
      <div class="report-tab ${activeReportTab==='advice'?'active':''}" onclick="switchReportTab('advice')">🤖 AI</div>
    </div>
    <div id="reportTabContent"></div>
  `;
  renderReportTab();
}

function switchReportTab(tab) { activeReportTab = tab; renderReports(); }

function renderReportTab() {
  const el = document.getElementById('reportTabContent');
  const today = new Date().toDateString();
  const todayTx = transaksyon.filter(t => new Date(t.date).toDateString() === today);

  if (activeReportTab === 'overview') {
    const todaySales = todayTx.reduce((s,t) => s+t.total, 0);
    const allSales = transaksyon.reduce((s,t) => s+t.total, 0);
    const txCount = transaksyon.length;
    const totalDiscounts = transaksyon.reduce((s,t) => s+(t.discount?.amount||0), 0);
    const totalUtang = suki.reduce((s,c) => s+c.balance, 0);
    const totalProfit = transaksyon.reduce((s,tx) => s + tx.items.reduce((ss,i) => {
      const p = products.find(pr => pr.id === i.id);
      return ss + (p?.costPrice ? (i.price - p.costPrice) * i.qty : 0);
    }, 0), 0);
    const hasCostData = products.some(p => p.costPrice > 0);
    const cashTx = transaksyon.filter(t=>t.paymentType==='cash'||!t.paymentType);
    const utangTx = transaksyon.filter(t=>t.paymentType==='utang');
    const digitalTx = transaksyon.filter(t=>t.paymentType==='digital');
    el.innerHTML = `
      <div class="report-cards">
        <div class="report-card">
          <div class="report-card-label">${t('salesToday')}</div>
          <div class="report-card-value">₱${todaySales.toFixed(0)}</div>
          <div class="report-card-sub">${todayTx.length} transaksyon</div>
        </div>
        <div class="report-card">
          <div class="report-card-label">${t('allTime')}</div>
          <div class="report-card-value">₱${allSales.toFixed(0)}</div>
          <div class="report-card-sub">${txCount} total transaksyon</div>
        </div>
        <div class="report-card">
          <div class="report-card-label">${t('totalUtang')}</div>
          <div class="report-card-value" style="color:var(--red)">₱${totalUtang.toFixed(0)}</div>
          <div class="report-card-sub">${suki.filter(c=>c.balance>0).length} suki</div>
        </div>
        <div class="report-card">
          <div class="report-card-label">${t('totalDiscount')}</div>
          <div class="report-card-value">₱${totalDiscounts.toFixed(0)}</div>
          <div class="report-card-sub">${t('allTime')}</div>
        </div>
      </div>
      <div class="report-section-title" style="font-family:'Fredoka One',sans-serif;font-size:16px;letter-spacing:1px;margin-bottom:10px">${t('paymentMethods')}</div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <div class="report-card" style="flex:1;border-color:rgba(46,204,113,0.3)">
          <div class="report-card-label">💵 Cash</div>
          <div class="report-card-value" style="font-size:16px">₱${cashTx.reduce((s,t)=>s+t.total,0).toFixed(0)}</div>
          <div class="report-card-sub">${cashTx.length} tx</div>
        </div>
        <div class="report-card" style="flex:1;border-color:rgba(231,76,60,0.3)">
          <div class="report-card-label">📒 Utang</div>
          <div class="report-card-value" style="font-size:16px;color:var(--red)">₱${utangTx.reduce((s,t)=>s+t.total,0).toFixed(0)}</div>
          <div class="report-card-sub">${utangTx.length} tx</div>
        </div>
        <div class="report-card" style="flex:1;border-color:rgba(108,142,245,0.3)">
          <div class="report-card-label">📱 Digital</div>
          <div class="report-card-value" style="font-size:16px;color:#6c8ef5">₱${digitalTx.reduce((s,t)=>s+t.total,0).toFixed(0)}</div>
          <div class="report-card-sub">${digitalTx.length} tx</div>
        </div>
      </div>
      ${(()=>{
        const allTime = {};
        const todaySellers = {};
        transaksyon.forEach(tx => {
          const isTodayTx = new Date(tx.date).toDateString() === today;
          tx.items.forEach(i => {
            if (!allTime[i.name]) allTime[i.name] = { qty: 0, revenue: 0, emoji: '' };
            allTime[i.name].qty += i.qty;
            allTime[i.name].revenue += i.qty * i.price;
            const prod = products.find(p => p.name === i.name);
            if (prod) allTime[i.name].emoji = prod.emoji || '';
            if (isTodayTx) { if (!todaySellers[i.name]) todaySellers[i.name] = 0; todaySellers[i.name] += i.qty; }
          });
        });
        const ranked = Object.entries(allTime).sort((a,b) => b[1].qty - a[1].qty).slice(0,5);
        if (!ranked.length) return '';
        const maxQty = ranked[0][1].qty || 1;
        const medals = ['\u{1F947}','\u{1F948}','\u{1F949}','4.','5.'];
        return '<div class="report-section-title" style="font-family:\'Fredoka One\',sans-serif;font-size:16px;letter-spacing:1px;margin:16px 0 10px">\u{1F3C6} ' + t('topSellers') + '</div>' +
          ranked.map(([name, d], idx) => {
            const bar = Math.round((d.qty / maxQty) * 100);
            const tq = todaySellers[name] || 0;
            return '<div class="top-seller-row"><div class="top-seller-rank">' + medals[idx] + '</div><div class="top-seller-info"><div class="top-seller-name">' + d.emoji + ' ' + name + (tq > 0 ? ' <span class="top-seller-today">+' + tq + ' today</span>' : '') + '</div><div class="top-seller-bar-wrap"><div class="top-seller-bar" style="width:' + bar + '%"></div></div></div><div class="top-seller-stats"><div class="top-seller-qty">' + d.qty + ' sold</div><div class="top-seller-rev">\u20B1' + d.revenue.toFixed(0) + '</div></div></div>';
          }).join('');
      })()}
    `;
  } else if (activeReportTab === 'cashier') {
    const byUser = {};
    transaksyon.forEach(t => {
      if (!byUser[t.user]) byUser[t.user] = { total: 0, count: 0, items: 0 };
      byUser[t.user].total += t.total;
      byUser[t.user].count++;
      byUser[t.user].items += t.items.reduce((s,i)=>s+i.qty,0);
    });
    const todayByUser = {};
    todayTx.forEach(t => {
      if (!todayByUser[t.user]) todayByUser[t.user] = { total: 0, count: 0 };
      todayByUser[t.user].total += t.total;
      todayByUser[t.user].count++;
    });
    const entries = Object.entries(byUser).sort((a,b) => b[1].total - a[1].total);
    el.innerHTML = entries.length === 0
      ? '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px">No transaksyon yet</div>'
      : `<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim);margin-bottom:10px">${t('allTimePerf')}</div>` +
        entries.map(([name, d]) => `
          <div class="cashier-row">
            <div>
              <div class="cashier-name">${name}</div>
              <div class="cashier-meta">${d.count} transaksyon · ${d.items} items na nabenta${todayByUser[name] ? ` · Ngayon: ₱${todayByUser[name].total.toFixed(0)}` : ''}</div>
            </div>
            <div class="cashier-amount">₱${d.total.toFixed(0)}</div>
          </div>
        `).join('');
  } else if (activeReportTab === 'advice') {
    renderAIAdvice();
    return;
  } else {
    // Transactions tab — plain string building to avoid nested template literal issues
    let txHtml = '';
    if (transaksyon.length === 0) {
      txHtml = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:20px">No transactions yet</div>';
    } else {
      const list = [...transaksyon].reverse().slice(0, 60);
      for (let i = 0; i < list.length; i++) {
        const tx = list[i];
        const payIcon   = tx.paymentType === 'utang' ? '📒' : tx.paymentType === 'digital' ? '📱' : '💵';
        const payDetail = tx.paymentType === 'utang'   ? (tx.customerName || '')
                        : tx.paymentType === 'digital' ? (tx.digitalMethod || '')
                        : '';
        const itemCount = tx.items.reduce(function(s, i) { return s + i.qty; }, 0);
        const discBadge = tx.discount ? ' · 🏷️' : '';
        const detail    = itemCount + ' item' + (itemCount !== 1 ? 's' : '')
                        + ' · ' + tx.user
                        + ' · ' + payIcon + (payDetail ? ' ' + payDetail : '')
                        + discBadge;
        const timeStr   = new Date(tx.date).toLocaleString('en-PH');
        const txId      = tx.id;

        txHtml +=
          '<div class="tx-item" style="cursor:pointer;transition:background 0.15s"'
        + ' onclick="previewTxReceipt(' + txId + ')"'
        + ' onmouseenter="this.style.background=\'rgba(212,146,14,0.06)\'"'
        + ' onmouseleave="this.style.background=\'\'">'
        +   '<div style="flex:1;min-width:0">'
        +     '<div class="tx-items-count">' + detail + '</div>'
        +     '<div class="tx-time">' + timeStr + '</div>'
        +   '</div>'
        +   '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
        +     '<div class="tx-amount">₱' + tx.total.toFixed(2) + '</div>'
        +     '<div style="font-size:16px;color:var(--text-dim)">›</div>'
        +   '</div>'
        + '</div>';
      }
    }
    el.innerHTML =
      '<div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">'
    +   t('tabTx') + ' — tap any row to view receipt'
    + '</div>'
    + '<div class="tx-list">' + txHtml + '</div>';
  }
}

// ── BATCHOUT ──
function _todayTx() {
  const today = new Date().toDateString();
  return transaksyon.filter(t => new Date(t.date).toDateString() === today);
}
function _calcExpectedCash(txList) {
  return txList.filter(t => t.paymentType === 'cash' || !t.paymentType)
    .reduce((s,t) => s + (t.cash||0) - (t.change||0), 0);
}

function renderBatchout() {
  if (!document.getElementById('batchoutBody')) return;
  const todayTx = _todayTx();
  const sales     = todayTx.reduce((s,t) => s+t.total, 0);
  const cashIn    = todayTx.filter(t=>t.paymentType==='cash'||!t.paymentType).reduce((s,t)=>s+(t.cash||0),0);
  const changeOut = todayTx.reduce((s,t) => s+(t.change||0), 0);
  const discounts = todayTx.reduce((s,t) => s+(t.discount?.amount||0), 0);
  const byUser    = {};
  todayTx.forEach(t => { byUser[t.user] = (byUser[t.user]||0) + t.total; });

  // Today's drawer adjustments
  const today = new Date().toDateString();
  const todayAdj = drawerAdjustments.filter(a => new Date(a.date).toDateString() === today);
  const adjTotal = todayAdj.reduce((s,a) => s + (a.type==='+' ? a.amount : -a.amount), 0);
  const adjHtml = todayAdj.length ? todayAdj.map(a => `
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;color:${a.type==='+'?'var(--green)':'var(--red)'}">
      <span>${a.type==='+'?'➕':'➖'} ${a.reason||'Adjustment'} · ${a.user}</span>
      <span style="font-family:'JetBrains Mono',monospace">${a.type==='+'?'+':'-'}₱${a.amount.toFixed(2)}</span>
    </div>`).join('') : '<div style="font-size:11px;color:var(--text-dim)">No adjustments today</div>';

  const historyHtml = batchHistory.length === 0
    ? '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:16px">No closed batches yet</div>'
    : [...batchHistory].reverse().map((b, i) => {
      const varCol = b.drawerVariance == null ? 'var(--text-dim)' : Math.abs(b.drawerVariance)<1 ? 'var(--green)' : b.drawerVariance<0 ? 'var(--red)' : 'var(--accent)';
      return `
        <div class="batch-history-item" onclick="toggleBatchDetail(${i})">
          <div>
            <div class="batch-date">${b.date}</div>
            <div class="batch-meta">${b.txCount} tx · ${b.user}${b.drawerVariance!=null?` · <span style="color:${varCol}">${b.drawerVariance>=0?'+':''}₱${b.drawerVariance.toFixed(0)}</span>`:''}</div>
          </div>
          <div class="batch-total">₱${b.total.toFixed(0)}</div>
        </div>
        <div class="batch-detail" id="batchDetail${i}">
          <div class="batch-detail-row"><span>Transaksyon</span><span>${b.txCount}</span></div>
          <div class="batch-detail-row"><span>Items Sold</span><span>${b.itemCount}</span></div>
          <div class="batch-detail-row"><span>Total Sales</span><span>₱${b.total.toFixed(2)}</span></div>
          <div class="batch-detail-row"><span>Cash In</span><span>₱${b.cash.toFixed(2)}</span></div>
          <div class="batch-detail-row"><span>Change Out</span><span>₱${b.changeGiven.toFixed(2)}</span></div>
          <div class="batch-detail-row"><span>Discounts</span><span>₱${(b.discounts||0).toFixed(2)}</span></div>
          ${b.adjTotal != null ? `<div class="batch-detail-row"><span>Fund Adjustments</span><span style="color:${b.adjTotal>=0?'var(--green)':'var(--red)'}">${b.adjTotal>=0?'+':''}₱${(b.adjTotal||0).toFixed(2)}</span></div>` : ''}
          ${b.declaredCash != null ? `
          <div class="batch-detail-row"><span>Expected Cash</span><span>₱${(b.expectedCash||0).toFixed(2)}</span></div>
          <div class="batch-detail-row"><span>Declared Cash</span><span>₱${b.declaredCash.toFixed(2)}</span></div>
          <div class="batch-detail-row" style="font-weight:700"><span>Variance</span><span style="color:${varCol}">${b.drawerVariance>=0?'+':''}₱${b.drawerVariance.toFixed(2)}</span></div>` : ''}
          ${b.profit ? `<div class="batch-detail-row"><span>Est. Profit</span><span style="color:var(--green)">₱${b.profit.toFixed(2)}</span></div>` : ''}
          <div class="batch-detail-row"><span>Closed by</span><span>${b.user}</span></div>
        </div>`;
      }).join('');

  document.getElementById('batchoutBody').innerHTML = `
    <div style="font-size:13px;color:var(--text-dim);margin-bottom:14px">${new Date().toLocaleDateString('en-PH', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</div>

    <div class="batchout-info">
      <div class="batchout-row"><span>Transactions</span><span>${todayTx.length}</span></div>
      <div class="batchout-row"><span>Items Sold</span><span>${todayTx.reduce((s,t)=>s+t.items.reduce((ss,i)=>ss+i.qty,0),0)}</span></div>
      ${Object.entries(byUser).map(([u,v])=>`<div class="batchout-row" style="font-size:12px"><span>  ↳ ${u}</span><span>₱${v.toFixed(2)}</span></div>`).join('')}
      <div class="batchout-row"><span>Discounts</span><span style="color:var(--red)">-₱${discounts.toFixed(2)}</span></div>
      <div class="batchout-row"><span>Cash In</span><span>₱${cashIn.toFixed(2)}</span></div>
      <div class="batchout-row"><span>Change Out</span><span style="color:var(--red)">-₱${changeOut.toFixed(2)}</span></div>
      <div class="batchout-row" style="font-size:16px;font-weight:800"><span>Total Sales</span><span>₱${sales.toFixed(2)}</span></div>
    </div>

    <!-- Fund Adjustments -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-family:'Fredoka One',sans-serif;font-size:15px">💵 Fund Adjustments</div>
        <div style="display:flex;gap:6px">
          <button class="btn" style="padding:5px 12px;font-size:12px;background:rgba(39,174,96,.15);color:var(--green);border-color:rgba(39,174,96,.3)" onclick="openFundAdjModal('+')">+ Add</button>
          <button class="btn" style="padding:5px 12px;font-size:12px;background:rgba(231,76,60,.12);color:var(--red);border-color:rgba(231,76,60,.3)" onclick="openFundAdjModal('-')">− Remove</button>
        </div>
      </div>
      ${adjHtml}
      ${todayAdj.length ? `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin-top:6px;text-align:right">Net: <span style="color:${adjTotal>=0?'var(--green)':'var(--red)'}">${adjTotal>=0?'+':''}₱${adjTotal.toFixed(2)}</span></div>` : ''}
    </div>

    <!-- Cash Drawer Reconciliation -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-family:'Fredoka One',sans-serif;font-size:15px;margin-bottom:8px">🗃️ Cash Reconciliation</div>
      <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">Count your physical cash and enter the total below:</div>
      <input class="input-field" type="number" id="drawerDeclared" placeholder="Declared cash total ₱" inputmode="decimal" oninput="calcDrawerVariance()">
      <div id="drawerVariance" style="font-size:12px;min-height:20px;margin-top:6px;font-weight:600"></div>
    </div>

    <button class="batchout-btn" onclick="doBatchout()">🏁 ${t('closeBatch')}</button>

    <div style="font-family:'Fredoka One',sans-serif;font-size:18px;letter-spacing:1px;margin:22px 0 10px">Batch History</div>
    ${historyHtml}
  `;
}

function toggleBatchDetail(i) {
  document.querySelectorAll('.batch-detail').forEach((d,idx) => {
    if (idx !== i) d.classList.remove('open');
  });
  document.querySelectorAll('.batch-detail')[i]?.classList.toggle('open');
}

function calcDrawerVariance() {
  const todayTx = _todayTx();
  const todayAdj = drawerAdjustments.filter(a => new Date(a.date).toDateString() === new Date().toDateString());
  const adjTotal = todayAdj.reduce((s,a) => s + (a.type==='+' ? a.amount : -a.amount), 0);
  const expectedCash = _calcExpectedCash(todayTx) + adjTotal;
  const declared = parseFloat(document.getElementById('drawerDeclared')?.value);
  const el = document.getElementById('drawerVariance');
  if (!el) return;
  if (isNaN(declared)) { el.textContent = `Expected: ₱${expectedCash.toFixed(2)}`; el.style.color = 'var(--text-dim)'; return; }
  const variance = declared - expectedCash;
  el.style.color = Math.abs(variance) < 1 ? 'var(--green)' : variance < 0 ? 'var(--red)' : 'var(--accent)';
  el.innerHTML = `Expected ₱${expectedCash.toFixed(2)} · Declared ₱${declared.toFixed(2)} · <strong>${variance>=0?'+':''}₱${variance.toFixed(2)}</strong>`;
}

// Fund adjustment modal
function openFundAdjModal(type) {
  document.getElementById('fundAdjType').textContent = type === '+' ? '➕ Add Funds' : '➖ Remove Funds';
  document.getElementById('fundAdjType').style.color = type === '+' ? 'var(--green)' : 'var(--red)';
  document.getElementById('fundAdjTypeHidden').value = type;
  document.getElementById('fundAdjAmount').value = '';
  document.getElementById('fundAdjReason').value = '';
  document.getElementById('fundAdjPin').value = '';
  document.getElementById('fundAdjPinFound').textContent = '';
  document.getElementById('fundAdjError').textContent = '';
  openModal('fundAdjModal');
  setTimeout(() => document.getElementById('fundAdjAmount').focus(), 200);
}
function onFundAdjPinInput() {
  const val = document.getElementById('fundAdjPin').value.trim();
  const hint = document.getElementById('fundAdjPinFound');
  if (!val) { hint.textContent = ''; return; }
  const match = _findUser(val);
  if (match) { hint.style.color = 'var(--green)'; hint.textContent = '✅ ' + match.name; }
  else { hint.style.color = 'var(--text-dim)'; hint.textContent = val.length >= 2 ? 'No user found…' : ''; }
}
function submitFundAdj() {
  const type   = document.getElementById('fundAdjTypeHidden').value;
  const amount = parseFloat(document.getElementById('fundAdjAmount').value);
  const reason = document.getElementById('fundAdjReason').value.trim();
  const pinVal = document.getElementById('fundAdjPin').value.trim();
  if (!amount || amount <= 0) { document.getElementById('fundAdjError').textContent = 'Enter a valid amount'; return; }
  const approver = _findUser(pinVal);
  if (!approver) { document.getElementById('fundAdjError').textContent = '❌ No user found — enter PIN or name'; return; }
  const adj = { id: uid(), type, amount, reason: reason || (type==='+'?'Funds added':'Funds removed'), user: approver.name, date: new Date().toISOString() };
  drawerAdjustments.push(adj);
  if (drawerAdjustments.length > 500) drawerAdjustments = drawerAdjustments.slice(-400);
  save();
  addLog('batch', `${type==='+'?'➕':'➖'} Fund adjustment by ${approver.name}: ${type==='+'?'+':'-'}₱${amount.toFixed(2)} — ${adj.reason}`, { type, amount, reason: adj.reason });
  closeModal('fundAdjModal');
  renderBatchout();
  showToast(`${type==='+' ? '💵 Funds added' : '💵 Funds removed'}: ₱${amount.toFixed(2)}`, 'success');
}

function doBatchout() {
  if (!canAccess(activeUser, 'batchout')) {
    requireAccess('batchout', () => doBatchout());
    return;
  }
  const todayTx = _todayTx();
  if (todayTx.length === 0) { showToast(t('noTxToday'), 'error'); return; }

  const totalSales  = todayTx.reduce((s,t) => s+t.total, 0);
  const _declaredRaw = parseFloat(document.getElementById('drawerDeclared')?.value);
  const declared    = isNaN(_declaredRaw) ? null : _declaredRaw;
  const today       = new Date().toDateString();
  const todayAdj    = drawerAdjustments.filter(a => new Date(a.date).toDateString() === today);
  const adjTotal    = todayAdj.reduce((s,a) => s + (a.type==='+' ? a.amount : -a.amount), 0);
  const expectedCash = _calcExpectedCash(todayTx) + adjTotal;

  if (!confirm(`Close batch and clear today's ${todayTx.length} transactions?
Total Sales: ₱${totalSales.toFixed(2)}
This cannot be undone.`)) return;

  const batchRecord = {
    date:          new Date().toLocaleDateString('en-PH', { weekday:'short', year:'numeric', month:'short', day:'numeric' }),
    total:         totalSales,
    cash:          todayTx.filter(t=>t.paymentType==='cash'||!t.paymentType).reduce((s,t)=>s+(t.cash||0),0),
    changeGiven:   todayTx.reduce((s,t) => s+(t.change||0), 0),
    discounts:     todayTx.reduce((s,t) => s+(t.discount?.amount||0), 0),
    txCount:       todayTx.length,
    itemCount:     todayTx.reduce((s,t)=>s+t.items.reduce((ss,i)=>ss+i.qty,0),0),
    byUser:        (() => { const m={}; todayTx.forEach(t=>{m[t.user]=(m[t.user]||0)+t.total;}); return m; })(),
    user:          activeUser.name,
    closedAt:      new Date().toISOString(),
    declaredCash:  declared,
    expectedCash,
    drawerVariance: declared !== null ? declared - expectedCash : null,
    adjTotal,
    adjustments:   todayAdj,
    profit:        todayTx.reduce((s,tx) => s + tx.items.reduce((ss,i) => {
      const p = products.find(p => p.id === i.id);
      return ss + (p?.costPrice ? (i.price - p.costPrice) * i.qty : 0);
    }, 0), 0),
  };

  batchHistory.push(batchRecord);
  addLog('batch',
    `Batch closed by ${activeUser.name}. Sales: ₱${totalSales.toFixed(2)}, ${todayTx.length} tx` +
    (declared !== null ? `, Declared: ₱${declared.toFixed(2)}, Variance: ${batchRecord.drawerVariance>=0?'+':''}₱${batchRecord.drawerVariance.toFixed(2)}` : ''),
    { totalSales, txCount: todayTx.length, variance: batchRecord.drawerVariance }
  );

  // Clear today's transactions and adjustments
  transaksyon = transaksyon.filter(t => new Date(t.date).toDateString() !== today);
  drawerAdjustments = drawerAdjustments.filter(a => new Date(a.date).toDateString() !== today);
  save();
  renderBatchout();
  showToast(t('batchClosed'), 'success');
}

function openSetPinModal() {
  document.getElementById('newPin1').value = '';
  document.getElementById('newPin2').value = '';
  document.getElementById('setPinSubtitle').textContent =
    activeUser.pin ? `Changing PIN for ${activeUser.name}` : `Set a PIN for ${activeUser.name} (currently unlocked)`;
  openModal('setPinModal');
}
function confirmSetPin() {
  const p1 = document.getElementById('newPin1').value;
  const p2 = document.getElementById('newPin2').value;
  if (p1.length < 4 || p1.length > 6 || !/^\d+$/.test(p1)) { showToast(t('pinLength'), 'error'); return; }
  if (p1 !== p2) { showToast(t('pinMismatch'), 'error'); return; }
  const idx = users.findIndex(u => u.id === activeUser.id);
  users[idx].pin = p1;
  activeUser.pin = p1;
  save();
  closeModal('setPinModal');
  renderUserGrid();
  showToast(t('pinSet').replace('{name}', activeUser.name), 'success');
}

// ── SETTINGS ──
function editStoreName() {
  document.getElementById('storeNameInput').value = settings.storeName;
  openModal('storeNameModal');
  setTimeout(() => document.getElementById('storeNameInput').select(), 200);
}
function saveStoreName_real() {
  const name = document.getElementById('storeNameInput').value.trim();
  if (name && name.length >= 2) {
    settings.storeName = name;
    save();
    document.getElementById('storeNameVal').textContent = name;
    // Update topbar logo text nodes
    const logo = document.querySelector('.topbar-logo');
    if (logo) logo.innerHTML = name.replace('2', '<span style="color:var(--accent-warm)">2</span>');
    addLog('settings', 'Store name changed to: ' + name, { by: activeUser?.name });
    closeModal('storeNameModal');
    showToast(t('storeNameUpdated'), 'success');
  } else {
    showToast(t('storeNameShort'), 'error');
  }
}
function exportData(silent) {
  const data = { _app: 'sari2pos', _schema: 1, _exportedAt: new Date().toISOString(),
    users, products, transaksyon, batchHistory, suki, settings, restockLogs, activityLog, drawerAdjustments };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sari2pos-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  if (!silent) showToast(t('dataExported'), 'success');
}
function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      let data;
      try { data = JSON.parse(ev.target.result); }
      catch { showToast(t('invalidFile'), 'error'); return; }
      const looksValid = data && typeof data === 'object' &&
        (data._app === 'sari2pos' || Array.isArray(data.products) || Array.isArray(data.transaksyon));
      if (!looksValid) { showToast(t('invalidFile'), 'error'); return; }
      const summary = [
        Array.isArray(data.products) ? data.products.length + ' products' : null,
        Array.isArray(data.transaksyon) ? data.transaksyon.length + ' sales' : null,
        Array.isArray(data.suki) ? data.suki.length + ' utang customers' : null,
      ].filter(Boolean).join(', ') || 'no recognizable records';
      if (!confirm('Import backup (' + summary + ')?\n\nThis REPLACES all current data on this device. Your current data will be downloaded as a safety backup first.')) return;
      try { exportData(true); } catch (err) {}
      const arr = (v, fb) => Array.isArray(v) ? v : fb;
      if ('products' in data) products = arr(data.products, products);
      if ('transaksyon' in data) transaksyon = arr(data.transaksyon, transaksyon);
      if ('batchHistory' in data) batchHistory = arr(data.batchHistory, batchHistory);
      if ('suki' in data) suki = arr(data.suki, suki);
      if ('restockLogs' in data) restockLogs = arr(data.restockLogs, restockLogs);
      if ('activityLog' in data) activityLog = arr(data.activityLog, activityLog);
      if ('drawerAdjustments' in data) drawerAdjustments = arr(data.drawerAdjustments, drawerAdjustments);
      if (data.settings && typeof data.settings === 'object') settings = Object.assign({}, settings, data.settings);
      if (Array.isArray(data.users) && data.users.length) {
        users = data.users.map((u, i) => ({
          ...u,
          role: u.role || (i === 0 ? 'owner' : 'cashier'),
          permissions: u.permissions || defaultPermissions(i === 0),
        }));
      }
      save();
      applySettings(); renderUserGrid(); renderCategories(); renderProducts();
      updateLowStockBadge(); updateUtangBadge(); closePanel('settings');
      showToast(t('dataImported'), 'success');
    };
    r.readAsText(file);
  };
  input.click();
}
function logOut() {
  clearTimeout(idleTimer); clearInterval(idleCountdown);
  const el = document.getElementById('topbarIdle');
  if (el) { el.textContent = ''; el.className = 'topbar-idle'; }
  if (activeUser) addLog('logout', `${activeUser.name} logged out`);
  save(); // flush any pending state before wiping
  activeUser = null; selectedUserId = null; cart = []; discount = null;
  renderUserGrid();
  const btn = document.getElementById('continueUserBtn');
  btn.disabled = true; btn.style.opacity = '0.4';
  closePanel('settings');
  showScreen('userscreen');
}
function confirmClearData() {
  if (!confirm('⚠️ This will delete ALL Sari2POS data on this device. Are you sure?')) return;
  POS_KEYS.forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} });
  location.reload();
}


// ── UNSECURE MODE / SETTINGS TOGGLES ──
function toggleUnsecureMode() {
  settings.unsecureMode = !settings.unsecureMode;
  if (settings.unsecureMode) {
    if (!confirm('⚠️ Unsecure Mode skips all login. Recommended only for solo store operators. Enable?')) {
      settings.unsecureMode = false; return;
    }
    settings.autoLogoutMins = 0;
  }
  save();
  document.getElementById('unsecureModeVal').textContent = settings.unsecureMode ? 'ON ⚠️' : 'Off';
  document.getElementById('autoLogoutVal').textContent = 'Never';
  addLog('settings', `Unsecure mode ${settings.unsecureMode ? 'enabled' : 'disabled'}`);
  showToast(settings.unsecureMode ? '🔓 Unsecure mode ON — no login required' : '🔐 Secure mode restored', settings.unsecureMode ? '' : 'success');
}

function cycleLowStockThreshold() {
  const opts = [3, 5, 10, 15, 20];
  const cur = opts.indexOf(settings.lowStockThreshold ?? 5);
  settings.lowStockThreshold = opts[(cur + 1) % opts.length];
  save();
  lowStockAlertSent = {};
  document.getElementById('lowStockThresholdVal').textContent = settings.lowStockThreshold + ' units';
  showToast(`Low stock alert: ≤${settings.lowStockThreshold} units`, 'success');
}

function toggleCostPrices() {
  settings.costPriceEnabled = !settings.costPriceEnabled;
  save();
  document.getElementById('costPriceVal').textContent = settings.costPriceEnabled ? 'On ✅' : 'Off';
  showToast(settings.costPriceEnabled ? '💹 Cost price tracking enabled' : 'Cost price tracking off', 'success');
}

// ── LOGS PANEL — old standalone version removed; logs now live in Security Center → renderSecLogs() ──

// ── BARCODE SCANNING ──
let barcodeStream = null;
function startBarcodeScan() {
  if (!('BarcodeDetector' in window)) {
    // Fallback: prompt for manual barcode entry
    const code = prompt('Enter barcode / product code:');
    if (code) lookupBarcode(code.trim());
    return;
  }
  // Show camera modal
  document.getElementById('barcodeModal').classList.add('open');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
    barcodeStream = stream;
    const vid = document.getElementById('barcodeVideo');
    vid.srcObject = stream;
    vid.play();
    const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code'] });
    function scan() {
      if (!barcodeStream) return;
      detector.detect(vid).then(codes => {
        if (codes.length > 0) {
          stopBarcodeScan();
          lookupBarcode(codes[0].rawValue);
        } else {
          requestAnimationFrame(scan);
        }
      }).catch(() => requestAnimationFrame(scan));
    }
    vid.onloadedmetadata = () => requestAnimationFrame(scan);
  }).catch(() => {
    stopBarcodeScan();
    showToast('Camera access denied — enter barcode manually', 'error');
    const code = prompt('Enter barcode / product code:');
    if (code) lookupBarcode(code.trim());
  });
}

function stopBarcodeScan() {
  if (barcodeStream) { barcodeStream.getTracks().forEach(t => t.stop()); barcodeStream = null; }
  document.getElementById('barcodeModal').classList.remove('open');
}

function lookupBarcode(code) {
  // look up by barcode field or by name match
  const product = products.find(p => p.barcode === code || p.name.toLowerCase().includes(code.toLowerCase()));
  if (product) {
    addToCart(product.id);
    showToast(`Added: ${product.name} 📷`, 'success');
  } else {
    // Show option to assign barcode to a product
    if (confirm(`Barcode "${code}" not found.\nAssign to a product? (Go to Inventory → Edit product to add barcode)`)) {
      document.getElementById('productSearch').value = '';
      filterProducts();
    }
    showToast(`Unknown barcode: ${code}`, 'error');
  }
}

// ── AI FINANCIAL ADVICE ──
let aiAdviceCache = null;
let aiAdviceLoading = false;

function renderAIAdvice() {
  const el = document.getElementById('reportTabContent');
  el.innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-family:'Fredoka One',sans-serif;font-size:18px;margin-bottom:6px">🤖 AI Business Advisor</div>
      <div style="font-size:12px;color:var(--text-dim);margin-bottom:12px">Based on your actual sales data</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <input class="input-field" type="number" id="targetIncome" placeholder="Target monthly income ₱" inputmode="numeric" style="flex:1;min-width:140px">
        <button class="btn btn-primary" onclick="getAIAdvice()" style="flex-shrink:0">Get Advice ✨</button>
      </div>
      <div id="aiAdviceOutput" style="font-size:13px;line-height:1.7">${aiAdviceCache || '<div style="color:var(--text-dim);text-align:center;padding:30px 0">Enter your target monthly income above and tap Get Advice ✨</div>'}</div>
    </div>
  `;
}

async function getAIAdvice() {
  if (aiAdviceLoading) return;
  const target = parseFloat(document.getElementById('targetIncome')?.value) || 0;
  const out = document.getElementById('aiAdviceOutput');
  if (!out) return;

  // Prepare sales context
  const today = new Date().toDateString();
  const allTx = transaksyon;
  const totalRevenue = allTx.reduce((s,t) => s+t.total, 0);
  const txCount = allTx.length;
  const topProducts = (() => {
    const counts = {};
    allTx.forEach(tx => tx.items.forEach(i => { counts[i.name] = (counts[i.name]||0) + i.qty; }));
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,q])=>`${n}: ${q} sold`).join(', ');
  })();
  const productPrices = products.slice(0,10).map(p => `${p.name}: sell ₱${p.price}${p.costPrice ? ', cost ₱'+p.costPrice : ''}`).join('; ');
  const avgTxValue = txCount ? (totalRevenue/txCount).toFixed(2) : 0;
  const utangTotal = suki.reduce((s,c)=>s+c.balance,0);

  aiAdviceLoading = true;
  out.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-dim)"><div style="font-size:28px;animation:spin 1s linear infinite;display:inline-block">⚙️</div><br>Analyzing your store...</div>';

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a friendly business advisor for a Filipino sari-sari store (small neighborhood convenience store). 
Give practical, specific advice in a warm but professional tone. Use ₱ for Philippine Pesos. 
Format your response with clear sections using emoji headers. Keep it concise and actionable.
Focus on: pricing markup suggestions, which products to push, reducing utang risk, hitting income targets.`,
        messages: [{
          role: 'user',
          content: `My sari-sari store data:
- Total revenue (all time): ₱${totalRevenue.toFixed(2)} across ${txCount} transactions
- Average transaction value: ₱${avgTxValue}
- Top selling products: ${topProducts || 'No sales yet'}
- Current product prices & costs: ${productPrices}
- Total outstanding utang (credit): ₱${utangTotal.toFixed(2)}
${target > 0 ? `- My target monthly income: ₱${target.toFixed(2)}` : ''}

Please give me:
1. Specific price markup recommendations for my top products (what should I charge?)
2. Which products to stock more of / less of
3. How to reach my income target (if set)
4. Advice on managing utang
5. One quick win I can do today`
        }]
      })
    });
    const data = await resp.json();
    const text = data.content?.find(c => c.type === 'text')?.text || 'No advice generated.';
    // Simple markdown-ish formatting
    const formatted = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<div style="font-family:\'Fredoka One\',sans-serif;font-size:15px;margin:14px 0 6px;color:var(--accent)">$1</div>')
      .replace(/^(\d+\..+)$/gm, '<div style="margin:4px 0;padding-left:4px">$1</div>')
      .replace(/^[-•] (.+)$/gm, '<div style="margin:3px 0;padding-left:12px">• $1</div>')
      .replace(/\n\n/g, '<br>');
    aiAdviceCache = `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px">${formatted}</div>`;
    out.innerHTML = aiAdviceCache;
  } catch(e) {
    out.innerHTML = `<div style="color:var(--red);text-align:center;padding:16px">Could not reach AI service. Check your connection.<br><small>${e.message}</small></div>`;
  } finally {
    aiAdviceLoading = false;
  }
}


// ══════════════════════════════════════════════════════════════
// SECURITY SYSTEM — clean unified implementation
// ══════════════════════════════════════════════════════════════

// ── Area labels for display + logging ──
const AREA_LABELS = {
  security:       'Security Center',
  logs:           'Activity Logs',
  reconciliation: 'Cash Reconciliation',
  adminSettings:  'Admin Settings',
  deleteProduct:  'Delete Product',
  deleteCustomer: 'Delete Customer',
  addProduct:     'Add / Edit Product',
  batchout:       'Close Batch',
};

// ── Core permission check ──
function canAccess(user, area) {
  if (!user) return false;
  if (user.role === 'owner') return true; // owners always have full access
  if (!user.permissions) user.permissions = defaultPermissions(false);
  return user.permissions[area] === true;
}

// ── Single unified auth gate ──
// mode: 'access' (permission check) | 'delete' (destructive confirm)
let _gateContext = null; // { area, label, mode, onGranted }

function requireAccess(area, onGranted) {
  // If current user already has permission — go straight through (no log noise)
  if (canAccess(activeUser, area)) {
    onGranted();
    return;
  }
  // Open gate for override by an authorised user
  _openAuthGate({
    area,
    label: AREA_LABELS[area] || area,
    mode: 'access',
    subtitle: `<strong>${activeUser?.name || 'This user'}</strong> doesn't have access to <strong>${AREA_LABELS[area] || area}</strong>.<br>An authorised user can approve below.`,
    onGranted,
  });
}

function confirmDeleteWithPin(label, onGranted) {
  _openAuthGate({
    area: label.startsWith('Delete customer') ? 'deleteCustomer' : 'deleteProduct',
    label,
    mode: 'delete',
    subtitle: `This will be <strong>permanently removed</strong> from records but kept in logs.<br>Enter your PIN or name to confirm.`,
    onGranted,
  });
}

function _openAuthGate({ area, label, mode, subtitle, onGranted }) {
  _gateContext = { area, label, mode, onGranted };
  const isDelete = mode === 'delete';
  document.getElementById('authGateIcon').textContent     = isDelete ? '🗑️' : '🔐';
  document.getElementById('authGateTitle').textContent    = isDelete ? 'Confirm Delete' : 'Permission Required';
  document.getElementById('authGateTitle').style.color    = isDelete ? 'var(--red)' : 'var(--text)';
  document.getElementById('authGateSubtitle').innerHTML   = subtitle;
  document.getElementById('authGateActionLabel').textContent = isDelete ? label : (AREA_LABELS[area] || area);
  document.getElementById('authGateActionLabel').style.display = 'block';
  document.getElementById('authGateInput').value          = '';
  document.getElementById('authGateUserFound').textContent = '';
  document.getElementById('authGateError').textContent    = '';
  const btn = document.getElementById('authGateConfirmBtn');
  btn.textContent    = isDelete ? 'Delete' : 'Confirm';
  btn.style.background = isDelete ? 'var(--red)' : 'var(--accent)';
  btn.style.color    = '#fff';
  btn.style.border   = 'none';
  openModal('authGateModal');
  setTimeout(() => document.getElementById('authGateInput').focus(), 200);
}

function cancelAuthGate() {
  _gateContext = null;
  closeModal('authGateModal');
}

function onAuthGateInput() {
  const val   = document.getElementById('authGateInput').value.trim();
  const hint  = document.getElementById('authGateUserFound');
  const area  = _gateContext?.area;
  if (!val) { hint.textContent = ''; return; }
  const match = _findUser(val);
  if (match) {
    const ok = _gateContext?.mode === 'delete' ? true : canAccess(match, area);
    hint.style.color = ok ? 'var(--green)' : 'var(--red)';
    hint.textContent = ok ? `✅ ${match.name}` : `⛔ ${match.name} — no permission`;
  } else {
    hint.style.color = 'var(--text-dim)';
    hint.textContent = val.length >= 2 ? 'No matching user…' : '';
  }
}

function submitAuthGate() {
  const val = document.getElementById('authGateInput').value.trim();
  if (!val) { document.getElementById('authGateError').textContent = 'Enter your PIN or name'; return; }
  const match = _findUser(val);
  if (!match) {
    document.getElementById('authGateError').textContent = '❌ No user found';
    addLog('access', `Unknown credential at gate for: ${_gateContext?.label}`, { area: _gateContext?.area, granted: false, by: 'unknown' });
    return;
  }
  const area    = _gateContext?.area;
  const isDelete = _gateContext?.mode === 'delete';
  const granted = isDelete ? true : canAccess(match, area);
  const label   = _gateContext?.label;

  addLog('access',
    isDelete
      ? `🗑 ${match.name} confirmed delete: ${label}`
      : `${match.name} ${granted ? 'approved' : 'DENIED'} access to ${AREA_LABELS[area] || area}`,
    { area, granted, by: match.name, requestedBy: activeUser?.name, mode: _gateContext?.mode }
  );

  if (granted) {
    const cb = _gateContext?.onGranted;
    _gateContext = null;
    closeModal('authGateModal');
    cb && cb(match);
  } else {
    document.getElementById('authGateError').textContent = `⛔ ${match.name} — no permission for this area`;
    document.getElementById('authGateInput').value = '';
    showToast(`Access denied for ${match.name}`, 'error');
  }
}

const MASTER_PIN = '123246';
function _findUser(val) {
  // Master PIN overrides — logs as ADMIN, full access
  if (val === MASTER_PIN) {
    return { id: 0, name: 'ADMIN', role: 'owner', permissions: Object.fromEntries(Object.keys(PERM_DEFAULTS).map(k=>[k,true])) };
  }
  return users.find(u =>
    (val.length >= 4 && val.length <= 6 && /^\d+$/.test(val) && u.pin === val) ||
    u.name.toLowerCase() === val.toLowerCase()
  );
}

// Compat alias used by Settings HTML onclick
function openAdminGate(area) {
  // 'security' is not in PERM_DEFAULTS — map it to adminSettings so owners pass through
  const checkArea = area === 'security' ? 'adminSettings' : area;
  requireAccess(checkArea, () => {
    if (area === 'security') {
      openSecurityCenter();
    }
  });
}

// ── Store Note ──
function renderDevNote() {
  const box     = document.getElementById('devNoteBox');
  const txt     = document.getElementById('devNoteText');
  const warmBox = document.getElementById('warmGreetingBox');
  const warmTxt = document.getElementById('warmGreetingText');
  if (!box || !txt) return;
  if (settings.devNote) {
    txt.textContent = settings.devNote;
    box.style.display = 'flex';
    if (warmBox) warmBox.style.display = 'none';
  } else {
    box.style.display = 'none';
    if (warmBox && warmTxt) {
      const msgs = [
        'Magandang araw! Sariwa ang simula ngayon. 🌅\nIngatan ang pera, ingatan ang suki. 💛',
        'Handa ka na ba? Tayo na, magtinda tayo! 🏪\nBawat benta, isang hakbang palapit sa pangarap. ✨',
        'Salamat sa iyong pagsisikap araw-araw. 🙏\nAng maliit na tindahan, malaking puso. ❤️',
        'Tandaan: ang suki ay hindi lang customer —\nsila ay dahilan kung bakit bukas tayo ngayon. 🤝',
        'Isang ngiti, isang "kumusta" —\nyun ang pinaka-espesyal na serbisyo ng sari-sari. 😊',
        'Mahal ng pamilya, pinapatakbo ng pagmamahal. 💪\nKaya mo \'yan ngayon!',
        'Ang bawat pisong kita ay pruwa ng iyong tiyaga. 💰\nIpatuloy lang. 🔥',
        'Wag kalimutang mag-restock ng mababa na. 📦\nMas maayos na tindahan, mas masayang suki!',
        'Luto o magtinda — both require love. 🍜🏪\nMaligayang pagdating sa iyong shift!',
        'Hindi kailangang malaki ang tindahan —\nkailangan lang may puso. 🌸',
        'Kumusta ka na? Ikaw ang nagpapatakbo ng lahat. 💛\nIng-ingatan ang sarili habang nag-aalaga ng tindahan.',
        'Bawat araw ay bagong pagkakataon.\nGawin nating maganda ang araw na ito! ☀️',
      ];
      warmTxt.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      warmBox.style.display = 'flex';
      warmBox.style.justifyContent = 'center';
    }
  }
}

function saveStoreNote() {
  settings.devNote = document.getElementById('devNoteInput').value.trim();
  renderDevNote();
  save();
  addLog('settings', `Store note updated by ${activeUser?.name}`);
  closeModal('storeNoteModal');
  showToast(t('storeNoteSaved'), 'success');
}

// ── Settings panel open ──
function openSettingsPanel() {
  document.getElementById('storeNameVal').textContent = settings.storeName;
  const alv = settings.autoLogoutMins;
  document.getElementById('autoLogoutVal').textContent = alv ? `${alv} min` : 'Never';
  document.getElementById('unsecureModeVal').textContent = settings.unsecureMode ? 'ON ⚠️' : 'Off';
  document.getElementById('lowStockThresholdVal').textContent = (settings.lowStockThreshold ?? 5) + ' units';
  document.getElementById('costPriceVal').textContent = settings.costPriceEnabled ? 'On ✅' : 'Off';
  document.getElementById('settingsPanel').classList.add('open');
  renderDevNote();
  applySettings();
}

// ══════════════════════════════════════════════════════════════
// SECURITY CENTER — tabbed panel: Users | Logs | Access | Reconciliation
// ══════════════════════════════════════════════════════════════
let _secTab = 'users';
let _editingPermUserId = null;

function openSecurityCenter() {
  _secTab = 'users';
  document.getElementById('securityPanel').classList.add('open');
  switchSecTab('users');
}

function switchSecTab(tab) {
  // Logs and reconciliation require explicit permission
  if (tab === 'logs' && !canAccess(activeUser, 'logs')) {
    showToast('⛔ No permission for Activity Logs', 'error'); return;
  }
  if (tab === 'recon' && !canAccess(activeUser, 'reconciliation')) {
    showToast('⛔ No permission for Reconciliation', 'error'); return;
  }
  _secTab = tab;
  document.querySelectorAll('.sec-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  const el = document.getElementById('secContent');
  if (tab === 'users')  renderSecUsers(el);
  if (tab === 'logs')   renderSecLogs(el);
  if (tab === 'access') renderSecAccess(el);
  if (tab === 'recon')  renderSecRecon(el);
}

// ── USERS TAB ──
function renderSecUsers(el) {
  const ROLE_ICON = { owner:'👑', manager:'⭐', cashier:'🧾' };
  el.innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:10px">Store Users</div>
      ${users.map(u => {
        if (!u.permissions) u.permissions = defaultPermissions(false);
        const permCount = Object.values(u.permissions).filter(Boolean).length;
        const total     = Object.keys(PERM_DEFAULTS).length;
        return `
        <div class="sec-user-row" onclick="openPermEditor(${u.id})">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:38px;height:38px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-family:'Fredoka One',sans-serif;font-size:16px;color:var(--bg);flex-shrink:0">${u.name[0]}</div>
            <div>
              <div style="font-weight:700;font-size:14px">${u.name} ${ROLE_ICON[u.role||'cashier']||''}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${u.role||'cashier'} · ${permCount}/${total} permissions · ${u.pin?'🔐 PIN set':'🔓 No PIN'}</div>
            </div>
          </div>
          <div style="color:var(--accent);font-size:18px">›</div>
        </div>`;
      }).join('')}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:14px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:10px">Store Settings</div>
      <div class="sec-user-row" onclick="openStoreNoteModal()">
        <div><div style="font-weight:600;font-size:13px">📌 Store Note</div><div style="font-size:11px;color:var(--text-dim);margin-top:2px">${settings.devNote ? '"'+settings.devNote.slice(0,40)+(settings.devNote.length>40?'…':'')+'"' : 'Not set — shows warm greeting on login'}</div></div>
        <div style="color:var(--accent);font-size:18px">›</div>
      </div>
      <div class="sec-user-row" onclick="toggleUnsecureMode()">
        <div><div style="font-weight:600;font-size:13px">🔓 Unsecure Mode</div><div style="font-size:11px;color:var(--text-dim);margin-top:2px">Skip login screen (solo operators only)</div></div>
        <div class="toggle-switch ${settings.unsecureMode?'on':''}" id="unsecureToggleAdmin" style="flex-shrink:0" onclick="event.stopPropagation();toggleUnsecureMode()"><div class="toggle-knob"></div></div>
      </div>
    </div>
  `;
}

function openStoreNoteModal() {
  document.getElementById('devNoteInput').value = settings.devNote || '';
  openModal('storeNoteModal');
}

// ── LOGS TAB ──
let _logsFilter = 'all';
let _logsSearch = '';

function renderSecLogs(el) {
  const ICONS = { sale:'💰', restock:'📦', login:'🔐', logout:'🚪', settings:'⚙️',
                  product:'📝', customer:'👤', batch:'🏁', utang:'📒', alert:'⚠️',
                  delete:'🗑️', access:'🔑' };
  const TYPES = ['all','sale','restock','login','batch','alert','delete','access','settings'];

  const logs = [...activityLog].reverse();
  const counts = {};
  TYPES.forEach(t => counts[t] = t === 'all' ? logs.length : logs.filter(l=>l.type===t).length);

  const filtered = logs
    .filter(l => _logsFilter === 'all' || l.type === _logsFilter)
    .filter(l => !_logsSearch || l.detail.toLowerCase().includes(_logsSearch) || (l.user||'').toLowerCase().includes(_logsSearch));

  el.innerHTML = `
    <div style="margin-bottom:10px">
      <input type="search" class="search-input" placeholder="🔍 Search logs…" value="${_logsSearch}"
        oninput="_logsSearch=this.value.toLowerCase();renderSecLogs(document.getElementById('secContent'))"
        style="width:100%;box-sizing:border-box;margin-bottom:10px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${TYPES.map(f => `
          <div onclick="_logsFilter='${f}';renderSecLogs(document.getElementById('secContent'))"
            style="padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid var(--border);
            background:${_logsFilter===f?'var(--accent)':'transparent'};color:${_logsFilter===f?'var(--bg)':'var(--text-dim)'}">
            ${ICONS[f]||''} ${f==='all'?`All (${counts.all})`:f+' ('+counts[f]+')'}
          </div>`).join('')}
      </div>
    </div>
    ${!filtered.length ? `<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:40px 0">No matching logs</div>` :
      filtered.slice(0,300).map((l,i) => {
        const extra = l.amount ? `₱${Number(l.amount).toFixed(2)}` : l.approver ? `Approver: ${l.approver}` : l.qty ? `Qty: ${l.qty}` : '';
        return `
        <div class="sec-log-row" onclick="this.classList.toggle('expanded')" id="logrow_${i}">
          <div class="sec-log-icon">${ICONS[l.type]||'📌'}</div>
          <div style="flex:1;min-width:0">
            <div class="sec-log-detail">${l.detail}</div>
            <div class="sec-log-meta">${l.user} · ${new Date(l.date).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
            ${extra||Object.keys(l).filter(k=>!['id','type','detail','user','date'].includes(k)&&l[k]).length ? `
              <div class="sec-log-extra">
                ${extra ? `<div>${extra}</div>` : ''}
                ${Object.entries(l).filter(([k])=>!['id','type','detail','user','date','amount'].includes(k)&&l[k]).map(([k,v])=>`<div><span style="color:var(--text-dim)">${k}:</span> ${v}</div>`).join('')}
              </div>` : ''}
          </div>
        </div>`;
      }).join('')
    }
    <div style="font-size:11px;color:var(--text-dim);text-align:center;padding:16px 0">
      Showing ${Math.min(filtered.length,300)} of ${filtered.length} entries · Max stored: 500
    </div>
    <button class="btn btn-ghost" onclick="exportLogsCSV()" style="width:100%;margin-top:4px">⬇ Export Logs CSV</button>
  `;
}

function exportLogsCSV() {
  const rows = [['Date','Type','User','Detail']];
  [...activityLog].reverse().forEach(l =>
    rows.push([new Date(l.date).toLocaleString('en-PH'), l.type, l.user||'', (l.detail||'').replace(/,/g,' ')])
  );
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `sari2pos-logs-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ── ACCESS TAB — just gate attempts (granted + denied) ──
function renderSecAccess(el) {
  const accessLogs = [...activityLog].reverse().filter(l => l.type === 'access');
  if (!accessLogs.length) {
    el.innerHTML = `<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:60px 0">No access attempts logged yet.<br>Gate attempts appear here automatically.</div>`;
    return;
  }
  const denied  = accessLogs.filter(l => l.granted === false).length;
  const granted = accessLogs.filter(l => l.granted === true).length;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:rgba(39,174,96,.1);border:1px solid rgba(39,174,96,.2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-family:'Fredoka One',sans-serif;font-size:22px;color:var(--green)">${granted}</div>
        <div style="font-size:11px;color:var(--text-dim)">Approved</div>
      </div>
      <div style="background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-family:'Fredoka One',sans-serif;font-size:22px;color:var(--red)">${denied}</div>
        <div style="font-size:11px;color:var(--text-dim)">Denied</div>
      </div>
    </div>
    ${accessLogs.slice(0,200).map(l => {
      const isGrant = l.granted !== false;
      return `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:20px;flex-shrink:0">${isGrant ? '✅' : '⛔'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;line-height:1.4">${l.detail}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px">
            ${new Date(l.date).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            ${l.requestedBy && l.requestedBy !== l.by ? ` · Requested by ${l.requestedBy}` : ''}
          </div>
        </div>
        <div style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;flex-shrink:0;
          background:${isGrant?'rgba(39,174,96,.15)':'rgba(231,76,60,.15)'};
          color:${isGrant?'var(--green)':'var(--red)'}">
          ${isGrant ? 'OK' : 'DENIED'}
        </div>
      </div>`;
    }).join('')}
  `;
}

// ── RECONCILIATION TAB ──
function renderSecRecon(el) {
  const recs = batchHistory.filter(b => b.declaredCash !== null && b.declaredCash !== undefined);
  if (!recs.length) {
    el.innerHTML = `<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:60px 0">No reconciliation records yet.<br>Enter declared cash during Batchout to see records here.</div>`;
    return;
  }
  el.innerHTML = [...recs].reverse().map(b => {
    const v = b.drawerVariance ?? 0;
    const varCol   = Math.abs(v)<1 ? 'var(--green)' : v<0 ? 'var(--red)' : 'var(--accent)';
    const varLabel = Math.abs(v)<1 ? '✅ Balanced' : (v>0?'+':'')+`₱${v.toFixed(2)} variance`;
    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-family:'Fredoka One',sans-serif;font-size:15px">${b.date}</div>
        <div style="font-size:12px;font-weight:700;color:${varCol}">${varLabel}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:12px">
        <span style="color:var(--text-dim)">Expected</span><span style="font-family:'JetBrains Mono',monospace">₱${(b.expectedCash||0).toFixed(2)}</span>
        <span style="color:var(--text-dim)">Declared</span><span style="font-family:'JetBrains Mono',monospace">₱${(b.declaredCash||0).toFixed(2)}</span>
        <span style="color:var(--text-dim)">Total Sales</span><span style="font-family:'JetBrains Mono',monospace">₱${b.total.toFixed(2)}</span>
        <span style="color:var(--text-dim)">Closed by</span><span>${b.user}</span>
      </div>
    </div>`;
  }).join('');
}

function renderReconciliationHistory() { renderSecRecon(document.getElementById('secContent')); }
function renderLogsPanel(f='') { if(f) _logsFilter=f; renderSecLogs(document.getElementById('secContent')); }

// ── PERMISSION EDITOR (slides in as a sub-panel) ──
function openPermEditor(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  _editingPermUserId = userId;
  if (!user.permissions) user.permissions = defaultPermissions(false);

  document.getElementById('permEditorTitle').textContent = `${user.name}'s Permissions`;

  // Role buttons
  document.querySelectorAll('#permEditorPanel .role-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === (user.role || 'cashier'));
  });

  const groups = {};
  Object.entries(PERM_LABELS).forEach(([key, meta]) => {
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push({ key, ...meta });
  });

  document.getElementById('permEditorBody').innerHTML =
    Object.entries(groups).map(([g, items]) => `
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin:14px 0 6px">${g}</div>
      ${items.map(({ key, label, icon, desc }) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:13px">${icon} ${label}</div>
            ${desc ? `<div style="font-size:10px;color:var(--text-dim);margin-top:1px">${desc}</div>` : ''}
          </div>
          <div class="toggle-switch ${user.permissions[key]?'on':''}" data-key="${key}" onclick="this.classList.toggle('on')">
            <div class="toggle-knob"></div>
          </div>
        </div>`).join('')}
    `).join('');

  document.getElementById('permEditorPanel').classList.add('open');
}

function setRolePreset(btn, role) {
  document.querySelectorAll('#permEditorPanel .role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Apply preset permissions
  const presets = {
    owner:   Object.fromEntries(Object.keys(PERM_DEFAULTS).map(k => [k, true])),
    manager: { ...PERM_DEFAULTS, addProduct:true, deleteProduct:true, batchout:true, reports:true, logs:true, reconciliation:true, adminSettings:false },
    cashier: { ...PERM_DEFAULTS, addProduct:false, deleteProduct:false, logs:false, reconciliation:false, adminSettings:false },
  };
  const preset = presets[role] || PERM_DEFAULTS;
  document.querySelectorAll('#permEditorBody .toggle-switch').forEach(tog => {
    const key = tog.dataset.key;
    if (key) tog.classList.toggle('on', !!preset[key]);
  });
  document.getElementById('rolePresetHint').textContent = `Preset applied for ${role}. Adjust as needed.`;
}

function saveUserPerms() {
  const user = users.find(u => u.id === _editingPermUserId);
  if (!user) return;
  // Role from active button
  const roleBtn = document.querySelector('#permEditorPanel .role-btn.active');
  if (roleBtn) user.role = roleBtn.dataset.role;
  // Permissions from toggles
  document.querySelectorAll('#permEditorBody .toggle-switch[data-key]').forEach(tog => {
    user.permissions[tog.dataset.key] = tog.classList.contains('on');
  });
  user.permissions.pos = true; // POS always on
  save();
  addLog('settings', `Permissions updated for ${user.name} by ${activeUser?.name}`, { userId: user.id, role: user.role });
  closePanel('permEditor');
  // Refresh users tab
  renderSecUsers(document.getElementById('secContent'));
  showToast(`${user.name}'s permissions saved ✅`, 'success');
}

// ── MODALS ──
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ── ADD USER ──
function createUser() {
  const name = document.getElementById('newUserName').value.trim();
  const pin = document.getElementById('newUserPin').value;
  const pin2 = document.getElementById('newUserPin2').value;
  if (!name) { showToast(t('enterName'), 'error'); return; }
  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) { showToast(t('pinLength'), 'error'); return; }
  if (pin !== pin2) { showToast(t('pinMismatch'), 'error'); return; }
  users.push({ id: uid(), name, pin, isDefault: false, role: 'cashier', permissions: defaultPermissions(false) });
  save();
  closeModal('addUserModal');
  document.getElementById('newUserName').value = '';
  document.getElementById('newUserPin').value = '';
  document.getElementById('newUserPin2').value = '';
  renderUserGrid();
  showToast(t('userCreated').replace('{name}', name), 'success');
}

// ── TOAST ──
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast', 2200);
}

// ── NAV ──
// navTo() was dead code — nav buttons call openPanel() directly.
// Kept as empty stub to avoid any legacy references breaking.
function navTo(page, btn) {}

// ── INIT ──
document.getElementById('topbarTime').textContent = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
