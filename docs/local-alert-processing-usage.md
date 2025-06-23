# Local Alert Processing Usage Guide

This document explains how to use the local alert processing capabilities for edge computing scenarios with limited connectivity.

## Overview

The local alert processing system consists of:
- **LocalAlertProcessor**: Handles alert classification and processing on the client side
- **LocalNotificationService**: Manages browser notifications
- **Service Worker**: Provides background processing capabilities

## Basic Usage

### 1. Initialize the Services

```javascript
import { LocalAlertProcessor, LocalNotificationService } from '../src/services/local';

// Initialize notification service
const notificationService = new LocalNotificationService();
await notificationService.initialize();

// Initialize alert processor
const alertProcessor = new LocalAlertProcessor();
alertProcessor.setNotificationService(notificationService);
```

### 2. Process Incoming Alerts

```javascript
// Example alert data
const alertData = {
  id: 'alert-123',
  type: 'earthquake',
  title: 'Earthquake Alert',
  description: 'Magnitude 5.0 earthquake detected near city center',
  timestamp: '2023-01-01T00:00:00Z',
  location: {
    latitude: 40.7128,
    longitude: -74.0060
  }
};

// Process the alert
try {
  const processedAlert = await alertProcessor.processAlert(alertData);
  console.log('Alert processed:', processedAlert);
} catch (error) {
  console.error('Error processing alert:', error);
}
```

### 3. Register Service Worker

```javascript
// Register the service worker for background processing
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-alert-processor.js')
    .then(registration => {
      console.log('Service worker registered:', registration);
      
      // Send alerts to service worker for processing
      registration.active.postMessage({
        type: 'process-alert',
        data: alertData
      });
    })
    .catch(error => {
      console.error('Service worker registration failed:', error);
    });
}
```

## Alert Classification

The system uses keyword-based classification with the following categories:

### Severity Levels
- **Critical**: earthquake, tsunami, tornado, fire, flood, chemical
- **High**: severe_weather, health_emergency, security_threat  
- **Medium**: weather_warning, traffic_alert, air_quality
- **Low**: general_info, maintenance, advisory

### Alert Types
- **Earthquake**: earthquake, seismic, tremor, magnitude
- **Fire**: fire, wildfire, smoke, evacuation
- **Weather**: storm, hurricane, tornado, flood, snow, ice
- **Health**: outbreak, disease, contamination, medical
- **Security**: threat, attack, suspicious, lockdown

## Notification Behavior

Notifications are triggered based on:

1. **Always notify**: Critical severity alerts
2. **Conditional notify**: High severity alerts within proximity threshold (50km)
3. **Urgent notify**: Any alert within urgency radius (10km)

## Offline Capabilities

The system provides offline functionality through:

### Local Storage
- Alerts are stored in IndexedDB for offline access
- Processing queue is maintained in browser cache
- Device preferences are stored in localStorage

### Background Sync
- Queued alerts are synchronized when connectivity is restored
- Service worker handles background synchronization
- Failed sync attempts are retried with exponential backoff

### Example: Handling Offline Scenarios

```javascript
// Check online status
if (!navigator.onLine) {
  console.log('Offline mode - alerts will be queued for sync');
}

// Listen for online events
window.addEventListener('online', () => {
  console.log('Back online - syncing queued alerts');
  // Service worker will automatically handle sync
});

// Get queued alerts
const queuedAlerts = alertProcessor.getQueuedAlerts();
console.log(`${queuedAlerts.length} alerts queued for sync`);
```

## Testing

### Test Notification Functionality

```javascript
// Test if notifications work
const testResult = await notificationService.testNotification();
if (testResult) {
  console.log('Notifications are working');
} else {
  console.log('Notification test failed');
}
```

### Get Processing Statistics

```javascript
// Get processor statistics
const stats = alertProcessor.getStats();
console.log('Processing stats:', stats);

// Get notification service statistics  
const notificationStats = notificationService.getStats();
console.log('Notification stats:', notificationStats);
```

## Error Handling

The system includes comprehensive error handling:

```javascript
try {
  await alertProcessor.processAlert(alertData);
} catch (error) {
  if (error.message === 'Invalid alert data') {
    console.error('Alert validation failed:', error);
  } else {
    console.error('Processing error:', error);
  }
}
```

## Performance Considerations

### Resource Optimization
- Classification uses lightweight keyword matching
- Geolocation requests are cached for 5 minutes
- Service worker minimizes battery usage
- Notifications are throttled to prevent spam

### Memory Management
- Alert queue is automatically cleared after sync
- Old notifications are cleaned up periodically
- IndexedDB storage is managed efficiently

## Browser Compatibility

### Required Features
- Service Workers (for background processing)
- Notifications API (for local notifications)
- IndexedDB (for offline storage)
- Geolocation API (for proximity detection)

### Fallback Behavior
- Graceful degradation when features are unavailable
- Browser notifications fallback when service worker unavailable
- Local processing continues without geolocation

## Security Considerations

- All data is processed locally on the device
- No sensitive information is transmitted during offline mode
- Device ID generation uses secure random values
- Notification permissions are properly requested and managed