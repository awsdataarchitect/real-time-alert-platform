/**
 * Unit tests for OfflineManager
 */

import OfflineManager from '../../../../src/services/offline/OfflineManager';
import OfflineStorageService from '../../../../src/services/offline/OfflineStorageService';
import SynchronizationService from '../../../../src/services/offline/SynchronizationService';

// Mock dependencies
jest.mock('../../../../src/services/offline/OfflineStorageService');
jest.mock('../../../../src/services/offline/SynchronizationService');

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
};

global.indexedDB = mockIndexedDB;

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  value: {
    register: jest.fn().mockResolvedValue({
      addEventListener: jest.fn(),
      waiting: null,
      active: {
        postMessage: jest.fn(),
      },
    }),
    addEventListener: jest.fn(),
  },
});

// Mock fetch
global.fetch = jest.fn();

describe('OfflineManager', () => {
  let offlineManager;
  let mockStorageService;
  let mockSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Create mock instances
    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      storeAlert: jest.fn().mockResolvedValue(),
      getAlert: jest.fn().mockResolvedValue(),
      getAlerts: jest.fn().mockResolvedValue([]),
      updateAlert: jest.fn().mockResolvedValue(),
      deleteAlert: jest.fn().mockResolvedValue(),
      storeUserPreferences: jest.fn().mockResolvedValue(),
      getUserPreferences: jest.fn().mockResolvedValue(),
      addToSyncQueue: jest.fn().mockResolvedValue(),
      getPendingSyncOperations: jest.fn().mockResolvedValue([]),
      removeSyncOperation: jest.fn().mockResolvedValue(),
      getStorageStats: jest.fn().mockResolvedValue({}),
      setMetadata: jest.fn().mockResolvedValue(),
      getMetadata: jest.fn().mockResolvedValue(),
    };

    mockSyncService = {
      syncAlert: jest.fn().mockResolvedValue(),
      syncUserPreferences: jest.fn().mockResolvedValue(),
      syncOperation: jest.fn().mockResolvedValue(),
    };

    OfflineStorageService.mockImplementation(() => mockStorageService);
    SynchronizationService.mockImplementation(() => mockSyncService);

    offlineManager = new OfflineManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize storage service', async () => {
      await offlineManager.initialize();
      expect(mockStorageService.initialize).toHaveBeenCalled();
    });

    it('should register service worker', async () => {
      await offlineManager.initialize();
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    });

    it('should perform initial sync when online', async () => {
      mockStorageService.getPendingSyncOperations.mockResolvedValue([]);
      await offlineManager.initialize();
      expect(mockStorageService.getPendingSyncOperations).toHaveBeenCalled();
    });
  });

  describe('alert management', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should store alert locally and sync when online', async () => {
      const alert = { alertId: 'test-1', title: 'Test Alert' };
      
      await offlineManager.storeAlert(alert);
      
      expect(mockStorageService.storeAlert).toHaveBeenCalledWith(alert);
      expect(mockSyncService.syncAlert).toHaveBeenCalledWith(alert);
    });

    it('should queue alert for sync when offline', async () => {
      const alert = { alertId: 'test-1', title: 'Test Alert' };
      
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      offlineManager.isOnline = false;
      
      await offlineManager.storeAlert(alert);
      
      expect(mockStorageService.storeAlert).toHaveBeenCalledWith(alert);
      expect(mockStorageService.addToSyncQueue).toHaveBeenCalledWith(
        'create', 'alert', alert.alertId, alert
      );
      expect(mockSyncService.syncAlert).not.toHaveBeenCalled();
    });

    it('should update alert locally and sync', async () => {
      const alertId = 'test-1';
      const updates = { title: 'Updated Alert' };
      const updatedAlert = { alertId, ...updates };
      
      mockStorageService.getAlert.mockResolvedValue(updatedAlert);
      
      await offlineManager.updateAlert(alertId, updates);
      
      expect(mockStorageService.updateAlert).toHaveBeenCalledWith(alertId, updates);
      expect(mockSyncService.syncAlert).toHaveBeenCalledWith(updatedAlert);
    });

    it('should get alerts from local storage first', async () => {
      const filters = { eventType: 'earthquake' };
      const localAlerts = [{ alertId: 'test-1' }];
      
      mockStorageService.getAlerts.mockResolvedValue(localAlerts);
      
      const result = await offlineManager.getAlerts(filters);
      
      expect(mockStorageService.getAlerts).toHaveBeenCalledWith(filters);
      expect(result).toEqual(localAlerts);
    });

    it('should fetch from server when online and update local storage', async () => {
      const filters = { eventType: 'earthquake' };
      const serverAlerts = [{ alertId: 'test-2' }];
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(serverAlerts),
      });
      
      const result = await offlineManager.getAlerts(filters);
      
      expect(fetch).toHaveBeenCalledWith('/api/alerts?' + new URLSearchParams(filters));
      expect(mockStorageService.storeAlert).toHaveBeenCalledWith(serverAlerts[0]);
      expect(result).toEqual(serverAlerts);
    });
  });

  describe('user preferences management', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should store user preferences locally and sync', async () => {
      const userId = 'user-1';
      const preferences = { theme: 'dark' };
      
      await offlineManager.storeUserPreferences(userId, preferences);
      
      expect(mockStorageService.storeUserPreferences).toHaveBeenCalledWith(userId, preferences);
      expect(mockSyncService.syncUserPreferences).toHaveBeenCalledWith(userId, preferences);
    });

    it('should queue preferences for sync when offline', async () => {
      const userId = 'user-1';
      const preferences = { theme: 'dark' };
      
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      offlineManager.isOnline = false;
      
      await offlineManager.storeUserPreferences(userId, preferences);
      
      expect(mockStorageService.addToSyncQueue).toHaveBeenCalledWith(
        'update', 'userPreferences', userId, preferences
      );
    });

    it('should get user preferences from local storage', async () => {
      const userId = 'user-1';
      const preferences = { theme: 'dark' };
      
      mockStorageService.getUserPreferences.mockResolvedValue(preferences);
      
      const result = await offlineManager.getUserPreferences(userId);
      
      expect(mockStorageService.getUserPreferences).toHaveBeenCalledWith(userId);
      expect(result).toEqual(preferences);
    });
  });

  describe('synchronization', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should sync pending operations when online', async () => {
      const pendingOps = [
        { id: 1, operation: 'create', entityType: 'alert', data: { alertId: 'test-1' } },
        { id: 2, operation: 'update', entityType: 'userPreferences', data: { userId: 'user-1' } },
      ];
      
      mockStorageService.getPendingSyncOperations.mockResolvedValue(pendingOps);
      
      await offlineManager.performSync();
      
      expect(mockSyncService.syncOperation).toHaveBeenCalledTimes(2);
      expect(mockStorageService.removeSyncOperation).toHaveBeenCalledTimes(2);
    });

    it('should not sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      offlineManager.isOnline = false;
      
      await offlineManager.performSync();
      
      expect(mockStorageService.getPendingSyncOperations).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      const pendingOps = [
        { id: 1, operation: 'create', entityType: 'alert', data: { alertId: 'test-1' }, retryCount: 0 },
      ];
      
      mockStorageService.getPendingSyncOperations.mockResolvedValue(pendingOps);
      mockSyncService.syncOperation.mockRejectedValue(new Error('Sync failed'));
      
      await offlineManager.performSync();
      
      expect(mockSyncService.syncOperation).toHaveBeenCalled();
      expect(mockStorageService.removeSyncOperation).not.toHaveBeenCalled();
    });

    it('should sync from server to local storage', async () => {
      const serverUpdates = {
        alerts: [{ alertId: 'server-1' }],
        preferences: [{ userId: 'user-1', theme: 'light' }],
      };
      
      mockStorageService.getMetadata.mockResolvedValue('2023-01-01T00:00:00Z');
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(serverUpdates),
      });
      
      await offlineManager.syncFromServer();
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sync/updates?since=2023-01-01T00:00:00Z'),
        expect.any(Object)
      );
      expect(mockStorageService.storeAlert).toHaveBeenCalledWith(serverUpdates.alerts[0]);
      expect(mockStorageService.storeUserPreferences).toHaveBeenCalledWith(
        'user-1', serverUpdates.preferences[0]
      );
    });
  });

  describe('connectivity handling', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should handle online status change', async () => {
      const mockEmit = jest.spyOn(offlineManager, 'emit');
      mockStorageService.getPendingSyncOperations.mockResolvedValue([]);
      
      await offlineManager.handleOnlineStatusChange(true);
      
      expect(mockEmit).toHaveBeenCalledWith('connectivity-changed', {
        isOnline: true,
        wasOnline: true,
      });
    });

    it('should perform sync when coming online', async () => {
      offlineManager.isOnline = false;
      mockStorageService.getPendingSyncOperations.mockResolvedValue([]);
      
      await offlineManager.handleOnlineStatusChange(true);
      
      expect(mockStorageService.getPendingSyncOperations).toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should register event listeners', () => {
      const callback = jest.fn();
      
      offlineManager.on('test-event', callback);
      offlineManager.emit('test-event', { data: 'test' });
      
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove event listeners', () => {
      const callback = jest.fn();
      
      offlineManager.on('test-event', callback);
      offlineManager.off('test-event', callback);
      offlineManager.emit('test-event', { data: 'test' });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should get offline statistics', async () => {
      const storageStats = { alerts: 5, userPreferences: 1 };
      const cacheStatus = { 'static-v1': 10 };
      
      mockStorageService.getStorageStats.mockResolvedValue(storageStats);
      mockStorageService.getPendingSyncOperations.mockResolvedValue([{}, {}]);
      mockStorageService.getMetadata.mockResolvedValue('2023-01-01T00:00:00Z');
      
      // Mock service worker cache status
      const mockMessageChannel = {
        port1: { onmessage: null },
        port2: {},
      };
      global.MessageChannel = jest.fn(() => mockMessageChannel);
      
      const statsPromise = offlineManager.getOfflineStats();
      
      // Simulate service worker response
      setTimeout(() => {
        mockMessageChannel.port1.onmessage({ data: cacheStatus });
      }, 0);
      
      const stats = await statsPromise;
      
      expect(stats).toEqual({
        storage: storageStats,
        cache: cacheStatus,
        pendingOperations: 2,
        isOnline: true,
        lastSync: '2023-01-01T00:00:00Z',
      });
    });

    it('should check if feature is available offline', () => {
      expect(offlineManager.isFeatureAvailableOffline('view-alerts')).toBe(true);
      expect(offlineManager.isFeatureAvailableOffline('live-streaming')).toBe(false);
    });

    it('should force sync when online', async () => {
      mockStorageService.getPendingSyncOperations.mockResolvedValue([]);
      
      await offlineManager.forceSync();
      
      expect(mockStorageService.getPendingSyncOperations).toHaveBeenCalled();
    });

    it('should throw error when forcing sync while offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      offlineManager.isOnline = false;
      
      await expect(offlineManager.forceSync()).rejects.toThrow('Cannot sync while offline');
    });
  });
});