// Service worker mínimo do LIFT.OS — hoje existe só pra habilitar notificações locais
// (ex: "descanso completo") mesmo com o app em segundo plano ou outro app aberto.
// Não faz cache nem funciona offline ainda — isso fica pra uma próxima etapa do PWA.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
