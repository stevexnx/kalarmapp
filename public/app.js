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
  friendRequests: { received: [], sent: [] },
  splitPayRequests: { received: [], sent: [] },
  splitPayTab: 'received', // 'received' | 'sent'
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

// ================= CATÁLOGO DE SUSCRIPCIONES POPULARES (PRECIOS OFICIALES E ICONOS) =================
const PRESET_SERVICES = [
  // Streaming de Video
  {
    name: 'Netflix',
    category: 'Streaming',
    color: '#E50914',
    icon: 'netflix',
    url: 'https://www.netflix.com',
    defaultPlan: 'Estándar',
    plans: [
      { name: 'Estándar con anuncios', priceUsd: 6.99, cycle: 'monthly' },
      { name: 'Estándar (1080p)', priceUsd: 15.49, cycle: 'monthly' },
      { name: 'Premium (4K HDR)', priceUsd: 22.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'Disney+',
    category: 'Streaming',
    color: '#113CCF',
    icon: 'disneyplus',
    url: 'https://www.disneyplus.com',
    defaultPlan: 'Estándar',
    plans: [
      { name: 'Estándar con anuncios', priceUsd: 9.99, cycle: 'monthly' },
      { name: 'Estándar sin anuncios', priceUsd: 15.99, cycle: 'monthly' },
      { name: 'Premium 4K', priceUsd: 19.99, cycle: 'monthly' },
      { name: 'Premium Anual', priceUsd: 159.99, cycle: 'annual' }
    ]
  },
  {
    name: 'Amazon Prime',
    category: 'Streaming',
    color: '#00A8E1',
    icon: 'amazonprime',
    url: 'https://www.amazon.com/prime',
    defaultPlan: 'Mensual',
    plans: [
      { name: 'Mensual', priceUsd: 14.99, cycle: 'monthly' },
      { name: 'Anual', priceUsd: 139.00, cycle: 'annual' }
    ]
  },
  {
    name: 'Max (HBO)',
    category: 'Streaming',
    color: '#002BE7',
    icon: 'max',
    url: 'https://www.max.com',
    defaultPlan: 'Estándar',
    plans: [
      { name: 'Básico con anuncios', priceUsd: 9.99, cycle: 'monthly' },
      { name: 'Estándar Full HD', priceUsd: 16.99, cycle: 'monthly' },
      { name: 'Platino 4K Ultra HD', priceUsd: 20.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'YouTube Premium',
    category: 'Streaming',
    color: '#FF0000',
    icon: 'youtube',
    url: 'https://www.youtube.com/premium',
    defaultPlan: 'Individual',
    plans: [
      { name: 'Individual', priceUsd: 13.99, cycle: 'monthly' },
      { name: 'Familiar (hasta 5)', priceUsd: 22.99, cycle: 'monthly' },
      { name: 'Estudiante', priceUsd: 7.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'Apple TV+',
    category: 'Streaming',
    color: '#000000',
    icon: 'appletv',
    url: 'https://tv.apple.com',
    defaultPlan: 'Mensual',
    plans: [
      { name: 'Mensual', priceUsd: 9.99, cycle: 'monthly' },
      { name: 'Anual', priceUsd: 99.00, cycle: 'annual' }
    ]
  },
  {
    name: 'Paramount+',
    category: 'Streaming',
    color: '#0064FF',
    icon: 'paramountplus',
    url: 'https://www.paramountplus.com',
    defaultPlan: 'Estándar',
    plans: [
      { name: 'Essential', priceUsd: 7.99, cycle: 'monthly' },
      { name: 'Con Showtime', priceUsd: 12.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'Crunchyroll',
    category: 'Streaming',
    color: '#F47521',
    icon: 'crunchyroll',
    url: 'https://www.crunchyroll.com',
    defaultPlan: 'Fan',
    plans: [
      { name: 'Fan', priceUsd: 7.99, cycle: 'monthly' },
      { name: 'Mega Fan', priceUsd: 11.99, cycle: 'monthly' },
      { name: 'Mega Fan Anual', priceUsd: 99.99, cycle: 'annual' }
    ]
  },

  // Música & Audio
  {
    name: 'Spotify',
    category: 'Música',
    color: '#1DB954',
    icon: 'spotify',
    url: 'https://www.spotify.com',
    defaultPlan: 'Individual',
    plans: [
      { name: 'Individual', priceUsd: 11.99, cycle: 'monthly' },
      { name: 'Duo (2 cuentas)', priceUsd: 16.99, cycle: 'monthly' },
      { name: 'Familiar (6 cuentas)', priceUsd: 19.99, cycle: 'monthly' },
      { name: 'Estudiantes', priceUsd: 5.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'Apple Music',
    category: 'Música',
    color: '#FC3C44',
    icon: 'applemusic',
    url: 'https://music.apple.com',
    defaultPlan: 'Individual',
    plans: [
      { name: 'Individual', priceUsd: 10.99, cycle: 'monthly' },
      { name: 'Familiar', priceUsd: 16.99, cycle: 'monthly' },
      { name: 'Estudiante', priceUsd: 5.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'YouTube Music',
    category: 'Música',
    color: '#FF0000',
    icon: 'youtubemusic',
    url: 'https://music.youtube.com',
    defaultPlan: 'Individual',
    plans: [
      { name: 'Individual', priceUsd: 10.99, cycle: 'monthly' },
      { name: 'Familiar', priceUsd: 16.99, cycle: 'monthly' }
    ]
  },

  // Inteligencia Artificial & Productividad
  {
    name: 'ChatGPT Plus',
    category: 'IA & Productividad',
    color: '#10A37F',
    icon: 'openai',
    url: 'https://chatgpt.com',
    defaultPlan: 'Plus',
    plans: [
      { name: 'Plus (GPT-4o & o1)', priceUsd: 20.00, cycle: 'monthly' },
      { name: 'Pro (o1 Pro ilimitado)', priceUsd: 200.00, cycle: 'monthly' }
    ]
  },
  {
    name: 'Claude Pro',
    category: 'IA & Productividad',
    color: '#D97706',
    icon: 'anthropic',
    url: 'https://claude.ai',
    defaultPlan: 'Pro',
    plans: [
      { name: 'Pro (Claude 3.5 Sonnet)', priceUsd: 20.00, cycle: 'monthly' }
    ]
  },
  {
    name: 'Midjourney',
    category: 'IA & Productividad',
    color: '#2B2D42',
    icon: 'midjourney',
    url: 'https://www.midjourney.com',
    defaultPlan: 'Estándar',
    plans: [
      { name: 'Básico', priceUsd: 10.00, cycle: 'monthly' },
      { name: 'Estándar', priceUsd: 30.00, cycle: 'monthly' },
      { name: 'Pro', priceUsd: 60.00, cycle: 'monthly' }
    ]
  },
  {
    name: 'GitHub Copilot',
    category: 'IA & Productividad',
    color: '#24292F',
    icon: 'github',
    url: 'https://github.com/features/copilot',
    defaultPlan: 'Individual',
    plans: [
      { name: 'Individual', priceUsd: 10.00, cycle: 'monthly' },
      { name: 'Individual Anual', priceUsd: 100.00, cycle: 'annual' }
    ]
  },
  {
    name: 'Microsoft 365',
    category: 'IA & Productividad',
    color: '#D83B01',
    icon: 'microsoft',
    url: 'https://www.microsoft.com/microsoft-365',
    defaultPlan: 'Personal',
    plans: [
      { name: 'Personal Mensual', priceUsd: 6.99, cycle: 'monthly' },
      { name: 'Personal Anual', priceUsd: 69.99, cycle: 'annual' },
      { name: 'Familia (6 pers) Mensual', priceUsd: 9.99, cycle: 'monthly' },
      { name: 'Familia (6 pers) Anual', priceUsd: 99.99, cycle: 'annual' }
    ]
  },
  {
    name: 'Notion Plus',
    category: 'IA & Productividad',
    color: '#000000',
    icon: 'notion',
    url: 'https://www.notion.so',
    defaultPlan: 'Plus Mensual',
    plans: [
      { name: 'Plus Mensual', priceUsd: 10.00, cycle: 'monthly' },
      { name: 'Plus Anual', priceUsd: 96.00, cycle: 'annual' }
    ]
  },

  // Gaming
  {
    name: 'Xbox Game Pass',
    category: 'Gaming',
    color: '#107C10',
    icon: 'xbox',
    url: 'https://www.xbox.com/game-pass',
    defaultPlan: 'Ultimate',
    plans: [
      { name: 'Core (Consola)', priceUsd: 9.99, cycle: 'monthly' },
      { name: 'PC Game Pass', priceUsd: 11.99, cycle: 'monthly' },
      { name: 'Ultimate (PC + Cloud)', priceUsd: 19.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'PlayStation Plus',
    category: 'Gaming',
    color: '#003791',
    icon: 'playstation',
    url: 'https://www.playstation.com/ps-plus',
    defaultPlan: 'Extra',
    plans: [
      { name: 'Essential', priceUsd: 9.99, cycle: 'monthly' },
      { name: 'Extra (Catálogo juegos)', priceUsd: 14.99, cycle: 'monthly' },
      { name: 'Premium (Clásicos & Nube)', priceUsd: 17.99, cycle: 'monthly' },
      { name: 'Essential Anual', priceUsd: 79.99, cycle: 'annual' },
      { name: 'Extra Anual', priceUsd: 134.99, cycle: 'annual' },
      { name: 'Premium Anual', priceUsd: 159.99, cycle: 'annual' }
    ]
  },
  {
    name: 'Nintendo Switch Online',
    category: 'Gaming',
    color: '#E60012',
    icon: 'nintendo',
    url: 'https://www.nintendo.com/switch-online',
    defaultPlan: 'Individual Anual',
    plans: [
      { name: 'Individual Anual', priceUsd: 19.99, cycle: 'annual' },
      { name: 'Individual + Paquete Expansión', priceUsd: 49.99, cycle: 'annual' },
      { name: 'Familiar Anual (hasta 8)', priceUsd: 34.99, cycle: 'annual' }
    ]
  },

  // Almacenamiento en Nube & Seguridad
  {
    name: 'Google One',
    category: 'Nube & Utilidades',
    color: '#4285F4',
    icon: 'google',
    url: 'https://one.google.com',
    defaultPlan: '100 GB',
    plans: [
      { name: 'Básico (100 GB)', priceUsd: 1.99, cycle: 'monthly' },
      { name: 'Estándar (200 GB)', priceUsd: 2.99, cycle: 'monthly' },
      { name: 'Premium (2 TB)', priceUsd: 9.99, cycle: 'monthly' },
      { name: 'AI Premium (Gemini Advanced 2TB)', priceUsd: 19.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'iCloud+',
    category: 'Nube & Utilidades',
    color: '#007AFF',
    icon: 'apple',
    url: 'https://www.apple.com/icloud',
    defaultPlan: '50 GB',
    plans: [
      { name: '50 GB', priceUsd: 0.99, cycle: 'monthly' },
      { name: '200 GB', priceUsd: 2.99, cycle: 'monthly' },
      { name: '2 TB', priceUsd: 9.99, cycle: 'monthly' }
    ]
  },
  {
    name: 'Dropbox Plus',
    category: 'Nube & Utilidades',
    color: '#0061FF',
    icon: 'dropbox',
    url: 'https://www.dropbox.com',
    defaultPlan: 'Plus 2TB',
    plans: [
      { name: 'Plus Mensual (2 TB)', priceUsd: 11.99, cycle: 'monthly' },
      { name: 'Plus Anual (2 TB)', priceUsd: 119.88, cycle: 'annual' }
    ]
  },
  {
    name: '1Password',
    category: 'Nube & Utilidades',
    color: '#0A85EA',
    icon: '1password',
    url: 'https://1password.com',
    defaultPlan: 'Individual',
    plans: [
      { name: 'Individual Anual', priceUsd: 35.88, cycle: 'annual' },
      { name: 'Familiar Anual (5 pers)', priceUsd: 59.88, cycle: 'annual' }
    ]
  }
];

// ================= ICONOS OFICIALES DE SERVICIOS (SVG OPTIMIZADOS) =================
const OFFICIAL_ICONS = {
  netflix: `<svg viewBox="0 0 24 24" fill="#E50914"><path d="M5.398 0v24c1.196-.27 2.378-.584 3.546-.944V8.49L15.06 24c1.23-.33 2.44-.7 3.542-1.077V0h-3.542v15.228L8.944 0H5.398z"/></svg>`,
  spotify: `<svg viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.215.354-.676.467-1.03.252-2.825-1.728-6.38-2.119-10.57-1.162-.405.093-.811-.161-.904-.567-.093-.405.162-.811.567-.904 4.588-1.048 8.524-.606 11.685 1.33.354.215.467.676.252 1.031zm1.47-3.266c-.27.44-.847.578-1.287.308-3.235-1.988-8.167-2.563-11.994-1.401-.497.151-1.025-.133-1.176-.63-.151-.498.133-1.026.63-1.177 4.375-1.328 9.805-.688 13.519 1.593.44.27.578.847.308 1.287zm.126-3.41C15.228 8.35 8.843 8.14 5.15 9.26c-.604.184-1.246-.164-1.43-.768-.184-.604.164-1.246.768-1.43 4.24-1.287 11.29-1.047 15.753 1.603.543.322.721 1.027.4 1.57-.323.542-1.028.72-1.57.398z"/></svg>`,
  disneyplus: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.8 14.5c-1.3 0-2.4-.6-3.2-1.5-.7.9-1.8 1.5-3.1 1.5-2.2 0-3.9-1.8-3.9-4s1.7-4 3.9-4c1.3 0 2.4.6 3.1 1.5.8-.9 1.9-1.5 3.2-1.5 2.2 0 3.9 1.8 3.9 4s-1.7 4-3.9 4z"/></svg>`,
  amazonprime: `<svg viewBox="0 0 24 24" fill="#00A8E1"><path d="M13.88 15.65c-2.3 1.7-5.63 2.6-8.52 2.6-4.04 0-7.7-1.5-10.46-4.02-.22-.2-.04-.5.22-.35 3.06 1.77 6.8 2.82 10.63 2.82 2.56 0 5.4-.53 7.97-1.63.39-.17.72.27.16.58zm1.09-.97c-.29-.38-1.94-.18-2.68-.09-.23.03-.26-.16-.06-.31 1.34-.98 3.53-.7 3.79-.38.26.33-.07 2.53-1.34 3.6-.19.16-.38.07-.3-.14.28-.7 1.01-2.02.59-2.68zM24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  youtubemusic: `<svg viewBox="0 0 24 24" fill="#FF0000"><circle cx="12" cy="12" r="12" fill="#FF0000"/><path fill="#FFF" d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm-2 8.5v-5l4.5 2.5-4.5 2.5z"/></svg>`,
  appletv: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.85-.92.04-2.03.62-2.69 1.38-.58.67-1.09 1.74-1.04 2.81 1.03.08 2.1-.59 2.72-1.34z"/></svg>`,
  applemusic: `<svg viewBox="0 0 24 24" fill="#FC3C44"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.025 8.643l-5.69 1.393v5.82c0 1.258-.948 2.144-2.115 2.144-1.168 0-2.115-.886-2.115-2.144 0-1.257.947-2.143 2.115-2.143.438 0 .84.14 1.183.376V7.472a.933.933 0 0 1 .715-.91l6.198-1.517c.563-.138 1.074.286 1.074.863v8.948c0 1.258-.948 2.144-2.115 2.144-1.168 0-2.115-.886-2.115-2.144 0-1.257.947-2.143 2.115-2.143.438 0 .84.14 1.183.376V8.92c0-.15-.099-.27-.248-.277z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.85-.92.04-2.03.62-2.69 1.38-.58.67-1.09 1.74-1.04 2.81 1.03.08 2.1-.59 2.72-1.34z"/></svg>`,
  max: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M2.5 7.5h3.2l2.3 4.6 2.3-4.6h3.2v9h-2.8v-5.2l-1.9 3.8h-1.6l-1.9-3.8v5.2H2.5v-9zm12.3 0h3.5l2.7 5.5 2.7-5.5h3.5v9h-2.8v-5.2l-2.4 4.8h-1.9l-2.4-4.8v5.2h-2.9v-9z"/></svg>`,
  paramountplus: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 2L2 20h20L12 2zm0 4.8l6.2 11.2H5.8L12 6.8z"/></svg>`,
  crunchyroll: `<svg viewBox="0 0 24 24" fill="#F47521"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.8 14.5A7.5 7.5 0 0 1 6.5 12a7.5 7.5 0 0 1 10.3-6.5 6 6 0 1 0 0 13z"/></svg>`,
  openai: `<svg viewBox="0 0 24 24" fill="#10A37F"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zm-1.22-9.61a4.472 4.472 0 0 1 2.34-1.97v5.676a.799.799 0 0 0 .392.682l5.844 3.37-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.38 8.694zm15.932 3.532l-5.844-3.37 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.79a4.494 4.494 0 0 1-.685 8.105v-5.676a.795.795 0 0 0-.392-.681zm2.01-4.852l-.141-.085-4.779-2.76a.776.776 0 0 0-.78 0l-5.844 3.37V5.568a.085.085 0 0 1 .033-.062l4.84-2.793a4.5 4.5 0 0 1 6.67 4.659zM8.305 13.576l-2.02-1.168a.076.076 0 0 1-.038-.052V6.773a4.5 4.5 0 0 1 7.37-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.392.681v6.737zm1.141-2.072l2.554-1.474 2.554 1.474v2.95l-2.554 1.475-2.554-1.475v-2.95z"/></svg>`,
  anthropic: `<svg viewBox="0 0 24 24" fill="#D97706"><path d="M14.5 2.5h-5L2 21.5h4.8l1.8-4.6h6.8l1.8 4.6H22L14.5 2.5zm-4.4 11.2l2.4-6.3 2.4 6.3h-4.8z"/></svg>`,
  midjourney: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 2L4 20h4.5l1.8-4.2h3.4L15.5 20H20L12 2zm-.8 9.8l1.3-3.2 1.3 3.2h-2.6z"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
  microsoft: `<svg viewBox="0 0 24 24"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M1 13h10v10H1z"/><path fill="#7fba00" d="M13 1h10v10H13z"/><path fill="#ffb900" d="M13 13h10v10H13z"/></svg>`,
  notion: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.97c-.42-.326-.98-.7-2.054-.607L3.01 2.457c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.213.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.793-.887l-15.084.887c-.56.046-.792.373-.792.934zm12.364 1.773c.093.42 0 .84-.42.887l-.934.186v8.492c-.606.327-1.166.514-1.633.514-.746 0-1.026-.233-1.633-.98l-4.526-7.045v6.578l1.353.327c.42.093.514.513.514.84 0 .326-.234.466-.654.466l-3.313.187c-.093-.374 0-.794.373-.84l.98-.234V9.998l-1.306-.14c-.374-.047-.467-.42-.467-.747 0-.327.28-.467.653-.467l3.733-.233 4.9 7.372V10.14l-1.213-.234c-.42-.093-.467-.466-.467-.793 0-.327.28-.467.653-.467z"/></svg>`,
  xbox: `<svg viewBox="0 0 24 24" fill="#107C10"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.25c2.44 0 4.678.89 6.425 2.37-1.12.87-2.92 2.38-4.525 3.99-1.25-1.3-2.65-2.65-3.9-3.8 0-.01 0-.01 0-.01 1.99-.95 4.23-.55 2-.55zm-7.75 3.25c.87-.72 1.87-1.32 2.97-1.76 1.48 1.34 3.09 2.89 4.54 4.38-2.6 2.5-5.38 4.79-7.51 4.79-.04 0-.08 0-.12-.01.07-2.73 1.1-5.26 2.12-7.4zm15.5 0c1.02 2.14 2.05 4.67 2.12 7.4-.04.01-.08.01-.12.01-2.13 0-4.91-2.29-7.51-4.79 1.45-1.49 3.06-3.04 4.54-4.38 1.1.44 2.1 1.04 2.97 1.76zM12 21.75c-2.31 0-4.46-.77-6.2-2.07 2.66-.4 6.2-3.8 6.2-7.08 0 3.28 3.54 6.68 6.2 7.08-1.74 1.3-3.89 2.07-6.2 2.07z"/></svg>`,
  playstation: `<svg viewBox="0 0 24 24" fill="#003791"><path d="M12.01 2c-3.15 0-4.91 1.25-5.01 3.48-.12 2.67 2.14 3.65 4.96 4.13l1.83.33v3.74c-.95-.14-1.93-.41-2.91-.84-.96-.42-1.42-.92-1.42-1.55 0-.29.1-.55.33-.82l-2.79-1.1c-.53.71-.8 1.48-.8 2.31 0 1.41.67 2.58 2.02 3.51 1.34.93 3.19 1.5 5.57 1.71v3.1h2.78v-3.04c2.25-.13 4.14-.64 5.67-1.52 1.54-.88 2.31-2 2.31-3.36 0-1.63-1.07-2.88-3.21-3.76l-1.99-.83v-3.7c1.01.12 1.83.35 2.45.69.63.34.94.75.94 1.23 0 .27-.08.5-.26.69l2.7 1.21c.42-.64.63-1.32.63-2.04 0-1.28-.6-2.34-1.8-3.18-1.2-.84-2.89-1.37-5.07-1.59V2h-2.23zm-.01 5.37c-.96-.13-1.63-.37-2.02-.73-.38-.36-.45-.75-.22-1.18.23-.42.72-.64 1.48-.64.76 0 1.44.22 2.04.65l-1.28 1.9zm2.79 5.86v-1.92l1.37.58c.84.36 1.26.83 1.26 1.41 0 .58-.42 1.01-1.26 1.29-.84.28-1.84.42-3.01.42l1.64-1.78z"/></svg>`,
  nintendo: `<svg viewBox="0 0 24 24" fill="#E60012"><path d="M0 12c0 6.627 5.373 12 12 12s12-5.373 12-12S18.627 0 12 0 0 5.373 0 12zm7.5-6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm9 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm-9-5.5h3v11h-3V8zm6-3h3v11h-3V5z"/></svg>`,
  google: `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27A7.16 7.16 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.25A11.97 11.97 0 0 0 0 12c0 1.92.45 3.74 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>`,
  dropbox: `<svg viewBox="0 0 24 24" fill="#0061FF"><path d="M6 2l6 3.93-6 3.93-6-3.93L6 2zm12 0l6 3.93-6 3.93-6-3.93L18 2zM0 13.79l6 3.93 6-3.93-6-3.93-6 3.93zm18-3.93l-6 3.93 6 3.93 6-3.93-6-3.93zM6 19.36l6-3.93 6 3.93-6 3.93-6-3.93z"/></svg>`,
  '1password': `<svg viewBox="0 0 24 24" fill="#0A85EA"><circle cx="12" cy="12" r="12"/><path fill="#FFF" d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm-1 2.5a1 1 0 0 1 2 0v2.09a2.5 2.5 0 1 1-2 0V8.5zm1 4.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>`
};

function getServiceOfficialIcon(name, customColor = '#4F46E5', sizeClass = 'w-5 h-5') {
  if (!name) return `<i data-lucide="credit-card" class="${sizeClass}"></i>`;
  const lower = name.toLowerCase().trim();

  // Buscar coincidencia en PRESET_SERVICES
  const matched = PRESET_SERVICES.find(s => 
    lower.includes(s.name.toLowerCase()) || 
    s.name.toLowerCase().includes(lower)
  );

  if (matched && matched.icon && OFFICIAL_ICONS[matched.icon]) {
    return OFFICIAL_ICONS[matched.icon];
  }

  // Comprobaciones heurísticas directas
  if (lower.includes('netflix')) return OFFICIAL_ICONS.netflix;
  if (lower.includes('spotify')) return OFFICIAL_ICONS.spotify;
  if (lower.includes('disney')) return OFFICIAL_ICONS.disneyplus;
  if (lower.includes('prime') || lower.includes('amazon')) return OFFICIAL_ICONS.amazonprime;
  if (lower.includes('youtube music')) return OFFICIAL_ICONS.youtubemusic;
  if (lower.includes('youtube')) return OFFICIAL_ICONS.youtube;
  if (lower.includes('apple tv')) return OFFICIAL_ICONS.appletv;
  if (lower.includes('apple music')) return OFFICIAL_ICONS.applemusic;
  if (lower.includes('apple') || lower.includes('icloud')) return OFFICIAL_ICONS.apple;
  if (lower.includes('chatgpt') || lower.includes('openai') || lower.includes('gpt')) return OFFICIAL_ICONS.openai;
  if (lower.includes('claude') || lower.includes('anthropic')) return OFFICIAL_ICONS.anthropic;
  if (lower.includes('midjourney')) return OFFICIAL_ICONS.midjourney;
  if (lower.includes('github') || lower.includes('copilot')) return OFFICIAL_ICONS.github;
  if (lower.includes('microsoft') || lower.includes('office') || lower.includes('365')) return OFFICIAL_ICONS.microsoft;
  if (lower.includes('notion')) return OFFICIAL_ICONS.notion;
  if (lower.includes('xbox') || lower.includes('game pass')) return OFFICIAL_ICONS.xbox;
  if (lower.includes('playstation') || lower.includes('ps plus')) return OFFICIAL_ICONS.playstation;
  if (lower.includes('nintendo') || lower.includes('switch')) return OFFICIAL_ICONS.nintendo;
  if (lower.includes('google') || lower.includes('drive')) return OFFICIAL_ICONS.google;
  if (lower.includes('dropbox')) return OFFICIAL_ICONS.dropbox;
  if (lower.includes('1password') || lower.includes('password')) return OFFICIAL_ICONS['1password'];
  if (lower.includes('max') || lower.includes('hbo')) return OFFICIAL_ICONS.max;
  if (lower.includes('paramount')) return OFFICIAL_ICONS.paramountplus;
  if (lower.includes('crunchyroll')) return OFFICIAL_ICONS.crunchyroll;

  // Letra inicial por defecto si no es una marca reconocida
  return `<span class="font-bold text-sm text-white">${name.charAt(0).toUpperCase()}</span>`;
}

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
    const isDev = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname.endsWith('.local') ||
                  window.location.search.includes('disable_sw=true');

    if (isDev) {
      // En desarrollo: desregistrar SW activos y limpiar caches para evitar bloqueos de caché
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const reg of registrations) {
          reg.unregister().then(() => console.log('SW desregistrado para entorno de desarrollo'));
        }
      });
      if ('caches' in window) {
        caches.keys().then(names => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
          // Chequear si hay actualización inmediatamente
          reg.update();
        }).catch(err => console.log('SW error:', err));
      });
    }
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
    if (tabLogin) tabLogin.className = 'py-2 rounded-full bg-[#d0bcff] text-[#381e72] font-semibold transition';
    if (tabReg) tabReg.className = 'py-2 rounded-full text-[#cac4d0] hover:text-white transition';
    extraFields?.classList.add('hidden');
    rememberContainer?.classList.remove('hidden');
    if (submitBtn) submitBtn.textContent = 'Entrar a mi Cuenta';
  } else {
    if (title) title.textContent = 'Crear Nueva Cuenta';
    if (subtitle) subtitle.textContent = 'Crea tu espacio personal y privado';
    if (tabReg) tabReg.className = 'py-2 rounded-full bg-[#d0bcff] text-[#381e72] font-semibold transition';
    if (tabLogin) tabLogin.className = 'py-2 rounded-full text-[#cac4d0] hover:text-white transition';
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
      let result;
      try {
        result = await res.json();
      } catch (parseErr) {
        const text = await res.text().catch(() => '');
        showToast(`Error del servidor (${res.status}): ${text.slice(0, 100) || 'Respuesta inválida'}`, 'error');
        return;
      }
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
      console.error('Login error:', err);
      showToast(`Error de conexión: ${err.message || err}`, 'error');
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
  // Tabs principales (móvil y Navigation Rail escritorio)
  document.getElementById('tabBtnDashboard')?.addEventListener('click', () => switchTab('dashboard'));
  document.getElementById('tabBtnCalendar')?.addEventListener('click', () => switchTab('calendar'));
  document.getElementById('tabBtnPayments')?.addEventListener('click', () => switchTab('payments'));
  document.getElementById('tabBtnFriends')?.addEventListener('click', () => switchTab('friends'));

  document.getElementById('railBtnDashboard')?.addEventListener('click', () => switchTab('dashboard'));
  document.getElementById('railBtnCalendar')?.addEventListener('click', () => switchTab('calendar'));
  document.getElementById('railBtnPayments')?.addEventListener('click', () => switchTab('payments'));
  document.getElementById('railBtnFriends')?.addEventListener('click', () => switchTab('friends'));
  document.getElementById('railBtnSettings')?.addEventListener('click', openSettingsModal);
  document.getElementById('railBtnBackup')?.addEventListener('click', openBackupModal);

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

  // Amigos y Funciones Sociales
  document.getElementById('btnOpenAddFriendModal')?.addEventListener('click', () => openFriendModal());
  document.getElementById('btnOpenAddFriendModal2')?.addEventListener('click', () => openFriendModal());
  document.getElementById('btnCloseFriendModal')?.addEventListener('click', closeFriendModal);
  document.getElementById('btnCancelFriendModal')?.addEventListener('click', closeFriendModal);
  document.getElementById('friendForm')?.addEventListener('submit', handleFriendSubmit);

  // Buscador de Usuarios Registrados
  document.getElementById('btnOpenUserSearchModal')?.addEventListener('click', openUserSearchModal);
  document.getElementById('btnCloseUserSearchModal')?.addEventListener('click', closeUserSearchModal);
  document.getElementById('userSearchInput')?.addEventListener('input', debounce((e) => handleUserSearch(e.target.value.trim()), 300));

  // Split Pay (Pago en Conjunto)
  document.getElementById('btnCloseSplitPayModal')?.addEventListener('click', closeSplitPayModal);
  document.getElementById('btnCancelSplitPayModal')?.addEventListener('click', closeSplitPayModal);
  document.getElementById('splitPayForm')?.addEventListener('submit', handleSplitPaySubmit);
  document.getElementById('splitPaySubSelect')?.addEventListener('change', handleSplitPaySubChange);
  document.getElementById('btnTabSplitReceived')?.addEventListener('click', () => setSplitPayTab('received'));
  document.getElementById('btnTabSplitSent')?.addEventListener('click', () => setSplitPayTab('sent'));

  // Suscripciones en Común
  document.getElementById('btnCloseSharedSubsModal')?.addEventListener('click', closeSharedSubsModal);
  document.getElementById('btnOkSharedSubsModal')?.addEventListener('click', closeSharedSubsModal);

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
  document.getElementById('btnBackToPresets')?.addEventListener('click', showPresetsStep);
  document.getElementById('btnBackToPresetsForm')?.addEventListener('click', showPresetsStep);
  document.getElementById('btnCustomSubscription')?.addEventListener('click', openCustomSubscription);
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

  // Catálogo M3 de Servicios & Presets
  document.getElementById('presetSearchInput')?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    const activeChip = document.querySelector('#presetCategoryChips .m3-chip.active');
    const cat = activeChip ? activeChip.dataset.cat : 'all';
    renderPresetCatalog(cat, query);
  });

  document.querySelectorAll('#presetCategoryChips .m3-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#presetCategoryChips .m3-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const query = document.getElementById('presetSearchInput')?.value.trim() || '';
      renderPresetCatalog(chip.dataset.cat, query);
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
    const [resFriends, resBalances, resReqs, resSplit] = await Promise.all([
      fetch('/api/friends', { headers: getAuthHeaders() }),
      fetch('/api/friends/balances', { headers: getAuthHeaders() }),
      fetch('/api/friends/requests', { headers: getAuthHeaders() }),
      fetch('/api/friends/split-requests', { headers: getAuthHeaders() })
    ]);
    const friendsData = await resFriends.json();
    const balancesData = await resBalances.json();
    const reqsData = await resReqs.json();
    const splitData = await resSplit.json();

    if (friendsData.success) {
      state.friends = friendsData.data;
      renderFriendsList();
      const badge = document.getElementById('friendsBadgeCount');
      if (badge) badge.textContent = state.friends.length;
      const railFriendsBadge = document.getElementById('railFriendsBadge');
      if (railFriendsBadge) railFriendsBadge.textContent = state.friends.length;
    }
    if (balancesData.success) {
      state.friendBalances = balancesData.data;
      renderFriendBalances();
    }
    if (reqsData.success) {
      state.friendRequests = reqsData.data || { received: [], sent: [] };
      renderFriendRequests();
    }
    if (splitData.success) {
      state.splitPayRequests = splitData.data || { received: [], sent: [] };
      renderSplitPayRequests();
    }
  } catch (err) {
    console.error('Error cargando amigos y datos sociales:', err);
  }
}

// ================= GESTIÓN Y RENDERIZADO DE AMIGOS Y COBROS =================
function renderFriendsList() {
  const grid = document.getElementById('friendsListGrid');
  const countBadgeHeader = document.getElementById('friendsCountBadgeHeader');
  const totalElem = document.getElementById('friendsTotalOwed');
  if (!grid) return;

  const friends = state.friends || [];
  const balances = state.friendBalances || [];
  
  if (countBadgeHeader) {
    countBadgeHeader.textContent = friends.length;
  }

  // Mapa de balances por ID de amigo
  const balanceMap = {};
  let grandTotalOwed = 0;
  balances.forEach(b => {
    if (b.friend && b.friend.id) {
      balanceMap[b.friend.id] = b;
      grandTotalOwed += (b.monthly_total_owed || 0);
    }
  });

  if (totalElem) {
    totalElem.textContent = `${state.currency}${formatNumber(grandTotalOwed)}`;
  }

  if (friends.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-10 text-center text-[#cac4d0] text-xs">
        No tienes amigos agregados aún. Busca usuarios registrados o agrega amigos manualmente para dividir gastos y suscripciones.
      </div>
    `;
    return;
  }

  grid.innerHTML = friends.map(f => {
    const isRegistered = Boolean(f.linked_user_id);
    const balanceInfo = balanceMap[f.id];
    const monthlyOwed = balanceInfo ? balanceInfo.monthly_total_owed : 0;
    const subsList = balanceInfo ? (balanceInfo.shared_subscriptions || []) : [];
    const hasActiveDebt = monthlyOwed > 0;

    // Mensaje preconfigurado para WhatsApp si debe algo
    const subNames = subsList.map(s => s.name).join(', ');
    const waText = encodeURIComponent(`Hola ${f.name}, te escribo para recordarte tu parte de ${subNames || 'las suscripciones'} de este mes por ${state.currency}${formatNumber(monthlyOwed)}. ¡Gracias!`);
    const waUrl = f.phone ? `https://wa.me/${f.phone.replace(/[^0-9]/g, '')}?text=${waText}` : `https://wa.me/?text=${waText}`;

    // Badges resumidos de suscripciones compartidas (hasta 2)
    let subsBadgesHtml = '';
    if (subsList.length > 0) {
      subsBadgesHtml = subsList.slice(0, 2).map(s => {
        const isDiff = s.currency && s.currency !== state.baseCurrencyCode;
        const shareConv = s.friend_share_converted !== undefined ? s.friend_share_converted : convertCurrency(s.friend_share, s.currency, state.baseCurrencyCode);
        return `
          <div class="flex items-center justify-between text-[11px] bg-[#141218] px-2.5 py-1 rounded-lg border border-[#49454f]/30">
            <span class="text-[#e6e0e9] font-medium truncate pr-2">${escapeHtml(s.name)}</span>
            <span class="font-mono font-bold text-[#a8d5b5] shrink-0 text-[10px]">${state.currency}${formatNumber(shareConv)}</span>
          </div>
        `;
      }).join('');
      if (subsList.length > 2) {
        subsBadgesHtml += `<div class="text-[10px] text-[#cac4d0] text-right">+${subsList.length - 2} más</div>`;
      }
    }

    return `
    <div onclick="viewSharedSubsWithFriend(${f.id}, '${escapeHtml(f.name)}', ${f.linked_user_id || 'null'})" class="p-4 bg-[#211f26] border border-[#49454f]/40 rounded-2xl flex flex-col justify-between hover:border-[#d0bcff]/70 hover:bg-[#28262f] cursor-pointer transition space-y-3 group shadow-sm">
      <!-- Encabezado de la Tarjeta del Amigo -->
      <div>
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow shrink-0 group-hover:scale-105 transition" style="background-color: ${f.avatar_color || '#a8d5b5'}; color: #133821">
              ${escapeHtml(f.name.charAt(0).toUpperCase())}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="text-xs font-bold text-white font-google-sans truncate group-hover:text-[#d0bcff] transition">${escapeHtml(f.name)}</h4>
                ${isRegistered ? `<span class="text-[9px] px-1.5 py-0.2 rounded-full bg-[#381e72] text-[#d0bcff] font-semibold border border-[#d0bcff]/30">Conectado</span>` : ''}
              </div>
              <div class="text-[11px] text-[#cac4d0] truncate">${escapeHtml(f.phone || f.email || 'Sin contacto')}</div>
            </div>
          </div>
          <div class="flex items-center gap-0.5 text-[#cac4d0]" onclick="event.stopPropagation()">
            <button onclick="editFriend(${f.id})" title="Editar" class="p-1 hover:text-white hover:bg-[#36343b] rounded-full transition"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
            <button onclick="deleteFriend(${f.id}, '${escapeHtml(f.name)}')" title="Eliminar" class="p-1 hover:text-[#f2b8b5] hover:bg-[#36343b] rounded-full transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        </div>

        <!-- Estado de Cuota / Cobro Integrado -->
        <div class="mt-3 pt-2.5 border-t border-[#49454f]/30 flex items-center justify-between">
          <div class="text-[10px] uppercase font-bold text-[#cac4d0]">
            ${subsList.length > 0 ? `${subsList.length} ${subsList.length === 1 ? 'plan compartido' : 'planes compartidos'}` : 'Sin planes compartidos'}
          </div>
          <div class="text-right">
            <span class="text-[9px] uppercase text-[#cac4d0] block">Cuota mensual</span>
            <span class="text-xs font-bold font-mono ${hasActiveDebt ? 'text-[#a8d5b5]' : 'text-[#938f99]'}">${state.currency}${formatNumber(monthlyOwed)}</span>
          </div>
        </div>

        <!-- Lista de suscripciones resumidas si existen -->
        ${subsBadgesHtml ? `<div class="mt-2 space-y-1">${subsBadgesHtml}</div>` : ''}
      </div>

      <!-- Acciones Unificadas -->
      <div class="pt-2 border-t border-[#49454f]/30 flex items-center gap-1.5 text-xs" onclick="event.stopPropagation()">
        <button onclick="viewSharedSubsWithFriend(${f.id}, '${escapeHtml(f.name)}', ${f.linked_user_id || 'null'})" class="flex-1 m3-btn-tonal text-[10px] py-1 px-2 flex items-center justify-center gap-1" title="Ver suscripciones individuales y planes">
          <i data-lucide="layers" class="w-3.5 h-3.5 text-[#d0bcff]"></i> Ver Suscripciones
        </button>
        <button onclick="openSplitPayModalForFriend(${f.id}, '${escapeHtml(f.name)}', ${f.linked_user_id || 'null'})" class="m3-btn-filled text-[10px] py-1 px-2.5 flex items-center justify-center gap-1" title="Solicitar pagar en conjunto">
          <i data-lucide="split" class="w-3 h-3"></i> Dividir
        </button>
        ${hasActiveDebt ? `
          <button onclick="recordFriendPaymentPrompt(${f.id}, '${escapeHtml(f.name)}', ${monthlyOwed})" class="m3-btn-outline text-[10px] py-1 px-2 flex items-center justify-center gap-1" title="Marcar cuota de este mes como saldada">
            <i data-lucide="check" class="w-3 h-3 text-[#a8d5b5]"></i> Saldar
          </button>
          ${f.phone ? `
            <a href="${waUrl}" target="_blank" rel="noopener" class="p-1.5 rounded-full bg-[#2b5037] hover:bg-[#2b5037]/80 text-[#a8d5b5] flex items-center justify-center transition" title="Enviar recordatorio por WhatsApp">
              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
            </a>
          ` : ''}
        ` : ''}
      </div>
    </div>
  `;
  }).join('');

  initIcons();
}

function renderFriendBalances() {
  // Ahora integrado directamente en renderFriendsList()
  renderFriendsList();
}

// ================= SOLICITUDES DE AMISTAD =================
function renderFriendRequests() {
  const section = document.getElementById('friendRequestsSection');
  const list = document.getElementById('friendRequestsList');
  const countBadge = document.getElementById('friendRequestsCountBadge');
  if (!section || !list) return;

  const received = state.friendRequests?.received || [];
  if (countBadge) countBadge.textContent = received.length;

  if (received.length === 0) {
    section.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = received.map(req => `
    <div class="p-3 bg-[#1d1b20] border border-[#d0bcff]/30 rounded-2xl flex items-center justify-between gap-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-full bg-[#d0bcff] text-[#381e72] font-bold text-xs flex items-center justify-center shrink-0">
          ${escapeHtml((req.sender_name || req.sender_username || '?').charAt(0).toUpperCase())}
        </div>
        <div class="min-w-0">
          <h4 class="text-xs font-bold text-white truncate">${escapeHtml(req.sender_name || req.sender_username)}</h4>
          <div class="text-[10px] text-[#cac4d0] truncate">@${escapeHtml(req.sender_username)}</div>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="respondFriendRequest(${req.id}, 'accept')" class="m3-btn-filled text-xs py-1 px-2.5 flex items-center gap-1">
          <i data-lucide="check" class="w-3 h-3"></i> Aceptar
        </button>
        <button onclick="respondFriendRequest(${req.id}, 'reject')" class="m3-btn-outline text-xs py-1 px-2.5 text-rose-300 border-rose-500/30 hover:bg-rose-500/10">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </div>
    </div>
  `).join('');

  initIcons();
}

async function respondFriendRequest(requestId, action) {
  try {
    const res = await fetch('/api/friends/respond-request', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ request_id: requestId, action: action })
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.success) {
      showToast(action === 'accept' ? '¡Solicitud aceptada! Ahora son amigos en SubTracker' : 'Solicitud rechazada', 'success');
      await loadFriends();
    } else {
      showToast(result.error || result.message || 'Error al procesar solicitud', 'error');
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

// ================= BÚSQUEDA DE USUARIOS =================
function openUserSearchModal() {
  const modal = document.getElementById('userSearchModal');
  const input = document.getElementById('userSearchInput');
  const results = document.getElementById('userSearchResults');
  if (input) input.value = '';
  if (results) {
    results.innerHTML = `
      <div class="text-center py-6 text-xs text-[#938f99]">
        Escribe al menos 2 letras para buscar usuarios.
      </div>
    `;
  }
  modal?.classList.remove('hidden');
  input?.focus();
  initIcons();
}

function closeUserSearchModal() {
  document.getElementById('userSearchModal')?.classList.add('hidden');
}

async function handleUserSearch(query) {
  const resultsContainer = document.getElementById('userSearchResults');
  if (!resultsContainer) return;

  if (!query || query.length < 2) {
    resultsContainer.innerHTML = `
      <div class="text-center py-6 text-xs text-[#938f99]">
        Escribe al menos 2 letras para buscar usuarios.
      </div>
    `;
    return;
  }

  try {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { headers: getAuthHeaders() });
    const result = await res.json();
    if (!result.success) {
      resultsContainer.innerHTML = `<div class="text-center py-4 text-xs text-rose-300">${escapeHtml(result.error || 'Error buscando')}</div>`;
      return;
    }

    const users = result.data || [];
    if (users.length === 0) {
      resultsContainer.innerHTML = `
        <div class="text-center py-6 text-xs text-[#938f99]">
          No se encontraron usuarios que coincidan con "${escapeHtml(query)}".
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = users.map(u => {
      let actionBtn = '';
      if (u.relationship_status === 'friends') {
        actionBtn = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-[#2b5037] text-[#a8d5b5] font-semibold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Amigos</span>`;
      } else if (u.relationship_status === 'pending_sent') {
        actionBtn = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-[#4a4458] text-[#e8def8] font-semibold">Solicitud enviada</span>`;
      } else if (u.relationship_status === 'pending_received') {
        actionBtn = `<button onclick="respondFriendRequest(${u.request_id}, 'accept')" class="m3-btn-filled text-[10px] py-1 px-2.5">Aceptar</button>`;
      } else {
        actionBtn = `
          <button onclick="sendFriendRequestToUser('${escapeHtml(u.username)}')" class="m3-btn-filled text-xs py-1.5 px-3 flex items-center gap-1">
            <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Conectar
          </button>
        `;
      }

      return `
        <div class="p-3 bg-[#1d1b20] border border-[#49454f]/40 rounded-2xl flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full bg-[#d0bcff] text-[#381e72] font-bold text-xs flex items-center justify-center shrink-0">
              ${escapeHtml((u.display_name || u.username).charAt(0).toUpperCase())}
            </div>
            <div class="min-w-0">
              <h4 class="text-xs font-bold text-white truncate">${escapeHtml(u.display_name || u.username)}</h4>
              <div class="text-[10px] text-[#cac4d0] truncate">@${escapeHtml(u.username)}</div>
            </div>
          </div>
          <div>${actionBtn}</div>
        </div>
      `;
    }).join('');

    initIcons();
  } catch (err) {
    console.error('Error buscando usuarios:', err);
  }
}

async function sendFriendRequestToUser(target) {
  try {
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ receiver: target })
    });
    const result = await res.json();
    if (result.success) {
      showToast('¡Solicitud de amistad enviada con éxito!', 'success');
      const input = document.getElementById('userSearchInput');
      if (input && input.value) {
        handleUserSearch(input.value.trim());
      }
      await loadFriends();
    } else {
      showToast(result.error || 'Error al enviar solicitud', 'error');
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

// ================= SPLIT PAY (PAGO EN CONJUNTO) =================
function setSplitPayTab(tab) {
  state.splitPayTab = tab;
  const btnRec = document.getElementById('btnTabSplitReceived');
  const btnSent = document.getElementById('btnTabSplitSent');

  if (tab === 'received') {
    btnRec?.classList.add('bg-[#d0bcff]', 'text-[#381e72]', 'font-semibold');
    btnRec?.classList.remove('text-[#cac4d0]');
    btnSent?.classList.remove('bg-[#d0bcff]', 'text-[#381e72]', 'font-semibold');
    btnSent?.classList.add('text-[#cac4d0]');
  } else {
    btnSent?.classList.add('bg-[#d0bcff]', 'text-[#381e72]', 'font-semibold');
    btnSent?.classList.remove('text-[#cac4d0]');
    btnRec?.classList.remove('bg-[#d0bcff]', 'text-[#381e72]', 'font-semibold');
    btnRec?.classList.add('text-[#cac4d0]');
  }
  renderSplitPayRequests();
}

function renderSplitPayRequests() {
  const container = document.getElementById('splitPayRequestsContainer');
  const countRecElem = document.getElementById('countSplitReceived');
  const countSentElem = document.getElementById('countSplitSent');
  const inboxBadge = document.getElementById('splitPayInboxBadge');
  if (!container) return;

  const received = state.splitPayRequests?.received || [];
  const sent = state.splitPayRequests?.sent || [];

  if (countRecElem) countRecElem.textContent = received.length;
  if (countSentElem) countSentElem.textContent = sent.length;

  const pendingReceived = received.filter(r => r.status === 'pending');
  if (inboxBadge) {
    if (pendingReceived.length > 0) {
      inboxBadge.textContent = `${pendingReceived.length} pendientes`;
      inboxBadge.classList.remove('hidden');
    } else {
      inboxBadge.classList.add('hidden');
    }
  }

  const list = state.splitPayTab === 'received' ? received : sent;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-[#cac4d0] text-xs">
        No hay solicitudes de pago en conjunto ${state.splitPayTab === 'received' ? 'recibidas' : 'enviadas'}.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(req => {
    const isReceived = state.splitPayTab === 'received';
    const statusMap = {
      pending: { text: 'Pendiente', badge: 'bg-amber-400/20 text-amber-300 border-amber-500/30' },
      paid: { text: 'Pagada', badge: 'bg-[#2b5037] text-[#a8d5b5] border-[#a8d5b5]/30' },
      declined: { text: 'Rechazada', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' }
    };
    const st = statusMap[req.status] || { text: req.status, badge: 'bg-zinc-700 text-zinc-300' };
    const curSym = CURRENCY_SYMBOLS[req.currency] || req.currency || '$';
    const otherPerson = isReceived
      ? (req.creator_display_name || req.creator_name || req.creator_username || 'Usuario')
      : (req.friend_display_name || req.friend_name || req.friend_username || 'Amigo');
    const subName = req.subscription_name || req.sub_name || 'Suscripción';

    return `
      <div class="p-3.5 bg-[#211f26] border border-[#49454f]/40 rounded-2xl flex flex-col justify-between space-y-3">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[10px] text-[#cac4d0] uppercase tracking-wider block">
                ${isReceived ? `Solicitado por ${escapeHtml(otherPerson)}` : `Enviado a ${escapeHtml(otherPerson)}`}
              </span>
              <h4 class="text-xs font-bold text-white font-google-sans mt-0.5">${escapeHtml(subName)}</h4>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full border font-semibold ${st.badge}">
              ${st.text}
            </span>
          </div>

          <div class="mt-2.5 flex items-baseline justify-between">
            <span class="text-xs text-[#cac4d0]">Monto requerido:</span>
            <span class="text-base font-extrabold text-[#a8d5b5] font-mono">${curSym}${formatNumber(req.amount)}</span>
          </div>

          ${req.due_date ? `
            <div class="mt-1 text-[10px] text-[#cac4d0] flex items-center gap-1">
              <i data-lucide="calendar" class="w-3 h-3 text-[#d0bcff]"></i>
              <span>Vence: ${formatDate(req.due_date)}</span>
            </div>
          ` : ''}

          ${req.notes ? `
            <p class="mt-1.5 text-[11px] text-[#938f99] italic bg-[#141218] p-2 rounded-xl border border-[#49454f]/30">
              "${escapeHtml(req.notes)}"
            </p>
          ` : ''}
        </div>

        ${isReceived && req.status === 'pending' ? `
          <div class="pt-2 border-t border-[#49454f]/30 flex items-center gap-2">
            <button onclick="respondSplitPay(${req.id}, 'paid')" class="flex-1 m3-btn-filled text-xs py-1.5 px-3 flex items-center justify-center gap-1">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Confirmar Pago
            </button>
            <button onclick="respondSplitPay(${req.id}, 'declined')" class="m3-btn-outline text-xs py-1.5 px-3 text-rose-300 border-rose-500/30 hover:bg-rose-500/10">
              Rechazar
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  initIcons();
}

async function respondSplitPay(requestId, action) {
  try {
    const res = await fetch('/api/friends/split-requests/respond', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ request_id: requestId, action: action })
    });
    const result = await res.json();
    if (result.success) {
      showToast(action === 'paid' ? '¡Pago registrado exitosamente!' : 'Solicitud rechazada', 'success');
      await loadFriends();
    } else {
      showToast(result.error || 'Error al procesar pago', 'error');
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

function openSplitPayModalForFriend(friendId, friendName, friendUserId, preselectedSubId = null, customAmount = null) {
  const modal = document.getElementById('splitPayModal');
  const friendNameDisplay = document.getElementById('splitPayFriendNameDisplay');
  const friendIdInput = document.getElementById('splitFriendId');
  const friendUserIdInput = document.getElementById('splitFriendUserId');
  const subSelect = document.getElementById('splitPaySubSelect');
  const amountInput = document.getElementById('splitPayAmount');
  const currencyInput = document.getElementById('splitPayCurrency');
  const dueDateInput = document.getElementById('splitPayDueDate');
  const notesInput = document.getElementById('splitPayNotes');

  // Sanear friendUserId si viene como null, undefined, 0 o 'null'
  const validFriendUserId = (friendUserId && friendUserId !== 'null' && friendUserId !== 'undefined') ? parseInt(friendUserId) : null;

  if (friendIdInput) friendIdInput.value = friendId;
  if (friendUserIdInput) friendUserIdInput.value = validFriendUserId || '';
  if (friendNameDisplay) {
    friendNameDisplay.innerHTML = `
      <i data-lucide="user" class="w-4 h-4 text-[#d0bcff]"></i>
      <span>${escapeHtml(friendName)}</span>
      ${validFriendUserId ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-[#381e72] text-[#d0bcff]">Usuario Conectado</span>` : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-[#211f26] text-[#cac4d0]">Amigo Local</span>'}
    `;
  }

  // Filtrar suscripciones activas del usuario
  let relevantSubs = state.subscriptions.filter(s => s.status === 'active');

  if (relevantSubs.length === 0) {
    showToast('No tienes suscripciones activas disponibles para dividir', 'warning');
    return;
  }

  subSelect.innerHTML = relevantSubs.map(s => {
    const defaultSplitPrice = s.friend_share || s.my_share || (s.price / (s.shared_with_count || 2));
    const isSelected = preselectedSubId && s.id === preselectedSubId ? 'selected' : '';
    return `
      <option value="${s.id}" ${isSelected} data-price="${defaultSplitPrice}" data-currency="${s.currency || 'USD'}" data-next="${s.next_billing_date || s.next_payment_date || ''}">
        ${escapeHtml(s.name)} - ${CURRENCY_SYMBOLS[s.currency] || s.currency}${formatNumber(s.price)} (${CURRENCY_SYMBOLS[s.currency] || s.currency}${formatNumber(defaultSplitPrice)} c/u)
      </option>
    `;
  }).join('');

  if (preselectedSubId) {
    subSelect.value = preselectedSubId;
  }

  // Seleccionar y actualizar campos
  handleSplitPaySubChange();

  if (customAmount !== null && customAmount !== undefined && amountInput) {
    amountInput.value = parseFloat(customAmount).toFixed(2);
  }

  modal?.classList.remove('hidden');
  initIcons();
}

function handleSplitPaySubChange() {
  const subSelect = document.getElementById('splitPaySubSelect');
  const amountInput = document.getElementById('splitPayAmount');
  const currencyInput = document.getElementById('splitPayCurrency');
  const dueDateInput = document.getElementById('splitPayDueDate');

  if (!subSelect) return;
  const opt = subSelect.options[subSelect.selectedIndex];
  if (opt) {
    const price = opt.dataset.price;
    const curr = opt.dataset.currency || 'USD';
    const nextDate = opt.dataset.next;
    if (amountInput) amountInput.value = parseFloat(price || 0).toFixed(2);
    if (currencyInput) currencyInput.value = curr;
    if (dueDateInput && nextDate) dueDateInput.value = nextDate;
  }
}

function closeSplitPayModal() {
  document.getElementById('splitPayModal')?.classList.add('hidden');
}

async function handleSplitPaySubmit(e) {
  e.preventDefault();
  const friendId = parseInt(document.getElementById('splitFriendId').value);
  const friendUserIdVal = document.getElementById('splitFriendUserId').value;
  const friendUserId = (friendUserIdVal && friendUserIdVal !== 'null' && friendUserIdVal !== 'undefined') ? parseInt(friendUserIdVal) : null;
  const subId = parseInt(document.getElementById('splitPaySubSelect').value);
  const amount = parseFloat(document.getElementById('splitPayAmount').value);
  const currency = document.getElementById('splitPayCurrency').value || 'USD';
  const dueDate = document.getElementById('splitPayDueDate').value || null;
  const notes = document.getElementById('splitPayNotes').value.trim();

  if (!friendId || !subId || !amount) {
    showToast('Por favor completa los campos requeridos', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/friends/split-request', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        subscription_id: subId,
        friend_id: friendId,
        friend_user_id: friendUserId,
        amount: amount,
        currency: currency,
        due_date: dueDate,
        notes: notes
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('¡Solicitud de pago en conjunto enviada!', 'success');
      closeSplitPayModal();
      setSplitPayTab('sent');
      await loadFriends();
    } else {
      showToast(result.error || 'Error enviando solicitud', 'error');
    }
  } catch (err) {
    showToast('Error al conectar con el servidor', 'error');
  }
}

// ================= SUSCRIPCIONES Y DIVIDIR PAGO CON AMIGO =================
async function viewSharedSubsWithFriend(friendId, friendName, friendUserId = null) {
  const modal = document.getElementById('sharedSubsModal');
  const title = document.getElementById('sharedSubsModalTitle');
  const subtitle = document.getElementById('sharedSubsModalSubtitle');
  const content = document.getElementById('sharedSubsModalContent');

  if (title) {
    title.innerHTML = `
      <i data-lucide="layers" class="w-5 h-5 text-[#d0bcff]"></i>
      <span>Suscripciones con ${escapeHtml(friendName)}</span>
    `;
  }
  if (subtitle) {
    subtitle.textContent = `Consulta tus suscripciones, las de tu amigo y solicita pagar en conjunto.`;
  }
  if (content) {
    content.innerHTML = `<div class="text-center py-8 text-xs text-[#cac4d0]">Cargando suscripciones...</div>`;
  }
  modal?.classList.remove('hidden');
  initIcons();

  try {
    const res = await fetch(`/api/friends/shared-subs?friend_id=${friendId}`, { headers: getAuthHeaders() });
    const result = await res.json();
    if (!result.success) {
      if (content) content.innerHTML = `<div class="text-center py-4 text-xs text-rose-300">${escapeHtml(result.error || 'Error cargando suscripciones')}</div>`;
      return;
    }

    const data = result.data || {};
    const mySubs = data.my_subscriptions || [];
    const friendSubs = data.friend_subscriptions || [];
    const isLinked = Boolean(data.is_linked);
    const linkedUserId = data.friend?.linked_user_id || friendUserId || null;

    let html = '';

    // 1. Sección: Mis Suscripciones (Oportunidad de solicitarle pagar en conjunto)
    html += `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-google-sans">
            <i data-lucide="user" class="w-3.5 h-3.5 text-[#d0bcff]"></i> Tus Suscripciones (${mySubs.length})
          </h4>
          <span class="text-[10px] text-[#cac4d0]">Invita a pagar en conjunto</span>
        </div>
    `;

    if (mySubs.length === 0) {
      html += `
        <div class="p-4 rounded-xl bg-[#211f26] border border-[#49454f]/30 text-center text-xs text-[#cac4d0]">
          No tienes suscripciones activas registradas aún.
        </div>
      `;
    } else {
      html += `<div class="space-y-2">`;
      html += mySubs.map(s => {
        const curSym = CURRENCY_SYMBOLS[s.currency] || s.currency || '$';
        const splitAmount = (s.friend_share || (s.price / (s.shared_with_count || 2))).toFixed(2);
        return `
          <div class="p-3 bg-[#211f26] border border-[#49454f]/40 rounded-xl flex items-center justify-between gap-3 hover:border-[#d0bcff]/40 transition">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0" style="background-color: ${s.color || '#d0bcff'}; color: #141218">
                ${escapeHtml(s.name.charAt(0).toUpperCase())}
              </div>
              <div class="min-w-0">
                <h5 class="text-xs font-bold text-white truncate font-google-sans">${escapeHtml(s.name)}</h5>
                <div class="text-[11px] text-[#cac4d0] truncate">
                  Total: <span class="font-mono text-white">${curSym}${formatNumber(s.price)}</span> / ${CYCLE_LABELS[s.billing_cycle] || s.billing_cycle}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <div class="text-right hidden sm:block">
                <span class="text-[9px] uppercase text-[#cac4d0] block">Parte sugerida</span>
                <span class="text-xs font-bold text-[#a8d5b5] font-mono">${curSym}${formatNumber(splitAmount)}</span>
              </div>
              <button onclick="closeSharedSubsModal(); openSplitPayModalForFriend(${friendId}, '${escapeHtml(friendName)}', ${linkedUserId || 'null'}, ${s.id}, ${splitAmount});" class="m3-btn-filled text-[11px] py-1.5 px-3 flex items-center gap-1.5 shadow-sm" title="Solicitar pagar en conjunto">
                <i data-lucide="split" class="w-3.5 h-3.5"></i>
                <span>Dividir Pago</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
      html += `</div>`;
    }
    html += `</div>`;

    // 2. Sección: Suscripciones del Amigo (Si está conectado en SubTracker)
    html += `
      <div class="pt-4 border-t border-[#49454f]/40 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-google-sans">
            <i data-lucide="users" class="w-3.5 h-3.5 text-[#a8d5b5]"></i> Suscripciones de ${escapeHtml(friendName)}
          </h4>
          ${isLinked ? `<span class="text-[9px] px-2 py-0.5 rounded-full bg-[#2b5037] text-[#a8d5b5] font-semibold border border-[#a8d5b5]/30">Usuario Conectado</span>` : `<span class="text-[9px] px-2 py-0.5 rounded-full bg-[#36343b] text-[#cac4d0]">Contacto Local</span>`}
        </div>
    `;

    if (!isLinked) {
      html += `
        <div class="p-4 rounded-xl bg-[#211f26]/60 border border-[#49454f]/30 text-xs text-[#cac4d0] space-y-1">
          <p>Este amigo aún no está conectado a una cuenta de SubTracker.</p>
          <p class="text-[11px] text-[#938f99]">Para ver las suscripciones que él tiene registradas y sincronizar cobros mutuos, envíale una solicitud de amistad desde <strong>"Buscar Usuarios"</strong>.</p>
        </div>
      `;
    } else if (friendSubs.length === 0) {
      html += `
        <div class="p-4 rounded-xl bg-[#211f26] border border-[#49454f]/30 text-center text-xs text-[#cac4d0]">
          ${escapeHtml(friendName)} no tiene suscripciones públicas o activas registradas en este momento.
        </div>
      `;
    } else {
      html += `<div class="space-y-2">`;
      html += friendSubs.map(fs => {
        const curSym = CURRENCY_SYMBOLS[fs.currency] || fs.currency || '$';
        const halfPrice = (fs.price / 2).toFixed(2);
        return `
          <div class="p-3 bg-[#211f26] border border-[#49454f]/40 rounded-xl flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0" style="background-color: ${fs.color || '#a8d5b5'}; color: #141218">
                ${escapeHtml(fs.name.charAt(0).toUpperCase())}
              </div>
              <div class="min-w-0">
                <h5 class="text-xs font-bold text-white truncate font-google-sans">${escapeHtml(fs.name)}</h5>
                <div class="text-[11px] text-[#cac4d0] truncate">
                  ${curSym}${formatNumber(fs.price)} / ${CYCLE_LABELS[fs.billing_cycle] || fs.billing_cycle}
                </div>
              </div>
            </div>
            <div class="text-right">
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#36343b] text-[#d0bcff] font-medium font-mono">
                Registrada por ${escapeHtml(friendName)}
              </span>
            </div>
          </div>
        `;
      }).join('');
      html += `</div>`;
    }
    html += `</div>`;

    if (content) {
      content.innerHTML = html;
    }
    initIcons();
  } catch (err) {
    if (content) content.innerHTML = `<div class="text-center py-4 text-xs text-rose-300">Error al conectar con el servidor</div>`;
  }
}

function closeSharedSubsModal() {
  document.getElementById('sharedSubsModal')?.classList.add('hidden');
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

  const railDash = document.getElementById('railBtnDashboard');
  const railCal = document.getElementById('railBtnCalendar');
  const railPay = document.getElementById('railBtnPayments');
  const railFriends = document.getElementById('railBtnFriends');

  [viewDash, viewCal, viewPay, viewFriends].forEach(v => v?.classList.add('hidden'));
  [tabDash, tabCal, tabPay, tabFriends, railDash, railCal, railPay, railFriends].forEach(t => {
    t?.classList.remove('active');
  });

  if (tab === 'dashboard') {
    viewDash?.classList.remove('hidden');
    tabDash?.classList.add('active');
    railDash?.classList.add('active');
  } else if (tab === 'calendar') {
    viewCal?.classList.remove('hidden');
    tabCal?.classList.add('active');
    railCal?.classList.add('active');
    renderCalendar();
  } else if (tab === 'payments') {
    viewPay?.classList.remove('hidden');
    tabPay?.classList.add('active');
    railPay?.classList.add('active');
    loadPayments();
  } else if (tab === 'friends') {
    viewFriends?.classList.remove('hidden');
    tabFriends?.classList.add('active');
    railFriends?.classList.add('active');
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
      ? `${tSymbol}${formatNumber(t.price)} <span class="text-[#d0bcff] font-bold">(≈ ${state.currency}${formatNumber(convPriceTrial)})</span>`
      : `${state.currency}${formatNumber(t.price)}`;

    return `
      <div class="flex items-center justify-between bg-[#1d1b20] rounded-2xl p-3.5 border border-[#f2b8b5]/30">
        <div>
          <div class="font-bold text-white text-xs flex items-center gap-1.5 font-google-sans">
            <span>${escapeHtml(t.name)}</span>
            <span class="m3-badge-error animate-pulse">
              ${urgency}
            </span>
          </div>
          <div class="text-[11px] text-[#f2b8b5]/80 mt-0.5">
            Límite: <strong>${formatDateFriendly(t.trial_end_date)}</strong> &bull; Cobro: ${priceStrTrial}
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${t.url ? `<a href="${escapeHtml(t.url)}" target="_blank" class="m3-btn-outline text-[11px] py-1 px-3 text-[#f2b8b5] border-[#f2b8b5]/30 hover:bg-[#8c1d18]/20 flex items-center gap-1"><i data-lucide="external-link" class="w-3 h-3"></i> Cancelar</a>` : ''}
          <button onclick="editSubscription(${t.id})" class="m3-btn-tonal text-[11px] py-1 px-3">Gestionar</button>
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
        <button onclick="markAsPaidAndAdvance(${sub.id})" title="Registrar pago y avanzar corte al siguiente ciclo" class="m3-btn-tonal text-xs py-1 px-3 flex items-center gap-1">
          <i data-lucide="receipt" class="w-3.5 h-3.5"></i> <span>Pagado</span>
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

  let trialBadge = sub.is_trial ? `<span class="m3-badge-error flex items-center gap-1"><i data-lucide="timer" class="w-3 h-3"></i> Trial</span>` : '';
  let sharedBadge = sub.is_shared ? `<span class="m3-badge-success flex items-center gap-1"><i data-lucide="users" class="w-3 h-3"></i> Dividido /${sub.shared_with_count || 2}</span>` : '';

  const iconHtml = getServiceOfficialIcon(sub.name, sub.color);

  return `
    <div class="m3-card p-5 relative overflow-hidden flex flex-col justify-between m3-elevation-1">
      <div class="absolute top-0 left-0 right-0 h-1.5" style="background-color: ${sub.color || 'var(--md-sys-color-primary)'}"></div>

      <div>
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="m3-brand-icon-box" style="background: linear-gradient(135deg, ${sub.color || '#d0bcff'}22, ${sub.color || '#d0bcff'}44); border: 1px solid ${sub.color || '#d0bcff'}55">
              ${iconHtml}
            </div>
            <div>
              <h4 class="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 font-google-sans">
                ${escapeHtml(sub.name)}
                ${sub.url ? `<a href="${escapeHtml(sub.url)}" target="_blank" rel="noopener" class="text-[#cac4d0] hover:text-[#d0bcff] transition"><i data-lucide="external-link" class="w-3 h-3"></i></a>` : ''}
              </h4>
              <div class="flex flex-wrap items-center gap-1.5 mt-1">
                <span class="m3-badge-secondary">
                  ${escapeHtml(sub.category)}
                </span>
                ${trialBadge}
                ${sharedBadge}
                ${statusBadge}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1 text-[#cac4d0]">
            <button onclick="editSubscription(${sub.id})" title="Editar" class="p-1.5 hover:text-white hover:bg-[#2b2930] rounded-full transition"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
            <button onclick="deleteSubscription(${sub.id}, '${escapeHtml(sub.name)}')" title="Eliminar" class="p-1.5 hover:text-[#f2b8b5] hover:bg-[#2b2930] rounded-full transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        </div>

        <div class="mt-4 p-3 bg-[#1d1b20] rounded-2xl border border-[#49454f]/30 flex items-center justify-between">
          <div>
            <span class="text-[10px] uppercase tracking-wider font-semibold text-[#cac4d0] flex items-center gap-1">
              <i data-lucide="calendar" class="w-3 h-3 text-[#cac4d0]"></i> Fecha de Corte
            </span>
            <div class="text-xs font-semibold text-[#e6e0e9] mt-0.5">${formatDateFriendly(sub.next_billing_date)}</div>
          </div>
          <div class="text-right">
            <span class="${badgeClass}">${daysText}</span>
            <button onclick="markAsPaidAndAdvance(${sub.id})" class="block text-[11px] text-[#d0bcff] hover:underline mt-1 font-semibold">Marcar Pagado</button>
          </div>
        </div>

        <div class="mt-3.5 grid grid-cols-2 gap-2 bg-[#211f26] border border-[#49454f]/40 rounded-2xl p-3">
          <div>
            <span class="text-[10px] uppercase font-semibold tracking-wider text-[#cac4d0] block">Cobro Recurrente</span>
            ${isDifferentCurrency ? `
              <span class="text-xs font-bold text-white font-mono">${baseSymbol}${formatNumber(convertedPrice)} <span class="text-[10px] font-normal text-[#cac4d0]">/${cycleLabel.toLowerCase()}</span></span>
              <span class="block text-[11px] font-medium text-[#d0bcff]">orig. ${subSymbol}${formatNumber(sub.price)} ${subCurr}</span>
              ${sub.is_shared ? `<span class="block text-[10px] text-[#a8d5b5] font-medium mt-0.5">Tu parte: ${baseSymbol}${formatNumber(convertedMonthly)}/m</span>` : ''}
            ` : `
              <span class="text-xs font-bold text-white font-mono">${baseSymbol}${formatNumber(sub.price)} <span class="text-[10px] font-normal text-[#cac4d0]">/${cycleLabel.toLowerCase()}</span></span>
              ${sub.is_shared ? `<span class="block text-[10px] text-[#a8d5b5] font-medium mt-0.5">Tu parte: ${baseSymbol}${formatNumber(sub.monthly_cost)}/m</span>` : ''}
            `}
          </div>

          <div class="text-right">
            <span class="text-[10px] uppercase font-bold tracking-wider text-[#d0bcff] block flex items-center justify-end gap-0.5 font-google-sans">
              <i data-lucide="sparkles" class="w-2.5 h-2.5"></i> Costo Anual
            </span>
            <span class="text-sm font-extrabold text-[#e8def8] tracking-tight block font-mono">
              ${baseSymbol}${formatNumber(convertedAnnual)} <span class="text-[10px] font-medium text-[#cac4d0]">/año</span>
            </span>
            ${isDifferentCurrency ? `
              <span class="text-[10px] text-[#cac4d0] block font-mono">(${subSymbol}${formatNumber(sub.annual_cost)} ${subCurr})</span>
            ` : `
              <span class="text-[10px] text-[#cac4d0] block font-mono">(${baseSymbol}${formatNumber(convertedMonthly)}/mes)</span>
            `}
          </div>
        </div>

        <div class="mt-3 text-[11px] text-[#cac4d0] flex items-center justify-between border-t border-[#49454f]/30 pt-2.5">
          <span class="flex items-center gap-1 text-[#cac4d0]">
            <i data-lucide="credit-card" class="w-3 h-3 text-[#cac4d0]"></i>
            ${escapeHtml(sub.payment_method || 'Sin método')}
          </span>
          ${sub.notes ? `<span class="truncate max-w-[140px] italic text-[#938f99]" title="${escapeHtml(sub.notes)}">"${escapeHtml(sub.notes)}"</span>` : ''}
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-[#49454f]/30 flex items-center justify-between text-xs">
        <button onclick="toggleSubscriptionStatus(${sub.id}, '${sub.status}')" class="text-xs font-medium text-[#cac4d0] hover:text-white flex items-center gap-1.5 transition">
          <i data-lucide="${sub.status === 'active' ? 'pause-circle' : 'play-circle'}" class="w-3.5 h-3.5"></i>
          <span>${sub.status === 'active' ? 'Pausar' : 'Reactivar'}</span>
        </button>
        <span class="text-[11px] text-[#938f99] font-mono">#${sub.id}</span>
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

  const iconHtml = getServiceOfficialIcon(sub.name, sub.color, 'w-3.5 h-3.5');

  return `
    <tr class="hover:bg-[#211f26] transition">
      <td class="px-4 py-3.5">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm" style="background: linear-gradient(135deg, ${sub.color || '#d0bcff'}22, ${sub.color || '#d0bcff'}44); border: 1px solid ${sub.color || '#d0bcff'}55">
            ${iconHtml}
          </div>
          <div>
            <div class="font-bold text-white flex items-center gap-1.5 font-google-sans">
              ${escapeHtml(sub.name)}
              ${sub.is_trial ? `<span class="m3-badge-error text-[9px]">TRIAL</span>` : ''}
              ${sub.is_shared ? `<span class="m3-badge-success text-[9px]">SPLIT</span>` : ''}
            </div>
            <div class="text-[11px] text-[#cac4d0]">${escapeHtml(sub.payment_method || 'Tarjeta')}</div>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5">
        <span class="m3-badge-secondary">
          ${escapeHtml(sub.category)}
        </span>
      </td>
      <td class="px-4 py-3.5">
        <div class="font-medium text-[#e6e0e9]">${formatDateFriendly(sub.next_billing_date)}</div>
        <span class="${badgeClass}">${daysText}</span>
      </td>
      <td class="px-4 py-3.5 font-mono">
        ${isDifferentCurrency ? `
          <div class="font-bold text-white">${baseSymbol}${formatNumber(convertedPrice)} <span class="text-[11px] text-[#cac4d0] font-normal">/${cycleLabel.toLowerCase()}</span></div>
          <div class="text-[11px] text-[#d0bcff] font-semibold">orig. ${subSymbol}${formatNumber(sub.price)} ${subCurr}</div>
        ` : `
          <div class="font-bold text-white">${baseSymbol}${formatNumber(sub.price)}</div>
          <div class="text-[11px] text-[#cac4d0]">${cycleLabel}</div>
        `}
      </td>
      <td class="px-4 py-3.5 font-mono">
        <div class="font-extrabold text-[#d0bcff]">${baseSymbol}${formatNumber(convertedAnnual)} / año</div>
        <div class="text-[10px] text-[#cac4d0]">
          (${baseSymbol}${formatNumber(convertedMonthly)} / mes${isDifferentCurrency ? ` &bull; orig. ${subSymbol}${formatNumber(sub.annual_cost)}` : ''})
        </div>
      </td>
      <td class="px-4 py-3.5">${statusBadge}</td>
      <td class="px-4 py-3.5 text-right space-x-1">
        <button onclick="markAsPaidAndAdvance(${sub.id})" title="Marcar como pagado" class="p-1.5 hover:bg-[#2b2930] rounded-full text-[#cac4d0] hover:text-[#a8d5b5] transition"><i data-lucide="receipt" class="w-4 h-4"></i></button>
        <button onclick="editSubscription(${sub.id})" title="Editar" class="p-1.5 hover:bg-[#2b2930] rounded-full text-[#cac4d0] hover:text-white transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
        <button onclick="deleteSubscription(${sub.id}, '${escapeHtml(sub.name)}')" title="Eliminar" class="p-1.5 hover:bg-[#2b2930] rounded-full text-[#cac4d0] hover:text-[#f2b8b5] transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
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
  const btnA = document.getElementById('btnChartModeAnnual');
  const btnM = document.getElementById('btnChartModeMonthly');
  if (btnA && btnM) {
    if (mode === 'annual') {
      btnA.className = 'px-3 py-1 rounded-full font-medium bg-[#d0bcff] text-[#381e72] transition';
      btnM.className = 'px-3 py-1 rounded-full font-medium text-[#cac4d0] hover:text-white transition';
    } else {
      btnM.className = 'px-3 py-1 rounded-full font-medium bg-[#d0bcff] text-[#381e72] transition';
      btnA.className = 'px-3 py-1 rounded-full font-medium text-[#cac4d0] hover:text-white transition';
    }
  }
  renderCharts();
}

function setViewMode(mode) {
  state.viewMode = mode;
  const btnG = document.getElementById('viewModeGrid');
  const btnT = document.getElementById('viewModeTable');
  if (btnG && btnT) {
    if (mode === 'grid') {
      btnG.className = 'p-1.5 rounded-full bg-[#d0bcff] text-[#381e72] transition';
      btnT.className = 'p-1.5 rounded-full text-[#cac4d0] hover:text-white transition';
    } else {
      btnT.className = 'p-1.5 rounded-full bg-[#d0bcff] text-[#381e72] transition';
      btnG.className = 'p-1.5 rounded-full text-[#cac4d0] hover:text-white transition';
    }
  }
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
  const railBadge = document.getElementById('railCalendarBadge');
  if (railBadge) railBadge.textContent = cutsCount;
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
      ? 'is-selected border-[#d0bcff]'
      : (isToday ? 'is-today border-[#f2c18d] bg-[#643f14]/20' : 'border-[#49454f]/40 bg-[#1d1b20] hover:border-[#49454f]');

    let chipsHtml = '';
    if (hasCuts) {
      // Mostrar hasta 3 chips y un contador si hay más
      const maxChips = 2;
      const visibleCuts = dayCuts.slice(0, maxChips);
      const remainingCount = dayCuts.length - maxChips;

      chipsHtml = visibleCuts.map(cut => {
        const bgCol = cut.color || '#d0bcff';
        return `
          <div class="calendar-badge-chip px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white truncate flex items-center gap-1 shadow-sm"
               style="background-color: ${bgCol};"
               title="${escapeHtml(cut.name)}: ${curSymbol}${formatNumber(cut.converted_price_calculated)}">
            <span class="truncate">${escapeHtml(cut.name)}</span>
          </div>
        `;
      }).join('');

      if (remainingCount > 0) {
        chipsHtml += `
          <div class="text-[9px] font-bold text-[#e8def8] bg-[#4a4458] px-1.5 py-0.2 rounded-full text-center">
            +${remainingCount} más
          </div>
        `;
      }
    }

    html += `
      <div onclick="selectCalendarDate('${dateStr}')"
           class="calendar-day-cell rounded-2xl p-1.5 sm:p-2 border ${cellBorder} flex flex-col justify-between cursor-pointer transition relative group">
        
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold ${isToday ? 'text-[#f2c18d] font-extrabold ring-1 ring-[#f2c18d]/40 rounded px-1' : (isSelected ? 'text-[#d0bcff]' : 'text-[#cac4d0]')}">
            ${day}
          </span>
          ${hasCuts ? `
            <span class="w-2 h-2 rounded-full bg-[#d0bcff] shrink-0 ${isToday ? 'animate-ping' : ''}"></span>
          ` : ''}
        </div>

        <div class="mt-1 space-y-1 overflow-hidden">
          ${chipsHtml}
        </div>

        ${hasCuts ? `
          <div class="mt-1 pt-0.5 border-t border-[#49454f]/30 text-[10px] font-mono text-[#a8d5b5] font-bold text-right hidden sm:block">
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
  badge.className = 'm3-badge-primary font-mono font-bold';

  list.innerHTML = cutsForSelectedDay.map(sub => {
    const isDiff = sub.currency && sub.currency !== baseCurr;
    const origSymbol = CURRENCY_SYMBOLS[sub.currency] || '$';
    const cycleLabel = CYCLE_LABELS[sub.billing_cycle] || sub.billing_cycle;

    return `
      <div class="m3-card p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group">
        <div class="absolute top-0 left-0 right-0 h-1" style="background-color: ${sub.color || 'var(--md-sys-color-primary)'}"></div>

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

        <div class="bg-[#141218] rounded-2xl p-3 flex items-center justify-between border border-[#49454f]/30">
          <div>
            <span class="text-[10px] text-[#cac4d0] uppercase tracking-wider block font-medium">Cobro del Día</span>
            <span class="text-sm font-bold text-white font-mono">${curSymbol}${formatNumber(sub.converted_price_calculated)}</span>
          </div>
          ${isDiff ? `
            <div class="text-right">
              <span class="text-[10px] text-[#cac4d0] uppercase tracking-wider block font-medium">Original</span>
              <span class="text-xs font-semibold text-[#d0bcff] font-mono">${origSymbol}${formatNumber(sub.price)} ${sub.currency}</span>
            </div>
          ` : ''}
        </div>

        <div class="flex items-center justify-between pt-1 text-xs">
          <span class="text-[11px] text-[#cac4d0] flex items-center gap-1">
            <i data-lucide="credit-card" class="w-3 h-3 text-[#cac4d0]"></i>
            ${escapeHtml(sub.payment_method || 'Tarjeta')}
          </span>
          <div class="flex items-center gap-1.5">
            <button onclick="markAsPaidAndAdvance(${sub.id})" title="Marcar como pagado y avanzar fecha" class="m3-btn-tonal text-xs py-1 px-3 flex items-center gap-1">
              <i data-lucide="receipt" class="w-3.5 h-3.5"></i> Pagado
            </button>
            <button onclick="editSubscription(${sub.id})" title="Editar suscripción" class="p-1.5 rounded-full hover:bg-[#2b2930] text-[#cac4d0] hover:text-white transition">
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

function showPresetsStep() {
  const tplStep = document.getElementById('templatesStepContainer');
  const form = document.getElementById('subscriptionForm');
  const btnBack = document.getElementById('btnBackToPresets');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');

  tplStep?.classList.remove('hidden');
  form?.classList.add('hidden');
  btnBack?.classList.add('hidden');

  if (modalTitle) modalTitle.innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-[#d0bcff]"></i> Nueva Suscripción`;
  if (modalSubtitle) modalSubtitle.textContent = 'Elige un servicio popular o crea una personalizada';

  renderPresetCatalog();
  initIcons();
}

function showDetailsForm(titleText = 'Detalles de Suscripción', isEdit = false) {
  const tplStep = document.getElementById('templatesStepContainer');
  const form = document.getElementById('subscriptionForm');
  const btnBack = document.getElementById('btnBackToPresets');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');

  tplStep?.classList.add('hidden');
  form?.classList.remove('hidden');

  if (isEdit) {
    btnBack?.classList.add('hidden');
    if (modalTitle) modalTitle.innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-[#d0bcff]"></i> Editar Suscripción`;
    if (modalSubtitle) modalSubtitle.textContent = 'Modifica los valores y fechas de tu suscripción';
  } else {
    btnBack?.classList.remove('hidden');
    if (modalTitle) modalTitle.innerHTML = `<i data-lucide="check-circle-2" class="w-5 h-5 text-[#a8d5b5]"></i> ${escapeHtml(titleText)}`;
    if (modalSubtitle) modalSubtitle.textContent = 'Configura el plan, fecha de corte y división de gastos';
  }

  updateModalLiveCalculation();
  initIcons();
}

function openCustomSubscription() {
  const form = document.getElementById('subscriptionForm');
  form.reset();

  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 1);
  const defaultDateStr = defaultDate.toISOString().split('T')[0];

  document.getElementById('subId').value = '';
  document.getElementById('subName').value = '';
  document.getElementById('subPrice').value = '';
  document.getElementById('subCurrency').value = state.baseCurrencyCode || 'USD';
  document.getElementById('subBillingCycle').value = 'monthly';
  document.getElementById('subCategory').value = 'Servicios';
  document.getElementById('subNextBillingDate').value = defaultDateStr;
  document.getElementById('subColor').value = '#d0bcff';

  document.getElementById('trialFieldsContainer')?.classList.add('hidden');
  document.getElementById('sharedFieldsContainer')?.classList.add('hidden');
  populateSharedFriendsCheckboxes([]);

  showDetailsForm('Suscripción Personalizada', false);
}

function openModal(sub = null) {
  state.editingId = sub ? sub.id : null;
  const modal = document.getElementById('subscriptionModal');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const form = document.getElementById('subscriptionForm');

  form.reset();

  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 1);
  const defaultDateStr = defaultDate.toISOString().split('T')[0];

  document.getElementById('trialFieldsContainer')?.classList.add('hidden');
  document.getElementById('sharedFieldsContainer')?.classList.add('hidden');

  let selectedFriendIds = [];

  if (sub) {
    btnSubmitText.textContent = 'Actualizar Suscripción';

    document.getElementById('subId').value = sub.id;
    document.getElementById('subName').value = sub.name;
    document.getElementById('subPrice').value = sub.price;
    document.getElementById('subCurrency').value = sub.currency || 'USD';
    document.getElementById('subBillingCycle').value = sub.billing_cycle;
    document.getElementById('subNextBillingDate').value = sub.next_billing_date;
    document.getElementById('subCategory').value = sub.category;
    document.getElementById('subPaymentMethod').value = sub.payment_method || '';
    document.getElementById('subStatus').value = sub.status;
    document.getElementById('subColor').value = sub.color || '#d0bcff';
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

    showDetailsForm(sub.name, true);
  } else {
    btnSubmitText.textContent = 'Guardar Suscripción';

    document.getElementById('subId').value = '';
    document.getElementById('subCurrency').value = state.baseCurrencyCode || 'USD';
    document.getElementById('subNextBillingDate').value = defaultDateStr;
    document.getElementById('subColor').value = '#d0bcff';

    // Abrir directamente en el paso 1 (Buscador y Plantillas)
    showPresetsStep();
  }

  populateSharedFriendsCheckboxes(selectedFriendIds);
  modal.classList.remove('hidden');
  initIcons();
}

// ================= RENDERIZADO DEL CATÁLOGO DE PRESETS M3 =================
function renderPresetCatalog(filterCategory = 'all', searchQuery = '') {
  const container = document.getElementById('presetGridContainer');
  if (!container) return;

  const baseCurr = state.baseCurrencyCode || 'USD';
  const baseSymbol = state.currency || '$';
  const q = searchQuery.toLowerCase().trim();

  const filtered = PRESET_SERVICES.filter(service => {
    const matchCategory = filterCategory === 'all' || service.category.toLowerCase() === filterCategory.toLowerCase();
    const matchQuery = !q || service.name.toLowerCase().includes(q) || service.category.toLowerCase().includes(q);
    return matchCategory && matchQuery;
  });

  // Tarjeta de Personalizada siempre accesible como primera o destacada opción
  const customCardHtml = `
    <div class="m3-preset-card border-dashed border-[#d0bcff]/50 bg-[#2b2930]/40 group hover:border-[#d0bcff]" onclick="openCustomSubscription()" title="Crear suscripción propia desde cero">
      <div class="m3-brand-icon-box bg-[#d0bcff]/20 text-[#d0bcff] transition-transform group-hover:scale-105 border border-[#d0bcff]/40">
        <i data-lucide="plus" class="w-5 h-5"></i>
      </div>
      <div class="overflow-hidden flex-1 min-w-0">
        <div class="text-xs font-bold text-white truncate flex items-center gap-1.5 font-google-sans">
          <span>Personalizada</span>
          <span class="m3-badge-primary text-[9px]">Nuevo</span>
        </div>
        <div class="text-[11px] text-[#cac4d0] truncate">
          Crea un servicio que no esté en la lista
        </div>
      </div>
    </div>
  `;

  if (filtered.length === 0) {
    container.innerHTML = `
      ${customCardHtml}
      <div class="col-span-full py-6 text-center text-xs text-[#cac4d0]">
        No se encontraron servicios que coincidan con la búsqueda. Puedes crear una <button type="button" onclick="openCustomSubscription()" class="text-[#d0bcff] font-semibold underline">Personalizada</button>.
      </div>
    `;
    initIcons();
    return;
  }

  const itemsHtml = filtered.map((service, sIndex) => {
    const plan = service.plans[0];
    const converted = convertCurrency(plan.priceUsd, 'USD', baseCurr);
    const cycleLabel = plan.cycle === 'annual' ? '/año' : '/mes';
    const isDiffCurr = baseCurr !== 'USD';
    const iconHtml = getServiceOfficialIcon(service.name, service.color);

    return `
      <div class="m3-preset-card group" onclick="selectPresetService(${sIndex})" title="Añadir ${escapeHtml(service.name)} (${plan.name})">
        <div class="m3-brand-icon-box transition-transform group-hover:scale-105"
             style="background: linear-gradient(135deg, ${service.color || '#d0bcff'}22, ${service.color || '#d0bcff'}44); border: 1px solid ${service.color || '#d0bcff'}55">
          ${iconHtml}
        </div>
        <div class="overflow-hidden flex-1 min-w-0">
          <div class="text-xs font-bold text-white truncate flex items-center gap-1 font-google-sans">
            <span>${escapeHtml(service.name)}</span>
          </div>
          <div class="text-[11px] font-mono font-semibold text-[#d0bcff] truncate">
            ${baseSymbol}${formatNumber(converted)}${cycleLabel}
          </div>
          ${isDiffCurr ? `<div class="text-[9px] text-[#cac4d0] font-mono truncate">($${formatNumber(plan.priceUsd)} USD)</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = customCardHtml + itemsHtml;
  initIcons();
}

function selectPresetService(serviceIndex) {
  const service = PRESET_SERVICES[serviceIndex];
  if (!service) return;

  const baseCurr = state.baseCurrencyCode || 'USD';
  const plan = service.plans[0];
  const convertedPrice = convertCurrency(plan.priceUsd, 'USD', baseCurr);

  document.getElementById('subName').value = service.name;
  document.getElementById('subPrice').value = formatNumber(convertedPrice).replace(/,/g, '');
  document.getElementById('subCurrency').value = baseCurr;
  document.getElementById('subBillingCycle').value = plan.cycle || 'monthly';
  document.getElementById('subCategory').value = service.category || 'Otros';
  document.getElementById('subColor').value = service.color || '#d0bcff';
  if (service.url) {
    document.getElementById('subUrl').value = service.url;
  }

  showDetailsForm(service.name, false);
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
    if (calcM) calcM.innerHTML = `${subSymbol}${formatNumber(monthly)} <span class="text-[#d0bcff] font-bold text-[11px] font-mono">(≈ ${baseSymbol}${formatNumber(monthlyConv)} ${baseCurr})</span> / mes`;
    if (calcA) calcA.innerHTML = `${subSymbol}${formatNumber(annual)} <span class="text-[#d0bcff] font-bold text-[11px] font-mono">(≈ ${baseSymbol}${formatNumber(annualConv)} ${baseCurr})</span> / año`;
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
  if (days === null || days === undefined) return { text: 'Pendiente', badgeClass: 'm3-badge-secondary' };
  if (days < 0) return { text: `Vencido hace ${Math.abs(days)}d`, badgeClass: 'm3-badge-error' };
  if (days === 0) return { text: '¡Hoy!', badgeClass: 'm3-badge-error animate-pulse' };
  if (days === 1) return { text: 'Mañana', badgeClass: 'm3-badge-warning' };
  if (days <= 7) return { text: `En ${days} días`, badgeClass: 'm3-badge-warning' };
  return { text: `En ${days} días`, badgeClass: 'm3-badge-secondary' };
}

function getStatusBadge(status) {
  if (status === 'active') return `<span class="m3-badge-success">Activa</span>`;
  if (status === 'paused') return `<span class="m3-badge-warning">Pausada</span>`;
  return `<span class="m3-badge-secondary">Cancelada</span>`;
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
  let iconHtml = type === 'success' ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-[#a8d5b5]"></i>' : (type === 'error' ? '<i data-lucide="alert-circle" class="w-4 h-4 text-[#f2b8b5]"></i>' : '<i data-lucide="info" class="w-4 h-4 text-[#d0bcff]"></i>');
  let colorClasses = type === 'success' 
    ? 'bg-[#141218] border-[#a8d5b5]/40 text-[#e6e0e9] shadow-[#2b5037]/20' 
    : (type === 'error' 
      ? 'bg-[#141218] border-[#f2b8b5]/40 text-[#e6e0e9] shadow-[#8c1d18]/20' 
      : 'bg-[#141218] border-[#d0bcff]/40 text-[#e6e0e9] shadow-[#4f378b]/20');

  iconElem.innerHTML = iconHtml;
  toast.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl text-xs sm:text-sm font-medium border transition-all duration-300 ease-out font-google-sans ${colorClasses}`;
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
window.openCustomSubscription = openCustomSubscription;
window.showPresetsStep = showPresetsStep;
window.selectPresetService = selectPresetService;
