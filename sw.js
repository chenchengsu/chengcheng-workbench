const CACHE = 'chengcheng-workbench-v145';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/bead-data.js',
  './js/bead-stock.js',
  './nav-bead.jpg',
  './notebook-icon.jpg',
  './notebook-home.svg',
  './granary-home.svg',
  './icon-expense-today.svg',
  './icon-expense-month.svg',
  './icon-weight.svg',
  './icon-period.svg',
  './icon-notebook.svg',
  './icon-bead.svg',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './stage-hero.png',
  './nav-home.png',
  './nav-account.png',
  './nav-health.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
