// Service worker: solo guarda los archivos de la página para abrirla rápido. Nunca guarda datos de proyectos ni respuestas del motor.
const CACHE = 'proyectos-v1';
const ARCHIVOS = ['./', 'index.html', 'estilos.css', 'app.js', 'config.js', 'logo.jpg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // el motor, los mapas y los videos nunca pasan por aquí
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
});
