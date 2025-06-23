/**
 * Main Service Worker for Offline-First Architecture
 * Handles caching, background sync, and offline functionality
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/offline.html'
];

// API endpoints to cache
const CACHEABLE_APIS = [
  '/api/alerts',
  '/api/user/preferences',
  '/api/dashboard/summary'
];

class OfflineServiceWorker {
  constructor() {
    this.setupEventListeners();
    this.isOnline = navigator.onLine;
  }

  setupEventListeners() {
    // Install event - cache static assets
    self.addEventListener('install', (event) => {
      console.log('Service Worker installing...');
      event.waitUntil(this.handleInstall());
    });

    // Activate event - clean up old caches
    self.addEventListener('activate', (event) => {
      console.log('Service Worker activating...');
      event.waitUntil(this.handleActivate());
    });

    // Fetch event - handle network requests
    self.addEventListener('fetch', (event) => {
      event.respondWith(this.handleFetch(event.request));
    });

    // Background sync
    self.addEventListener('sync', (event) => {
      console.log('Background sync triggered:', event.tag);
      if (event.tag === 'background-sync') {
        event.waitUntil(this.handleBackgroundSync());
      }
    });

    // Push notifications
    self.addEventListener('push', (event) => {
      if (event.data) {
        const data = event.data.json();
        event.waitUntil(this.handlePushNotification(data));
      }
    });

    // Notification click
    self.addEventListener('notificationclick', (event) => {
      event.notification.close();
      event.waitUntil(this.handleNotificationClick(event));
    });

    // Message from main thread
    self.addEventListener('message', (event) => {
      this.handleMessage(event);
    });

    // Online/offline status
    self.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnlineStatusChange(true);
    });

    self.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOnlineStatusChange(false);
    });
  }

  /**
   * Handle service worker installation
   */
  async handleInstall() {
    try {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
      console.log('Static assets cached successfully');
      
      // Skip waiting to activate immediately
      await self.skipWaiting();
    } catch (error) {
      console.error('Error during service worker installation:', error);
    }
  }

  /**
   * Handle service worker activation
   */
  async handleActivate() {
    try {
      // Clean up old caches
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name !== STATIC_CACHE && 
        name !== DYNAMIC_CACHE && 
        name !== API_CACHE
      );

      await Promise.all(
        oldCaches.map(cacheName => caches.delete(cacheName))
      );

      console.log('Old caches cleaned up');
      
      // Take control of all clients
      await self.clients.claim();
    } catch (error) {
      console.error('Error during service worker activation:', error);
    }
  }

  /**
   * Handle fetch requests with caching strategy
   */
  async handleFetch(request) {
    const url = new URL(request.url);

    // Handle different types of requests
    if (this.isStaticAsset(request)) {
      return this.cacheFirst(request, STATIC_CACHE);
    } else if (this.isAPIRequest(request)) {
      return this.networkFirst(request, API_CACHE);
    } else if (this.isNavigationRequest(request)) {
      return this.handleNavigationRequest(request);
    } else {
      return this.staleWhileRevalidate(request, DYNAMIC_CACHE);
    }
  }

  /**
   * Cache-first strategy for static assets
   */
  async cacheFirst(request, cacheName) {
    try {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    } catch (error) {
      console.error('Cache-first strategy failed:', error);
      return this.getOfflineFallback(request);
    }
  }

  /**
   * Network-first strategy for API requests
   */
  async networkFirst(request, cacheName) {
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    } catch (error) {
      console.log('Network failed, trying cache:', request.url);
      
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        // Add offline indicator to response
        const modifiedResponse = this.addOfflineHeader(cachedResponse);
        return modifiedResponse;
      }

      return this.getOfflineFallback(request);
    }
  }

  /**
   * Stale-while-revalidate strategy
   */
  async staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Fetch in background to update cache
    const fetchPromise = fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(() => {
      // Network failed, but we might have cached version
    });

    // Return cached version immediately if available
    if (cachedResponse) {
      return cachedResponse;
    }

    // Wait for network if no cached version
    try {
      return await fetchPromise;
    } catch (error) {
      return this.getOfflineFallback(request);
    }
  }

  /**
   * Handle navigation requests (page loads)
   */
  async handleNavigationRequest(request) {
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    } catch (error) {
      // Return cached version or offline page
      const cache = await caches.open(DYNAMIC_CACHE);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }

      // Return offline page for navigation requests
      const offlineResponse = await cache.match('/offline.html');
      return offlineResponse || new Response('Offline', { status: 503 });
    }
  }

  /**
   * Handle background synchronization
   */
  async handleBackgroundSync() {
    try {
      console.log('Performing background sync...');
      
      // Get pending operations from IndexedDB
      const pendingOperations = await this.getPendingOperations();
      
      if (pendingOperations.length === 0) {
        console.log('No pending operations to sync');
        return;
      }

      console.log(`Syncing ${pendingOperations.length} operations`);
      
      for (const operation of pendingOperations) {
        try {
          await this.syncOperation(operation);
          await this.markOperationSynced(operation.id);
        } catch (error) {
          console.error('Failed to sync operation:', operation.id, error);
          await this.incrementRetryCount(operation.id);
        }
      }

      // Notify main thread about sync completion
      this.notifyClients('sync-completed', {
        syncedCount: pendingOperations.length
      });

    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  /**
   * Handle push notifications
   */
  async handlePushNotification(data) {
    const options = {
      body: data.body || 'New alert received',
      icon: '/icons/alert-icon.png',
      badge: '/icons/badge.png',
      tag: data.tag || 'alert',
      data: data,
      requireInteraction: data.critical || false,
      actions: [
        {
          action: 'view',
          title: 'View Alert',
          icon: '/icons/view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ]
    };

    await self.registration.showNotification(data.title || 'Alert', options);
  }

  /**
   * Handle notification clicks
   */
  async handleNotificationClick(event) {
    const action = event.action;
    const data = event.notification.data;

    if (action === 'view' || !action) {
      // Open or focus the app
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      let clientToFocus = null;

      for (const client of clients) {
        if (client.url.includes('/alerts/') || client.url === '/') {
          clientToFocus = client;
          break;
        }
      }

      if (clientToFocus) {
        await clientToFocus.focus();
        clientToFocus.postMessage({
          type: 'notification-clicked',
          data: data
        });
      } else {
        const url = data.alertId ? `/alerts/${data.alertId}` : '/';
        await self.clients.openWindow(url);
      }
    }
    // Dismiss action doesn't need additional handling
  }

  /**
   * Handle messages from main thread
   */
  handleMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'skip-waiting':
        self.skipWaiting();
        break;
      case 'cache-urls':
        this.cacheUrls(data.urls);
        break;
      case 'clear-cache':
        this.clearCache(data.cacheName);
        break;
      case 'get-cache-status':
        this.getCacheStatus().then(status => {
          event.ports[0].postMessage(status);
        });
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  }

  /**
   * Handle online/offline status changes
   */
  handleOnlineStatusChange(isOnline) {
    this.isOnline = isOnline;
    
    this.notifyClients('connectivity-changed', { isOnline });

    if (isOnline) {
      // Trigger background sync when coming online
      this.registerBackgroundSync();
    }
  }

  /**
   * Utility methods
   */
  isStaticAsset(request) {
    return request.url.includes('/static/') || 
           request.url.includes('.css') || 
           request.url.includes('.js') ||
           request.url.includes('.png') ||
           request.url.includes('.jpg') ||
           request.url.includes('.svg');
  }

  isAPIRequest(request) {
    return request.url.includes('/api/') || 
           request.url.includes('/graphql');
  }

  isNavigationRequest(request) {
    return request.mode === 'navigate';
  }

  addOfflineHeader(response) {
    const headers = new Headers(response.headers);
    headers.set('X-Served-From', 'cache');
    headers.set('X-Offline-Mode', 'true');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  }

  async getOfflineFallback(request) {
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE);
      return await cache.match('/offline.html') || 
             new Response('Offline', { status: 503 });
    }
    
    return new Response('Offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  async registerBackgroundSync() {
    try {
      await self.registration.sync.register('background-sync');
    } catch (error) {
      console.error('Failed to register background sync:', error);
    }
  }

  async notifyClients(type, data) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type, data });
    });
  }

  async cacheUrls(urls) {
    const cache = await caches.open(DYNAMIC_CACHE);
    await Promise.all(
      urls.map(url => 
        fetch(url).then(response => {
          if (response.ok) {
            return cache.put(url, response);
          }
        }).catch(() => {
          // Ignore cache failures
        })
      )
    );
  }

  async clearCache(cacheName) {
    if (cacheName) {
      await caches.delete(cacheName);
    } else {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
  }

  async getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = keys.length;
    }
    
    return status;
  }

  // IndexedDB operations for background sync
  async getPendingOperations() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RealTimeAlertPlatform', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result || []);
        };
        
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async syncOperation(operation) {
    const { entityType, operation: op, data } = operation;
    
    let url, method, body;
    
    switch (entityType) {
      case 'alert':
        url = `/api/alerts${op === 'update' ? `/${data.alertId}` : ''}`;
        method = op === 'create' ? 'POST' : op === 'update' ? 'PUT' : 'DELETE';
        body = op !== 'delete' ? JSON.stringify(data) : undefined;
        break;
      case 'userPreferences':
        url = `/api/user/preferences`;
        method = 'PUT';
        body = JSON.stringify(data);
        break;
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    return response.json();
  }

  async markOperationSynced(operationId) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RealTimeAlertPlatform', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const deleteRequest = store.delete(operationId);
        
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async incrementRetryCount(operationId) {
    // Implementation for retry logic
    console.log(`Incrementing retry count for operation ${operationId}`);
  }
}

// Initialize the service worker
const offlineServiceWorker = new OfflineServiceWorker();

console.log('Offline Service Worker initialized');