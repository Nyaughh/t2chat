const CACHE_NAME = 't2chat-v1';
const STATIC_CACHE = 't2chat-static-v1';
const DATA_CACHE = 't2chat-data-v1';

// Assets to cache
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline',
  '/auth',
  '/site.webmanifest',
  '/assets/toggle.svg',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/icon.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache assets individually to avoid failing if one asset fails
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            cache.add(url).catch(error => {
              console.warn('[SW] Failed to cache:', url, error);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Static assets cached (with potential warnings)');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error during installation:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== STATIC_CACHE && 
                     cacheName !== DATA_CACHE && 
                     cacheName !== CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests differently
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (url.pathname.startsWith('/_next/') || 
      url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|json)$/) ||
      STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle other requests (CSS, JS, images, etc.)
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        // Try network and cache the response
        return fetch(request)
          .then((response) => {
            // Only cache successful responses
            if (response.ok && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch((error) => {
            console.log('[SW] Failed to fetch:', request.url);
            
            // For navigation requests, provide offline fallback
            if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
              return handleNavigationRequest(request);
            }
            
            // For other resources, just throw the error
            throw error;
          });
      })
  );
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If it's a chat request, queue for background sync
    if (request.url.includes('/api/chat')) {
      await queueForBackgroundSync(request);
    }
    
    throw error;
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', request.url);
    throw error;
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful page responses
    if (response.ok && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Navigation failed for:', url.pathname, 'serving offline fallback');
    
    // Try to serve cached version of the same page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving cached version of:', url.pathname);
      return cachedResponse;
    }
    
    // For chat routes, try to serve the main app shell
    if (url.pathname.startsWith('/chat/') || url.pathname === '/') {
      const appShell = await caches.match('/');
      if (appShell) {
        console.log('[SW] Serving app shell for chat route');
        return appShell;
      }
    }
    
    // Fallback to offline page
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      console.log('[SW] Serving offline page');
      return offlinePage;
    }
    
    // Last resort: create a basic offline response
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>T2 Chat - Offline</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: system-ui, sans-serif; 
              text-align: center; 
              padding: 2rem; 
              background: #fafafa; 
            }
            .container { 
              max-width: 400px; 
              margin: 0 auto; 
              padding: 2rem; 
              background: white; 
              border-radius: 8px; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #374151; margin-bottom: 1rem; }
            p { color: #6b7280; margin-bottom: 1.5rem; }
            button { 
              background: #ef4444; 
              color: white; 
              border: none; 
              padding: 0.75rem 1.5rem; 
              border-radius: 6px; 
              cursor: pointer; 
              font-size: 1rem;
            }
            button:hover { background: #dc2626; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">📱</div>
            <h1>You're Offline</h1>
            <p>This page isn't available offline. Please check your connection and try again.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>
    `, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    });
  }
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'chat-sync') {
    event.waitUntil(syncPendingChats());
  }
  
  if (event.tag === 'message-sync') {
    event.waitUntil(syncPendingMessages());
  }
});

// Queue requests for background sync
async function queueForBackgroundSync(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };
    
    // Store in IndexedDB for background sync
    const db = await openDB();
    const tx = db.transaction(['pending_requests'], 'readwrite');
    await tx.objectStore('pending_requests').add(requestData);
    
    // Register background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register('chat-sync');
    }
    
    console.log('[SW] Request queued for background sync');
  } catch (error) {
    console.error('[SW] Error queueing request:', error);
  }
}

// Sync pending chats when online
async function syncPendingChats() {
  try {
    const db = await openDB();
    const tx = db.transaction(['pending_requests'], 'readonly');
    const requests = await tx.objectStore('pending_requests').getAll();
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          // Remove from queue on success
          const deleteTx = db.transaction(['pending_requests'], 'readwrite');
          await deleteTx.objectStore('pending_requests').delete(requestData.timestamp);
          
          // Notify clients of successful sync
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                data: { url: requestData.url }
              });
            });
          });
        }
      } catch (error) {
        console.error('[SW] Error syncing request:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in background sync:', error);
  }
}

// Sync pending messages
async function syncPendingMessages() {
  // Similar to syncPendingChats but for individual messages
  console.log('[SW] Syncing pending messages...');
}

// IndexedDB helper
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('t2chat-sw', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pending_requests')) {
        const store = db.createObjectStore('pending_requests', { keyPath: 'timestamp' });
        store.createIndex('url', 'url', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('cached_chats')) {
        const chatStore = db.createObjectStore('cached_chats', { keyPath: 'id' });
        chatStore.createIndex('userId', 'userId', { unique: false });
      }
    };
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'You have a new message in T2 Chat',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-16x16.png',
    data: event.data ? event.data.json() : {},
    actions: [
      {
        action: 'open',
        title: 'Open Chat'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('T2 Chat', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' })
        .then((clientList) => {
          // Check if app is already open
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Open new window if not already open
          if (self.clients.openWindow) {
            return self.clients.openWindow('/');
          }
        })
    );
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_CHAT':
      cacheChatData(data);
      break;
      
    case 'GET_CACHED_CHATS':
      getCachedChats().then(chats => {
        event.ports[0].postMessage({ chats });
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Cache chat data for offline access
async function cacheChatData(chatData) {
  try {
    const db = await openDB();
    const tx = db.transaction(['cached_chats'], 'readwrite');
    await tx.objectStore('cached_chats').put(chatData);
    console.log('[SW] Chat data cached');
  } catch (error) {
    console.error('[SW] Error caching chat data:', error);
  }
}

// Get cached chats
async function getCachedChats() {
  try {
    const db = await openDB();
    const tx = db.transaction(['cached_chats'], 'readonly');
    return await tx.objectStore('cached_chats').getAll();
  } catch (error) {
    console.error('[SW] Error getting cached chats:', error);
    return [];
  }
} 