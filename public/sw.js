// Service worker do LIFT.OS
// 1) Notificações locais (ex: "descanso completo") com o app em segundo plano.
// 2) Cache offline do "casco" do app, sem nunca servir código velho quando há internet.
//
// Regras:
//  - Só trata GET do próprio site. Supabase, fontes e /api/* passam direto pela rede.
//  - app.html e app.js: rede primeiro (sempre a versão nova); cache só se estiver offline/lento.
//  - /vendor, ícones e manifest: cache primeiro (arquivos com versão fixa ou que quase não mudam).
//  - Para publicar uma nova versão do casco, basta mudar CACHE_VERSION.

const CACHE_VERSION = 'lift-v2';   // suba ao regenerar /taco.json (cache-primeiro)
const SHELL = [
  '/app.html',
  '/app.js',
  '/vendor/supabase-js-2.119.1.js',
  '/vendor/jspdf-2.5.1.umd.min.js',
  '/taco.json',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
];
const NETWORK_FIRST = new Set(['/app.html', '/app.js']);
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // allSettled: um arquivo ausente não impede a instalação do restante
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function redeComTimeout(request) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS);
    fetch(request).then(
      (res) => { clearTimeout(t); resolve(res); },
      (err) => { clearTimeout(t); reject(err); }
    );
  });
}

async function redePrimeiro(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const res = await redeComTimeout(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const guardado = await cache.match(request, { ignoreSearch: true });
    if (guardado) return guardado;
    throw e;
  }
}

async function cachePrimeiro(request) {
  const cache = await caches.open(CACHE_VERSION);
  const guardado = await cache.match(request, { ignoreSearch: true });
  if (guardado) return guardado;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Supabase, fontes etc.
  if (url.pathname.startsWith('/api/')) return;             // análise de foto: sempre rede
  if (url.pathname === '/sw.js') return;

  // Abrir o app (navegação): a página sempre vem da rede; offline usa o app.html guardado
  if (req.mode === 'navigate') {
    if (url.pathname === '/app.html') {
      event.respondWith(
        redePrimeiro(new Request('/app.html')).catch(() => caches.match('/app.html'))
      );
    }
    return;
  }

  if (NETWORK_FIRST.has(url.pathname)) {
    event.respondWith(redePrimeiro(req));
  } else if (SHELL.includes(url.pathname) || url.pathname.startsWith('/vendor/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(cachePrimeiro(req));
  }
});

// Ao tocar na notificação, foca a aba do app já aberta (ou abre uma nova)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/app.html');
    })
  );
});
