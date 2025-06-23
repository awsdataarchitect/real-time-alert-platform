/**
 * Local Notification Service
 * Handles browser notifications for local alert processing
 */

class LocalNotificationService {
  constructor() {
    this.permission = Notification.permission;
    this.serviceWorkerRegistration = null;
    this.notificationQueue = [];
  }

  /**
   * Initialize notification service
   */
  async initialize() {
    try {
      // Request notification permission
      await this.requestPermission();
      
      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register(
          '/sw-alert-processor.js',
          { scope: '/' }
        );
        console.log('Service worker registered for notifications');
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission() {
    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }
    
    if (this.permission !== 'granted') {
      throw new Error('Notification permission denied');
    }
    
    return this.permission;
  }

  /**
   * Show notification
   */
  async show(notification) {
    try {
      if (this.permission !== 'granted') {
        console.warn('Cannot show notification: permission not granted');
        return null;
      }

      // Use service worker for persistent notifications if available
      if (this.serviceWorkerRegistration) {
        return await this.showServiceWorkerNotification(notification);
      } else {
        return await this.showBrowserNotification(notification);
      }
    } catch (error) {
      console.error('Error showing notification:', error);
      // Queue notification for retry
      this.queueNotification(notification);
      throw error;
    }
  }

  /**
   * Show notification via service worker
   */
  async showServiceWorkerNotification(notification) {
    const options = {
      body: notification.body,
      icon: notification.icon || '/icons/alert-default.png',
      badge: notification.badge || '/badges/default.png',
      tag: notification.tag,
      data: notification.data,
      requireInteraction: notification.requireInteraction || false,
      silent: notification.silent || false,
      vibrate: this.getVibrationPattern(notification.data?.severity),
      actions: notification.actions || [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icons/view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ]
    };

    await this.serviceWorkerRegistration.showNotification(notification.title, options);
    console.log('Service worker notification shown:', notification.tag);
  }

  /**
   * Show browser notification (fallback)
   */
  async showBrowserNotification(notification) {
    const options = {
      body: notification.body,
      icon: notification.icon || '/icons/alert-default.png',
      tag: notification.tag,
      data: notification.data,
      requireInteraction: notification.requireInteraction || false,
      silent: notification.silent || false
    };

    const browserNotification = new Notification(notification.title, options);
    
    // Handle notification events
    browserNotification.onclick = (event) => {
      event.preventDefault();
      this.handleNotificationClick(notification.data);
      browserNotification.close();
    };

    browserNotification.onclose = () => {
      console.log('Notification closed:', notification.tag);
    };

    browserNotification.onerror = (error) => {
      console.error('Notification error:', error);
    };

    return browserNotification;
  }

  /**
   * Get vibration pattern based on severity
   */
  getVibrationPattern(severity) {
    const patterns = {
      critical: [200, 100, 200, 100, 200], // Urgent pattern
      high: [200, 100, 200], // Important pattern
      medium: [200], // Single vibration
      low: [] // No vibration
    };
    
    return patterns[severity] || patterns.medium;
  }

  /**
   * Handle notification click
   */
  handleNotificationClick(data) {
    if (data && data.alertId) {
      // Navigate to alert details
      if (window.location.pathname !== `/alerts/${data.alertId}`) {
        window.location.href = `/alerts/${data.alertId}`;
      }
      
      // Focus window if it exists
      if (window.focus) {
        window.focus();
      }
    }
  }

  /**
   * Queue notification for retry
   */
  queueNotification(notification) {
    this.notificationQueue.push({
      notification,
      queuedAt: new Date().toISOString(),
      retryCount: 0
    });
  }

  /**
   * Process queued notifications
   */
  async processQueue() {
    if (this.notificationQueue.length === 0) return;

    const queue = [...this.notificationQueue];
    this.notificationQueue = [];

    for (const item of queue) {
      try {
        await this.show(item.notification);
        console.log('Queued notification processed:', item.notification.tag);
      } catch (error) {
        item.retryCount++;
        if (item.retryCount < 3) {
          this.notificationQueue.push(item);
        } else {
          console.error('Failed to process notification after 3 retries:', item.notification.tag);
        }
      }
    }
  }

  /**
   * Clear all notifications with specific tag
   */
  async clearNotifications(tag) {
    if (this.serviceWorkerRegistration) {
      const notifications = await this.serviceWorkerRegistration.getNotifications({ tag });
      notifications.forEach(notification => notification.close());
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications() {
    if (this.serviceWorkerRegistration) {
      const notifications = await this.serviceWorkerRegistration.getNotifications();
      notifications.forEach(notification => notification.close());
    }
  }

  /**
   * Get active notifications
   */
  async getActiveNotifications() {
    if (this.serviceWorkerRegistration) {
      return await this.serviceWorkerRegistration.getNotifications();
    }
    return [];
  }

  /**
   * Check if notifications are supported
   */
  isSupported() {
    return 'Notification' in window;
  }

  /**
   * Check if service worker notifications are supported
   */
  isServiceWorkerSupported() {
    return 'serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype;
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      permission: this.permission,
      supported: this.isSupported(),
      serviceWorkerSupported: this.isServiceWorkerSupported(),
      queueSize: this.notificationQueue.length,
      hasServiceWorker: !!this.serviceWorkerRegistration
    };
  }

  /**
   * Test notification functionality
   */
  async testNotification() {
    const testNotification = {
      title: 'Test Notification',
      body: 'This is a test notification from the alert system.',
      tag: 'test-notification',
      data: {
        alertId: 'test',
        severity: 'low',
        type: 'test'
      }
    };

    try {
      await this.show(testNotification);
      return true;
    } catch (error) {
      console.error('Test notification failed:', error);
      return false;
    }
  }
}

export default LocalNotificationService;