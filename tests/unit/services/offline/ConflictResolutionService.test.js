/**
 * Unit tests for ConflictResolutionService
 */

import ConflictResolutionService from '../../../../src/services/offline/ConflictResolutionService.js';

// Mock OfflineStorageService
const mockOfflineStorage = {
  resolveConflict: jest.fn(),
  storeAlert: jest.fn(),
  storeUserPreferences: jest.fn(),
  getUnresolvedConflicts: jest.fn()
};

describe('ConflictResolutionService', () => {
  let conflictResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    conflictResolver = new ConflictResolutionService(mockOfflineStorage);
  });

  describe('resolveConflict', () => {
    it('should resolve conflict using last-write-wins strategy', async () => {
      const conflict = {
        id: 1,
        entityType: 'alert',
        entityId: 'alert-1',
        localData: { alertId: 'alert-1', lastModified: 2000, data: 'local' },
        remoteData: { alertId: 'alert-1', lastModified: 1000, data: 'remote' }
      };

      mockOfflineStorage.resolveConflict.mockResolvedValue();
      mockOfflineStorage.storeAlert.mockResolvedValue();

      const resolution = await conflictResolver.resolveConflict(conflict, 'last_write_wins');

      expect(resolution.strategy).toBe('last_write_wins');
      expect(resolution.winner).toBe('local');
      expect(resolution.resolvedData).toEqual(conflict.localData);
      expect(mockOfflineStorage.resolveConflict).toHaveBeenCalledWith(1, resolution);
      expect(mockOfflineStorage.storeAlert).toHaveBeenCalled();
    });

    it('should throw error for unknown strategy', async () => {
      const conflict = { id: 1, entityType: 'alert' };

      await expect(conflictResolver.resolveConflict(conflict, 'unknown_strategy'))
        .rejects.toThrow('Unknown resolution strategy: unknown_strategy');
    });
  });

  describe('lastWriteWins', () => {
    it('should choose local data when it is more recent', async () => {
      const conflict = {
        localData: { alertId: 'alert-1', lastModified: 2000, data: 'local' },
        remoteData: { alertId: 'alert-1', lastModified: 1000, data: 'remote' }
      };

      const resolution = await conflictResolver.lastWriteWins(conflict);

      expect(resolution.winner).toBe('local');
      expect(resolution.resolvedData).toEqual(conflict.localData);
      expect(resolution.reason).toBe('Local data is more recent');
    });

    it('should choose remote data when it is more recent', async () => {
      const conflict = {
        localData: { alertId: 'alert-1', lastModified: 1000, data: 'local' },
        remoteData: { alertId: 'alert-1', lastModified: 2000, data: 'remote' }
      };

      const resolution = await conflictResolver.lastWriteWins(conflict);

      expect(resolution.winner).toBe('remote');
      expect(resolution.resolvedData).toEqual(conflict.remoteData);
      expect(resolution.reason).toBe('Remote data is more recent');
    });

    it('should merge data when timestamps are equal', async () => {
      const timestamp = 1000;
      const conflict = {
        localData: { alertId: 'alert-1', lastModified: timestamp, localField: 'local' },
        remoteData: { alertId: 'alert-1', lastModified: timestamp, remoteField: 'remote' }
      };

      const resolution = await conflictResolver.lastWriteWins(conflict);

      expect(resolution.winner).toBe('merged');
      expect(resolution.resolvedData).toEqual(
        expect.objectContaining({
          alertId: 'alert-1',
          lastModified: timestamp,
          localField: 'local',
          remoteField: 'remote'
        })
      );
      expect(resolution.reason).toBe('Same timestamp - data merged');
    });
  });

  describe('manualResolution', () => {
    it('should return manual resolution requiring user input', async () => {
      const conflict = {
        localData: { alertId: 'alert-1', data: 'local' },
        remoteData: { alertId: 'alert-1', data: 'remote' }
      };

      const resolution = await conflictResolver.manualResolution(conflict);

      expect(resolution.strategy).toBe('manual_resolution');
      expect(resolution.winner).toBe('pending');
      expect(resolution.requiresUserInput).toBe(true);
      expect(resolution.options).toEqual({
        local: conflict.localData,
        remote: conflict.remoteData,
        merge: expect.any(Object)
      });
    });
  });

  describe('priorityBased', () => {
    it('should choose data with higher priority', async () => {
      const conflict = {
        entityType: 'alert',
        localData: { alertId: 'alert-1', severity: 5, status: 'active' },
        remoteData: { alertId: 'alert-1', severity: 9, status: 'active', verified: true }
      };

      const resolution = await conflictResolver.priorityBased(conflict);

      expect(resolution.winner).toBe('remote');
      expect(resolution.resolvedData).toEqual(conflict.remoteData);
      expect(resolution.reason).toContain('Remote data has higher priority');
    });

    it('should fall back to last-write-wins when priorities are equal', async () => {
      const conflict = {
        entityType: 'alert',
        localData: { alertId: 'alert-1', severity: 5, lastModified: 2000 },
        remoteData: { alertId: 'alert-1', severity: 5, lastModified: 1000 }
      };

      const resolution = await conflictResolver.priorityBased(conflict);

      expect(resolution.winner).toBe('local');
      expect(resolution.resolvedData).toEqual(conflict.localData);
    });
  });

  describe('mergeData', () => {
    it('should merge non-conflicting fields', () => {
      const localData = {
        alertId: 'alert-1',
        localField: 'local',
        sharedField: 'local_value',
        lastModified: 2000
      };
      const remoteData = {
        alertId: 'alert-1',
        remoteField: 'remote',
        sharedField: 'remote_value',
        lastModified: 1000
      };

      const merged = conflictResolver.mergeData(localData, remoteData);

      expect(merged).toEqual({
        alertId: 'alert-1',
        localField: 'local',
        remoteField: 'remote',
        sharedField: 'remote_value', // Remote wins for conflicts
        lastModified: 2000 // Max timestamp
      });
    });

    it('should merge arrays by removing duplicates', () => {
      const localData = {
        tags: ['local1', 'shared', 'local2']
      };
      const remoteData = {
        tags: ['remote1', 'shared', 'remote2']
      };

      const merged = conflictResolver.mergeData(localData, remoteData);

      expect(merged.tags).toEqual(
        expect.arrayContaining(['local1', 'local2', 'remote1', 'remote2', 'shared'])
      );
      expect(merged.tags).toHaveLength(5);
    });

    it('should recursively merge nested objects', () => {
      const localData = {
        metadata: {
          localField: 'local',
          sharedField: 'local_value'
        }
      };
      const remoteData = {
        metadata: {
          remoteField: 'remote',
          sharedField: 'remote_value'
        }
      };

      const merged = conflictResolver.mergeData(localData, remoteData);

      expect(merged.metadata).toEqual({
        localField: 'local',
        remoteField: 'remote',
        sharedField: 'remote_value'
      });
    });
  });

  describe('calculatePriority', () => {
    it('should calculate higher priority for critical alerts', () => {
      const criticalAlert = {
        severity: 9,
        status: 'active',
        verified: true
      };

      const priority = conflictResolver.calculatePriority(criticalAlert, 'alert', 'remote');

      expect(priority).toBeGreaterThan(40); // Base 10 + severity 20 + status 10 + verified 15
    });

    it('should calculate higher priority for recent user preferences', () => {
      const recentPrefs = {
        lastModified: Date.now() - 1800000 // 30 minutes ago
      };

      const priority = conflictResolver.calculatePriority(recentPrefs, 'userPreferences', 'local');

      expect(priority).toBeGreaterThan(15); // Recent preference bonus
    });

    it('should add priority for data completeness', () => {
      const completeData = {
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
        field4: 'value4',
        field5: 'value5'
      };

      const priority = conflictResolver.calculatePriority(completeData, 'alert', 'local');

      expect(priority).toBeGreaterThan(5); // Field count bonus
    });
  });

  describe('resolveWithUserChoice', () => {
    beforeEach(() => {
      mockOfflineStorage.getUnresolvedConflicts.mockResolvedValue([
        {
          id: 1,
          entityType: 'alert',
          entityId: 'alert-1',
          localData: { alertId: 'alert-1', data: 'local' },
          remoteData: { alertId: 'alert-1', data: 'remote' }
        }
      ]);
    });

    it('should resolve with local choice', async () => {
      mockOfflineStorage.resolveConflict.mockResolvedValue();
      mockOfflineStorage.storeAlert.mockResolvedValue();

      const resolution = await conflictResolver.resolveWithUserChoice(1, 'local');

      expect(resolution.strategy).toBe('user_choice');
      expect(resolution.winner).toBe('local');
      expect(resolution.userChoice).toBe('local');
      expect(mockOfflineStorage.resolveConflict).toHaveBeenCalled();
      expect(mockOfflineStorage.storeAlert).toHaveBeenCalled();
    });

    it('should resolve with remote choice', async () => {
      mockOfflineStorage.resolveConflict.mockResolvedValue();
      mockOfflineStorage.storeAlert.mockResolvedValue();

      const resolution = await conflictResolver.resolveWithUserChoice(1, 'remote');

      expect(resolution.winner).toBe('remote');
      expect(resolution.resolvedData.data).toBe('remote');
    });

    it('should resolve with merge choice', async () => {
      mockOfflineStorage.resolveConflict.mockResolvedValue();
      mockOfflineStorage.storeAlert.mockResolvedValue();

      const resolution = await conflictResolver.resolveWithUserChoice(1, 'merge');

      expect(resolution.winner).toBe('merge');
      expect(resolution.resolvedData).toEqual(
        expect.objectContaining({
          alertId: 'alert-1',
          data: 'remote' // Remote wins in merge for conflicting fields
        })
      );
    });

    it('should resolve with custom data', async () => {
      const customData = { alertId: 'alert-1', data: 'custom' };
      mockOfflineStorage.resolveConflict.mockResolvedValue();
      mockOfflineStorage.storeAlert.mockResolvedValue();

      const resolution = await conflictResolver.resolveWithUserChoice(1, 'custom', customData);

      expect(resolution.winner).toBe('custom');
      expect(resolution.resolvedData).toEqual(customData);
    });

    it('should throw error for invalid choice', async () => {
      await expect(conflictResolver.resolveWithUserChoice(1, 'invalid'))
        .rejects.toThrow('Invalid choice: invalid');
    });

    it('should throw error for custom choice without data', async () => {
      await expect(conflictResolver.resolveWithUserChoice(1, 'custom'))
        .rejects.toThrow('Custom data required for custom resolution');
    });

    it('should throw error for non-existent conflict', async () => {
      await expect(conflictResolver.resolveWithUserChoice(999, 'local'))
        .rejects.toThrow('Conflict 999 not found');
    });
  });

  describe('autoResolveConflicts', () => {
    it('should auto-resolve all conflicts', async () => {
      const conflicts = [
        {
          id: 1,
          entityType: 'alert',
          entityId: 'alert-1',
          localData: { lastModified: 2000 },
          remoteData: { lastModified: 1000 }
        },
        {
          id: 2,
          entityType: 'alert',
          entityId: 'alert-2',
          localData: { lastModified: 1000 },
          remoteData: { lastModified: 2000 }
        }
      ];

      mockOfflineStorage.getUnresolvedConflicts.mockResolvedValue(conflicts);
      mockOfflineStorage.resolveConflict.mockResolvedValue();
      mockOfflineStorage.storeAlert.mockResolvedValue();

      const results = await conflictResolver.autoResolveConflicts('last_write_wins');

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockOfflineStorage.resolveConflict).toHaveBeenCalledTimes(2);
    });

    it('should handle resolution errors', async () => {
      const conflicts = [
        {
          id: 1,
          entityType: 'alert',
          entityId: 'alert-1',
          localData: {},
          remoteData: {}
        }
      ];

      mockOfflineStorage.getUnresolvedConflicts.mockResolvedValue(conflicts);
      mockOfflineStorage.resolveConflict.mockRejectedValue(new Error('Resolution failed'));

      const results = await conflictResolver.autoResolveConflicts();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Resolution failed');
    });
  });
});