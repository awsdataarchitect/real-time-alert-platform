/**
 * Synchronization Service
 * Handles data synchronization between local storage and remote server
 */

import OfflineStorageService from './OfflineStorageService.js';

class SynchronizationService {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.offlineStorage = new OfflineStorageService();
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.syncInterval = null;
    this.conflictResolver = new ConflictResolver();

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  /**
   * Initialize synchronization service
   */
  async initialize() {
    await this.offlineStorage.initialize();
    
    // Start periodic sync if online
    if (this.isOnline) {
      this.startPeriodicSync();
    }

    // Process any pending sync operations
    await this.processPendingSync();
  }

  /**
   * Handle online event
   */
  async handleOnline() {
    this.isOnline = true;
    console.log('Connection restored - starting synchronization');
    
    this.startPeriodicSync();
    await this.processPendingSync();
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    this.isOnline = false;
    console.log('Connection lost - switching to offline mode');
    
    this.stopPeriodicSync();
  }

  /**
   * Start periodic synchronization
   */
  startPeriodicSync(intervalMs = 30000) { // 30 seconds
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.syncInProgress) {
        await this.processPendingSync();
      }
    }, intervalMs);
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Process pending synchronization operations
   */
  async processPendingSync() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Get pending operations
      const operations = await this.offlineStorage.getPendingSyncOperations();
      
      for (const operation of operations) {
        try {
          await this.processSyncOperation(operation);
          await this.offlineStorage.removeSyncOperation(operation.id);
        } catch (error) {
          console.error('Sync operation failed:', error);
          await this.handleSyncError(operation, error);
        }
      }

      // Update last sync timestamp
      await this.offlineStorage.setMetadata('lastSyncTimestamp', Date.now());
      
    } catch (error) {
      console.error('Sync process failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process individual sync operation
   */
  async processSyncOperation(operation) {
    const { operation: op, entityType, entityId, data } = operation;

    switch (entityType) {
      case 'alert':
        await this.syncAlert(op, entityId, data);
        break;
      case 'userPreferences':
        await this.syncUserPreferences(op, entityId, data);
        break;
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Sync alert data
   */
  async syncAlert(operation, alertId, data) {
    switch (operation) {
      case 'create':
        await this.createRemoteAlert(data);
        break;
      case 'update':
        await this.updateRemoteAlert(alertId, data);
        break;
      case 'delete':
        await this.deleteRemoteAlert(alertId);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Sync user preferences
   */
  async syncUserPreferences(operation, userId, data) {
    switch (operation) {
      case 'create':
      case 'update':
        await this.updateRemoteUserPreferences(userId, data);
        break;
      case 'delete':
        await this.deleteRemoteUserPreferences(userId);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Create alert on remote server
   */
  async createRemoteAlert(alertData) {
    try {
      const response = await this.apiClient.createAlert(alertData);
      
      // Update local data with server response
      await this.offlineStorage.updateAlert(alertData.alertId, {
        ...response,
        syncStatus: 'synced'
      });
      
      return response;
    } catch (error) {
      if (this.isConflictError(error)) {
        await this.handleConflict('alert', alertData.alertId, alertData, error.remoteData, 'create_conflict');
      }
      throw error;
    }
  }

  /**
   * Update alert on remote server
   */
  async updateRemoteAlert(alertId, alertData) {
    try {
      const response = await this.apiClient.updateAlert(alertId, alertData);
      
      // Update local data with server response
      await this.offlineStorage.updateAlert(alertId, {
        ...response,
        syncStatus: 'synced'
      });
      
      return response;
    } catch (error) {
      if (this.isConflictError(error)) {
        await this.handleConflict('alert', alertId, alertData, error.remoteData, 'update_conflict');
      }
      throw error;
    }
  }

  /**
   * Delete alert on remote server
   */
  async deleteRemoteAlert(alertId) {
    try {
      await this.apiClient.deleteAlert(alertId);
      await this.offlineStorage.deleteAlert(alertId);
    } catch (error) {
      if (error.status === 404) {
        // Alert already deleted on server
        await this.offlineStorage.deleteAlert(alertId);
      } else {
        throw error;
      }
    }
  }

  /**
   * Update user preferences on remote server
   */
  async updateRemoteUserPreferences(userId, preferences) {
    try {
      const response = await this.apiClient.updateUserPreferences(userId, preferences);
      
      // Update local data with server response
      await this.offlineStorage.storeUserPreferences(userId, {
        ...response,
        syncStatus: 'synced'
      });
      
      return response;
    } catch (error) {
      if (this.isConflictError(error)) {
        await this.handleConflict('userPreferences', userId, preferences, error.remoteData, 'update_conflict');
      }
      throw error;
    }
  }

  /**
   * Delete user preferences on remote server
   */
  async deleteRemoteUserPreferences(userId) {
    try {
      await this.apiClient.deleteUserPreferences(userId);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }
  }

  /**
   * Download remote data to local storage
   */
  async downloadRemoteData(lastSyncTimestamp = null) {
    if (!this.isOnline) {
      throw new Error('Cannot download data while offline');
    }

    try {
      // Download alerts
      const alerts = await this.apiClient.getAlerts({
        modifiedSince: lastSyncTimestamp
      });

      for (const alert of alerts) {
        const localAlert = await this.offlineStorage.getAlert(alert.alertId);
        
        if (localAlert && localAlert.lastModified > alert.lastModified) {
          // Local version is newer - potential conflict
          await this.handleConflict('alert', alert.alertId, localAlert, alert, 'version_conflict');
        } else {
          // Store remote version
          await this.offlineStorage.storeAlert({
            ...alert,
            syncStatus: 'synced'
          });
        }
      }

      // Download user preferences if applicable
      const currentUser = await this.getCurrentUser();
      if (currentUser) {
        const remotePreferences = await this.apiClient.getUserPreferences(currentUser.userId);
        const localPreferences = await this.offlineStorage.getUserPreferences(currentUser.userId);

        if (localPreferences && localPreferences.lastModified > remotePreferences.lastModified) {
          // Local version is newer - potential conflict
          await this.handleConflict('userPreferences', currentUser.userId, localPreferences, remotePreferences, 'version_conflict');
        } else {
          // Store remote version
          await this.offlineStorage.storeUserPreferences(currentUser.userId, {
            ...remotePreferences,
            syncStatus: 'synced'
          });
        }
      }

    } catch (error) {
      console.error('Failed to download remote data:', error);
      throw error;
    }
  }

  /**
   * Handle synchronization errors
   */
  async handleSyncError(operation, error) {
    operation.retryCount = (operation.retryCount || 0) + 1;
    
    if (operation.retryCount >= 3) {
      console.error('Max retries reached for sync operation:', operation);
      // Store as failed operation for manual review
      await this.offlineStorage.setMetadata(`failed_sync_${operation.id}`, {
        operation,
        error: error.message,
        timestamp: Date.now()
      });
    } else {
      // Re-queue with exponential backoff
      const delay = Math.pow(2, operation.retryCount) * 1000; // 2s, 4s, 8s
      setTimeout(async () => {
        await this.offlineStorage.addToSyncQueue(
          operation.operation,
          operation.entityType,
          operation.entityId,
          operation.data,
          operation.priority
        );
      }, delay);
    }
  }

  /**
   * Handle data conflicts
   */
  async handleConflict(entityType, entityId, localData, remoteData, conflictType) {
    await this.offlineStorage.storeConflict(entityType, entityId, localData, remoteData, conflictType);
    
    // Attempt automatic resolution
    const resolution = await this.conflictResolver.resolve(conflictType, localData, remoteData);
    
    if (resolution.canAutoResolve) {
      await this.applyConflictResolution(entityType, entityId, resolution.resolvedData);
    }
  }

  /**
   * Apply conflict resolution
   */
  async applyConflictResolution(entityType, entityId, resolvedData) {
    switch (entityType) {
      case 'alert':
        await this.offlineStorage.storeAlert({
          ...resolvedData,
          syncStatus: 'synced'
        });
        break;
      case 'userPreferences':
        await this.offlineStorage.storeUserPreferences(entityId, {
          ...resolvedData,
          syncStatus: 'synced'
        });
        break;
    }
  }

  /**
   * Check if error is a conflict error
   */
  isConflictError(error) {
    return error.status === 409 || error.code === 'CONFLICT';
  }

  /**
   * Get current user (placeholder - implement based on auth system)
   */
  async getCurrentUser() {
    // This should be implemented based on your authentication system
    return null;
  }

  /**
   * Force full synchronization
   */
  async forceFullSync() {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await this.downloadRemoteData();
    await this.processPendingSync();
  }

  /**
   * Get synchronization status
   */
  async getSyncStatus() {
    const pendingOperations = await this.offlineStorage.getPendingSyncOperations();
    const conflicts = await this.offlineStorage.getUnresolvedConflicts();
    const lastSyncTimestamp = await this.offlineStorage.getMetadata('lastSyncTimestamp');

    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pendingOperations: pendingOperations.length,
      unresolvedConflicts: conflicts.length,
      lastSyncTimestamp
    };
  }
}

/**
 * Conflict Resolution Helper Class
 */
class ConflictResolver {
  /**
   * Resolve conflicts based on conflict type and data
   */
  async resolve(conflictType, localData, remoteData) {
    switch (conflictType) {
      case 'version_conflict':
        return this.resolveVersionConflict(localData, remoteData);
      case 'create_conflict':
        return this.resolveCreateConflict(localData, remoteData);
      case 'update_conflict':
        return this.resolveUpdateConflict(localData, remoteData);
      default:
        return { canAutoResolve: false, reason: 'Unknown conflict type' };
    }
  }

  /**
   * Resolve version conflicts (last-write-wins with merge)
   */
  resolveVersionConflict(localData, remoteData) {
    // Use timestamp to determine winner
    if (localData.lastModified > remoteData.lastModified) {
      return {
        canAutoResolve: true,
        resolvedData: localData,
        resolution: 'local_wins'
      };
    } else if (remoteData.lastModified > localData.lastModified) {
      return {
        canAutoResolve: true,
        resolvedData: remoteData,
        resolution: 'remote_wins'
      };
    } else {
      // Same timestamp - merge non-conflicting fields
      const merged = this.mergeData(localData, remoteData);
      return {
        canAutoResolve: true,
        resolvedData: merged,
        resolution: 'merged'
      };
    }
  }

  /**
   * Resolve create conflicts
   */
  resolveCreateConflict(localData, remoteData) {
    // For create conflicts, prefer remote data (server is authoritative)
    return {
      canAutoResolve: true,
      resolvedData: remoteData,
      resolution: 'remote_wins'
    };
  }

  /**
   * Resolve update conflicts
   */
  resolveUpdateConflict(localData, remoteData) {
    // For update conflicts, use version-based resolution
    return this.resolveVersionConflict(localData, remoteData);
  }

  /**
   * Merge data from local and remote sources
   */
  mergeData(localData, remoteData) {
    // Simple merge strategy - can be enhanced based on specific needs
    return {
      ...remoteData,
      ...localData,
      lastModified: Math.max(localData.lastModified || 0, remoteData.lastModified || 0)
    };
  }
}

export default SynchronizationService;