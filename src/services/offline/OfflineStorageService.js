/**
 * Offline Storage Service
 * Manages local data storage using IndexedDB for offline functionality
 */

class OfflineStorageService {
  constructor() {
    this.dbName = 'RealTimeAlertPlatform';
    this.dbVersion = 1;
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the IndexedDB database
   */
  async initialize() {
    if (this.isInitialized) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isInitialized = true;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.createObjectStores(db);
      };
    });
  }

  /**
   * Create object stores for offline data
   */
  createObjectStores(db) {
    // Alerts store
    if (!db.objectStoreNames.contains('alerts')) {
      const alertsStore = db.createObjectStore('alerts', { keyPath: 'alertId' });
      alertsStore.createIndex('eventType', 'eventType', { unique: false });
      alertsStore.createIndex('severity', 'severity', { unique: false });
      alertsStore.createIndex('createdAt', 'createdAt', { unique: false });
      alertsStore.createIndex('status', 'status', { unique: false });
      alertsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
    }

    // User preferences store
    if (!db.objectStoreNames.contains('userPreferences')) {
      db.createObjectStore('userPreferences', { keyPath: 'userId' });
    }

    // Sync queue store
    if (!db.objectStoreNames.contains('syncQueue')) {
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      syncStore.createIndex('operation', 'operation', { unique: false });
      syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      syncStore.createIndex('priority', 'priority', { unique: false });
    }

    // Conflict resolution store
    if (!db.objectStoreNames.contains('conflicts')) {
      const conflictsStore = db.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true });
      conflictsStore.createIndex('entityId', 'entityId', { unique: false });
      conflictsStore.createIndex('entityType', 'entityType', { unique: false });
      conflictsStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Metadata store for tracking sync state
    if (!db.objectStoreNames.contains('metadata')) {
      db.createObjectStore('metadata', { keyPath: 'key' });
    }
  }

  /**
   * Store an alert locally
   */
  async storeAlert(alert) {
    await this.ensureInitialized();
    
    const alertWithMetadata = {
      ...alert,
      syncStatus: 'pending',
      lastModified: Date.now(),
      version: alert.version || 1
    };

    return this.performTransaction('alerts', 'readwrite', (store) => {
      return store.put(alertWithMetadata);
    });
  }

  /**
   * Retrieve alerts from local storage
   */
  async getAlerts(filters = {}) {
    await this.ensureInitialized();

    return this.performTransaction('alerts', 'readonly', (store) => {
      if (Object.keys(filters).length === 0) {
        return store.getAll();
      }

      // Apply filters
      const results = [];
      return new Promise((resolve, reject) => {
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const alert = cursor.value;
            let matches = true;

            // Apply filters
            if (filters.eventType && alert.eventType !== filters.eventType) {
              matches = false;
            }
            if (filters.minSeverity && alert.severity < filters.minSeverity) {
              matches = false;
            }
            if (filters.status && alert.status !== filters.status) {
              matches = false;
            }

            if (matches) {
              results.push(alert);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Get a specific alert by ID
   */
  async getAlert(alertId) {
    await this.ensureInitialized();

    return this.performTransaction('alerts', 'readonly', (store) => {
      return store.get(alertId);
    });
  }

  /**
   * Update an alert in local storage
   */
  async updateAlert(alertId, updates) {
    await this.ensureInitialized();

    return this.performTransaction('alerts', 'readwrite', async (store) => {
      const existing = await store.get(alertId);
      if (!existing) {
        throw new Error(`Alert ${alertId} not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        lastModified: Date.now(),
        version: (existing.version || 1) + 1,
        syncStatus: 'pending'
      };

      return store.put(updated);
    });
  }

  /**
   * Delete an alert from local storage
   */
  async deleteAlert(alertId) {
    await this.ensureInitialized();

    return this.performTransaction('alerts', 'readwrite', (store) => {
      return store.delete(alertId);
    });
  }

  /**
   * Store user preferences locally
   */
  async storeUserPreferences(userId, preferences) {
    await this.ensureInitialized();

    const preferencesWithMetadata = {
      userId,
      ...preferences,
      lastModified: Date.now(),
      syncStatus: 'pending'
    };

    return this.performTransaction('userPreferences', 'readwrite', (store) => {
      return store.put(preferencesWithMetadata);
    });
  }

  /**
   * Get user preferences from local storage
   */
  async getUserPreferences(userId) {
    await this.ensureInitialized();

    return this.performTransaction('userPreferences', 'readonly', (store) => {
      return store.get(userId);
    });
  }

  /**
   * Add operation to sync queue
   */
  async addToSyncQueue(operation, entityType, entityId, data, priority = 1) {
    await this.ensureInitialized();

    const syncItem = {
      operation, // 'create', 'update', 'delete'
      entityType, // 'alert', 'userPreferences'
      entityId,
      data,
      priority,
      timestamp: Date.now(),
      retryCount: 0
    };

    return this.performTransaction('syncQueue', 'readwrite', (store) => {
      return store.add(syncItem);
    });
  }

  /**
   * Get pending sync operations
   */
  async getPendingSyncOperations() {
    await this.ensureInitialized();

    return this.performTransaction('syncQueue', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const results = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            // Sort by priority (higher first) then by timestamp
            results.sort((a, b) => {
              if (a.priority !== b.priority) {
                return b.priority - a.priority;
              }
              return a.timestamp - b.timestamp;
            });
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Remove operation from sync queue
   */
  async removeSyncOperation(operationId) {
    await this.ensureInitialized();

    return this.performTransaction('syncQueue', 'readwrite', (store) => {
      return store.delete(operationId);
    });
  }

  /**
   * Store conflict for resolution
   */
  async storeConflict(entityType, entityId, localData, remoteData, conflictType) {
    await this.ensureInitialized();

    const conflict = {
      entityType,
      entityId,
      localData,
      remoteData,
      conflictType, // 'version', 'concurrent_modification'
      timestamp: Date.now(),
      resolved: false
    };

    return this.performTransaction('conflicts', 'readwrite', (store) => {
      return store.add(conflict);
    });
  }

  /**
   * Get unresolved conflicts
   */
  async getUnresolvedConflicts() {
    await this.ensureInitialized();

    return this.performTransaction('conflicts', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const results = [];
        const index = store.index('timestamp');
        const request = index.openCursor();

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const conflict = cursor.value;
            if (!conflict.resolved) {
              results.push(conflict);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Mark conflict as resolved
   */
  async resolveConflict(conflictId, resolution) {
    await this.ensureInitialized();

    return this.performTransaction('conflicts', 'readwrite', async (store) => {
      const conflict = await store.get(conflictId);
      if (!conflict) {
        throw new Error(`Conflict ${conflictId} not found`);
      }

      const resolved = {
        ...conflict,
        resolved: true,
        resolution,
        resolvedAt: Date.now()
      };

      return store.put(resolved);
    });
  }

  /**
   * Store metadata
   */
  async setMetadata(key, value) {
    await this.ensureInitialized();

    return this.performTransaction('metadata', 'readwrite', (store) => {
      return store.put({ key, value, timestamp: Date.now() });
    });
  }

  /**
   * Get metadata
   */
  async getMetadata(key) {
    await this.ensureInitialized();

    const result = await this.performTransaction('metadata', 'readonly', (store) => {
      return store.get(key);
    });

    return result ? result.value : null;
  }

  /**
   * Clear all offline data
   */
  async clearAllData() {
    await this.ensureInitialized();

    const stores = ['alerts', 'userPreferences', 'syncQueue', 'conflicts', 'metadata'];
    
    for (const storeName of stores) {
      await this.performTransaction(storeName, 'readwrite', (store) => {
        return store.clear();
      });
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats() {
    await this.ensureInitialized();

    const stats = {};
    const stores = ['alerts', 'userPreferences', 'syncQueue', 'conflicts', 'metadata'];

    for (const storeName of stores) {
      const count = await this.performTransaction(storeName, 'readonly', (store) => {
        return store.count();
      });
      stats[storeName] = count;
    }

    return stats;
  }

  /**
   * Helper method to ensure database is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Helper method to perform database transactions
   */
  async performTransaction(storeName, mode, operation) {
    const transaction = this.db.transaction([storeName], mode);
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const result = operation(store);

      if (result && typeof result.then === 'function') {
        // Handle async operations
        result.then(resolve).catch(reject);
      } else if (result && result.onsuccess !== undefined) {
        // Handle IDB requests
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      } else {
        // Handle synchronous operations
        resolve(result);
      }

      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export default OfflineStorageService;