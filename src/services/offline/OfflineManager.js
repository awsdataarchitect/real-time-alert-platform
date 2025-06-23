/**
 * Offline Manager
 * Coordinates offline functionality, service worker communication, and sync operations
 */

import OfflineStorageService from './OfflineStorageService';
import SynchronizationService from './SynchronizationService';

class OfflineManager {
  constructor() {
    this.storageService = new OfflineStorageService();
    this.syncService = new SynchronizationService();
    this.isOnline = navigator.onLine;
    this.serviceWorkerRegistration = null;
    this.listeners = new Map();
    this.syncInProgress = false;
    
    this.initialize();
  }

  /**
   * Initialize the offline manager
   */
  async initialize() {
    try {
      // Initialize storage service
      await this.storageService.initialize();
      
      // Register service worker
      await this.registerServiceWorker();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initial sync if online
      if (this.isOnline) {
        await this.performSync();
      }
      
      console.log('Offline Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Offline Manager:', error);
    }
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
        
        // Handle service worker updates
        this.serviceWorkerRegistration.addEventListener('updatefound', () => {
          const newWorker = this.serviceWorkerRegistration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available
              this.emit('sw-update-available');
            }
          });
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });

        console.log('Service Worker registered successfully');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Online/offline events
    window.addEventListener('online', () => {
      this.handleOnlineStatusChange(true);
    });

    window.addEventListener('offline', () => {
      this.handleOnlineStatusChange(false);
    });

    // Page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.performSync();
      }
    });

    // Before unload - save any pending data
    window.addEventListener('beforeunload', () => {
      this.handleBeforeUnload();
    });
  }

  /**
   * Handle online/offline status changes
   */
  async handleOnlineStatusChange(isOnline) {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    this.emit('connectivity-changed', { isOnline, wasOnline });

    if (isOnline && !wasOnline) {
      // Just came online
      console.log('Connection restored, performing sync...');
      await this.performSync();
    } else if (!isOnline && wasOnline) {
      // Just went offline
      console.log('Connection lost, switching to offline mode');
    }
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(data) {
    const { type, data: payload } = data;

    switch (type) {
      case 'sync-completed':
        this.handleSyncCompleted(payload);
        break;
      case 'notification-clicked':
        this.handleNotificationClicked(payload);
        break;
      case 'connectivity-changed':
        this.handleOnlineStatusChange(payload.isOnline);
        break;
      default:
        console.log('Unknown service worker message:', type, payload);
    }
  }

  /**
   * Perform synchronization
   */
  async performSync() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    this.emit('sync-started');

    try {
      console.log('Starting synchronization...');
      
      // Get pending operations
      const pendingOps = await this.storageService.getPendingSyncOperations();
      
      if (pendingOps.length > 0) {
        console.log(`Syncing ${pendingOps.length} pending operations`);
        
        for (const operation of pendingOps) {
          try {
            await this.syncService.syncOperation(operation);
            await this.storageService.removeSyncOperation(operation.id);
            
            this.emit('operation-synced', { operation });
          } catch (error) {
            console.error('Failed to sync operation:', operation.id, error);
            
            // Handle retry logic
            if (operation.retryCount < 3) {
              operation.retryCount++;
              // Will be retried in next sync
            } else {
              // Mark as failed after max retries
              this.emit('sync-failed', { operation, error });
            }
          }
        }
      }

      // Sync server changes to local storage
      await this.syncFromServer();
      
      this.emit('sync-completed', { 
        syncedOperations: pendingOps.length 
      });
      
      console.log('Synchronization completed successfully');
    } catch (error) {
      console.error('Synchronization failed:', error);
      this.emit('sync-error', { error });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync data from server to local storage
   */
  async syncFromServer() {
    try {
      // Get last sync timestamp
      const lastSync = await this.storageService.getMetadata('lastSyncTimestamp');
      const timestamp = lastSync || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Fetch updates from server
      const response = await fetch(`/api/sync/updates?since=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Server sync failed: ${response.status}`);
      }

      const updates = await response.json();

      // Apply updates to local storage
      for (const update of updates.alerts || []) {
        await this.storageService.storeAlert(update);
      }

      for (const update of updates.preferences || []) {
        await this.storageService.storeUserPreferences(update.userId, update);
      }

      // Update last sync timestamp
      await this.storageService.setMetadata('lastSyncTimestamp', new Date().toISOString());

    } catch (error) {
      console.error('Failed to sync from server:', error);
      throw error;
    }
  }

  /**
   * Store data with offline support
   */
  async storeAlert(alert) {
    try {
      // Store locally
      await this.storageService.storeAlert(alert);

      // Queue for sync if offline or sync immediately if online
      if (this.isOnline) {
        try {
          await this.syncService.syncAlert(alert);
        } catch (error) {
          // If sync fails, queue for later
          await this.storageService.addToSyncQueue('create', 'alert', alert.alertId, alert);
        }
      } else {
        await this.storageService.addToSyncQueue('create', 'alert', alert.alertId, alert);
      }

      this.emit('alert-stored', { alert });
    } catch (error) {
      console.error('Failed to store alert:', error);
      throw error;
    }
  }

  /**
   * Update alert with offline support
   */
  async updateAlert(alertId, updates) {
    try {
      // Update locally
      await this.storageService.updateAlert(alertId, updates);

      // Queue for sync
      const updatedAlert = await this.storageService.getAlert(alertId);
      
      if (this.isOnline) {
        try {
          await this.syncService.syncAlert(updatedAlert);
        } catch (error) {
          await this.storageService.addToSyncQueue('update', 'alert', alertId, updatedAlert);
        }
      } else {
        await this.storageService.addToSyncQueue('update', 'alert', alertId, updatedAlert);
      }

      this.emit('alert-updated', { alertId, updates });
    } catch (error) {
      console.error('Failed to update alert:', error);
      throw error;
    }
  }

  /**
   * Get alerts with offline support
   */
  async getAlerts(filters = {}) {
    try {
      // Always get from local storage first
      const localAlerts = await this.storageService.getAlerts(filters);

      // If online, try to get fresh data
      if (this.isOnline) {
        try {
          const response = await fetch('/api/alerts?' + new URLSearchParams(filters));
          if (response.ok) {
            const serverAlerts = await response.json();
            
            // Update local storage with server data
            for (const alert of serverAlerts) {
              await this.storageService.storeAlert(alert);
            }
            
            return serverAlerts;
          }
        } catch (error) {
          console.log('Failed to fetch from server, using cached data');
        }
      }

      return localAlerts;
    } catch (error) {
      console.error('Failed to get alerts:', error);
      throw error;
    }
  }

  /**
   * Store user preferences with offline support
   */
  async storeUserPreferences(userId, preferences) {
    try {
      await this.storageService.storeUserPreferences(userId, preferences);

      if (this.isOnline) {
        try {
          await this.syncService.syncUserPreferences(userId, preferences);
        } catch (error) {
          await this.storageService.addToSyncQueue('update', 'userPreferences', userId, preferences);
        }
      } else {
        await this.storageService.addToSyncQueue('update', 'userPreferences', userId, preferences);
      }

      this.emit('preferences-stored', { userId, preferences });
    } catch (error) {
      console.error('Failed to store user preferences:', error);
      throw error;
    }
  }

  /**
   * Get user preferences with offline support
   */
  async getUserPreferences(userId) {
    try {
      const localPrefs = await this.storageService.getUserPreferences(userId);

      if (this.isOnline) {
        try {
          const response = await fetch(`/api/user/${userId}/preferences`);
          if (response.ok) {
            const serverPrefs = await response.json();
            await this.storageService.storeUserPreferences(userId, serverPrefs);
            return serverPrefs;
          }
        } catch (error) {
          console.log('Failed to fetch preferences from server, using cached data');
        }
      }

      return localPrefs;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      throw error;
    }
  }

  /**
   * Cache resources for offline use
   */
  async cacheResources(urls) {
    if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.active) {
      this.serviceWorkerRegistration.active.postMessage({
        type: 'cache-urls',
        data: { urls }
      });
    }
  }

  /**
   * Clear offline cache
   */
  async clearCache(cacheName = null) {
    if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.active) {
      this.serviceWorkerRegistration.active.postMessage({
        type: 'clear-cache',
        data: { cacheName }
      });
    }
  }

  /**
   * Get cache status
   */
  async getCacheStatus() {
    return new Promise((resolve) => {
      if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.active) {
        const messageChannel = new MessageChannel();
        
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data);
        };

        this.serviceWorkerRegistration.active.postMessage({
          type: 'get-cache-status'
        }, [messageChannel.port2]);
      } else {
        resolve({});
      }
    });
  }

  /**
   * Get offline statistics
   */
  async getOfflineStats() {
    const storageStats = await this.storageService.getStorageStats();
    const cacheStatus = await this.getCacheStatus();
    const pendingOps = await this.storageService.getPendingSyncOperations();

    return {
      storage: storageStats,
      cache: cacheStatus,
      pendingOperations: pendingOps.length,
      isOnline: this.isOnline,
      lastSync: await this.storageService.getMetadata('lastSyncTimestamp')
    };
  }

  /**
   * Force sync
   */
  async forceSync() {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await this.performSync();
  }

  /**
   * Event handling
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Utility methods
   */
  handleSyncCompleted(payload) {
    console.log('Sync completed:', payload);
    this.emit('sync-completed', payload);
  }

  handleNotificationClicked(payload) {
    this.emit('notification-clicked', payload);
  }

  handleBeforeUnload() {
    // Save any pending data before page unload
    // This is synchronous, so keep it minimal
  }

  getAuthToken() {
    // Get authentication token from storage or context
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Update service worker
   */
  async updateServiceWorker() {
    if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.waiting) {
      this.serviceWorkerRegistration.waiting.postMessage({ type: 'skip-waiting' });
      window.location.reload();
    }
  }

  /**
   * Check if feature is available offline
   */
  isFeatureAvailableOffline(feature) {
    const offlineFeatures = [
      'view-alerts',
      'view-preferences',
      'basic-map',
      'alert-history',
      'notifications'
    ];

    return offlineFeatures.includes(feature);
  }
}

export default OfflineManager;