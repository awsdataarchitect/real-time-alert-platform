/**
 * Offline Services Index
 * Main entry point for offline functionality
 */

import OfflineStorageService from './OfflineStorageService.js';
import SynchronizationService from './SynchronizationService.js';
import ConflictResolutionService from './ConflictResolutionService.js';

/**
 * Offline Manager - Coordinates all offline functionality
 */
class OfflineManager {
  constructor(apiClient) {
    this.offlineStorage = new OfflineStorageService();
    this.syncService = new SynchronizationService(apiClient);
    this.conflictResolver = new ConflictResolutionService(this.offlineStorage);
    this.isInitialized = false;
  }

  /**
   * Initialize all offline services
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.offlineStorage.initialize();
      await this.syncService.initialize();
      this.isInitialized = true;
      console.log('Offline services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline services:', error);
      throw error;
    }
  }

  /**
   * Store alert for offline access
   */
  async storeAlert(alert) {
    await this.ensureInitialized();
    
    try {
      await this.offlineStorage.storeAlert(alert);
      
      // Add to sync queue if we have connectivity issues
      if (!navigator.onLine) {
        await this.offlineStorage.addToSyncQueue('create', 'alert', alert.alertId, alert);
      }
      
      return alert;
    } catch (error) {
      console.error('Failed to store alert offline:', error);
      throw error;
    }
  }

  /**
   * Get alerts from offline storage
   */
  async getAlerts(filters = {}) {
    await this.ensureInitialized();
    return this.offlineStorage.getAlerts(filters);
  }

  /**
   * Update alert in offline storage
   */
  async updateAlert(alertId, updates) {
    await this.ensureInitialized();
    
    try {
      await this.offlineStorage.updateAlert(alertId, updates);
      
      // Add to sync queue
      await this.offlineStorage.addToSyncQueue('update', 'alert', alertId, updates);
      
      return updates;
    } catch (error) {
      console.error('Failed to update alert offline:', error);
      throw error;
    }
  }

  /**
   * Store user preferences offline
   */
  async storeUserPreferences(userId, preferences) {
    await this.ensureInitialized();
    
    try {
      await this.offlineStorage.storeUserPreferences(userId, preferences);
      
      // Add to sync queue
      await this.offlineStorage.addToSyncQueue('update', 'userPreferences', userId, preferences);
      
      return preferences;
    } catch (error) {
      console.error('Failed to store user preferences offline:', error);
      throw error;
    }
  }

  /**
   * Get user preferences from offline storage
   */
  async getUserPreferences(userId) {
    await this.ensureInitialized();
    return this.offlineStorage.getUserPreferences(userId);
  }

  /**
   * Force synchronization with remote server
   */
  async forceSync() {
    await this.ensureInitialized();
    
    if (!navigator.onLine) {
      throw new Error('Cannot sync while offline');
    }
    
    return this.syncService.forceFullSync();
  }

  /**
   * Get synchronization status
   */
  async getSyncStatus() {
    await this.ensureInitialized();
    return this.syncService.getSyncStatus();
  }

  /**
   * Get unresolved conflicts
   */
  async getConflicts() {
    await this.ensureInitialized();
    return this.offlineStorage.getUnresolvedConflicts();
  }

  /**
   * Resolve conflict with user choice
   */
  async resolveConflict(conflictId, choice, customData = null) {
    await this.ensureInitialized();
    return this.conflictResolver.resolveWithUserChoice(conflictId, choice, customData);
  }

  /**
   * Auto-resolve all conflicts
   */
  async autoResolveConflicts(strategy = 'last_write_wins') {
    await this.ensureInitialized();
    return this.conflictResolver.autoResolveConflicts(strategy);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    await this.ensureInitialized();
    return this.offlineStorage.getStorageStats();
  }

  /**
   * Clear all offline data
   */
  async clearOfflineData() {
    await this.ensureInitialized();
    return this.offlineStorage.clearAllData();
  }

  /**
   * Check if offline mode is available
   */
  isOfflineModeAvailable() {
    return 'indexedDB' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get offline capabilities status
   */
  async getOfflineStatus() {
    await this.ensureInitialized();
    
    const stats = await this.getStorageStats();
    const syncStatus = await this.getSyncStatus();
    const conflicts = await this.getConflicts();
    
    return {
      isAvailable: this.isOfflineModeAvailable(),
      isOnline: navigator.onLine,
      isInitialized: this.isInitialized,
      storageStats: stats,
      syncStatus,
      unresolvedConflicts: conflicts.length,
      lastSync: syncStatus.lastSyncTimestamp
    };
  }

  /**
   * Ensure services are initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

export {
  OfflineStorageService,
  SynchronizationService,
  ConflictResolutionService,
  OfflineManager
};

export default OfflineManager;