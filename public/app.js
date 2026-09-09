/**
 * SubTracker Pro - Frontend con Login, Cuentas Privadas y Lista de Amigos
 * Gestión de suscripciones, fechas de corte, división de gastos y cobros.
 */

// Estado global de la aplicación
const state = {
  user: null,
  token: sessionStorage.getItem('subtracker_token') || localStorage.getItem('subtracker_token') || '',
  subscriptions: [],
  friends: [],
  friendBalances: [],
  stats: null,
  settings: null,
  currency: '$',
  baseCurrencyCode: 'USD',
  chartMode: 'annual', // 'annual' | 'monthly'
  viewMode: 'grid',    // 'grid' | 'table'
  currentTab: 'dashboard', // 'dashboard' | 'payments' | 'friends'
  categoryChart: null,
  topChart: null,
  editingId: null,
  editingFriendId: null,
  authMode: 'login', // 'login' | 'register'
  calendar: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    selectedDateStr: null
  }
};

const CURRENCY_SYMBOLS = {
  'USD': '$',
  'DOP': 'RD$',
  'EUR': '€',
  'MXN': 'MX$',
  'ARS': 'AR$',
  'CLP': 'CLP$',
  'COP': 'COL$',
  'GBP': '£'
};

const CYCLE_LABELS = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  biannual: 'Semestral',
  annual: 'Anual'
};

const CATEGORY_COLORS = {
  'Streaming': '#E50914',
  'Software': '#6366F1',
  'Servicios': '#F59E0B',
  'Salud & Fitness': '#10B981',
  'Educación': '#06B6D4',
  'Gaming': '#EC4899',
  'Otros': '#8B5CF6'
};

function convertCurrency(amount, fromCurr, toCurr) {
  if (!amount || isNaN(amount)) return 0;
  fromCurr = fromCurr || 'USD';
  toCurr = toCurr || state.baseCurrencyCode || 'USD';
  if (fromCurr === toCurr) return amount;

  const rates = state.settings?.exchange_rates || {
    'USD': 1.0, 'DOP': 60.0, 'EUR': 0.92, 'MXN': 19.5, 'ARS': 980.0, 'CLP': 920.0, 'COP': 4100.0, 'GBP': 0.78
  };

  const rateFrom = rates[fromCurr] || 1.0;
  const rateTo = rates[toCurr] || 1.0;

  if (rateFrom <= 0) return amount;
  const inUsd = amount / rateFrom;
  return inUsd * rateTo;
}

// ================= INICIALIZACIÓN =================
document.addEventListener('DOMContentLoaded', async () => {
  initPWA();
  initIcons();
  initEventListeners();
  await checkAuth();
  if (state.user) {
    await loadAllData();
  }
});

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW error:', err));
    });
  }
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  return headers;
}

// ================= AUTENTICACIÓN =================
async function checkAuth() {
  state.token = sessionStorage.getItem('subtracker_token') || localStorage.getItem('subtracker_token') || '';
  if (!state.token) {
    state.user = null;
    renderUserProfile();
    openAuthModal('login');
    return;
  }
  try {
    const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
    const result = await res.json();
    if (result.success && result.user) {
      state.user = result.user;
    } else {
      state.user = null;
      state.token = '';
      localStorage.removeItem('subtracker_token');
      sessionStorage.removeItem('subtracker_token');
    }
  } catch (err) {
    console.error('Error comprobando sesión:', err);
    state.user = null;
  } finally {
    renderUserProfile();
    if (!state.user) {
      openAuthModal('login');
    }
  }
}

function renderUserProfile() {
  const badge = document.getElementById('userAvatarBadge');
  const dispName = document.getElementById('userDisplayNameText');
  const uName = document.getElementById('userUsernameText');
  const loggedInMenu = document.getElementById('userLoggedInMenu');
  const openLoginBtn = document.getElementById('btnOpenLoginModal');

  // Campos en Ajustes
  const settingsUserCard = document.getElementById('settingsUserCard');
  const settingsAvatar = document.getElementById('settingsUserAvatar');
  const settingsDispName = document.getElementById('settingsUserDisplayName');
  const settingsUName = document.getElementById('settingsUserUsername');

  // Campos en Modal de Perfil
  const modalAvatar = document.getElementById('modalProfileAvatar');
  const modalDispName = document.getElementById('modalProfileDisplayName');
  const modalUName = document.getElementById('modalProfileUsername');
  const modalEmail = document.getElementById('modalProfileEmail');

  if (state.user) {
    loggedInMenu?.classList.remove('hidden');
    openLoginBtn?.classList.add('hidden');
    settingsUserCard?.classList.remove('hidden');

    const initial = (state.user.display_name || state.user.username || 'A').charAt(0).toUpperCase();
    const bgColor = state.user.avatar_color || '#4F46E5';

    if (badge) {
      badge.textContent = initial;
      badge.style.backgroundColor = bgColor;
    }
    if (dispName) dispName.textContent = state.user.display_name || state.user.username;
    if (uName) uName.textContent = `@${state.user.username}`;

    if (settingsAvatar) {
      settingsAvatar.textContent = initial;
      settingsAvatar.style.backgroundColor = bgColor;
    }
    if (settingsDispName) settingsDispName.textContent = state.user.display_name || state.user.username;
    if (settingsUName) settingsUName.textContent = `@${state.user.username}`;

    if (modalAvatar) {
      modalAvatar.textContent = initial;
      modalAvatar.style.backgroundColor = bgColor;
    }
    if (modalDispName) modalDispName.textContent = state.user.display_name || state.user.username;
    if (modalUName) modalUName.textContent = `@${state.user.username}`;
    if (modalEmail) modalEmail.textContent = state.user.email || 'Sin correo registrado';
  } else {
    loggedInMenu?.classList.add('hidden');
    openLoginBtn?.classList.remove('hidden');
    settingsUserCard?.classList.add('hidden');
  }

  initIcons();
}

function openAuthModal(mode = 'login') {
  state.authMode = mode;
  const modal = document.getElementById('authModal');
  const title = document.getElementById('authModalTitle');
  const subtitle = document.getElementById('authModalSubtitle');
  const tabLogin = document.getElementById('tabAuthLogin');
  const tabReg = document.getElementById('tabAuthRegister');
  const extraFields = document.getElementById('authRegisterExtraFields');
  const rememberContainer = document.getElementById('authRememberContainer');
  const submitBtn = document.getElementById('btnSubmitAuth');
  const closeBtn = document.getElementById('btnCloseAuthModal');

  if (mode === 'login') {
    if (title) title.textContent = 'Iniciar Sesión';
    if (subtitle) subtitle.textContent = 'Identifícate para entrar a tu panel';
    if (tabLogin) tabLogin.className = 'py-2 rounded-lg bg-indigo-600 text-white transition';
    if (tabReg) tabReg.className = 'py-2 rounded-lg text-slate-400 hover:text-white transition';
    extraFields?.classList.add('hidden');
    rememberContainer?.classList.remove('hidden');
    if (submitBtn) submitBtn.textContent = 'Entrar a mi Cuenta';
  } else {
    if (title) title.textContent = 'Crear Nueva Cuenta';
    if (subtitle) subtitle.textContent = 'Crea tu espacio personal y privado';
    if (tabReg) tabReg.className = 'py-2 rounded-lg bg-indigo-600 text-white transition';
    if (tabLogin) tabLogin.className = 'py-2 rounded-lg text-slate-400 hover:text-white transition';
    extraFields?.classList.remove('hidden');
    rememberContainer?.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'Registrarme';
  }

  // Si no está autenticado, no permitir cerrar el modal
  if (closeBtn) {
    if (!state.user) {
      closeBtn.classList.add('hidden');
    } else {
      closeBtn.classList.remove('hidden');
    }
  }

  modal?.classList.remove('hidden');
  initIcons();
}

function closeAuthModal() {
  if (!state.user) {
    showToast('Debes iniciar sesión o registrarte para acceder a SubTracker', 'info');
    return;
  }
  document.getElementById('authModal')?.classList.add('hidden');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const rememberMe = document.getElementById('authRememberMe')?.checked || false;

  if (state.authMode === 'login') {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await res.json();
      if (result.success) {
        state.token = result.token;
        state.user = result.user;

        if (rememberMe) {
          localStorage.setItem('subtracker_token', result.token);
          sessionStorage.removeItem('subtracker_token');
        } else {
          sessionStorage.setItem('subtracker_token', result.token);
          localStorage.removeItem('subtracker_token');
        }

        showToast(`¡Bienvenido de nuevo, ${state.user.display_name}!`, 'success');
        document.getElementById('authModal')?.classList.add('hidden');
        renderUserProfile();
        await loadAllData();
      } else {
        showToast(result.error || 'Credenciales inválidas', 'error');
      }
    } catch (err) {
      showToast('Error al conectar con el servidor', 'error');
    }
  } else {
    const displayName = document.getElementById('authDisplayName').value.trim();
    const email = document.getElementById('authEmail').value.trim();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, display_name: displayName, email })
      });
      const result = await res.json();
      if (result.success) {
        state.token = result.token;
        state.user = result.user;

        if (rememberMe) {
          localStorage.setItem('subtracker_token', result.token);
          sessionStorage.removeItem('subtracker_token');
        } else {
          sessionStorage.setItem('subtracker_token', result.token);
          localStorage.removeItem('subtracker_token');
        }

        showToast(`¡Cuenta creada con éxito!`, 'success');
        document.getElementById('authModal')?.classList.add('hidden');
        renderUserProfile();
        await loadAllData();
      } else {
        showToast(result.error || 'Error al registrar', 'error');
      }
    } catch (err) {
      showToast('Error al registrar usuario', 'error');
    }
  }
}

async function handleLogout() {
  if (!confirm('¿Deseas cerrar tu sesión actual?')) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
  } catch (e) {}
  state.token = '';
  state.user = null;
  localStorage.removeItem('subtracker_token');
  sessionStorage.removeItem('subtracker_token');

  // Limpiar modales abiertos
  document.getElementById('profileModal')?.classList.add('hidden');
  document.getElementById('settingsModal')?.classList.add('hidden');

  // Vaciar datos en memoria y re-renderizar interfaz limpia
  state.subscriptions = [];
  state.friends = [];
  state.friendBalances = [];
  state.stats = null;

  renderUserProfile();
  renderSubscriptions();
  renderFriends();
  renderKPIs();

  showToast('Has cerrado sesión exitosamente', 'info');
  openAuthModal('login');
}

// ================= EVENT LISTENERS =================
function initEventListeners() {
  // Tabs principales
  document.getElementById('tabBtnDashboard')?.addEventListener('click', () => switchTab('dashboard'));
  document.getElementById('tabBtnCalendar')?.addEventListener('click', () => switchTab('calendar'));
  document.getElementById('tabBtnPayments')?.addEventListener('click', () => switchTab('payments'));
  document.getElementById('tabBtnFriends')?.addEventListener('click', () => switchTab('friends'));

  // Navegación de Calendario
  document.getElementById('btnPrevMonth')?.addEventListener('click', () => changeCalendarMonth(-1));
  document.getElementById('btnNextMonth')?.addEventListener('click', () => changeCalendarMonth(1));
  document.getElementById('btnTodayMonth')?.addEventListener('click', () => resetCalendarToToday());

  // Auth UI & Logout
  document.getElementById('btnOpenLoginModal')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btnCloseAuthModal')?.addEventListener('click', closeAuthModal);
  document.getElementById('tabAuthLogin')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('tabAuthRegister')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('authForm')?.addEventListener('submit', handleAuthSubmit);

  // Botones de Cerrar Sesión (Navbar, Ajustes, Modal de Perfil)
  document.getElementById('btnLogout')?.addEventListener('click', handleLogout);
  document.getElementById('btnLogoutSettings')?.addEventListener('click', handleLogout);
  document.getElementById('btnLogoutFromProfileModal')?.addEventListener('click', handleLogout);

  // Modal de Perfil de Usuario
  document.getElementById('btnOpenProfileModal')?.addEventListener('click', () => {
    document.getElementById('profileModal')?.classList.remove('hidden');
    initIcons();
  });
  document.getElementById('btnCloseProfileModal')?.addEventListener('click', () => {
    document.getElementById('profileModal')?.classList.add('hidden');
  });
  document.getElementById('btnCancelProfileModal')?.addEventListener('click', () => {
    document.getElementById('profileModal')?.classList.add('hidden');
  });

  // Amigos
  document.getElementById('btnOpenAddFriendModal')?.addEventListener('click', () => openFriendModal());
  document.getElementById('btnOpenAddFriendModal2')?.addEventListener('click', () => openFriendModal());
  document.getElementById('btnCloseFriendModal')?.addEventListener('click', closeFriendModal);
  document.getElementById('btnCancelFriendModal')?.addEventListener('click', closeFriendModal);
  document.getElementById('friendForm')?.addEventListener('submit', handleFriendSubmit);

  // Notificaciones
  document.getElementById('btnEnableNotifications')?.addEventListener('click', requestNotificationPermission);

  // Filtros
  document.getElementById('searchInput')?.addEventListener('input', debounce(() => loadSubscriptions(), 250));
  document.getElementById('categoryFilter')?.addEventListener('change', () => loadSubscriptions());
  document.getElementById('statusFilter')?.addEventListener('change', () => loadSubscriptions());
  document.getElementById('sortBy')?.addEventListener('change', () => loadSubscriptions());

  // Vistas
  document.getElementById('viewModeGrid')?.addEventListener('click', () => setViewMode('grid'));
  document.getElementById('viewModeTable')?.addEventListener('click', () => setViewMode('table'));

  // Gráfica
  document.getElementById('btnChartModeAnnual')?.addEventListener('click', () => setChartMode('annual'));
  document.getElementById('btnChartModeMonthly')?.addEventListener('click', () => setChartMode('monthly'));

  // Modales
  document.getElementById('btnOpenAddModal')?.addEventListener('click', () => openModal());
  document.getElementById('btnEmptyAdd')?.addEventListener('click', () => openModal());
  document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
  document.getElementById('btnCancelModal')?.addEventListener('click', closeModal);
  document.getElementById('subscriptionForm')?.addEventListener('submit', handleFormSubmit);

  // Checkboxes de Formulario
  document.getElementById('subIsTrial')?.addEventListener('change', (e) => {
    document.getElementById('trialFieldsContainer')?.classList.toggle('hidden', !e.target.checked);
  });

  document.getElementById('subIsShared')?.addEventListener('change', (e) => {
    document.getElementById('sharedFieldsContainer')?.classList.toggle('hidden', !e.target.checked);
    updateModalLiveCalculation();
  });

  document.getElementById('subSharedCount')?.addEventListener('input', () => {
    const price = parseFloat(document.getElementById('subPrice')?.value) || 0;
    const count = parseInt(document.getElementById('subSharedCount')?.value) || 1;
    const myShare = document.getElementById('subMySharePrice');
    if (myShare && count > 1) {
      myShare.value = (price / count).toFixed(2);
    }
    updateModalLiveCalculation();
  });

  // Cálculo en vivo
  document.getElementById('subPrice')?.addEventListener('input', updateModalLiveCalculation);
  document.getElementById('subCurrency')?.addEventListener('change', updateModalLiveCalculation);
  document.getElementById('subBillingCycle')?.addEventListener('change', updateModalLiveCalculation);
  document.getElementById('subMySharePrice')?.addEventListener('input', updateModalLiveCalculation);

  // Plantillas
  document.querySelectorAll('.tpl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('subName').value = btn.dataset.name;
      document.getElementById('subPrice').value = btn.dataset.price;
      document.getElementById('subBillingCycle').value = btn.dataset.cycle;
      document.getElementById('subCategory').value = btn.dataset.cat;
      document.getElementById('subCurrency').value = btn.dataset.currency || 'USD';
      document.getElementById('subColor').value = btn.dataset.color || '#4F46E5';
      updateModalLiveCalculation();
    });
  });

  // Ajustes
  document.getElementById('btnOpenSettingsModal')?.addEventListener('click', openSettingsModal);
  document.getElementById('btnQuickEditBudget')?.addEventListener('click', openSettingsModal);
  document.getElementById('btnCloseSettingsModal')?.addEventListener('click', closeSettingsModal);
  document.getElementById('btnCancelSettings')?.addEventListener('click', closeSettingsModal);
  document.getElementById('settingsForm')?.addEventListener('submit', handleSettingsSubmit);
  document.getElementById('btnTestWebhook')?.addEventListener('click', testWebhook);

  // Pagos Manuales
  document.getElementById('btnOpenManualPaymentModal')?.addEventListener('click', openManualPaymentModal);
  document.getElementById('btnClosePaymentModal')?.addEventListener('click', closePaymentModal);
  document.getElementById('btnCancelPaymentModal')?.addEventListener('click', closePaymentModal);
  document.getElementById('paymentForm')?.addEventListener('submit', handlePaymentSubmit);

  // Respaldos
  document.getElementById('btnOpenBackupModal')?.addEventListener('click', openBackupModal);
  document.getElementById('btnCloseBackupModal')?.addEventListener('click', closeBackupModal);
  document.getElementById('btnExportJson')?.addEventListener('click', exportJson);
  document.getElementById('btnExportCsv')?.addEventListener('click', exportCsv);
  document.getElementById('importFileInput')?.addEventListener('change', handleImportJson);
  document.getElementById('btnResetDemo')?.addEventListener('click', resetDemoData);
}

// ================= CARGA DE DATOS =================
async function loadAllData() {
  await Promise.all([loadSettings(), loadStats(), loadSubscriptions(), loadPayments(), loadFriends()]);
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings', { headers: getAuthHeaders() });
    const result = await res.json();
    if (result.success) {
      state.settings = result.data;
      state.baseCurrencyCode = result.data.base_currency || 'USD';
      state.currency = CURRENCY_SYMBOLS[state.baseCurrencyCode] || '$';
      const navBadge = document.getElementById('navBaseCurrencyBadge');
      if (navBadge) navBadge.textContent = `${state.baseCurrencyCode} (${state.currency})`;
    }
  } catch (err) {
    console.error('Error cargando ajustes:', err);
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats', { headers: getAuthHeaders() });
    const result = await res.json();
    if (result.success) {
      state.stats = result.data;
      renderKPIs();
      renderBudgetBar();
      renderTrialAlerts();
      renderUpcomingAlerts();
      renderCharts();
    }
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

async function loadSubscriptions() {
  try {
    const search = document.getElementById('searchInput')?.value.trim() || '';
    const category = document.getElementById('categoryFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    const sort_by = document.getElementById('sortBy')?.value || 'date_asc';

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category !== 'all') params.append('category', category);
    if (status === 'trials' || status === 'shared') {
      params.append('status', 'all');
    } else if (status !== 'all') {
      params.append('status', status);
    }
    if (sort_by) params.append('sort_by', sort_by);

    const res = await fetch(`/api/subscriptions?${params.toString()}`, { headers: getAuthHeaders() });
    const result = await res.json();
    if (result.success) {
      let data = result.data;
      if (status === 'trials') data = data.filter(s => s.is_trial);
      else if (status === 'shared') data = data.filter(s => s.is_shared);
      state.subscriptions = data;
      renderSubscriptions();
      updateCalendarBadge();
      if (state.currentTab === 'calendar') {
        renderCalendar();
      }
    }
  } catch (err) {
    console.error('Error cargando suscripciones:', err);
  }
}

async function loadPayments() {
  try {
    const res = await fetch('/api/payments?limit=50', { headers: getAuthHeaders() });
    const result = await res.json();
    if (result.success) {
      renderPaymentHistory(result.data);
    }
  } catch (err) {
    console.error('Error cargando pagos:', err);
  }
}

async function loadFriends() {
  try {
    const [resFriends, resBalances] = await Promise.all([
      fetch('/api/friends', { headers: getAuthHeaders() }),
      fetch('/api/friends/balances', { headers: getAuthHeaders() })
    ]);
    const friendsData = await resFriends.json();
    const balancesData = await resBalances.json();

    if (friendsData.success) {
      state.friends = friendsData.data;
      renderFriendsList();
      const badge = document.getElementById('friendsBadgeCount');
      if (badge) badge.textContent = state.friends.length;
    }
    if (balancesData.success) {
      state.friendBalances = balancesData.data;
      renderFriendBalances();
    }
  } catch (err) {
    console.error('Error cargando amigos:', err);
  }
}

// ================= GESTIÓN Y RENDERIZADO DE AMIGOS =================
function renderFriendsList() {
  const grid = document.getElementById('friendsListGrid');
  if (!grid) return;

  if (state.friends.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-500 text-xs">
        No tienes amigos agregados aún. Agrega amigos para vincularlos a planes familiares o suscripciones compartidas.
      </div>
    `;
    return;
  }

  grid.innerHTML = state.friends.map(f => `
    <div class="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow" style="background-color: ${f.avatar_color || '#10B981'}">
          ${escapeHtml(f.name.charAt(0).toUpperCase())}
        </div>
        <div>
          <h4 class="text-xs font-bold text-white">${escapeHtml(f.name)}</h4>
          <div class="text-[11px] text-slate-400">${escapeHtml(f.phone || f.email || 'Sin contacto')}</div>
          ${f.notes ? `<div class="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-[130px]">${escapeHtml(f.notes)}</div>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-1 text-slate-400">
        <button onclick="editFriend(${f.id})" title="Editar" class="p-1 hover:text-white rounded"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
        <button onclick="deleteFriend(${f.id}, '${escapeHtml(f.name)}')" title="Eliminar" class="p-1 hover:text-red-400 rounded"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
      </div>
    </div>
  `).join('');

  initIcons();
}

function renderFriendBalances() {
  const container = document.getElementById('friendsBalancesContainer');
  const totalElem = document.getElementById('friendsTotalOwed');
  if (!container) return;

  const balances = state.friendBalances || [];
  let grandTotalOwed = 0;

  if (balances.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-500 text-xs">
        Ningún amigo tiene suscripciones compartidas asignadas aún.
      </div>
    `;
    if (totalElem) totalElem.textContent = `${state.currency}0.00`;
    return;
  }

  container.innerHTML = balances.map(b => {
    grandTotalOwed += b.monthly_total_owed;
    const f = b.friend;
    const subsList = b.shared_subscriptions;

    let subsBadgesHtml = subsList.map(s => {
      const isDiff = s.currency && s.currency !== state.baseCurrencyCode;
      const shareConv = s.friend_share_converted !== undefined ? s.friend_share_converted : convertCurrency(s.friend_share, s.currency, state.baseCurrencyCode);
      const shareText = isDiff
        ? `${state.currency}${formatNumber(shareConv)}/m <span class="text-[10px] text-slate-400 font-normal">(${CURRENCY_SYMBOLS[s.currency] || s.currency}${formatNumber(s.friend_share)})</span>`
        : `${state.currency}${formatNumber(s.friend_share)}/mes`;
      return `
      <div class="flex items-center justify-between text-[11px] bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
        <span class="text-slate-300 font-medium">${escapeHtml(s.name)}</span>
        <span class="font-mono font-bold text-emerald-400">${shareText}</span>
      </div>
    `;
    }).join('');

    // Mensaje preconfigurado para WhatsApp
    const subNames = subsList.map(s => s.name).join(', ');
    const waText = encodeURIComponent(`Hola ${f.name}, te escribo para recordarte tu parte de ${subNames} de este mes por ${state.currency}${formatNumber(b.monthly_total_owed)}. ¡Gracias!`);
    const waUrl = f.phone ? `https://wa.me/${f.phone.replace(/[^0-9]/g, '')}?text=${waText}` : `https://wa.me/?text=${waText}`;

    return `
      <div class="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
        <div>
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow" style="background-color: ${f.avatar_color || '#10B981'}">
                ${f.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 class="text-xs font-bold text-white">${escapeHtml(f.name)}</h4>
                <span class="text-[10px] text-slate-400">${subsList.length} ${subsList.length === 1 ? 'servicio compartido' : 'servicios compartidos'}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Cuota mensual</span>
              <span class="text-sm font-extrabold text-emerald-400 font-mono">${state.currency}${formatNumber(b.monthly_total_owed)}</span>
            </div>
          </div>

          <div class="mt-3 space-y-1.5">
            ${subsBadgesHtml || '<span class="text-[11px] text-slate-500">Sin servicios activos</span>'}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800 flex items-center gap-2">
          <a href="${waUrl}" target="_blank" rel="noopener" class="flex-1 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition">
            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
            <span>Cobrar WhatsApp</span>
          </a>
          <button onclick="recordFriendPaymentPrompt(${f.id}, '${escapeHtml(f.name)}', ${b.monthly_total_owed})" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition" title="Registrar que ya te pagó este mes">
            <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i>
            <span>Saldado</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (totalElem) {
    totalElem.textContent = `${state.currency}${formatNumber(grandTotalOwed)}`;
  }

  initIcons();
}

function openFriendModal(friend = null) {
  state.editingFriendId = friend ? friend.id : null;
  const modal = document.getElementById('friendModal');
  const title = document.getElementById('friendModalTitle');
  const form = document.getElementById('friendForm');
  form.reset();

  if (friend) {
    title.innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-emerald-400"></i> Editar Amigo`;
    document.getElementById('friendId').value = friend.id;
    document.getElementById('friendName').value = friend.name;
    document.getElementById('friendPhone').value = friend.phone || '';
    document.getElementById('friendEmail').value = friend.email || '';
    document.getElementById('friendAvatarColor').value = friend.avatar_color || '#10B981';
    document.getElementById('friendNotes').value = friend.notes || '';
  } else {
    title.innerHTML = `<i data-lucide="user-plus" class="w-5 h-5 text-emerald-400"></i> Agregar Amigo`;
    document.getElementById('friendId').value = '';
    document.getElementById('friendAvatarColor').value = '#10B981';
  }

  modal?.classList.remove('hidden');
  initIcons();
}

function closeFriendModal() {
  document.getElementById('friendModal')?.classList.add('hidden');
  state.editingFriendId = null;
}

async function handleFriendSubmit(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('friendName').value.trim(),
    phone: document.getElementById('friendPhone').value.trim(),
    email: document.getElementById('friendEmail').value.trim(),
    avatar_color: document.getElementById('friendAvatarColor').value,
    notes: document.getElementById('friendNotes').value.trim()
  };

  try {
    let res;
    if (state.editingFriendId) {
      res = await fetch(`/api/friends/${state.editingFriendId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch('/api/friends', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
    }
    const result = await res.json();
    if (result.success) {
      showToast(state.editingFriendId ? 'Amigo actualizado' : 'Amigo agregado con éxito', 'success');
      closeFriendModal();
      await loadFriends();
    } else {
      showToast(result.error || 'Error al guardar amigo', 'error');
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

async function editFriend(id) {
  const f = state.friends.find(x => x.id === id);
  if (f) openFriendModal(f);
}

async function deleteFriend(id, name) {
  if (!confirm(`¿Deseas eliminar a "${name}" de tu lista de amigos?`)) return;
  try {
    const res = await fetch(`/api/friends/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    const result = await res.json();
    if (result.success) {
      showToast(`Amigo "${name}" eliminado`, 'info');
      await loadFriends();
    }
  } catch (err) {
    console.error('Error al eliminar amigo:', err);
  }
}

async function recordFriendPaymentPrompt(friendId, friendName, amount) {
  const notes = prompt(`Registrar pago recibido de ${friendName}:`, `Cuota mensual saldada (${state.currency}${amount})`);
  if (notes === null) return;

  try {
    const res = await fetch('/api/friends/record-payment', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        friend_id: friendId,
        amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        notes: notes
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Pago recibido de ${friendName} registrado con éxito`, 'success');
      await loadFriends();
    }
  } catch (err) {
    console.error('Error registrando pago de amigo:', err);
  }
}

// ================= PESTAÑAS =================
function switchTab(tab) {
  state.currentTab = tab;
  const viewDash = document.getElementById('viewDashboard');
  const viewCal = document.getElementById('viewCalendar');
  const viewPay = document.getElementById('viewPayments');
  const viewFriends = document.getElementById('viewFriends');

  const tabDash = document.getElementById('tabBtnDashboard');
  const tabCal = document.getElementById('tabBtnCalendar');
  const tabPay = document.getElementById('tabBtnPayments');
  const tabFriends = document.getElementById('tabBtnFriends');

  [viewDash, viewCal, viewPay, viewFriends].forEach(v => v?.classList.add('hidden'));
  [tabDash, tabCal, tabPay, tabFriends].forEach(t => {
    t?.classList.remove('active', 'text-indigo-400', 'border-indigo-500');
    t?.classList.add('text-slate-400', 'border-transparent');
  });

  if (tab === 'dashboard') {
    viewDash?.classList.remove('hidden');
    tabDash?.classList.add('active', 'text-indigo-400', 'border-indigo-500');
    tabDash?.classList.remove('text-slate-400', 'border-transparent');
  } else if (tab === 'calendar') {
    viewCal?.classList.remove('hidden');
    tabCal?.classList.add('active', 'text-indigo-400', 'border-indigo-500');
    tabCal?.classList.remove('text-slate-400', 'border-transparent');
    renderCalendar();
  } else if (tab === 'payments') {
    viewPay?.classList.remove('hidden');
    tabPay?.classList.add('active', 'text-indigo-400', 'border-indigo-500');
    tabPay?.classList.remove('text-slate-400', 'border-transparent');
    loadPayments();
  } else if (tab === 'friends') {
    viewFriends?.classList.remove('hidden');
    tabFriends?.classList.add('active', 'text-indigo-400', 'border-indigo-500');
    tabFriends?.classList.remove('text-slate-400', 'border-transparent');
    loadFriends();
  }
  initIcons();
}

// ================= RENDERIZADO DASHBOARD =================
function renderKPIs() {
  if (!state.stats) return;
  const s = state.stats;
  const cur = state.currency;

  document.getElementById('kpiMonthlyCost').textContent = `${cur}${formatNumber(s.total_monthly_cost)}`;
  document.getElementById('kpiAnnualCost').textContent = `${cur}${formatNumber(s.total_annual_cost)}`;

  const upcomingCount = s.upcoming_7_days ? s.upcoming_7_days.length : 0;
  document.getElementById('kpiUpcomingCount').textContent = upcomingCount;
  const kpiUpcomingSub = document.getElementById('kpiUpcomingSubtitle');
  if (kpiUpcomingSub) {
    const upcomingSum = (s.upcoming_7_days || []).reduce((acc, x) => {
      const conv = x.converted_price !== undefined ? x.converted_price : convertCurrency(x.price, x.currency, state.baseCurrencyCode);
      return acc + conv;
    }, 0);
    kpiUpcomingSub.textContent = upcomingCount === 0 ? 'Sin cobros en 7 días' : `Cobros por ${cur}${formatNumber(upcomingSum)}`;
  }

  document.getElementById('kpiSharedSavings').textContent = `${cur}${formatNumber(s.total_shared_savings)}`;

  const savingsTip = document.getElementById('smartAnnualSavingsTip');
  if (savingsTip && s.potential_annual_savings > 0) {
    savingsTip.innerHTML = `
      <i data-lucide="sparkles" class="w-4 h-4 text-emerald-400 shrink-0"></i>
      <span>Ahorro estimado: Podrías ahorrar <strong>${cur}${formatNumber(s.potential_annual_savings)}/año</strong> pagando planes anuales.</span>
    `;
  }
}

function renderBudgetBar() {
  if (!state.stats) return;
  const s = state.stats;
  const cur = state.currency;

  const bar = document.getElementById('budgetProgressBar');
  const spent = document.getElementById('budgetSpentAmount');
  const limit = document.getElementById('budgetLimitAmount');
  const pill = document.getElementById('budgetAlertPill');
  const sub = document.getElementById('budgetSubtitle');

  if (spent) spent.textContent = `${cur}${formatNumber(s.total_monthly_cost)}`;
  if (limit) limit.textContent = `${cur}${formatNumber(s.monthly_budget)}`;

  const pct = Math.min(100, Math.max(0, s.budget_used_percentage));
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.className = s.budget_status === 'danger' ? 'h-full rounded-full transition-all duration-500 bg-rose-500' : (s.budget_status === 'warning' ? 'h-full rounded-full transition-all duration-500 bg-amber-500' : 'h-full rounded-full transition-all duration-500 bg-emerald-500');
  }

  if (pill) {
    if (s.budget_status === 'danger') {
      pill.textContent = `¡Excedido por ${cur}${formatNumber(Math.abs(s.budget_remaining))}!`;
      pill.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse';
    } else if (s.budget_status === 'warning') {
      pill.textContent = `Cerca del límite (${pct}%)`;
      pill.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    } else {
      pill.textContent = `Dentro del límite (${pct}%)`;
      pill.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  }

  if (sub) {
    sub.textContent = s.budget_remaining >= 0 ? `Te quedan ${cur}${formatNumber(s.budget_remaining)} disponibles de tu presupuesto mensual.` : `Has superado tu meta mensual en ${cur}${formatNumber(Math.abs(s.budget_remaining))}.`;
  }
}

function renderTrialAlerts() {
  const banner = document.getElementById('trialAlertsBanner');
  if (!banner || !state.stats) return;

  const trials = state.stats.trials_expiring_soon || [];
  if (trials.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  let itemsHtml = trials.map(t => {
    const days = t.days_until_trial_end;
    let urgency = days <= 1 ? '¡Cancela HOY!' : `Vence en ${days} días`;
    const tCurr = t.currency || 'USD';
    const tSymbol = CURRENCY_SYMBOLS[tCurr] || '$';
    const isDiffTrial = tCurr !== state.baseCurrencyCode;
    const convPriceTrial = t.converted_price !== undefined ? t.converted_price : convertCurrency(t.price, tCurr, state.baseCurrencyCode);
    const priceStrTrial = isDiffTrial
      ? `${tSymbol}${formatNumber(t.price)} <span class="text-indigo-300 font-bold">(≈ ${state.currency}${formatNumber(convPriceTrial)})</span>`
      : `${state.currency}${formatNumber(t.price)}`;

    return `
      <div class="flex items-center justify-between bg-slate-900/80 rounded-xl p-3 border border-rose-500/30">
        <div>
          <div class="font-bold text-white text-xs flex items-center gap-1.5">
            <span>${escapeHtml(t.name)}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
              ${urgency}
            </span>
          </div>
          <div class="text-[11px] text-rose-200/80 mt-0.5">
            Límite: <strong>${formatDateFriendly(t.trial_end_date)}</strong> &bull; Cobro: ${priceStrTrial}
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${t.url ? `<a href="${escapeHtml(t.url)}" target="_blank" class="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 flex items-center gap-1"><i data-lucide="external-link" class="w-3 h-3"></i> Cancelar</a>` : ''}
          <button onclick="editSubscription(${t.id})" class="px-2.5 py-1 text-[11px] rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition">Gestionar</button>
        </div>
      </div>
    `;
  }).join('');

  banner.innerHTML = `
    <div class="flex items-center gap-2.5 mb-2.5">
      <div class="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
        <i data-lucide="alert-triangle" class="w-4 h-4"></i>
      </div>
      <div>
        <h3 class="text-xs sm:text-sm font-bold text-white">🚨 ¡Alerta de Pruebas Gratuitas por Vencer! (${trials.length})</h3>
        <p class="text-[11px] text-rose-200/80">Cancela a tiempo para que no te apliquen el cobro automático recurrente.</p>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${itemsHtml}</div>
  `;

  initIcons();
}

function renderUpcomingAlerts() {
  const banner = document.getElementById('cutOffAlertsBanner');
  if (!banner || !state.stats) return;

  const upcoming = state.stats.upcoming_7_days || [];
  if (upcoming.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  banner.className = 'rounded-2xl p-4 sm:p-5 border bg-amber-950/30 border-amber-500/40 text-amber-200 transition-all shadow-lg shadow-amber-950/20';

  let itemsHtml = upcoming.map(sub => {
    let badgeText = sub.days_until_billing === 0 ? '¡Hoy!' : (sub.days_until_billing === 1 ? 'Mañana' : `En ${sub.days_until_billing} días`);
    let badgeClass = sub.days_until_billing === 0 ? 'bg-red-500/20 text-red-300 border border-red-500/40 font-bold animate-pulse' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold';

    const subCurr = sub.currency || 'USD';
    const subSymbol = CURRENCY_SYMBOLS[subCurr] || '$';
    const isDiffSub = subCurr !== state.baseCurrencyCode;
    const convPriceSub = sub.converted_price !== undefined ? sub.converted_price : convertCurrency(sub.price, subCurr, state.baseCurrencyCode);
    const priceStrSub = isDiffSub
      ? `${subSymbol}${formatNumber(sub.price)} <span class="text-amber-300 font-bold">(≈ ${state.currency}${formatNumber(convPriceSub)})</span>`
      : `${state.currency}${formatNumber(sub.price)}`;

    return `
      <div class="flex items-center justify-between bg-slate-900/60 rounded-xl px-3.5 py-2.5 border border-amber-500/20">
        <div class="flex items-center gap-2.5">
          <span class="w-3 h-3 rounded-full" style="background-color: ${sub.color || '#F59E0B'}"></span>
          <div>
            <div class="text-xs font-bold text-white flex items-center gap-1.5">
              <span>${escapeHtml(sub.name)}</span>
              <span class="text-[10px] font-normal px-2 py-0.5 rounded-full ${badgeClass}">${badgeText}</span>
            </div>
            <div class="text-[11px] text-slate-400">
              Corte: <span class="text-slate-300">${formatDateFriendly(sub.next_billing_date)}</span> &bull; ${priceStrSub}
            </div>
          </div>
        </div>
        <button onclick="markAsPaidAndAdvance(${sub.id})" title="Registrar pago y avanzar corte al siguiente ciclo" class="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/30 transition flex items-center gap-1">
          <i data-lucide="receipt" class="w-3 h-3"></i> <span>Pagado</span>
        </button>
      </div>
    `;
  }).join('');

  banner.innerHTML = `
    <div class="flex items-start sm:items-center justify-between gap-3 mb-3">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
          <i data-lucide="alarm-clock" class="w-4 h-4"></i>
        </div>
        <div>
          <h3 class="text-xs sm:text-sm font-bold text-white">Fechas de corte inminentes (${upcoming.length})</h3>
          <p class="text-[11px] text-amber-300/80">Revisa tu saldo antes de los cargos programados.</p>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">${itemsHtml}</div>
  `;

  initIcons();
}

function renderSubscriptions() {
  const grid = document.getElementById('subscriptionsGrid');
  const tableContainer = document.getElementById('subscriptionsTableContainer');
  const tableBody = document.getElementById('subscriptionsTableBody');
  const emptyState = document.getElementById('emptyState');

  if (!grid || !tableContainer || !tableBody || !emptyState) return;
  const subs = state.subscriptions || [];

  if (subs.length === 0) {
    grid.classList.add('hidden');
    tableContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    initIcons();
    return;
  }

  emptyState.classList.add('hidden');

  if (state.viewMode === 'grid') {
    grid.classList.remove('hidden');
    tableContainer.classList.add('hidden');
    grid.innerHTML = subs.map(sub => createCardHtml(sub)).join('');
  } else {
    grid.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    tableBody.innerHTML = subs.map(sub => createTableRowHtml(sub)).join('');
  }

  initIcons();
}

function createCardHtml(sub) {
  const baseCurr = state.baseCurrencyCode || 'USD';
  const baseSymbol = state.currency;
  const subCurr = sub.currency || 'USD';
  const subSymbol = CURRENCY_SYMBOLS[subCurr] || '$';
  const cycleLabel = CYCLE_LABELS[sub.billing_cycle] || sub.billing_cycle;
  const { text: daysText, badgeClass } = getCutOffBadgeInfo(sub.days_until_billing);
  const statusBadge = getStatusBadge(sub.status);

  const isDifferentCurrency = subCurr !== baseCurr;
  const convertedPrice = sub.converted_price !== undefined ? sub.converted_price : convertCurrency(sub.price, subCurr, baseCurr);
  const convertedMonthly = sub.converted_monthly_cost !== undefined ? sub.converted_monthly_cost : convertCurrency(sub.monthly_cost, subCurr, baseCurr);
  const convertedAnnual = sub.converted_annual_cost !== undefined ? sub.converted_annual_cost : convertCurrency(sub.annual_cost, subCurr, baseCurr);

  let trialBadge = sub.is_trial ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1"><i data-lucide="timer" class="w-3 h-3"></i> Trial</span>` : '';
  let sharedBadge = sub.is_shared ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i data-lucide="users" class="w-3 h-3"></i> Dividido /${sub.shared_with_count || 2}</span>` : '';

  return `
    <div class="sub-card bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
      <div class="absolute top-0 left-0 right-0 h-1" style="background-color: ${sub.color || '#4F46E5'}"></div>

      <div>
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md font-bold text-sm" style="background: linear-gradient(135deg, ${sub.color || '#4F46E5'}, #1E1B4B)">
              ${sub.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 class="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                ${escapeHtml(sub.name)}
                ${sub.url ? `<a href="${escapeHtml(sub.url)}" target="_blank" rel="noopener" class="text-slate-500 hover:text-indigo-400 transition"><i data-lucide="external-link" class="w-3 h-3"></i></a>` : ''}
              </h4>
              <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  ${escapeHtml(sub.category)}
                </span>
                ${trialBadge}
                ${sharedBadge}
                ${statusBadge}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1 text-slate-400">
            <button onclick="editSubscription(${sub.id})" title="Editar" class="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
            <button onclick="deleteSubscription(${sub.id}, '${escapeHtml(sub.name)}')" title="Eliminar" class="p-1.5 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        </div>

        <div class="mt-4 p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span class="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1">
              <i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i> Fecha de Corte
            </span>
            <div class="text-xs font-semibold text-slate-200 mt-0.5">${formatDateFriendly(sub.next_billing_date)}</div>
          </div>
          <div class="text-right">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}">${daysText}</span>
            <button onclick="markAsPaidAndAdvance(${sub.id})" class="block text-[10px] text-indigo-400 hover:text-indigo-300 mt-1 font-semibold underline decoration-dotted">Marcar Pagado</button>
          </div>
        </div>

        <div class="mt-3.5 grid grid-cols-2 gap-2 bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-3">
          <div>
            <span class="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">Cobro Recurrente</span>
            ${isDifferentCurrency ? `
              <span class="text-xs font-bold text-white">${baseSymbol}${formatNumber(convertedPrice)} <span class="text-[10px] font-normal text-slate-400">/${cycleLabel.toLowerCase()}</span></span>
              <span class="block text-[11px] font-medium text-indigo-300">orig. ${subSymbol}${formatNumber(sub.price)} ${subCurr}</span>
              ${sub.is_shared ? `<span class="block text-[10px] text-emerald-400 font-medium mt-0.5">Tu parte: ${baseSymbol}${formatNumber(convertedMonthly)}/m</span>` : ''}
            ` : `
              <span class="text-xs font-bold text-white">${baseSymbol}${formatNumber(sub.price)} <span class="text-[10px] font-normal text-slate-400">/${cycleLabel.toLowerCase()}</span></span>
              ${sub.is_shared ? `<span class="block text-[10px] text-emerald-400 font-medium mt-0.5">Tu parte: ${baseSymbol}${formatNumber(sub.monthly_cost)}/m</span>` : ''}
            `}
          </div>

          <div class="text-right">
            <span class="text-[10px] uppercase font-bold tracking-wider text-indigo-300 block flex items-center justify-end gap-0.5">
              <i data-lucide="sparkles" class="w-2.5 h-2.5"></i> Costo Anual
            </span>
            <span class="text-sm font-extrabold text-indigo-200 tracking-tight block">
              ${baseSymbol}${formatNumber(convertedAnnual)} <span class="text-[10px] font-medium text-indigo-300/80">/año</span>
            </span>
            ${isDifferentCurrency ? `
              <span class="text-[10px] text-slate-400 block font-mono">(${subSymbol}${formatNumber(sub.annual_cost)} ${subCurr})</span>
            ` : `
              <span class="text-[10px] text-indigo-300/70 block font-mono">(${baseSymbol}${formatNumber(convertedMonthly)}/mes)</span>
            `}
          </div>
        </div>

        <div class="mt-3 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
          <span class="flex items-center gap-1 text-slate-400">
            <i data-lucide="credit-card" class="w-3 h-3 text-slate-500"></i>
            ${escapeHtml(sub.payment_method || 'Sin método')}
          </span>
          ${sub.notes ? `<span class="truncate max-w-[140px] italic text-slate-400" title="${escapeHtml(sub.notes)}">"${escapeHtml(sub.notes)}"</span>` : ''}
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <button onclick="toggleSubscriptionStatus(${sub.id}, '${sub.status}')" class="text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition">
          <i data-lucide="${sub.status === 'active' ? 'pause-circle' : 'play-circle'}" class="w-3.5 h-3.5"></i>
          <span>${sub.status === 'active' ? 'Pausar' : 'Reactivar'}</span>
        </button>
        <span class="text-[11px] text-slate-500 font-mono">#${sub.id}</span>
      </div>
    </div>
  `;
}

function createTableRowHtml(sub) {
  const baseCurr = state.baseCurrencyCode || 'USD';
  const baseSymbol = state.currency;
  const subCurr = sub.currency || 'USD';
  const subSymbol = CURRENCY_SYMBOLS[subCurr] || '$';
  const cycleLabel = CYCLE_LABELS[sub.billing_cycle] || sub.billing_cycle;
  const { text: daysText, badgeClass } = getCutOffBadgeInfo(sub.days_until_billing);
  const statusBadge = getStatusBadge(sub.status);

  const isDifferentCurrency = subCurr !== baseCurr;
  const convertedPrice = sub.converted_price !== undefined ? sub.converted_price : convertCurrency(sub.price, subCurr, baseCurr);
  const convertedMonthly = sub.converted_monthly_cost !== undefined ? sub.converted_monthly_cost : convertCurrency(sub.monthly_cost, subCurr, baseCurr);
  const convertedAnnual = sub.converted_annual_cost !== undefined ? sub.converted_annual_cost : convertCurrency(sub.annual_cost, subCurr, baseCurr);

  return `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="px-4 py-3.5">
        <div class="flex items-center gap-2.5">
          <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${sub.color || '#4F46E5'}"></span>
          <div>
            <div class="font-bold text-white flex items-center gap-1">
              ${escapeHtml(sub.name)}
              ${sub.is_trial ? `<span class="text-[9px] font-bold px-1.5 rounded bg-rose-500/20 text-rose-300">TRIAL</span>` : ''}
              ${sub.is_shared ? `<span class="text-[9px] font-bold px-1.5 rounded bg-emerald-500/20 text-emerald-300">SPLIT</span>` : ''}
            </div>
            <div class="text-[11px] text-slate-400">${escapeHtml(sub.payment_method || 'Tarjeta')}</div>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5">
        <span class="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
          ${escapeHtml(sub.category)}
        </span>
      </td>
      <td class="px-4 py-3.5">
        <div class="font-medium text-slate-200">${formatDateFriendly(sub.next_billing_date)}</div>
        <span class="text-[10px] font-bold px-1.5 py-0.2 rounded ${badgeClass}">${daysText}</span>
      </td>
      <td class="px-4 py-3.5 font-mono">
        ${isDifferentCurrency ? `
          <div class="font-bold text-white">${baseSymbol}${formatNumber(convertedPrice)} <span class="text-[11px] text-slate-400 font-normal">/${cycleLabel.toLowerCase()}</span></div>
          <div class="text-[11px] text-indigo-300 font-semibold">orig. ${subSymbol}${formatNumber(sub.price)} ${subCurr}</div>
        ` : `
          <div class="font-bold text-white">${baseSymbol}${formatNumber(sub.price)}</div>
          <div class="text-[11px] text-slate-400">${cycleLabel}</div>
        `}
      </td>
      <td class="px-4 py-3.5 font-mono">
        <div class="font-extrabold text-indigo-300">${baseSymbol}${formatNumber(convertedAnnual)} / año</div>
        <div class="text-[10px] text-slate-400">
          (${baseSymbol}${formatNumber(convertedMonthly)} / mes${isDifferentCurrency ? ` &bull; orig. ${subSymbol}${formatNumber(sub.annual_cost)}` : ''})
        </div>
      </td>
      <td class="px-4 py-3.5">${statusBadge}</td>
      <td class="px-4 py-3.5 text-right space-x-1">
        <button onclick="markAsPaidAndAdvance(${sub.id})" title="Marcar como pagado" class="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400"><i data-lucide="receipt" class="w-4 h-4"></i></button>
        <button onclick="editSubscription(${sub.id})" title="Editar" class="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
        <button onclick="deleteSubscription(${sub.id}, '${escapeHtml(sub.name)}')" title="Eliminar" class="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </td>
    </tr>
  `;
}

function renderPaymentHistory(payments) {
  const tbody = document.getElementById('paymentHistoryTableBody');
  const badge = document.getElementById('paymentsBadgeCount');
  if (badge) badge.textContent = payments ? payments.length : 0;
  if (!tbody) return;

  if (!payments || payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-500 text-xs">
          No hay pagos registrados aún. Haz clic en "Pagado" para registrarlos automáticamente.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="px-4 py-3 font-medium text-slate-200">${formatDateFriendly(p.payment_date)}</td>
      <td class="px-4 py-3 font-bold text-white">${escapeHtml(p.subscription_name)}</td>
      <td class="px-4 py-3 font-mono font-bold text-emerald-400">${CURRENCY_SYMBOLS[p.currency] || '$'}${formatNumber(p.amount)}</td>
      <td class="px-4 py-3 text-slate-400">${escapeHtml(p.payment_method || 'Tarjeta')}</td>
      <td class="px-4 py-3 text-slate-400 text-xs">${escapeHtml(p.notes || '-')}</td>
    </tr>
  `).join('');
}

// ================= GRÁFICAS DE COSTOS =================
function renderCharts() {
  if (!state.stats) return;
  renderCategoryChart();
  renderTopExpensiveChart();
}

function renderCategoryChart() {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;

  const categories = state.stats.categories || [];
  const cur = state.currency;
  const breakdownList = document.getElementById('categoryBreakdownList');
  const centerText = document.getElementById('chartCenterText');

  if (categories.length === 0) {
    if (centerText) centerText.innerHTML = '<span class="text-xs text-slate-500">Sin datos</span>';
    if (state.categoryChart) {
      state.categoryChart.destroy();
      state.categoryChart = null;
    }
    return;
  }

  const labels = categories.map(c => c.category);
  const dataValues = categories.map(c => state.chartMode === 'annual' ? c.annual_cost : c.monthly_cost);
  const backgroundColors = categories.map(c => CATEGORY_COLORS[c.category] || '#8B5CF6');

  if (centerText) {
    const total = state.chartMode === 'annual' ? state.stats.total_annual_cost : state.stats.total_monthly_cost;
    centerText.innerHTML = `
      <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total</span>
      <span class="text-base font-bold text-white">${cur}${formatNumber(total)}</span>
    `;
  }

  if (breakdownList) {
    breakdownList.innerHTML = categories.map(c => {
      const val = state.chartMode === 'annual' ? c.annual_cost : c.monthly_cost;
      return `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${CATEGORY_COLORS[c.category] || '#8B5CF6'}"></span>
            <span class="text-slate-300 font-medium">${escapeHtml(c.category)}</span>
            <span class="text-[10px] text-slate-500">(${c.count})</span>
          </div>
          <div class="font-mono text-slate-300">
            <span class="font-bold">${cur}${formatNumber(val)}</span>
            <span class="text-slate-500 text-[10px] ml-1">${c.percentage}%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  if (state.categoryChart) state.categoryChart.destroy();

  const ctx = canvas.getContext('2d');
  state.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#1E293B',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${cur}${formatNumber(ctx.raw)} (${state.chartMode === 'annual' ? 'año' : 'mes'})`
          }
        }
      }
    }
  });
}

function renderTopExpensiveChart() {
  const canvas = document.getElementById('topExpensiveChart');
  if (!canvas) return;

  const topItems = state.stats.top_expensive || [];
  const cur = state.currency;

  if (topItems.length === 0) {
    if (state.topChart) {
      state.topChart.destroy();
      state.topChart = null;
    }
    return;
  }

  const labels = topItems.map(s => s.name);
  const dataValues = topItems.map(s => {
    const val = state.chartMode === 'annual'
      ? (s.converted_annual_cost !== undefined ? s.converted_annual_cost : convertCurrency(s.annual_cost, s.currency, state.baseCurrencyCode))
      : (s.converted_monthly_cost !== undefined ? s.converted_monthly_cost : convertCurrency(s.monthly_cost, s.currency, state.baseCurrencyCode));
    return Number(val.toFixed(2));
  });
  const colors = topItems.map(s => s.color || '#6366F1');

  if (state.topChart) state.topChart.destroy();

  const ctx = canvas.getContext('2d');
  state.topChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: state.chartMode === 'annual' ? `Costo Anual (${state.baseCurrencyCode})` : `Costo Mensual (${state.baseCurrencyCode})`,
        data: dataValues,
        backgroundColor: colors.map(c => `${c}CC`),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          callbacks: {
            label: (ctx) => {
              const item = topItems[ctx.dataIndex];
              const isDiff = item && item.currency && item.currency !== state.baseCurrencyCode;
              const origVal = state.chartMode === 'annual' ? item.annual_cost : item.monthly_cost;
              const origSym = item ? (CURRENCY_SYMBOLS[item.currency] || item.currency) : '$';
              const origStr = isDiff ? ` (orig. ${origSym}${formatNumber(origVal)} ${item.currency})` : '';
              return ` ${cur}${formatNumber(ctx.raw)} / ${state.chartMode === 'annual' ? 'año' : 'mes'}${origStr}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 11 } } },
        y: { grid: { color: '#33415522' }, ticks: { color: '#94A3B8', callback: (v) => `${cur}${formatNumber(v)}`, font: { size: 10 } } }
      }
    }
  });
}

function setChartMode(mode) {
  state.chartMode = mode;
  document.getElementById('btnChartModeAnnual')?.classList.toggle('bg-indigo-600', mode === 'annual');
  document.getElementById('btnChartModeAnnual')?.classList.toggle('text-white', mode === 'annual');
  document.getElementById('btnChartModeMonthly')?.classList.toggle('bg-indigo-600', mode === 'monthly');
  document.getElementById('btnChartModeMonthly')?.classList.toggle('text-white', mode === 'monthly');
  renderCharts();
}

function setViewMode(mode) {
  state.viewMode = mode;
  document.getElementById('viewModeGrid')?.classList.toggle('bg-indigo-600', mode === 'grid');
  document.getElementById('viewModeTable')?.classList.toggle('bg-indigo-600', mode === 'table');
  renderSubscriptions();
}

// ================= CALENDARIO DE CORTES =================
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function changeCalendarMonth(delta) {
  let newMonth = state.calendar.currentMonth + delta;
  let newYear = state.calendar.currentYear;
  if (newMonth < 0) {
    newMonth = 11;
    newYear -= 1;
  } else if (newMonth > 11) {
    newMonth = 0;
    newYear += 1;
  }
  state.calendar.currentMonth = newMonth;
  state.calendar.currentYear = newYear;
  renderCalendar();
}

function resetCalendarToToday() {
  const now = new Date();
  state.calendar.currentYear = now.getFullYear();
  state.calendar.currentMonth = now.getMonth();
  const pad = n => String(n).padStart(2, '0');
  state.calendar.selectedDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  renderCalendar();
}

function getSubBillingDatesForMonth(sub, year, month) {
  // Retorna un array con todas las fechas (YYYY-MM-DD) en que ocurre corte para esta sub en el mes
  if (!sub.next_billing_date || sub.status === 'canceled') return [];

  const dates = [];
  const pad = n => String(n).padStart(2, '0');
  const baseParts = sub.next_billing_date.split('-').map(Number);
  if (baseParts.length !== 3) return [];
  const [baseYear, baseMonth, baseDay] = baseParts;

  const cycle = sub.billing_cycle || 'monthly';
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  if (cycle === 'monthly') {
    // Corte mensual: ocurre el día baseDay de cada mes (ajustado si el mes tiene menos días)
    const day = Math.min(baseDay, lastDayOfMonth);
    dates.push(`${year}-${pad(month + 1)}-${pad(day)}`);
  } else if (cycle === 'weekly') {
    // Corte semanal: cada 7 días a partir de la fecha base
    const baseDate = new Date(baseYear, baseMonth - 1, baseDay);
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    // Encontrar la ocurrencia que cae en o antes del inicio de mes
    let iter = new Date(baseDate);
    if (iter > endOfMonth) {
      // Retrocemos hacia atrás
      while (iter > startOfMonth) {
        iter.setDate(iter.getDate() - 7);
      }
    } else {
      // Avanzamos hacia adelante
      while (iter < startOfMonth) {
        iter.setDate(iter.getDate() + 7);
      }
    }

    // Ahora iteramos dentro del mes
    while (iter <= endOfMonth) {
      if (iter >= startOfMonth) {
        dates.push(`${iter.getFullYear()}-${pad(iter.getMonth() + 1)}-${pad(iter.getDate())}`);
      }
      iter.setDate(iter.getDate() + 7);
    }
  } else if (cycle === 'quarterly') {
    // Ocurre cada 3 meses en baseDay
    const monthDiff = (year - baseYear) * 12 + (month - (baseMonth - 1));
    if (monthDiff % 3 === 0) {
      const day = Math.min(baseDay, lastDayOfMonth);
      dates.push(`${year}-${pad(month + 1)}-${pad(day)}`);
    }
  } else if (cycle === 'biannual') {
    // Ocurre cada 6 meses en baseDay
    const monthDiff = (year - baseYear) * 12 + (month - (baseMonth - 1));
    if (monthDiff % 6 === 0) {
      const day = Math.min(baseDay, lastDayOfMonth);
      dates.push(`${year}-${pad(month + 1)}-${pad(day)}`);
    }
  } else if (cycle === 'annual') {
    // Ocurre una vez al año en baseMonth - 1
    if (month === baseMonth - 1) {
      const day = Math.min(baseDay, lastDayOfMonth);
      dates.push(`${year}-${pad(month + 1)}-${pad(day)}`);
    }
  }

  return dates;
}

function updateCalendarBadge() {
  const badge = document.getElementById('calendarBadgeCount');
  if (!badge) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const subs = (state.subscriptions || []).filter(s => s.status !== 'canceled');

  let cutsCount = 0;
  subs.forEach(s => {
    cutsCount += getSubBillingDatesForMonth(s, year, month).length;
  });

  badge.textContent = cutsCount;
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthTitle = document.getElementById('calendarMonthTitle');
  const totalCutsElem = document.getElementById('calendarTotalCuts');
  const totalExpenseElem = document.getElementById('calendarTotalExpense');

  if (!grid) return;

  const year = state.calendar.currentYear;
  const month = state.calendar.currentMonth;
  const curSymbol = state.currency;
  const baseCurr = state.baseCurrencyCode || 'USD';

  if (monthTitle) {
    monthTitle.textContent = `${MONTH_NAMES[month]} ${year}`;
  }

  const today = new Date();
  const todayPad = n => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${todayPad(today.getMonth() + 1)}-${todayPad(today.getDate())}`;

  // Si no hay fecha seleccionada, seleccionar hoy (si estamos en el mes actual) o el día 1
  if (!state.calendar.selectedDateStr) {
    if (year === today.getFullYear() && month === today.getMonth()) {
      state.calendar.selectedDateStr = todayStr;
    } else {
      state.calendar.selectedDateStr = `${year}-${todayPad(month + 1)}-01`;
    }
  }

  // Agrupar suscripciones por fecha en este mes
  const activeSubs = (state.subscriptions || []).filter(s => s.status !== 'canceled');
  const cutsByDate = {};
  let totalMonthCuts = 0;
  let totalMonthExpense = 0;

  activeSubs.forEach(sub => {
    const dates = getSubBillingDatesForMonth(sub, year, month);
    const convertedPrice = sub.converted_price !== undefined
      ? sub.converted_price
      : convertCurrency(sub.price, sub.currency || 'USD', baseCurr);

    dates.forEach(dStr => {
      if (!cutsByDate[dStr]) cutsByDate[dStr] = [];
      cutsByDate[dStr].push({
        ...sub,
        billing_on_date: dStr,
        converted_price_calculated: convertedPrice
      });
      totalMonthCuts++;
      totalMonthExpense += convertedPrice;
    });
  });

  if (totalCutsElem) totalCutsElem.textContent = totalMonthCuts;
  if (totalExpenseElem) totalExpenseElem.textContent = `${curSymbol}${formatNumber(totalMonthExpense)}`;

  // Cálculo de la matriz del calendario
  // Primer día del mes
  const firstDayObj = new Date(year, month, 1);
  // getDay(): 0 es Domingo, 1 es Lunes... Queremos Lunes=0, Dom=6
  let firstDayOfWeek = firstDayObj.getDay() - 1;
  if (firstDayOfWeek === -1) firstDayOfWeek = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  let html = '';

  // Días de relleno del mes anterior
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDayNum = daysInPrevMonth - i;
    html += `
      <div class="calendar-day-cell rounded-xl p-1.5 sm:p-2 bg-slate-900/30 border border-slate-800/40 text-slate-600 opacity-50 flex flex-col justify-between">
        <span class="text-[11px] font-mono font-medium">${prevDayNum}</span>
      </div>
    `;
  }

  // Días del mes actual
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${todayPad(month + 1)}-${todayPad(day)}`;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === state.calendar.selectedDateStr;
    const dayCuts = cutsByDate[dateStr] || [];
    const hasCuts = dayCuts.length > 0;

    let cellBorder = isSelected
      ? 'is-selected border-indigo-500'
      : (isToday ? 'is-today border-amber-500/80 bg-amber-500/5' : 'border-slate-800 bg-slate-900/70 hover:border-slate-700');

    let chipsHtml = '';
    if (hasCuts) {
      // Mostrar hasta 3 chips y un contador si hay más
      const maxChips = 2;
      const visibleCuts = dayCuts.slice(0, maxChips);
      const remainingCount = dayCuts.length - maxChips;

      chipsHtml = visibleCuts.map(cut => {
        const bgCol = cut.color || '#4F46E5';
        return `
          <div class="calendar-badge-chip px-1.5 py-0.5 rounded text-[10px] font-semibold text-white truncate flex items-center gap-1 shadow-sm"
               style="background-color: ${bgCol};"
               title="${escapeHtml(cut.name)}: ${curSymbol}${formatNumber(cut.converted_price_calculated)}">
            <span class="truncate">${escapeHtml(cut.name)}</span>
          </div>
        `;
      }).join('');

      if (remainingCount > 0) {
        chipsHtml += `
          <div class="text-[9px] font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-1 py-0.2 rounded text-center">
            +${remainingCount} más
          </div>
        `;
      }
    }

    html += `
      <div onclick="selectCalendarDate('${dateStr}')"
           class="calendar-day-cell rounded-xl p-1.5 sm:p-2 border ${cellBorder} flex flex-col justify-between cursor-pointer transition relative group">
        
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold ${isToday ? 'text-amber-400 font-extrabold ring-1 ring-amber-400/40 rounded px-1' : (isSelected ? 'text-indigo-300' : 'text-slate-300')}">
            ${day}
          </span>
          ${hasCuts ? `
            <span class="w-2 h-2 rounded-full bg-indigo-400 shrink-0 ${isToday ? 'animate-ping' : ''}"></span>
          ` : ''}
        </div>

        <div class="mt-1 space-y-1 overflow-hidden">
          ${chipsHtml}
        </div>

        ${hasCuts ? `
          <div class="mt-1 pt-0.5 border-t border-slate-800 text-[10px] font-mono text-emerald-400 font-bold text-right hidden sm:block">
            ${curSymbol}${formatNumber(dayCuts.reduce((acc, c) => acc + c.converted_price_calculated, 0))}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Días de relleno del mes siguiente para completar la cuadrícula (múltiplo de 7)
  const totalCells = firstDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let j = 1; j <= remainingCells; j++) {
    html += `
      <div class="calendar-day-cell rounded-xl p-1.5 sm:p-2 bg-slate-900/30 border border-slate-800/40 text-slate-600 opacity-50 flex flex-col justify-between">
        <span class="text-[11px] font-mono font-medium">${j}</span>
      </div>
    `;
  }

  grid.innerHTML = html;
  renderCalendarDayDetails(cutsByDate[state.calendar.selectedDateStr] || []);
  initIcons();
}

function selectCalendarDate(dateStr) {
  state.calendar.selectedDateStr = dateStr;
  renderCalendar();
}

function renderCalendarDayDetails(cutsForSelectedDay) {
  const title = document.getElementById('calendarSelectedDateTitle');
  const badge = document.getElementById('calendarSelectedDateBadge');
  const list = document.getElementById('calendarSelectedDateList');

  if (!title || !badge || !list) return;

  const dateStr = state.calendar.selectedDateStr;
  if (!dateStr) {
    title.textContent = 'Selecciona una fecha en el calendario';
    badge.textContent = '-';
    list.innerHTML = `<p class="text-slate-500 text-xs col-span-full">Haz clic en cualquier día de la cuadrícula para ver sus cortes detallados.</p>`;
    return;
  }

  const [y, m, d] = dateStr.split('-');
  const friendly = `${parseInt(d, 10)} de ${MONTH_NAMES[parseInt(m, 10) - 1]} de ${y}`;
  title.textContent = `Fechas de Corte para el ${friendly}`;

  const curSymbol = state.currency;
  const baseCurr = state.baseCurrencyCode || 'USD';

  if (cutsForSelectedDay.length === 0) {
    badge.textContent = '0 cortes programados';
    badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono';
    list.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-500 text-xs">
        <i data-lucide="calendar-check" class="w-8 h-8 mx-auto mb-2 text-slate-600"></i>
        <p>No tienes ningún cobro recurrente programado para este día.</p>
      </div>
    `;
    initIcons();
    return;
  }

  const totalDayExpense = cutsForSelectedDay.reduce((acc, c) => acc + c.converted_price_calculated, 0);
  badge.textContent = `${cutsForSelectedDay.length} ${cutsForSelectedDay.length === 1 ? 'corte' : 'cortes'} (${curSymbol}${formatNumber(totalDayExpense)})`;
  badge.className = 'text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/30';

  list.innerHTML = cutsForSelectedDay.map(sub => {
    const isDiff = sub.currency && sub.currency !== baseCurr;
    const origSymbol = CURRENCY_SYMBOLS[sub.currency] || '$';
    const cycleLabel = CYCLE_LABELS[sub.billing_cycle] || sub.billing_cycle;

    return `
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-slate-700 transition">
        <div class="absolute top-0 left-0 right-0 h-1" style="background-color: ${sub.color || '#4F46E5'}"></div>

        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow shrink-0" style="background: linear-gradient(135deg, ${sub.color || '#4F46E5'}, #1E1B4B)">
              ${sub.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 class="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
                ${escapeHtml(sub.name)}
                ${sub.is_trial ? `<span class="text-[9px] font-bold px-1.5 rounded bg-rose-500/20 text-rose-300">TRIAL</span>` : ''}
                ${sub.is_shared ? `<span class="text-[9px] font-bold px-1.5 rounded bg-emerald-500/20 text-emerald-300">SPLIT</span>` : ''}
              </h4>
              <span class="text-[11px] text-slate-400">${escapeHtml(sub.category || 'Servicios')} &bull; ${cycleLabel}</span>
            </div>
          </div>
        </div>

        <div class="bg-slate-800/60 rounded-lg p-2.5 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Cobro del Día</span>
            <span class="text-sm font-bold text-white">${curSymbol}${formatNumber(sub.converted_price_calculated)}</span>
          </div>
          ${isDiff ? `
            <div class="text-right">
              <span class="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Original</span>
              <span class="text-xs font-semibold text-indigo-300">${origSymbol}${formatNumber(sub.price)} ${sub.currency}</span>
            </div>
          ` : ''}
        </div>

        <div class="flex items-center justify-between pt-1 text-xs">
          <span class="text-[11px] text-slate-400 flex items-center gap-1">
            <i data-lucide="credit-card" class="w-3 h-3 text-slate-500"></i>
            ${escapeHtml(sub.payment_method || 'Tarjeta')}
          </span>
          <div class="flex items-center gap-1.5">
            <button onclick="markAsPaidAndAdvance(${sub.id})" title="Marcar como pagado y avanzar fecha" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition flex items-center gap-1">
              <i data-lucide="receipt" class="w-3 h-3"></i> Pagado
            </button>
            <button onclick="editSubscription(${sub.id})" title="Editar suscripción" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  initIcons();
}

// ================= MODAL SUSCRIPCIÓN & SELECCIÓN DE AMIGOS =================
function populateSharedFriendsCheckboxes(selectedIds = []) {
  const container = document.getElementById('sharedFriendsCheckboxList');
  if (!container) return;

  if (!state.friends || state.friends.length === 0) {
    container.innerHTML = `<span class="text-slate-500 italic">No tienes amigos en tu lista aún. Agrégalos en la pestaña "Amigos".</span>`;
    return;
  }

  container.innerHTML = state.friends.map(f => {
    const isChecked = selectedIds.includes(f.id) || selectedIds.includes(String(f.id));
    return `
      <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer">
        <input type="checkbox" class="friend-checkbox rounded text-indigo-600" value="${f.id}" ${isChecked ? 'checked' : ''}>
        <span class="w-2 h-2 rounded-full" style="background-color: ${f.avatar_color || '#10B981'}"></span>
        <span>${escapeHtml(f.name)}</span>
      </label>
    `;
  }).join('');

  // Event listener para actualizar automáticamente el contador de integrantes
  container.querySelectorAll('.friend-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const checkedCount = container.querySelectorAll('.friend-checkbox:checked').length;
      const countInput = document.getElementById('subSharedCount');
      if (countInput) {
        countInput.value = Math.max(2, checkedCount + 1);
        const price = parseFloat(document.getElementById('subPrice')?.value) || 0;
        const myShare = document.getElementById('subMySharePrice');
        if (myShare) myShare.value = (price / (checkedCount + 1)).toFixed(2);
      }
      updateModalLiveCalculation();
    });
  });
}

function openModal(sub = null) {
  state.editingId = sub ? sub.id : null;
  const modal = document.getElementById('subscriptionModal');
  const modalTitle = document.getElementById('modalTitle');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const form = document.getElementById('subscriptionForm');
  const tplContainer = document.getElementById('templatesContainer');

  form.reset();

  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 1);
  const defaultDateStr = defaultDate.toISOString().split('T')[0];

  document.getElementById('trialFieldsContainer')?.classList.add('hidden');
  document.getElementById('sharedFieldsContainer')?.classList.add('hidden');

  let selectedFriendIds = [];

  if (sub) {
    modalTitle.innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-indigo-400"></i> Editar Suscripción`;
    btnSubmitText.textContent = 'Actualizar Suscripción';
    if (tplContainer) tplContainer.classList.add('hidden');

    document.getElementById('subId').value = sub.id;
    document.getElementById('subName').value = sub.name;
    document.getElementById('subPrice').value = sub.price;
    document.getElementById('subCurrency').value = sub.currency || 'USD';
    document.getElementById('subBillingCycle').value = sub.billing_cycle;
    document.getElementById('subNextBillingDate').value = sub.next_billing_date;
    document.getElementById('subCategory').value = sub.category;
    document.getElementById('subPaymentMethod').value = sub.payment_method || '';
    document.getElementById('subStatus').value = sub.status;
    document.getElementById('subColor').value = sub.color || '#4F46E5';
    document.getElementById('subUrl').value = sub.url || '';
    document.getElementById('subNotes').value = sub.notes || '';

    if (sub.is_trial) {
      document.getElementById('subIsTrial').checked = true;
      document.getElementById('trialFieldsContainer')?.classList.remove('hidden');
      document.getElementById('subTrialEndDate').value = sub.trial_end_date || '';
    }

    if (sub.is_shared) {
      document.getElementById('subIsShared').checked = true;
      document.getElementById('sharedFieldsContainer')?.classList.remove('hidden');
      document.getElementById('subSharedCount').value = sub.shared_with_count || 2;
      document.getElementById('subMySharePrice').value = sub.my_share_price || '';
      selectedFriendIds = (sub.shared_friend_ids || '').split(',').filter(Boolean);
    }
  } else {
    modalTitle.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-indigo-400"></i> Nueva Suscripción`;
    btnSubmitText.textContent = 'Guardar Suscripción';
    if (tplContainer) tplContainer.classList.remove('hidden');

    document.getElementById('subId').value = '';
    document.getElementById('subCurrency').value = state.baseCurrencyCode || 'USD';
    document.getElementById('subNextBillingDate').value = defaultDateStr;
    document.getElementById('subColor').value = '#4F46E5';
  }

  populateSharedFriendsCheckboxes(selectedFriendIds);
  updateModalLiveCalculation();
  modal.classList.remove('hidden');
  initIcons();
}

function closeModal() {
  document.getElementById('subscriptionModal')?.classList.add('hidden');
  state.editingId = null;
}

function updateModalLiveCalculation() {
  const priceInput = document.getElementById('subPrice');
  const cycleInput = document.getElementById('subBillingCycle');
  const isShared = document.getElementById('subIsShared')?.checked;
  const myShareInput = document.getElementById('subMySharePrice');
  const currSelect = document.getElementById('subCurrency');

  let price = parseFloat(priceInput?.value) || 0;
  if (isShared && myShareInput && parseFloat(myShareInput.value) > 0) {
    price = parseFloat(myShareInput.value);
  }

  const cycle = cycleInput?.value || 'monthly';
  const subCurr = currSelect?.value || state.baseCurrencyCode || 'USD';
  const subSymbol = CURRENCY_SYMBOLS[subCurr] || '$';
  const baseCurr = state.baseCurrencyCode || 'USD';
  const baseSymbol = state.currency;

  let annual = 0;
  let monthly = 0;

  if (cycle === 'weekly') {
    annual = price * 52;
    monthly = annual / 12;
  } else if (cycle === 'monthly') {
    annual = price * 12;
    monthly = price;
  } else if (cycle === 'quarterly') {
    annual = price * 4;
    monthly = annual / 12;
  } else if (cycle === 'biannual') {
    annual = price * 2;
    monthly = annual / 12;
  } else if (cycle === 'annual') {
    annual = price;
    monthly = annual / 12;
  }

  const calcM = document.getElementById('formCalcMonthly');
  const calcA = document.getElementById('formCalcAnnual');

  if (subCurr === baseCurr) {
    if (calcM) calcM.textContent = `${baseSymbol}${formatNumber(monthly)} / mes`;
    if (calcA) calcA.textContent = `${baseSymbol}${formatNumber(annual)} / año`;
  } else {
    const monthlyConv = convertCurrency(monthly, subCurr, baseCurr);
    const annualConv = convertCurrency(annual, subCurr, baseCurr);
    if (calcM) calcM.innerHTML = `${subSymbol}${formatNumber(monthly)} <span class="text-indigo-400 font-bold text-[11px]">(≈ ${baseSymbol}${formatNumber(monthlyConv)} ${baseCurr})</span> / mes`;
    if (calcA) calcA.innerHTML = `${subSymbol}${formatNumber(annual)} <span class="text-indigo-400 font-bold text-[11px]">(≈ ${baseSymbol}${formatNumber(annualConv)} ${baseCurr})</span> / año`;
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const isShared = document.getElementById('subIsShared').checked;
  const isTrial = document.getElementById('subIsTrial').checked;

  const friendCbs = document.querySelectorAll('#sharedFriendsCheckboxList .friend-checkbox:checked');
  const sharedFriendIds = Array.from(friendCbs).map(cb => cb.value).join(',');

  const data = {
    name: document.getElementById('subName').value.trim(),
    price: parseFloat(document.getElementById('subPrice').value) || 0,
    currency: document.getElementById('subCurrency').value,
    billing_cycle: document.getElementById('subBillingCycle').value,
    next_billing_date: document.getElementById('subNextBillingDate').value,
    category: document.getElementById('subCategory').value,
    payment_method: document.getElementById('subPaymentMethod').value.trim(),
    status: document.getElementById('subStatus').value,
    color: document.getElementById('subColor').value,
    url: document.getElementById('subUrl').value.trim(),
    notes: document.getElementById('subNotes').value.trim(),
    is_trial: isTrial ? 1 : 0,
    trial_end_date: isTrial ? document.getElementById('subTrialEndDate').value : null,
    is_shared: isShared ? 1 : 0,
    shared_with_count: isShared ? parseInt(document.getElementById('subSharedCount').value) || 2 : 1,
    my_share_price: isShared ? parseFloat(document.getElementById('subMySharePrice').value) || null : null,
    shared_friend_ids: isShared ? sharedFriendIds : ''
  };

  if (!data.name) {
    showToast('El nombre del servicio es obligatorio', 'error');
    return;
  }

  try {
    let res;
    if (state.editingId) {
      res = await fetch(`/api/subscriptions/${state.editingId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
    }

    const result = await res.json();
    if (result.success) {
      showToast(state.editingId ? 'Suscripción actualizada' : 'Suscripción guardada con éxito', 'success');
      closeModal();
      await loadAllData();
    } else {
      showToast(result.error || 'Ocurrió un error', 'error');
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

// ================= ACCIONES DE SUSCRIPCIÓN & PAGOS =================
async function editSubscription(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (sub) openModal(sub);
}

async function deleteSubscription(id, name) {
  if (!confirm(`¿Estás seguro de que deseas eliminar la suscripción a "${name}"?`)) return;
  try {
    const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    const result = await res.json();
    if (result.success) {
      showToast(`Suscripción "${name}" eliminada`, 'info');
      await loadAllData();
    }
  } catch (err) {
    console.error('Error al eliminar:', err);
  }
}

async function toggleSubscriptionStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  try {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Suscripción ${newStatus === 'active' ? 'activada' : 'pausada'}`, 'success');
      await loadAllData();
    }
  } catch (err) {
    console.error('Error al cambiar estado:', err);
  }
}

async function markAsPaidAndAdvance(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;
  const amount = sub.is_shared && sub.my_share_price ? sub.my_share_price : sub.price;

  try {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        subscription_id: id,
        amount: amount,
        currency: sub.currency || 'USD',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: sub.payment_method || 'Tarjeta',
        notes: `Cobro de corte pagado`,
        advance_date: true
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Pago de ${sub.name} registrado y fecha de corte avanzada`, 'success');
      await loadAllData();
    }
  } catch (err) {
    console.error('Error registrando pago:', err);
  }
}

// ================= MODALES AUXILIARES =================
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (state.settings) {
    document.getElementById('settingBudget').value = state.settings.monthly_budget || 150;
    document.getElementById('settingBaseCurrency').value = state.settings.base_currency || 'USD';
    document.getElementById('settingDiscordWebhook').value = state.settings.discord_webhook || '';
  }
  renderUserProfile();
  modal?.classList.remove('hidden');
  initIcons();
}

function closeSettingsModal() {
  document.getElementById('settingsModal')?.classList.add('hidden');
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const data = {
    monthly_budget: parseFloat(document.getElementById('settingBudget').value) || 150,
    base_currency: document.getElementById('settingBaseCurrency').value,
    discord_webhook: document.getElementById('settingDiscordWebhook').value.trim()
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      showToast('Configuraciones guardadas exitosamente', 'success');
      closeSettingsModal();
      await loadAllData();
    }
  } catch (err) {
    console.error('Error guardando ajustes:', err);
  }
}

async function testWebhook() {
  const url = document.getElementById('settingDiscordWebhook')?.value.trim();
  if (!url) {
    showToast('Ingresa una URL de Webhook para probar', 'error');
    return;
  }
  try {
    showToast('Enviando mensaje de prueba...', 'info');
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ webhook_url: url })
    });
    const result = await res.json();
    if (result.success) showToast('¡Mensaje enviado con éxito al Webhook!', 'success');
    else showToast(result.error || 'Error al enviar webhook', 'error');
  } catch (err) {
    showToast('Error de red al probar webhook', 'error');
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Tu navegador no soporta notificaciones de escritorio', 'error');
    return;
  }
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      new Notification('SubTracker Pro', {
        body: '¡Notificaciones activadas!',
        icon: '/icon.svg'
      });
      showToast('Notificaciones de escritorio activadas', 'success');
    }
  });
}

function openManualPaymentModal() {
  const modal = document.getElementById('paymentModal');
  const select = document.getElementById('paySubSelect');
  if (!modal || !select) return;

  select.innerHTML = state.subscriptions.map(s => `
    <option value="${s.id}">${escapeHtml(s.name)} (${s.currency} ${s.price})</option>
  `).join('');

  document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
  if (state.subscriptions.length > 0) {
    document.getElementById('payAmount').value = state.subscriptions[0].price;
  }
  modal.classList.remove('hidden');
  initIcons();
}

function closePaymentModal() {
  document.getElementById('paymentModal')?.classList.add('hidden');
}

async function handlePaymentSubmit(e) {
  e.preventDefault();
  const data = {
    subscription_id: parseInt(document.getElementById('paySubSelect').value),
    amount: parseFloat(document.getElementById('payAmount').value) || 0,
    payment_date: document.getElementById('payDate').value,
    payment_method: document.getElementById('payMethod').value.trim(),
    notes: document.getElementById('payNotes').value.trim()
  };

  try {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      showToast('Pago registrado exitosamente', 'success');
      closePaymentModal();
      await loadPayments();
      await loadStats();
    }
  } catch (err) {
    console.error('Error registrando pago:', err);
  }
}

function openBackupModal() {
  document.getElementById('backupModal')?.classList.remove('hidden');
  initIcons();
}

function closeBackupModal() {
  document.getElementById('backupModal')?.classList.add('hidden');
}

function exportJson() {
  window.open('/api/export', '_blank');
}

function exportCsv() {
  const subs = state.subscriptions || [];
  if (subs.length === 0) {
    showToast('No hay datos para exportar', 'info');
    return;
  }
  const headers = ['ID', 'Nombre', 'Precio', 'Moneda', 'Ciclo', 'Proximo_Corte', 'Costo_Mensual', 'Costo_Anual', 'Categoria', 'Estado', 'Es_Trial', 'Es_Compartida', 'Notas'];
  const rows = subs.map(s => [
    s.id, `"${(s.name || '').replace(/"/g, '""')}"`, s.price, s.currency, s.billing_cycle, s.next_billing_date,
    s.monthly_cost, s.annual_cost, `"${(s.category || '').replace(/"/g, '""')}"`, s.status, s.is_trial ? 'SI' : 'NO', s.is_shared ? 'SI' : 'NO', `"${(s.notes || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvContent));
  link.setAttribute('download', `suscripciones_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Archivo CSV exportado', 'success');
}

async function handleImportJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        showToast(`Se importaron ${result.imported_count} suscripciones`, 'success');
        closeBackupModal();
        await loadAllData();
      }
    } catch (err) {
      showToast('Archivo JSON inválido', 'error');
    }
  };
  reader.readAsText(file);
}

async function resetDemoData() {
  if (!confirm('¿Restablecer datos de demostración?')) return;
  try {
    const res = await fetch('/api/reset', { method: 'POST', headers: getAuthHeaders() });
    const result = await res.json();
    if (result.success) {
      showToast('Datos de demostración restablecidos', 'success');
      closeBackupModal();
      await loadAllData();
    }
  } catch (err) {
    console.error('Error al resetear:', err);
  }
}

// ================= HELPERS =================
function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateFriendly(dateStr) {
  if (!dateStr) return 'Sin fecha';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch (e) {}
  return dateStr;
}

function getCutOffBadgeInfo(days) {
  if (days === null || days === undefined) return { text: 'Pendiente', badgeClass: 'bg-slate-800 text-slate-400' };
  if (days < 0) return { text: `Vencido hace ${Math.abs(days)}d`, badgeClass: 'bg-red-500/20 text-red-300 border border-red-500/30' };
  if (days === 0) return { text: '¡Hoy!', badgeClass: 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse' };
  if (days === 1) return { text: 'Mañana', badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' };
  if (days <= 7) return { text: `En ${days} días`, badgeClass: 'bg-amber-500/20 text-amber-200 border border-amber-500/20' };
  return { text: `En ${days} días`, badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700' };
}

function getStatusBadge(status) {
  if (status === 'active') return `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Activa</span>`;
  if (status === 'paused') return `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Pausada</span>`;
  return `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">Cancelada</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const msgElem = document.getElementById('toastMessage');
  const iconElem = document.getElementById('toastIcon');
  if (!toast || !msgElem) return;

  msgElem.textContent = message;
  let iconHtml = type === 'success' ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>' : (type === 'error' ? '<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400"></i>' : '<i data-lucide="info" class="w-4 h-4 text-indigo-400"></i>');
  let colorClasses = type === 'success' ? 'bg-slate-900/95 border-emerald-500/40 text-slate-100 shadow-emerald-500/10' : (type === 'error' ? 'bg-slate-900/95 border-rose-500/40 text-slate-100 shadow-rose-500/10' : 'bg-slate-900/95 border-indigo-500/40 text-slate-100 shadow-indigo-500/10');

  iconElem.innerHTML = iconHtml;
  toast.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-xs sm:text-sm font-medium border transition-all duration-300 ease-out ${colorClasses}`;
  initIcons();

  toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'), 3500);
}

// Funciones accesibles globalmente
window.editSubscription = editSubscription;
window.deleteSubscription = deleteSubscription;
window.toggleSubscriptionStatus = toggleSubscriptionStatus;
window.markAsPaidAndAdvance = markAsPaidAndAdvance;
window.editFriend = editFriend;
window.deleteFriend = deleteFriend;
window.recordFriendPaymentPrompt = recordFriendPaymentPrompt;
window.selectCalendarDate = selectCalendarDate;
window.changeCalendarMonth = changeCalendarMonth;
window.resetCalendarToToday = resetCalendarToToday;
