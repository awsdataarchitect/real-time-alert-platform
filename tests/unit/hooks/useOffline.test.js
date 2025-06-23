/**
 * Unit tests for useOffline hook
 */

import { renderHook, act } from '@testing-library/react';
import useOffline from '../../../src/hooks/useOffline';
import OfflineManager from '../../../src/services/offline/OfflineManager';

// Mock OfflineManager
jest.mock('../../../src/services/offline/OfflineManager');

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('useOffline', () => {
  let mockOfflineManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Create mock OfflineManager instance
    mockOfflineManager = {
      initialize: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      off: jest.fn(),
      storeAlert: jest.fn().mockResolvedValue(),
      updateAlert: jest.fn().mockResolvedValue(),
      getAlerts: jest.fn().mockResolvedValue([]),
      storeUserPreferences: jest.fn().mockResolvedValue(),
      getUserPreferences: jest.fn().mockResolvedValue({}),
      forceSync: jest.fn().mockResolvedValue(),
      cacheResources: jest.fn().mockResolvedValue(),
      clearCache: jest.fn().mockResolvedValue(),
      updateServiceWorker: jest.fn().mockResolvedValue(),
      getOfflineStats: jest.fn().mockResolvedValue({
        storage: { alerts: 5 },
        cache: { 'static-v1': 10 },
        pendingOperations: 2,
        isOnline: true,
        lastSync: '2023-01-01T00:00:00Z',
      }),
      isFeatureAvailableOffline: jest.fn().mockReturnValue(true),
    };

    OfflineManager.mockImplementation(() => mockOfflineManager);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with default state', async () => {
    const { result } = renderHook(() => useOffline());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.pendingOperations).toBe(0);
    expect(result.current.serviceWorkerUpdate).toBe(false);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.hasPendingOperations).toBe(false);
  });

  it('should initialize offline manager', async () => {
    renderHook(() => useOffline());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(OfflineManager).toHaveBeenCalled();
    expect(mockOfflineManager.initialize).toHaveBeenCalled();
  });

  it('should register event listeners', async () => {
    renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockOfflineManager.on).toHaveBeenCalledWith('connectivity-changed', expect.any(Function));
    expect(mockOfflineManager.on).toHaveBeenCalledWith('sync-started', expect.any(Function));
    expect(mockOfflineManager.on).toHaveBeenCalledWith('sync-completed', expect.any(Function));
    expect(mockOfflineManager.on).toHaveBeenCalledWith('sync-error', expect.any(Function));
    expect(mockOfflineManager.on).toHaveBeenCalledWith('operation-synced', expect.any(Function));
    expect(mockOfflineManager.on).toHaveBeenCalledWith('sw-update-available', expect.any(Function));
  });

  it('should handle connectivity changes', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Get the connectivity change handler
    const connectivityHandler = mockOfflineManager.on.mock.calls.find(
      call => call[0] === 'connectivity-changed'
    )[1];

    // Simulate going offline
    act(() => {
      connectivityHandler({ isOnline: false });
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should handle sync status changes', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Get event handlers
    const syncStartedHandler = mockOfflineManager.on.mock.calls.find(
      call => call[0] === 'sync-started'
    )[1];
    const syncCompletedHandler = mockOfflineManager.on.mock.calls.find(
      call => call[0] === 'sync-completed'
    )[1];

    // Simulate sync started
    act(() => {
      syncStartedHandler();
    });

    expect(result.current.syncStatus).toBe('syncing');
    expect(result.current.isSyncing).toBe(true);

    // Simulate sync completed
    act(() => {
      syncCompletedHandler({ syncedOperations: 2 });
    });

    expect(result.current.syncStatus).toBe('completed');
    expect(result.current.isSyncing).toBe(false);
  });

  it('should handle service worker updates', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Get the service worker update handler
    const swUpdateHandler = mockOfflineManager.on.mock.calls.find(
      call => call[0] === 'sw-update-available'
    )[1];

    // Simulate service worker update
    act(() => {
      swUpdateHandler();
    });

    expect(result.current.serviceWorkerUpdate).toBe(true);
  });

  it('should store alerts', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const alert = { alertId: 'test-1', title: 'Test Alert' };

    await act(async () => {
      await result.current.storeAlert(alert);
    });

    expect(mockOfflineManager.storeAlert).toHaveBeenCalledWith(alert);
    expect(result.current.pendingOperations).toBe(1);
  });

  it('should update alerts', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const alertId = 'test-1';
    const updates = { title: 'Updated Alert' };

    await act(async () => {
      await result.current.updateAlert(alertId, updates);
    });

    expect(mockOfflineManager.updateAlert).toHaveBeenCalledWith(alertId, updates);
    expect(result.current.pendingOperations).toBe(1);
  });

  it('should get alerts', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const filters = { eventType: 'earthquake' };
    const alerts = [{ alertId: 'test-1' }];
    mockOfflineManager.getAlerts.mockResolvedValue(alerts);

    let resultAlerts;
    await act(async () => {
      resultAlerts = await result.current.getAlerts(filters);
    });

    expect(mockOfflineManager.getAlerts).toHaveBeenCalledWith(filters);
    expect(resultAlerts).toEqual(alerts);
  });

  it('should store user preferences', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const userId = 'user-1';
    const preferences = { theme: 'dark' };

    await act(async () => {
      await result.current.storeUserPreferences(userId, preferences);
    });

    expect(mockOfflineManager.storeUserPreferences).toHaveBeenCalledWith(userId, preferences);
    expect(result.current.pendingOperations).toBe(1);
  });

  it('should get user preferences', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const userId = 'user-1';
    const preferences = { theme: 'dark' };
    mockOfflineManager.getUserPreferences.mockResolvedValue(preferences);

    let resultPreferences;
    await act(async () => {
      resultPreferences = await result.current.getUserPreferences(userId);
    });

    expect(mockOfflineManager.getUserPreferences).toHaveBeenCalledWith(userId);
    expect(resultPreferences).toEqual(preferences);
  });

  it('should force sync when online', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.forceSync();
    });

    expect(mockOfflineManager.forceSync).toHaveBeenCalled();
  });

  it('should throw error when forcing sync while offline', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Simulate offline
    act(() => {
      const connectivityHandler = mockOfflineManager.on.mock.calls.find(
        call => call[0] === 'connectivity-changed'
      )[1];
      connectivityHandler({ isOnline: false });
    });

    mockOfflineManager.forceSync.mockRejectedValue(new Error('Cannot sync while offline'));

    await act(async () => {
      await expect(result.current.forceSync()).rejects.toThrow('Cannot sync while offline');
    });
  });

  it('should cache resources', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const urls = ['/api/alerts', '/api/preferences'];

    await act(async () => {
      await result.current.cacheResources(urls);
    });

    expect(mockOfflineManager.cacheResources).toHaveBeenCalledWith(urls);
  });

  it('should clear cache', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.clearCache('static-v1');
    });

    expect(mockOfflineManager.clearCache).toHaveBeenCalledWith('static-v1');
  });

  it('should update service worker', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.updateServiceWorker();
    });

    expect(mockOfflineManager.updateServiceWorker).toHaveBeenCalled();
    expect(result.current.serviceWorkerUpdate).toBe(false);
  });

  it('should check if feature is available offline', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const isAvailable = result.current.isFeatureAvailableOffline('view-alerts');

    expect(mockOfflineManager.isFeatureAvailableOffline).toHaveBeenCalledWith('view-alerts');
    expect(isAvailable).toBe(true);
  });

  it('should get connection quality', async () => {
    const { result } = renderHook(() => useOffline());

    // Mock navigator.connection
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      value: {
        effectiveType: '4g',
      },
    });

    const quality = result.current.getConnectionQuality();
    expect(quality).toBe('excellent');
  });

  it('should refresh stats', async () => {
    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.refreshStats();
    });

    expect(mockOfflineManager.getOfflineStats).toHaveBeenCalled();
  });

  it('should load offline stats on initialization', async () => {
    renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockOfflineManager.getOfflineStats).toHaveBeenCalled();
  });

  it('should cleanup event listeners on unmount', async () => {
    const { unmount } = renderHook(() => useOffline());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    unmount();

    expect(mockOfflineManager.off).toHaveBeenCalledWith('connectivity-changed', expect.any(Function));
    expect(mockOfflineManager.off).toHaveBeenCalledWith('sync-started', expect.any(Function));
    expect(mockOfflineManager.off).toHaveBeenCalledWith('sync-completed', expect.any(Function));
    expect(mockOfflineManager.off).toHaveBeenCalledWith('sync-error', expect.any(Function));
    expect(mockOfflineManager.off).toHaveBeenCalledWith('operation-synced', expect.any(Function));
    expect(mockOfflineManager.off).toHaveBeenCalledWith('sw-update-available', expect.any(Function));
  });
});