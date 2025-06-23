/**
 * Unit tests for SynchronizationService
 */

import SynchronizationService from '../../../../src/services/offline/SynchronizationService.js';

// Mock OfflineStorageService
jest.mock('../../../../src/services/offline/OfflineStorageService.js', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    getPendingSyncOperations: jest.fn(),
    removeSyncOperation: jest.fn(),
    addToSyncQueue: jest.fn(),
    setMetadata: jest.fn(),
    getMetadata: jest.fn(),
    storeAlert: jest.fn(),
    updateAlert: jest.fn(),
    deleteAlert: jest.fn(),
    getAlert: jest.fn(),
    storeUserPreferences: jest.fn(),
    getUserPreferences: jest.fn(),
    storeConflict: jest.fn(),
    getUnresolvedConflicts: jest.fn()
  }));
});

// Mock API client
const mockApiClient = {
  createAlert: jest.fn(),
  updateAlert: jest.fn(),
  deleteAlert: jest.fn(),
  getAlerts: jest.fn(),
  updateUserPreferences: jest.fn(),
  deleteUserPreferences: jest.fn(),
  getUserPreferences: jest.fn()
};

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window event listeners
const mockEventListeners = {};
global.window = {
  addEventListener: jest.fn((event, callback) => {
    mockEventListeners[event] = callback;
  }),
  removeEventListener: jest.fn()
};

describe('SynchronizationService', () => {
  let syncService;
  let mockOfflineStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    syncService = new SynchronizationService(mockApiClient);
    mockOfflineStorage = syncService.offlineStorage;
    
    // Reset navigator.onLine
    navigator.onLine = true;
  });

  describe('initialize', () => {
    it('should initialize offline storage and start sync if online', async () => {
      mockOfflineStorage.initialize.mockResolvedValue();
      mockOfflineStorage.getPendingSyncOperations.mockResolvedValue([]);

      await syncService.initialize();

      expect(mockOfflineStorage.initialize).toHaveBeenCalled();
      expect(syncService.syncInterval).toBeTruthy();
    });

    it('should not start sync if offline', async () => {
      navigator.onLine = false;
      syncService.isOnline = false;
      
      mockOfflineStorage.initialize.mockResolvedValue();
      mockOfflineStorage.getPendingSyncOperations.mockResolvedValue([]);

      await syncService.initialize();

      expect(mockOfflineStorage.initialize).toHaveBeenCalled();
      expect(syncService.syncInterval).toBeFalsy();
    });
  });

  describe('handleOnline', () => {
    it('should start sync when coming online', async () => {
      mockOfflineStorage.getPendingSyncOperations.mockResolvedValue([]);
      
      await syncService.handleOnline();

      expect(syncService.isOnline).toBe(true);
      expect(syncService.syncInterval).toBeTruthy();
    });
  });

  describe('handleOffline', () => {
    it('should stop sync when going offline', () => {
      syncService.syncInterval = setInterval(() => {}, 1000);
      
      syncService.handleOffline();

      expect(syncService.isOnline).toBe(false);
      expect(syncService.syncInterval).toBe(null);
    });
  });

  describe('processPendingSync', () => {
    it('should process pending sync operations', async () => {
      const mockOperations = [
        {
          id: 1,
          operation: 'create',
          entityType: 'alert',
          entityId: 'alert-1',
          data: { alertId: 'alert-1', eventType: 'earthquake' }
        }
      ];

      mockOfflineStorage.getPendingSyncOperations.mockResolvedValue(mockOperations);
      mockOfflineStorage.removeSyncOperation.mockResolvedValue();
      mockOfflineStorage.setMetadata.mockResolvedValue();
      mockApiClient.createAlert.mockResolvedValue({ alertId: 'alert-1', version: 1 });
      mockOfflineStorage.updateAlert.mockResolvedValue();

      await syncService.processPendingSync();

      expect(mockOfflineStorage.getPendingSyncOperations).toHaveBeenCalled();
      expect(mockApiClient.createAlert).toHaveBeenCalledWith(mockOperations[0].data);
      expect(mockOfflineStorage.removeSyncOperation).toHaveBeenCalledWith(1);
      expect(mockOfflineStorage.setMetadata).toHaveBeenCalledWith('lastSyncTimestamp', expect.any(Number));
    });

    it('should not process if already syncing', async () => {
      syncService.syncInProgress = true;

      await syncService.processPendingSync();

      expect(mockOfflineStorage.getPendingSyncOperations).not.toHaveBeenCalled();
    });

    it('should not process if offline', async () => {
      syncService.isOnline = false;

      await syncService.processPendingSync();

      expect(mockOfflineStorage.getPendingSyncOperations).not.toHaveBeenCalled();
    });

    it('should handle sync errors', async () => {
      const mockOperations = [
        {
          id: 1,
          operation: 'create',
          entityType: 'alert',
          entityId: 'alert-1',
          data: { alertId: 'alert-1' },
          retryCount: 0
        }
      ];

      mockOfflineStorage.getPendingSyncOperations.mockResolvedValue(mockOperations);
      mockApiClient.createAlert.mockRejectedValue(new Error('Network error'));
      mockOfflineStorage.addToSyncQueue.mockResolvedValue();

      await syncService.processPendingSync();

      expect(mockOfflineStorage.addToSyncQueue).toHaveBeenCalled();
    });
  });

  describe('syncAlert', () => {
    it('should create alert on remote server', async () => {
      const alertData = { alertId: 'alert-1', eventType: 'earthquake' };
      const serverResponse = { ...alertData, version: 1 };

      mockApiClient.createAlert.mockResolvedValue(serverResponse);
      mockOfflineStorage.updateAlert.mockResolvedValue();

      await syncService.syncAlert('create', 'alert-1', alertData);

      expect(mockApiClient.createAlert).toHaveBeenCalledWith(alertData);
      expect(mockOfflineStorage.updateAlert).toHaveBeenCalledWith('alert-1', {
        ...serverResponse,
        syncStatus: 'synced'
      });
    });

    it('should update alert on remote server', async () => {
      const alertData = { alertId: 'alert-1', eventType: 'earthquake', severity: 6 };
      const serverResponse = { ...alertData, version: 2 };

      mockApiClient.updateAlert.mockResolvedValue(serverResponse);
      mockOfflineStorage.updateAlert.mockResolvedValue();

      await syncService.syncAlert('update', 'alert-1', alertData);

      expect(mockApiClient.updateAlert).toHaveBeenCalledWith('alert-1', alertData);
      expect(mockOfflineStorage.updateAlert).toHaveBeenCalledWith('alert-1', {
        ...serverResponse,
        syncStatus: 'synced'
      });
    });

    it('should delete alert on remote server', async () => {
      mockApiClient.deleteAlert.mockResolvedValue();
      mockOfflineStorage.deleteAlert.mockResolvedValue();

      await syncService.syncAlert('delete', 'alert-1', {});

      expect(mockApiClient.deleteAlert).toHaveBeenCalledWith('alert-1');
      expect(mockOfflineStorage.deleteAlert).toHaveBeenCalledWith('alert-1');
    });

    it('should handle 404 errors on delete gracefully', async () => {
      const error = new Error('Not found');
      error.status = 404;
      
      mockApiClient.deleteAlert.mockRejectedValue(error);
      mockOfflineStorage.deleteAlert.mockResolvedValue();

      await syncService.syncAlert('delete', 'alert-1', {});

      expect(mockOfflineStorage.deleteAlert).toHaveBeenCalledWith('alert-1');
    });
  });

  describe('downloadRemoteData', () => {
    it('should download and store remote alerts', async () => {
      const remoteAlerts = [
        { alertId: 'alert-1', eventType: 'earthquake', lastModified: Date.now() }
      ];

      mockApiClient.getAlerts.mockResolvedValue(remoteAlerts);
      mockOfflineStorage.getAlert.mockResolvedValue(null);
      mockOfflineStorage.storeAlert.mockResolvedValue();
      syncService.getCurrentUser = jest.fn().mockResolvedValue(null);

      await syncService.downloadRemoteData();

      expect(mockApiClient.getAlerts).toHaveBeenCalled();
      expect(mockOfflineStorage.storeAlert).toHaveBeenCalledWith({
        ...remoteAlerts[0],
        syncStatus: 'synced'
      });
    });

    it('should handle conflicts when local version is newer', async () => {
      const remoteAlert = { alertId: 'alert-1', lastModified: 1000 };
      const localAlert = { alertId: 'alert-1', lastModified: 2000 };

      mockApiClient.getAlerts.mockResolvedValue([remoteAlert]);
      mockOfflineStorage.getAlert.mockResolvedValue(localAlert);
      mockOfflineStorage.storeConflict.mockResolvedValue();
      syncService.getCurrentUser = jest.fn().mockResolvedValue(null);

      await syncService.downloadRemoteData();

      expect(mockOfflineStorage.storeConflict).toHaveBeenCalledWith(
        'alert',
        'alert-1',
        localAlert,
        remoteAlert,
        'version_conflict'
      );
    });

    it('should throw error when offline', async () => {
      syncService.isOnline = false;

      await expect(syncService.downloadRemoteData()).rejects.toThrow('Cannot download data while offline');
    });
  });

  describe('getSyncStatus', () => {
    it('should return current sync status', async () => {
      const mockOperations = [{ id: 1 }, { id: 2 }];
      const mockConflicts = [{ id: 1 }];
      const lastSync = Date.now();

      mockOfflineStorage.getPendingSyncOperations.mockResolvedValue(mockOperations);
      mockOfflineStorage.getUnresolvedConflicts.mockResolvedValue(mockConflicts);
      mockOfflineStorage.getMetadata.mockResolvedValue(lastSync);

      const status = await syncService.getSyncStatus();

      expect(status).toEqual({
        isOnline: true,
        syncInProgress: false,
        pendingOperations: 2,
        unresolvedConflicts: 1,
        lastSyncTimestamp: lastSync
      });
    });
  });

  describe('ConflictResolver', () => {
    let resolver;

    beforeEach(() => {
      // Access the ConflictResolver class from the module
      resolver = new syncService.conflictResolver.constructor();
    });

    it('should resolve version conflicts with last-write-wins', async () => {
      const localData = { alertId: 'alert-1', lastModified: 2000, data: 'local' };
      const remoteData = { alertId: 'alert-1', lastModified: 1000, data: 'remote' };

      const resolution = await resolver.resolve('version_conflict', localData, remoteData);

      expect(resolution.canAutoResolve).toBe(true);
      expect(resolution.resolvedData).toEqual(localData);
      expect(resolution.resolution).toBe('local_wins');
    });

    it('should resolve create conflicts by preferring remote', async () => {
      const localData = { alertId: 'alert-1', data: 'local' };
      const remoteData = { alertId: 'alert-1', data: 'remote' };

      const resolution = await resolver.resolve('create_conflict', localData, remoteData);

      expect(resolution.canAutoResolve).toBe(true);
      expect(resolution.resolvedData).toEqual(remoteData);
      expect(resolution.resolution).toBe('remote_wins');
    });

    it('should merge data when timestamps are equal', async () => {
      const timestamp = Date.now();
      const localData = { alertId: 'alert-1', lastModified: timestamp, localField: 'local' };
      const remoteData = { alertId: 'alert-1', lastModified: timestamp, remoteField: 'remote' };

      const resolution = await resolver.resolve('version_conflict', localData, remoteData);

      expect(resolution.canAutoResolve).toBe(true);
      expect(resolution.resolvedData).toEqual(
        expect.objectContaining({
          localField: 'local',
          remoteField: 'remote',
          lastModified: timestamp
        })
      );
      expect(resolution.resolution).toBe('merged');
    });

    it('should not auto-resolve unknown conflict types', async () => {
      const resolution = await resolver.resolve('unknown_conflict', {}, {});

      expect(resolution.canAutoResolve).toBe(false);
      expect(resolution.reason).toBe('Unknown conflict type');
    });
  });
});