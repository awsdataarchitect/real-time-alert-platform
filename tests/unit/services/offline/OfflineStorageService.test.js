/**
 * Unit tests for OfflineStorageService
 */

import OfflineStorageService from '../../../../src/services/offline/OfflineStorageService.js';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

const mockDB = {
  createObjectStore: jest.fn(),
  transaction: jest.fn(),
  objectStoreNames: {
    contains: jest.fn()
  }
};

const mockObjectStore = {
  createIndex: jest.fn(),
  put: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  count: jest.fn(),
  add: jest.fn(),
  openCursor: jest.fn(),
  index: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore),
  onerror: null,
  oncomplete: null
};

const mockRequest = {
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null,
  result: null
};

// Setup global IndexedDB mock
global.indexedDB = mockIndexedDB;

describe('OfflineStorageService', () => {
  let offlineStorage;

  beforeEach(() => {
    offlineStorage = new OfflineStorageService();
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockIndexedDB.open.mockReturnValue(mockRequest);
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockDB.objectStoreNames.contains.mockReturnValue(false);
    mockObjectStore.put.mockReturnValue({ ...mockRequest, result: undefined });
    mockObjectStore.get.mockReturnValue({ ...mockRequest, result: null });
    mockObjectStore.getAll.mockReturnValue({ ...mockRequest, result: [] });
    mockObjectStore.delete.mockReturnValue({ ...mockRequest, result: undefined });
    mockObjectStore.clear.mockReturnValue({ ...mockRequest, result: undefined });
    mockObjectStore.count.mockReturnValue({ ...mockRequest, result: 0 });
    mockObjectStore.add.mockReturnValue({ ...mockRequest, result: 1 });
  });

  describe('initialize', () => {
    it('should initialize IndexedDB successfully', async () => {
      // Setup successful initialization
      setTimeout(() => {
        mockRequest.result = mockDB;
        mockRequest.onsuccess({ target: mockRequest });
      }, 0);

      await offlineStorage.initialize();

      expect(mockIndexedDB.open).toHaveBeenCalledWith('RealTimeAlertPlatform', 1);
      expect(offlineStorage.isInitialized).toBe(true);
      expect(offlineStorage.db).toBe(mockDB);
    });

    it('should handle initialization errors', async () => {
      setTimeout(() => {
        mockRequest.onerror();
      }, 0);

      await expect(offlineStorage.initialize()).rejects.toThrow('Failed to open IndexedDB');
    });

    it('should create object stores on upgrade', async () => {
      setTimeout(() => {
        mockRequest.onupgradeneeded({ target: { result: mockDB } });
        mockRequest.result = mockDB;
        mockRequest.onsuccess({ target: mockRequest });
      }, 0);

      await offlineStorage.initialize();

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('alerts', { keyPath: 'alertId' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('userPreferences', { keyPath: 'userId' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('syncQueue', { keyPath: 'id', autoIncrement: true });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('conflicts', { keyPath: 'id', autoIncrement: true });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('metadata', { keyPath: 'key' });
    });
  });

  describe('storeAlert', () => {
    beforeEach(async () => {
      // Mock successful initialization
      offlineStorage.db = mockDB;
      offlineStorage.isInitialized = true;
    });

    it('should store alert with metadata', async () => {
      const alert = {
        alertId: 'alert-1',
        eventType: 'earthquake',
        severity: 5,
        headline: 'Test Alert'
      };

      setTimeout(() => {
        mockObjectStore.put.mockReturnValue({ ...mockRequest, result: undefined });
        mockRequest.onsuccess();
      }, 0);

      await offlineStorage.storeAlert(alert);

      expect(mockDB.transaction).toHaveBeenCalledWith(['alerts'], 'readwrite');
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...alert,
          syncStatus: 'pending',
          version: 1,
          lastModified: expect.any(Number)
        })
      );
    });
  });

  describe('getAlerts', () => {
    beforeEach(async () => {
      offlineStorage.db = mockDB;
      offlineStorage.isInitialized = true;
    });

    it('should retrieve all alerts when no filters provided', async () => {
      const mockAlerts = [
        { alertId: 'alert-1', eventType: 'earthquake', severity: 5 },
        { alertId: 'alert-2', eventType: 'fire', severity: 3 }
      ];

      setTimeout(() => {
        mockObjectStore.getAll.mockReturnValue({ ...mockRequest, result: mockAlerts });
        mockRequest.onsuccess();
      }, 0);

      const result = await offlineStorage.getAlerts();

      expect(mockDB.transaction).toHaveBeenCalledWith(['alerts'], 'readonly');
      expect(mockObjectStore.getAll).toHaveBeenCalled();
    });

    it('should filter alerts based on provided filters', async () => {
      const mockAlerts = [
        { alertId: 'alert-1', eventType: 'earthquake', severity: 5, status: 'active' },
        { alertId: 'alert-2', eventType: 'fire', severity: 3, status: 'active' },
        { alertId: 'alert-3', eventType: 'earthquake', severity: 2, status: 'resolved' }
      ];

      const mockCursor = {
        value: null,
        continue: jest.fn()
      };

      let cursorIndex = 0;
      mockObjectStore.openCursor.mockReturnValue({
        ...mockRequest,
        onsuccess: null,
        onerror: null
      });

      setTimeout(() => {
        const request = mockObjectStore.openCursor.mock.results[0].value;
        request.onsuccess = (event) => {
          if (cursorIndex < mockAlerts.length) {
            event.target.result = {
              ...mockCursor,
              value: mockAlerts[cursorIndex++]
            };
          } else {
            event.target.result = null;
          }
        };
        request.onsuccess({ target: { result: mockCursor } });
      }, 0);

      const filters = { eventType: 'earthquake', minSeverity: 4 };
      const result = await offlineStorage.getAlerts(filters);

      expect(mockObjectStore.openCursor).toHaveBeenCalled();
    });
  });

  describe('updateAlert', () => {
    beforeEach(async () => {
      offlineStorage.db = mockDB;
      offlineStorage.isInitialized = true;
    });

    it('should update existing alert', async () => {
      const existingAlert = {
        alertId: 'alert-1',
        eventType: 'earthquake',
        severity: 5,
        version: 1
      };

      const updates = {
        severity: 6,
        description: 'Updated description'
      };

      setTimeout(() => {
        mockObjectStore.get.mockReturnValue({ ...mockRequest, result: existingAlert });
        mockRequest.onsuccess();
      }, 0);

      setTimeout(() => {
        mockObjectStore.put.mockReturnValue({ ...mockRequest, result: undefined });
        mockRequest.onsuccess();
      }, 10);

      await offlineStorage.updateAlert('alert-1', updates);

      expect(mockObjectStore.get).toHaveBeenCalledWith('alert-1');
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingAlert,
          ...updates,
          version: 2,
          syncStatus: 'pending',
          lastModified: expect.any(Number)
        })
      );
    });

    it('should throw error if alert not found', async () => {
      setTimeout(() => {
        mockObjectStore.get.mockReturnValue({ ...mockRequest, result: null });
        mockRequest.onsuccess();
      }, 0);

      await expect(offlineStorage.updateAlert('nonexistent', {}))
        .rejects.toThrow('Alert nonexistent not found');
    });
  });

  describe('addToSyncQueue', () => {
    beforeEach(async () => {
      offlineStorage.db = mockDB;
      offlineStorage.isInitialized = true;
    });

    it('should add operation to sync queue', async () => {
      setTimeout(() => {
        mockObjectStore.add.mockReturnValue({ ...mockRequest, result: 1 });
        mockRequest.onsuccess();
      }, 0);

      await offlineStorage.addToSyncQueue('create', 'alert', 'alert-1', { data: 'test' }, 2);

      expect(mockDB.transaction).toHaveBeenCalledWith(['syncQueue'], 'readwrite');
      expect(mockObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create',
          entityType: 'alert',
          entityId: 'alert-1',
          data: { data: 'test' },
          priority: 2,
          timestamp: expect.any(Number),
          retryCount: 0
        })
      );
    });
  });

  describe('storeConflict', () => {
    beforeEach(async () => {
      offlineStorage.db = mockDB;
      offlineStorage.isInitialized = true;
    });

    it('should store conflict for resolution', async () => {
      const localData = { alertId: 'alert-1', version: 1 };
      const remoteData = { alertId: 'alert-1', version: 2 };

      setTimeout(() => {
        mockObjectStore.add.mockReturnValue({ ...mockRequest, result: 1 });
        mockRequest.onsuccess();
      }, 0);

      await offlineStorage.storeConflict('alert', 'alert-1', localData, remoteData, 'version');

      expect(mockObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'alert',
          entityId: 'alert-1',
          localData,
          remoteData,
          conflictType: 'version',
          timestamp: expect.any(Number),
          resolved: false
        })
      );
    });
  });

  describe('clearAllData', () => {
    beforeEach(async () => {
      offlineStorage.db = mockDB;
      offlineStorage.isInitialized = true;
    });

    it('should clear all data from all stores', async () => {
      setTimeout(() => {
        mockObjectStore.clear.mockReturnValue({ ...mockRequest, result: undefined });
        mockRequest.onsuccess();
      }, 0);

      await offlineStorage.clearAllData();

      expect(mockObjectStore.clear).toHaveBeenCalledTimes(5); // 5 stores
    });
  });

  describe('getStorageStats', () => {
    beforeEach(async () => {
      offlineStorage.db = mockDB;
      offlineStorage.isInitialized = true;
    });

    it('should return storage statistics', async () => {
      setTimeout(() => {
        mockObjectStore.count.mockReturnValue({ ...mockRequest, result: 10 });
        mockRequest.onsuccess();
      }, 0);

      const stats = await offlineStorage.getStorageStats();

      expect(stats).toEqual({
        alerts: 10,
        userPreferences: 10,
        syncQueue: 10,
        conflicts: 10,
        metadata: 10
      });
    });
  });
});