// Service Worker for Agent Console PWA
// Serves offline fallback when server is unreachable

const CACHE_NAME = 'agent-console-v8';

// Inline offline page — no dependency on cache.addAll succeeding
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"/>
<meta name="theme-color" content="#0f172a"/>
<title>Agent Console</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
.c{max-width:320px;width:100%}
.i{font-size:48px;margin-bottom:16px}
h1{font-size:20px;font-weight:600;margin-bottom:8px}
p{font-size:14px;color:#94a3b8;line-height:1.5;margin-bottom:20px}
button{display:block;width:100%;border:none;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:10px}
.bp{background:#3b82f6;color:white}
.bs{background:#334155;color:#e2e8f0}
.d{color:#475569;font-size:12px;margin:16px 0}
input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:13px;margin-bottom:10px}
input::placeholder{color:#64748b}
.ok{color:#34d399;font-size:13px;display:none;margin-bottom:10px}
</style>
</head>
<body>
<div class="c">
<div class="i">📡</div>
<h1>Server Not Reachable</h1>
<p>Agent Console is not running or the tunnel URL has changed. Start the console on your desktop and try again.</p>
<button class="bp" onclick="location.reload()">Retry</button>
<div class="d">— or reconnect with new URL —</div>
<input id="u" type="url" placeholder="New tunnel URL"/>
<input id="t" type="password" placeholder="API token"/>
<div id="ok" class="ok">✓ Saved — reloading...</div>
<button class="bs" onclick="s()">Save & Reconnect</button>
</div>
<script>
var u=localStorage.getItem('agentconsole_base_url');
var t=localStorage.getItem('agentconsole_api_token');
if(u)document.getElementById('u').value=u;
if(t)document.getElementById('t').value=t;
function s(){
var nu=document.getElementById('u').value.trim();
var nt=document.getElementById('t').value.trim();
if(nu)localStorage.setItem('agentconsole_base_url',nu);
if(nt)localStorage.setItem('agentconsole_api_token',nt);
document.getElementById('ok').style.display='block';
setTimeout(function(){location.reload()},500);
}
</script>
</body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for API calls and SSE streams
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Navigation requests — network first, inline offline fallback
  // When tunnel is up but server is down, devtunnel returns a non-ok response (e.g. 502)
  // so we must check response.ok, not just catch network errors
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => response.ok ? response : offlineResponse())
        .catch(() => offlineResponse())
    );
    return;
  }

  // Static assets — cache-first
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          }).catch(() => new Response('', { status: 503 }))
      )
    );
    return;
  }

  event.respondWith(fetch(event.request));
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Agent Console', body: event.data.text() };
  }

  const title = payload.title || '🤖 Agent Console';
  const options = {
    body: payload.body || 'An agent has finished responding',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
    tag: payload.data?.session_id || 'agent-console',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open/focus the mobile app at the session
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/mobile';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if found
      for (const client of windowClients) {
        if (client.url.includes('/mobile') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
