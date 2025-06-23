/**
 * Service Worker for Local Alert Processing
 * Handles background alert processing and notifications
 */

// Import local alert processor (will be bundled)
importScripts('/js/LocalAlertProcessor.bundle.js');

const CACHE_NAME = 'alert-processor-v1';
const ALERT_QUEUE_KEY = 'alert-processing-queue';

class ServiceWorkerAlertProcessor {
  constructor() {
    this.processor = new LocalAlertProcessor();
    this.notificationService = new ServiceWorkerNotificationService();
    this.processor.setNotificationService(this.notificationService);
    this.isOnline = navigator.onLine;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle online/offline status
    self.addEventListener('online', () => {
      this.isOnline = true;
      this.syncQueuedAlerts();
    });

    self.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Handle background sync
    self.addEventListener('sync', (event) => {
      if (event.tag === 'alert-sync') {
        event.waitUntil(this.syncQueuedAlerts());
      }
    });

    // Handle push messages for alerts
    self.addEventListener('push', (event) => {
      if (event.data) {
        const alertData = event.data.json();
        event.waitUntil(this.handleIncomingAlert(alertData));
      }
    });

    // Handle notification clicks
    self.addEventListener('notificationclick', (event) => {
      event.notification.close();
      event.waitUntil(this.handleNotificationClick(event));
    });

    // Handle messages from main thread
    self.addEventListener('message', (event) => {
      this.handleMessage(event);
    });
  }

  /**
   * Handle incoming alert for processing
   */
  async handleIncomingAlert(alertData) {
    try {
      console.log('Processing alert in service worker:', alertData.id);
      
      // Process alert locally
      const processedAlert = await this.processor.processAlert(alertData);
      
      // Store in IndexedDB for persistence
      await this.storeAlert(processedAlert);
      
      // Queue for sync if offline
      if (!this.isOnline) {
        await this.queueForSync(processedAlert);
      }

      // Notify main thread
      this.notifyMainThread('alert-processed', {
        alertId: processedAlert.id,
        severity: processedAlert.severity
      });

    } catch (error) {
      console.error('Error handling incoming alert:', error);
      this.notifyMainThread('alert-error', {
        alertId: alertData.id,
        error: error.message
      });
    }
  }

  /**
   * Store alert in IndexedDB
   */
  async storeAlert(alert) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AlertDatabase', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['alerts'], 'readwrite');
        const store = transaction.objectStore('alerts');
        
        const addRequest = store.put(alert);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('alerts')) {
          const store = db.createObjectStore('alerts', { keyPath: 'id' });
          store.createIndex('severity', 'severity', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Queue alert for synchronization
   */
  async queueForSync(alert) {
    try {
      const queue = await this.getStoredQueue();
      queue.push({
        alert,
        queuedAt: new Date().toISOString()
      });
      await this.storeQueue(queue);
      
      // Register for background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        await self.registration.sync.register('alert-sync');
      }
    } catch (error) {
      console.error('Error queuing alert for sync:', error);
    }
  }

  /**
   * Sync queued alerts when online
   */
  async syncQueuedAlerts() {
    if (!this.isOnline) return;

    try {
      const queue = await this.getStoredQueue();
      if (queue.length === 0) return;

      console.log(`Syncing ${queue.length} queued alerts`);

      for (const queueItem of queue) {
        try {
          await this.syncAlert(queueItem.alert);
        } catch (error) {
          console.error('Error syncing alert:', queueItem.alert.id, error);
        }
      }

      // Clear queue after successful sync
      await this.storeQueue([]);
      
      this.notifyMainThread('sync-completed', {
        syncedCount: queue.length
      });

    } catch (error) {
      console.error('Error during alert sync:', error);
    }
  }

  /**
   * Sync individual alert to server
   */
  async syncAlert(alert) {
    const response = await fetch('/api/alerts/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(alert)
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get stored sync queue
   */
  async getStoredQueue() {
    try {
      const stored = await this.getFromCache(ALERT_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting stored queue:', error);
      return [];
    }
  }

  /**
   * Store sync queue
   */
  async storeQueue(queue) {
    try {
      await this.putInCache(ALERT_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error storing queue:', error);
    }
  }

  /**
   * Handle notification click
   */
  async handleNotificationClick(event) {
    const alertData = event.notification.data;
    
    // Open or focus the app
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    let clientToFocus = null;

    for (const client of windowClients) {
      if (client.url.includes('/alerts/') || client.url === '/') {
        clientToFocus = client;
        break;
      }
    }

    if (clientToFocus) {
      await clientToFocus.focus();
      clientToFocus.postMessage({
        type: 'notification-clicked',
        alertId: alertData.alertId
      });
    } else {
      await clients.openWindow(`/alerts/${alertData.alertId}`);
    }
  }

  /**
   * Handle messages from main thread
   */
  handleMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'process-alert':
        this.handleIncomingAlert(data);
        break;
      case 'get-stats':
        event.ports[0].postMessage({
          type: 'stats-response',
          data: this.processor.getStats()
        });
        break;
      case 'clear-queue':
        this.processor.clearQueue();
        this.storeQueue([]);
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  }

  /**
   * Notify main thread of events
   */
  notifyMainThread(type, data) {
    clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type, data });
      });
    });
  }

  /**
   * Cache utilities
   */
  async getFromCache(key) {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(key);
    return response ? await response.text() : null;
  }

  async putInCache(key, value) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, new Response(value));
  }
}

/**
 * Service Worker Notification Service
 */
class ServiceWorkerNotificationService {
  async show(notification) {
    // Check notification permission
    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    // Show notification
    await self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      tag: notification.tag,
      data: notification.data,
      requireInteraction: notification.requireInteraction,
      silent: notification.silent,
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icons/view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ]
    });
  }
}

// Initialize the service worker alert processor
const swAlertProcessor = new ServiceWorkerAlertProcessor();

console.log('Alert processing service worker initialized');