/**
 * Conflict Resolution Service
 * Handles different types of data conflicts between local and remote data
 */

class ConflictResolutionService {
  constructor(offlineStorage) {
    this.offlineStorage = offlineStorage;
    this.resolutionStrategies = {
      'last_write_wins': this.lastWriteWins.bind(this),
      'manual_resolution': this.manualResolution.bind(this),
      'field_level_merge': this.fieldLevelMerge.bind(this),
      'priority_based': this.priorityBased.bind(this)
    };
  }

  /**
   * Resolve a conflict using the specified strategy
   */
  async resolveConflict(conflict, strategy = 'last_write_wins') {
    const resolutionFunction = this.resolutionStrategies[strategy];
    
    if (!resolutionFunction) {
      throw new Error(`Unknown resolution strategy: ${strategy}`);
    }

    try {
      const resolution = await resolutionFunction(conflict);
      
      // Mark conflict as resolved
      await this.offlineStorage.resolveConflict(conflict.id, resolution);
      
      // Apply the resolution
      await this.applyResolution(conflict.entityType, conflict.entityId, resolution);
      
      return resolution;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }

  /**
   * Last-write-wins resolution strategy
   */
  async lastWriteWins(conflict) {
    const { localData, remoteData } = conflict;
    
    const localTimestamp = localData.lastModified || localData.updatedAt || 0;
    const remoteTimestamp = remoteData.lastModified || remoteData.updatedAt || 0;

    if (localTimestamp > remoteTimestamp) {
      return {
        strategy: 'last_write_wins',
        winner: 'local',
        resolvedData: localData,
        reason: 'Local data is more recent'
      };
    } else if (remoteTimestamp > localTimestamp) {
      return {
        strategy: 'last_write_wins',
        winner: 'remote',
        resolvedData: remoteData,
        reason: 'Remote data is more recent'
      };
    } else {
      // Same timestamp - merge the data
      return {
        strategy: 'last_write_wins',
        winner: 'merged',
        resolvedData: this.mergeData(localData, remoteData),
        reason: 'Same timestamp - data merged'
      };
    }
  }

  /**
   * Manual resolution strategy - requires user intervention
   */
  async manualResolution(conflict) {
    return {
      strategy: 'manual_resolution',
      winner: 'pending',
      resolvedData: null,
      reason: 'Requires manual user intervention',
      requiresUserInput: true,
      options: {
        local: conflict.localData,
        remote: conflict.remoteData,
        merge: this.mergeData(conflict.localData, conflict.remoteData)
      }
    };
  }

  /**
   * Field-level merge resolution strategy
   */
  async fieldLevelMerge(conflict) {
    const { localData, remoteData } = conflict;
    const mergedData = this.performFieldLevelMerge(localData, remoteData);

    return {
      strategy: 'field_level_merge',
      winner: 'merged',
      resolvedData: mergedData,
      reason: 'Fields merged based on modification timestamps',
      mergeDetails: this.getMergeDetails(localData, remoteData, mergedData)
    };
  }

  /**
   * Priority-based resolution strategy
   */
  async priorityBased(conflict) {
    const { localData, remoteData, entityType } = conflict;
    
    // Define priority rules based on entity type and data characteristics
    const localPriority = this.calculatePriority(localData, entityType, 'local');
    const remotePriority = this.calculatePriority(remoteData, entityType, 'remote');

    if (localPriority > remotePriority) {
      return {
        strategy: 'priority_based',
        winner: 'local',
        resolvedData: localData,
        reason: `Local data has higher priority (${localPriority} vs ${remotePriority})`
      };
    } else if (remotePriority > localPriority) {
      return {
        strategy: 'priority_based',
        winner: 'remote',
        resolvedData: remoteData,
        reason: `Remote data has higher priority (${remotePriority} vs ${localPriority})`
      };
    } else {
      // Equal priority - fall back to last-write-wins
      return await this.lastWriteWins(conflict);
    }
  }

  /**
   * Merge data from local and remote sources
   */
  mergeData(localData, remoteData) {
    const merged = { ...remoteData };

    // Merge non-conflicting fields from local data
    Object.keys(localData).forEach(key => {
      if (key === 'lastModified' || key === 'updatedAt') {
        // Use the most recent timestamp
        merged[key] = Math.max(
          localData[key] || 0,
          remoteData[key] || 0
        );
      } else if (key === 'version') {
        // Use the higher version number
        merged[key] = Math.max(
          localData[key] || 1,
          remoteData[key] || 1
        );
      } else if (remoteData[key] === undefined || remoteData[key] === null) {
        // Use local value if remote is empty
        merged[key] = localData[key];
      } else if (localData[key] !== remoteData[key] && localData[key] !== undefined) {
        // Handle conflicts based on data type
        if (Array.isArray(localData[key]) && Array.isArray(remoteData[key])) {
          // Merge arrays and remove duplicates
          merged[key] = [...new Set([...localData[key], ...remoteData[key]])];
        } else if (typeof localData[key] === 'object' && typeof remoteData[key] === 'object') {
          // Recursively merge objects
          merged[key] = this.mergeData(localData[key], remoteData[key]);
        }
        // For primitive conflicts, keep remote value (can be customized)
      }
    });

    return merged;
  }

  /**
   * Perform field-level merge with timestamp tracking
   */
  performFieldLevelMerge(localData, remoteData) {
    const merged = { ...remoteData };
    const localFieldTimestamps = localData._fieldTimestamps || {};
    const remoteFieldTimestamps = remoteData._fieldTimestamps || {};

    Object.keys(localData).forEach(key => {
      if (key.startsWith('_')) return; // Skip metadata fields

      const localTimestamp = localFieldTimestamps[key] || localData.lastModified || 0;
      const remoteTimestamp = remoteFieldTimestamps[key] || remoteData.lastModified || 0;

      if (localTimestamp > remoteTimestamp) {
        merged[key] = localData[key];
        if (!merged._fieldTimestamps) merged._fieldTimestamps = {};
        merged._fieldTimestamps[key] = localTimestamp;
      }
    });

    return merged;
  }

  /**
   * Calculate priority for data based on various factors
   */
  calculatePriority(data, entityType, source) {
    let priority = 0;

    // Base priority for source
    if (source === 'remote') {
      priority += 10; // Remote data generally has higher priority
    }

    // Entity-specific priority rules
    switch (entityType) {
      case 'alert':
        // Critical alerts have higher priority
        if (data.severity >= 8) priority += 20;
        if (data.status === 'active') priority += 10;
        if (data.verified === true) priority += 15;
        break;
      
      case 'userPreferences':
        // Recent preferences have higher priority
        const age = Date.now() - (data.lastModified || 0);
        if (age < 3600000) priority += 15; // Less than 1 hour
        break;
    }

    // Data completeness priority
    const fieldCount = Object.keys(data).length;
    priority += Math.min(fieldCount, 10); // Up to 10 points for completeness

    return priority;
  }

  /**
   * Get details about the merge operation
   */
  getMergeDetails(localData, remoteData, mergedData) {
    const details = {
      fieldsFromLocal: [],
      fieldsFromRemote: [],
      mergedFields: []
    };

    Object.keys(mergedData).forEach(key => {
      if (key.startsWith('_')) return;

      if (localData[key] !== undefined && remoteData[key] === undefined) {
        details.fieldsFromLocal.push(key);
      } else if (remoteData[key] !== undefined && localData[key] === undefined) {
        details.fieldsFromRemote.push(key);
      } else if (localData[key] !== remoteData[key]) {
        details.mergedFields.push({
          field: key,
          localValue: localData[key],
          remoteValue: remoteData[key],
          resolvedValue: mergedData[key]
        });
      }
    });

    return details;
  }

  /**
   * Apply resolution to the appropriate storage
   */
  async applyResolution(entityType, entityId, resolution) {
    if (!resolution.resolvedData) {
      return; // Manual resolution pending
    }

    const resolvedData = {
      ...resolution.resolvedData,
      syncStatus: 'synced',
      lastResolved: Date.now(),
      resolutionStrategy: resolution.strategy
    };

    switch (entityType) {
      case 'alert':
        await this.offlineStorage.storeAlert(resolvedData);
        break;
      case 'userPreferences':
        await this.offlineStorage.storeUserPreferences(entityId, resolvedData);
        break;
      default:
        throw new Error(`Unknown entity type for resolution: ${entityType}`);
    }
  }

  /**
   * Get all unresolved conflicts that require manual intervention
   */
  async getManualResolutionRequired() {
    const conflicts = await this.offlineStorage.getUnresolvedConflicts();
    
    return conflicts.filter(conflict => {
      // Check if conflict requires manual resolution
      return conflict.conflictType === 'manual' || 
             conflict.resolution?.requiresUserInput === true;
    });
  }

  /**
   * Resolve conflict with user choice
   */
  async resolveWithUserChoice(conflictId, choice, customData = null) {
    const conflicts = await this.offlineStorage.getUnresolvedConflicts();
    const conflict = conflicts.find(c => c.id === conflictId);
    
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    let resolvedData;
    let reason;

    switch (choice) {
      case 'local':
        resolvedData = conflict.localData;
        reason = 'User chose local version';
        break;
      case 'remote':
        resolvedData = conflict.remoteData;
        reason = 'User chose remote version';
        break;
      case 'merge':
        resolvedData = this.mergeData(conflict.localData, conflict.remoteData);
        reason = 'User chose merged version';
        break;
      case 'custom':
        if (!customData) {
          throw new Error('Custom data required for custom resolution');
        }
        resolvedData = customData;
        reason = 'User provided custom resolution';
        break;
      default:
        throw new Error(`Invalid choice: ${choice}`);
    }

    const resolution = {
      strategy: 'user_choice',
      winner: choice,
      resolvedData,
      reason,
      userChoice: choice,
      timestamp: Date.now()
    };

    await this.offlineStorage.resolveConflict(conflictId, resolution);
    await this.applyResolution(conflict.entityType, conflict.entityId, resolution);

    return resolution;
  }

  /**
   * Auto-resolve conflicts based on configured strategies
   */
  async autoResolveConflicts(strategy = 'last_write_wins') {
    const conflicts = await this.offlineStorage.getUnresolvedConflicts();
    const results = [];

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(conflict, strategy);
        results.push({
          conflictId: conflict.id,
          success: true,
          resolution
        });
      } catch (error) {
        results.push({
          conflictId: conflict.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

export default ConflictResolutionService;