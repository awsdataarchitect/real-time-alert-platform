# Offline Storage Usage Guide

This document explains how to use the offline storage functionality in the Real-Time Alert Platform.

## Overview

The offline storage system provides:
- Local data storage using IndexedDB
- Automatic synchronization with remote server
- Conflict resolution for data inconsistencies
- Offline-first functionality for critical alerts

## Components

### 1. OfflineStorageService
Handles local data storage using IndexedDB with the following stores:
- `alerts` - Alert data with metadata
- `userPreferences` - User preference data
- `syncQueue` - Pending synchronization operations
- `conflicts` - Data conflicts requiring resolution
- `metadata` - System metadata and timestamps

### 2. SynchronizationService
Manages data synchronization between local and remote storage:
- Automatic sync when online
- Periodic sync intervals
- Conflict detection and handling
- Retry mechanisms for failed operations

### 3. ConflictResolutionService
Resolves data conflicts using various strategies:
- Last-write-wins
- Manual resolution
- Field-level merge
- Priority-based resolution

## Usage Examples

### Basic Setup

```javascript
import OfflineManager from './src/services/offline/index.js';

// Initialize with API client
const apiClient = new YourApiClient();
const offlineManager = new OfflineManager(apiClient);

// Initialize offline services
await offlineManager.initialize();
```

### Storing Alerts Offline

```javascript
// Store an alert for offline access
const alert = {
  alertId: 'alert-123',
  eventType: 'earthquake',
  severity: 7,
  headline: 'Earthquake Alert',
  description: 'Magnitude 7.2 earthquake detected',
  location: {
    type: 'Point',
    coordinates: [-122.4194, 37.7749]
  },
  createdAt: Date.now()
};

await offlineManager.storeAlert(alert);
```

### Retrieving Alerts

```javascript
// Get all alerts
const allAlerts = await offlineManager.getAlerts();

// Get filtered alerts
const earthquakeAlerts = await offlineManager.getAlerts({
  eventType: 'earthquake',
  minSeverity: 5
});

// Get specific alert
const alert = await offlineManager.offlineStorage.getAlert('alert-123');
```

### User Preferences

```javascript
// Store user preferences
const preferences = {
  userId: 'user-456',
  alertCategories: ['earthquake', 'fire', 'weather'],
  notificationChannels: ['email', 'sms'],
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 50
  }
};

await offlineManager.storeUserPreferences('user-456', preferences);

// Retrieve user preferences
const userPrefs = await offlineManager.getUserPreferences('user-456');
```

### Synchronization

```javascript
// Check sync status
const syncStatus = await offlineManager.getSyncStatus();
console.log('Pending operations:', syncStatus.pendingOperations);
console.log('Last sync:', new Date(syncStatus.lastSyncTimestamp));

// Force synchronization
if (navigator.onLine) {
  await offlineManager.forceSync();
}
```

### Conflict Resolution

```javascript
// Get unresolved conflicts
const conflicts = await offlineManager.getConflicts();

// Auto-resolve conflicts using last-write-wins
const results = await offlineManager.autoResolveConflicts('last_write_wins');

// Manual conflict resolution
for (const conflict of conflicts) {
  if (conflict.requiresUserInput) {
    // Present options to user and get choice
    const userChoice = await presentConflictToUser(conflict);
    await offlineManager.resolveConflict(conflict.id, userChoice);
  }
}
```

### Offline Status Monitoring

```javascript
// Check offline capabilities
const offlineStatus = await offlineManager.getOfflineStatus();

console.log('Offline available:', offlineStatus.isAvailable);
console.log('Currently online:', offlineStatus.isOnline);
console.log('Storage stats:', offlineStatus.storageStats);
console.log('Unresolved conflicts:', offlineStatus.unresolvedConflicts);
```

## Event Handling

### Online/Offline Events

The synchronization service automatically handles online/offline events:

```javascript
// The service automatically starts/stops sync based on connectivity
window.addEventListener('online', () => {
  console.log('Connection restored - sync will resume');
});

window.addEventListener('offline', () => {
  console.log('Connection lost - switching to offline mode');
});
```

### Custom Event Handling

```javascript
// Listen for sync events (if implemented)
offlineManager.syncService.on('syncStart', () => {
  console.log('Synchronization started');
});

offlineManager.syncService.on('syncComplete', (results) => {
  console.log('Synchronization completed:', results);
});

offlineManager.syncService.on('conflictDetected', (conflict) => {
  console.log('Conflict detected:', conflict);
  // Handle conflict notification to user
});
```

## Error Handling

```javascript
try {
  await offlineManager.storeAlert(alert);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    // Handle storage quota exceeded
    console.error('Storage quota exceeded');
    // Optionally clear old data or notify user
  } else {
    console.error('Failed to store alert:', error);
  }
}
```

## Best Practices

### 1. Initialize Early
Initialize the offline manager early in your application lifecycle:

```javascript
// In your app initialization
async function initializeApp() {
  try {
    await offlineManager.initialize();
    console.log('Offline storage ready');
  } catch (error) {
    console.error('Offline storage unavailable:', error);
    // Fallback to online-only mode
  }
}
```

### 2. Handle Storage Limits
Monitor storage usage and clean up old data:

```javascript
const stats = await offlineManager.getStorageStats();
if (stats.alerts > 1000) {
  // Clean up old alerts
  const oldAlerts = await offlineManager.getAlerts({
    olderThan: Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days
  });
  
  for (const alert of oldAlerts) {
    await offlineManager.offlineStorage.deleteAlert(alert.alertId);
  }
}
```

### 3. Graceful Degradation
Always provide fallbacks for when offline storage is unavailable:

```javascript
async function getAlerts() {
  try {
    if (offlineManager.isOfflineModeAvailable()) {
      return await offlineManager.getAlerts();
    }
  } catch (error) {
    console.warn('Offline storage failed, falling back to API');
  }
  
  // Fallback to API call
  return await apiClient.getAlerts();
}
```

### 4. User Feedback
Provide clear feedback about offline status:

```javascript
function updateOfflineIndicator() {
  const indicator = document.getElementById('offline-indicator');
  
  if (navigator.onLine) {
    indicator.textContent = 'Online';
    indicator.className = 'status-online';
  } else {
    indicator.textContent = 'Offline';
    indicator.className = 'status-offline';
  }
}

window.addEventListener('online', updateOfflineIndicator);
window.addEventListener('offline', updateOfflineIndicator);
```

## Configuration

### Sync Intervals
Configure synchronization intervals based on your needs:

```javascript
// Start sync with custom interval (default is 30 seconds)
offlineManager.syncService.startPeriodicSync(60000); // 1 minute
```

### Storage Limits
Monitor and configure storage limits:

```javascript
// Check available storage
if ('storage' in navigator && 'estimate' in navigator.storage) {
  const estimate = await navigator.storage.estimate();
  console.log('Storage quota:', estimate.quota);
  console.log('Storage usage:', estimate.usage);
}
```

## Testing

The offline storage system includes comprehensive unit tests. Run them with:

```bash
npm test tests/unit/services/offline/
```

## Troubleshooting

### Common Issues

1. **IndexedDB not available**: Check browser compatibility
2. **Storage quota exceeded**: Implement data cleanup strategies
3. **Sync conflicts**: Review conflict resolution strategies
4. **Performance issues**: Consider data pagination and cleanup

### Debug Mode

Enable debug logging for troubleshooting:

```javascript
// Enable debug mode (if implemented)
offlineManager.setDebugMode(true);
```

This will provide detailed logging of storage operations, sync activities, and conflict resolution.