/**
 * useOffline Hook
 * React hook for managing offline functionality and state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import OfflineManager from '../services/offline/OfflineManager';

let offlineManagerInstance = null;

const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, completed, error
  const [offlineStats, setOfflineStats] = useState(null);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [cacheStatus, setCacheStatus] = useState({});
  const [serviceWorkerUpdate, setServiceWorkerUpdate] = useState(false);
  
  const offlineManagerRef = useRef(null);

  // Initialize offline manager
  useEffect(() => {
    const initializeOfflineManager = async () => {
      if (!offlineManagerInstance) {
        offlineManagerInstance = new OfflineManager();
        await offlineManagerInstance.initialize();
      }
      
      offlineManagerRef.current = offlineManagerInstance;

      // Set up event listeners
      const handleConnectivityChange = ({ isOnline: online }) => {
        setIsOnline(online);
      };

      const handleSyncStarted = () => {
        setSyncStatus('syncing');
      };

      const handleSyncCompleted = ({ syncedOperations }) => {
        setSyncStatus('completed');
        setPendingOperations(prev => Math.max(0, prev - syncedOperations));
        
        // Reset status after a delay
        setTimeout(() => setSyncStatus('idle'), 2000);
      };

      const handleSyncError = ({ error }) => {
        setSyncStatus('error');
        console.error('Sync error:', error);
        
        // Reset status after a delay
        setTimeout(() => setSyncStatus('idle'), 5000);
      };

      const handleOperationSynced = () => {
        setPendingOperations(prev => Math.max(0, prev - 1));
      };

      const handleServiceWorkerUpdate = () => {
        setServiceWorkerUpdate(true);
      };

      // Register event listeners
      offlineManagerInstance.on('connectivity-changed', handleConnectivityChange);
      offlineManagerInstance.on('sync-started', handleSyncStarted);
      offlineManagerInstance.on('sync-completed', handleSyncCompleted);
      offlineManagerInstance.on('sync-error', handleSyncError);
      offlineManagerInstance.on('operation-synced', handleOperationSynced);
      offlineManagerInstance.on('sw-update-available', handleServiceWorkerUpdate);

      // Initial stats load
      loadOfflineStats();

      // Cleanup function
      return () => {
        offlineManagerInstance.off('connectivity-changed', handleConnectivityChange);
        offlineManagerInstance.off('sync-started', handleSyncStarted);
        offlineManagerInstance.off('sync-completed', handleSyncCompleted);
        offlineManagerInstance.off('sync-error', handleSyncError);
        offlineManagerInstance.off('operation-synced', handleOperationSynced);
        offlineManagerInstance.off('sw-update-available', handleServiceWorkerUpdate);
      };
    };

    initializeOfflineManager();
  }, []);

  // Load offline statistics
  const loadOfflineStats = useCallback(async () => {
    if (offlineManagerRef.current) {
      try {
        const stats = await offlineManagerRef.current.getOfflineStats();
        setOfflineStats(stats);
        setPendingOperations(stats.pendingOperations);
        setCacheStatus(stats.cache);
      } catch (error) {
        console.error('Failed to load offline stats:', error);
      }
    }
  }, []);

  // Store alert with offline support
  const storeAlert = useCallback(async (alert) => {
    if (!offlineManagerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    await offlineManagerRef.current.storeAlert(alert);
    setPendingOperations(prev => prev + 1);
  }, []);

  // Update alert with offline support
  const updateAlert = useCallback(async (alertId, updates) => {
    if (!offlineManagerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    await offlineManagerRef.current.updateAlert(alertId, updates);
    setPendingOperations(prev => prev + 1);
  }, []);

  // Get alerts with offline support
  const getAlerts = useCallback(async (filters = {}) => {
    if (!offlineManagerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    return await offlineManagerRef.current.getAlerts(filters);
  }, []);

  // Store user preferences with offline support
  const storeUserPreferences = useCallback(async (userId, preferences) => {
    if (!offlineManagerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    await offlineManagerRef.current.storeUserPreferences(userId, preferences);
    setPendingOperations(prev => prev + 1);
  }, []);

  // Get user preferences with offline support
  const getUserPreferences = useCallback(async (userId) => {
    if (!offlineManagerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    return await offlineManagerRef.current.getUserPreferences(userId);
  }, []);

  // Force synchronization
  const forceSync = useCallback(async () => {
    if (!offlineManagerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    if (!isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await offlineManagerRef.current.forceSync();
  }, [isOnline]);

  // Cache resources for offline use
  const cacheResources = useCallback(async (urls) => {
    if (!offlineManagerRef.current) {
      return;
    }

    await offlineManagerRef.current.cacheResources(urls);
    await loadOfflineStats(); // Refresh stats
  }, [loadOfflineStats]);

  // Clear cache
  const clearCache = useCallback(async (cacheName = null) => {
    if (!offlineManagerRef.current) {
      return;
    }

    await offlineManagerRef.current.clearCache(cacheName);
    await loadOfflineStats(); // Refresh stats
  }, [loadOfflineStats]);

  // Update service worker
  const updateServiceWorker = useCallback(async () => {
    if (!offlineManagerRef.current) {
      return;
    }

    await offlineManagerRef.current.updateServiceWorker();
    setServiceWorkerUpdate(false);
  }, []);

  // Check if feature is available offline
  const isFeatureAvailableOffline = useCallback((feature) => {
    if (!offlineManagerRef.current) {
      return false;
    }

    return offlineManagerRef.current.isFeatureAvailableOffline(feature);
  }, []);

  // Get connection quality indicator
  const getConnectionQuality = useCallback(() => {
    if (!isOnline) {
      return 'offline';
    }

    // Use Network Information API if available
    if ('connection' in navigator) {
      const connection = navigator.connection;
      const effectiveType = connection.effectiveType;
      
      switch (effectiveType) {
        case 'slow-2g':
        case '2g':
          return 'poor';
        case '3g':
          return 'good';
        case '4g':
          return 'excellent';
        default:
          return 'good';
      }
    }

    return 'unknown';
  }, [isOnline]);

  // Refresh offline stats
  const refreshStats = useCallback(async () => {
    await loadOfflineStats();
  }, [loadOfflineStats]);

  return {
    // State
    isOnline,
    syncStatus,
    offlineStats,
    pendingOperations,
    cacheStatus,
    serviceWorkerUpdate,
    
    // Actions
    storeAlert,
    updateAlert,
    getAlerts,
    storeUserPreferences,
    getUserPreferences,
    forceSync,
    cacheResources,
    clearCache,
    updateServiceWorker,
    refreshStats,
    
    // Utilities
    isFeatureAvailableOffline,
    getConnectionQuality,
    
    // Computed values
    isSyncing: syncStatus === 'syncing',
    hasPendingOperations: pendingOperations > 0,
    isOfflineCapable: !!offlineManagerRef.current
  };
};

export default useOffline;