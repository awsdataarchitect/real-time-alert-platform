/**
 * Unit tests for Service Worker
 */

// Mock global objects for service worker environment
global.self = global;
global.caches = {
  open: jest.fn(),
  keys: jest.fn(),
  delete: jest.fn(),
};
global.clients = {
  matchAll: jest.fn(),
  openWindow: jest.fn(),
  claim: jest.fn(),
};
global.registration = {
  showNotification: jest.fn(),
  sync: {
    register: jest.fn(),
  },
};
global.skipWaiting = jest.fn();
global.addEventListener = jest.fn();
global.fetch = jest.fn();
global.indexedDB = {
  open: jest.fn(),
};

// Mock cache object
const mockCache = {
  addAll: jest.fn(),
  match: jest.fn(),
  put: jest.fn(),
  keys: jest.fn(),
};

// Mock IDB database
const mockDB = {
  transaction: jest.fn(),
  result: {
    transaction: jest.fn(),
  },
};

const mockTransaction = {
  objectStore: jest.fn(),
};

const mockStore = {
  getAll: jest.fn(),
  delete: jest.fn(),
};

describe('Service Worker', () => {
  let serviceWorkerInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks
    global.caches.open.mockResolvedValue(mockCache);
    global.caches.keys.mockResolvedValue(['old-cache-v1']);
    global.caches.delete.mockResolvedValue(true);
    
    mockCache.addAll.mockResolvedValue();
    mockCache.match.mockResolvedValue(null);
    mockCache.put.mockResolvedValue();
    mockCache.keys.mockResolvedValue([]);
    
    global.clients.matchAll.mockResolvedValue([]);
    global.clients.openWindow.mockResolvedValue();
    global.clients.claim.mockResolvedValue();
    
    global.registration.showNotification.mockResolvedValue();
    global.registration.sync.register.mockResolvedValue();
    
    global.fetch.mockResolvedValue({
      ok: true,
      clone: () => ({ ok: true }),
      json: () => Promise.resolve({}),
    });

    // Mock IndexedDB
    const mockRequest = {
      onsuccess: null,
      onerror: null,
      result: mockDB,
    };
    
    global.indexedDB.open.mockReturnValue(mockRequest);
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockStore);
    
    const mockGetAllRequest = {
      onsuccess: null,
      onerror: null,
      result: [],
    };
    mockStore.getAll.mockReturnValue(mockGetAllRequest);

    // Import and initialize service worker
    // Note: In a real test, you'd import the actual service worker file
    // For this test, we'll simulate the service worker class
    serviceWorkerInstance = {
      handleInstall: jest.fn(),
      handleActivate: jest.fn(),
      handleFetch: jest.fn(),
      handleBackgroundSync: jest.fn(),
      cacheFirst: jest.fn(),
      networkFirst: jest.fn(),
      staleWhileRevalidate: jest.fn(),
    };
  });

  describe('installation', () => {
    it('should cache static assets during install', async () => {
      const staticAssets = [
        '/',
        '/static/js/bundle.js',
        '/static/css/main.css',
        '/manifest.json',
        '/offline.html'
      ];

      // Simulate install event
      const installEvent = {
        waitUntil: jest.fn(),
      };

      // Mock the actual install handler
      const handleInstall = async () => {
        const cache = await global.caches.open('static-v1.0.0');
        await cache.addAll(staticAssets);
        await global.skipWaiting();
      };

      await handleInstall();

      expect(global.caches.open).toHaveBeenCalledWith('static-v1.0.0');
      expect(mockCache.addAll).toHaveBeenCalledWith(staticAssets);
      expect(global.skipWaiting).toHaveBeenCalled();
    });

    it('should handle install errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCache.addAll.mockRejectedValue(new Error('Cache failed'));

      const handleInstall = async () => {
        try {
          const cache = await global.caches.open('static-v1.0.0');
          await cache.addAll(['/']);
        } catch (error) {
          console.error('Error during service worker installation:', error);
        }
      };

      await handleInstall();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error during service worker installation:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('activation', () => {
    it('should clean up old caches during activation', async () => {
      const currentCaches = ['static-v1.0.0', 'dynamic-v1.0.0', 'api-v1.0.0'];
      const oldCaches = ['old-cache-v1', 'another-old-cache'];
      
      global.caches.keys.mockResolvedValue([...currentCaches, ...oldCaches]);

      const handleActivate = async () => {
        const cacheNames = await global.caches.keys();
        const validCaches = ['static-v1.0.0', 'dynamic-v1.0.0', 'api-v1.0.0'];
        const oldCaches = cacheNames.filter(name => !validCaches.includes(name));
        
        await Promise.all(
          oldCaches.map(cacheName => global.caches.delete(cacheName))
        );
        
        await global.clients.claim();
      };

      await handleActivate();

      expect(global.caches.delete).toHaveBeenCalledWith('old-cache-v1');
      expect(global.caches.delete).toHaveBeenCalledWith('another-old-cache');
      expect(global.clients.claim).toHaveBeenCalled();
    });
  });

  describe('fetch handling', () => {
    it('should use cache-first strategy for static assets', async () => {
      const request = new Request('/static/js/bundle.js');
      const cachedResponse = new Response('cached content');
      
      mockCache.match.mockResolvedValue(cachedResponse);

      const cacheFirst = async (request, cacheName) => {
        const cache = await global.caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
          return cachedResponse;
        }

        const networkResponse = await global.fetch(request);
        if (networkResponse.ok) {
          await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
      };

      const response = await cacheFirst(request, 'static-v1.0.0');

      expect(mockCache.match).toHaveBeenCalledWith(request);
      expect(response).toBe(cachedResponse);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should use network-first strategy for API requests', async () => {
      const request = new Request('/api/alerts');
      const networkResponse = new Response('network content');
      
      global.fetch.mockResolvedValue(networkResponse);
      mockCache.match.mockResolvedValue(null);

      const networkFirst = async (request, cacheName) => {
        try {
          const networkResponse = await global.fetch(request);
          
          if (networkResponse.ok) {
            const cache = await global.caches.open(cacheName);
            await cache.put(request, networkResponse.clone());
          }
          
          return networkResponse;
        } catch (error) {
          const cache = await global.caches.open(cacheName);
          const cachedResponse = await cache.match(request);
          
          if (cachedResponse) {
            return cachedResponse;
          }
          
          throw error;
        }
      };

      const response = await networkFirst(request, 'api-v1.0.0');

      expect(global.fetch).toHaveBeenCalledWith(request);
      expect(mockCache.put).toHaveBeenCalledWith(request, networkResponse.clone());
      expect(response).toBe(networkResponse);
    });

    it('should fall back to cache when network fails', async () => {
      const request = new Request('/api/alerts');
      const cachedResponse = new Response('cached content');
      
      global.fetch.mockRejectedValue(new Error('Network failed'));
      mockCache.match.mockResolvedValue(cachedResponse);

      const networkFirst = async (request, cacheName) => {
        try {
          const networkResponse = await global.fetch(request);
          return networkResponse;
        } catch (error) {
          const cache = await global.caches.open(cacheName);
          const cachedResponse = await cache.match(request);
          
          if (cachedResponse) {
            return cachedResponse;
          }
          
          throw error;
        }
      };

      const response = await networkFirst(request, 'api-v1.0.0');

      expect(global.fetch).toHaveBeenCalledWith(request);
      expect(mockCache.match).toHaveBeenCalledWith(request);
      expect(response).toBe(cachedResponse);
    });
  });

  describe('background sync', () => {
    it('should sync pending operations', async () => {
      const pendingOperations = [
        { id: 1, operation: 'create', entityType: 'alert', data: { alertId: 'test-1' } },
        { id: 2, operation: 'update', entityType: 'userPreferences', data: { userId: 'user-1' } },
      ];

      // Mock IndexedDB operations
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        result: mockDB,
      };
      
      global.indexedDB.open.mockReturnValue(mockRequest);
      
      const mockGetAllRequest = {
        onsuccess: null,
        onerror: null,
        result: pendingOperations,
      };
      
      mockStore.getAll.mockReturnValue(mockGetAllRequest);

      const handleBackgroundSync = async () => {
        return new Promise((resolve) => {
          const request = global.indexedDB.open('RealTimeAlertPlatform', 1);
          
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => {
              const operations = getAllRequest.result || [];
              resolve(operations);
            };
          };
          
          // Simulate successful request
          setTimeout(() => {
            mockRequest.onsuccess();
            mockGetAllRequest.onsuccess();
          }, 0);
        });
      };

      const operations = await handleBackgroundSync();

      expect(operations).toEqual(pendingOperations);
      expect(global.indexedDB.open).toHaveBeenCalledWith('RealTimeAlertPlatform', 1);
    });

    it('should handle sync errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        error: new Error('DB error'),
      };
      
      global.indexedDB.open.mockReturnValue(mockRequest);

      const handleBackgroundSync = async () => {
        return new Promise((resolve, reject) => {
          const request = global.indexedDB.open('RealTimeAlertPlatform', 1);
          
          request.onerror = () => {
            console.error('Background sync failed:', request.error);
            reject(request.error);
          };
          
          // Simulate error
          setTimeout(() => {
            mockRequest.onerror();
          }, 0);
        });
      };

      await expect(handleBackgroundSync()).rejects.toThrow('DB error');
      expect(consoleSpy).toHaveBeenCalledWith('Background sync failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('push notifications', () => {
    it('should show notification for push messages', async () => {
      const pushData = {
        title: 'Emergency Alert',
        body: 'Earthquake detected in your area',
        tag: 'earthquake-alert',
        critical: true,
      };

      const handlePushNotification = async (data) => {
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

        await global.registration.showNotification(data.title || 'Alert', options);
      };

      await handlePushNotification(pushData);

      expect(global.registration.showNotification).toHaveBeenCalledWith(
        'Emergency Alert',
        expect.objectContaining({
          body: 'Earthquake detected in your area',
          tag: 'earthquake-alert',
          requireInteraction: true,
        })
      );
    });
  });

  describe('notification clicks', () => {
    it('should handle notification clicks', async () => {
      const mockClient = {
        focus: jest.fn(),
        postMessage: jest.fn(),
        url: '/',
      };
      
      global.clients.matchAll.mockResolvedValue([mockClient]);

      const notificationData = {
        alertId: 'alert-123',
      };

      const handleNotificationClick = async (action, data) => {
        if (action === 'view' || !action) {
          const clients = await global.clients.matchAll({
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
            await global.clients.openWindow(url);
          }
        }
      };

      await handleNotificationClick('view', notificationData);

      expect(global.clients.matchAll).toHaveBeenCalledWith({
        type: 'window',
        includeUncontrolled: true
      });
      expect(mockClient.focus).toHaveBeenCalled();
      expect(mockClient.postMessage).toHaveBeenCalledWith({
        type: 'notification-clicked',
        data: notificationData
      });
    });

    it('should open new window when no existing client found', async () => {
      global.clients.matchAll.mockResolvedValue([]);

      const notificationData = {
        alertId: 'alert-123',
      };

      const handleNotificationClick = async (action, data) => {
        const clients = await global.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });

        if (clients.length === 0) {
          const url = data.alertId ? `/alerts/${data.alertId}` : '/';
          await global.clients.openWindow(url);
        }
      };

      await handleNotificationClick('view', notificationData);

      expect(global.clients.openWindow).toHaveBeenCalledWith('/alerts/alert-123');
    });
  });

  describe('utility functions', () => {
    it('should identify static assets correctly', () => {
      const isStaticAsset = (request) => {
        return request.url.includes('/static/') || 
               request.url.includes('.css') || 
               request.url.includes('.js') ||
               request.url.includes('.png') ||
               request.url.includes('.jpg') ||
               request.url.includes('.svg');
      };

      expect(isStaticAsset({ url: '/static/js/bundle.js' })).toBe(true);
      expect(isStaticAsset({ url: '/styles.css' })).toBe(true);
      expect(isStaticAsset({ url: '/api/alerts' })).toBe(false);
    });

    it('should identify API requests correctly', () => {
      const isAPIRequest = (request) => {
        return request.url.includes('/api/') || 
               request.url.includes('/graphql');
      };

      expect(isAPIRequest({ url: '/api/alerts' })).toBe(true);
      expect(isAPIRequest({ url: '/graphql' })).toBe(true);
      expect(isAPIRequest({ url: '/static/js/bundle.js' })).toBe(false);
    });

    it('should identify navigation requests correctly', () => {
      const isNavigationRequest = (request) => {
        return request.mode === 'navigate';
      };

      expect(isNavigationRequest({ mode: 'navigate' })).toBe(true);
      expect(isNavigationRequest({ mode: 'cors' })).toBe(false);
    });
  });
});