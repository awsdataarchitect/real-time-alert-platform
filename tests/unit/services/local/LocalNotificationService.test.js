/**
 * Unit tests for LocalNotificationService
 */

import LocalNotificationService from '../../../../src/services/local/LocalNotificationService.js';

// Mock Notification API
const mockNotification = jest.fn();
mockNotification.permission = 'default';
mockNotification.requestPermission = jest.fn();
Object.defineProperty(global, 'Notification', {
  value: mockNotification,
  writable: true
});

// Mock ServiceWorkerRegistration
const mockServiceWorkerRegistration = {
  showNotification: jest.fn(),
  getNotifications: jest.fn(),
  sync: {
    register: jest.fn()
  }
};

// Mock navigator.serviceWorker
const mockServiceWorker = {
  register: jest.fn()
};
Object.defineProperty(global.navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true
});

// Mock ServiceWorkerRegistration prototype
global.ServiceWorkerRegistration = {
  prototype: {
    showNotification: jest.fn()
  }
};

describe('LocalNotificationService', () => {
  let service;

  beforeEach(() => {
    service = new LocalNotificationService();
    jest.clearAllMocks();
    
    // Reset notification permission
    mockNotification.permission = 'default';
    mockNotification.requestPermission.mockResolvedValue('granted');
    mockServiceWorker.register.mockResolvedValue(mockServiceWorkerRegistration);
  });

  describe('initialization', () => {
    test('should initialize with default values', () => {
      expect(service.permission).toBe('default');
      expect(service.serviceWorkerRegistration).toBeNull();
      expect(service.notificationQueue).toEqual([]);
    });

    test('should initialize successfully with granted permission', async () => {
      mockNotification.permission = 'granted';
      
      const result = await service.initialize();
      
      expect(result).toBe(true);
      expect(mockServiceWorker.register).toHaveBeenCalledWith(
        '/sw-alert-processor.js',
        { scope: '/' }
      );
    });

    test('should handle initialization failure', async () => {
      mockServiceWorker.register.mockRejectedValue(new Error('Registration failed'));
      
      const result = await service.initialize();
      
      expect(result).toBe(false);
    });
  });

  describe('requestPermission', () => {
    test('should request permission when default', async () => {
      mockNotification.permission = 'default';
      mockNotification.requestPermission.mockResolvedValue('granted');
      
      const permission = await service.requestPermission();
      
      expect(mockNotification.requestPermission).toHaveBeenCalled();
      expect(permission).toBe('granted');
      expect(service.permission).toBe('granted');
    });

    test('should not request permission when already granted', async () => {
      service.permission = 'granted';
      
      const permission = await service.requestPermission();
      
      expect(mockNotification.requestPermission).not.toHaveBeenCalled();
      expect(permission).toBe('granted');
    });

    test('should throw error when permission denied', async () => {
      mockNotification.permission = 'default';
      mockNotification.requestPermission.mockResolvedValue('denied');
      
      await expect(service.requestPermission()).rejects.toThrow('Notification permission denied');
    });
  });

  describe('show notification', () => {
    beforeEach(() => {
      service.permission = 'granted';
    });

    test('should show service worker notification when available', async () => {
      service.serviceWorkerRegistration = mockServiceWorkerRegistration;
      
      const notification = {
        title: 'Test Alert',
        body: 'Test notification body',
        tag: 'test-alert',
        data: { alertId: 'alert-123', severity: 'high' }
      };

      await service.show(notification);

      expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledWith(
        'Test Alert',
        expect.objectContaining({
          body: 'Test notification body',
          tag: 'test-alert',
          data: { alertId: 'alert-123', severity: 'high' }
        })
      );
    });

    test('should show browser notification as fallback', async () => {
      const mockBrowserNotification = {
        onclick: null,
        onclose: null,
        onerror: null,
        close: jest.fn()
      };
      mockNotification.mockReturnValue(mockBrowserNotification);

      const notification = {
        title: 'Test Alert',
        body: 'Test notification body',
        tag: 'test-alert'
      };

      const result = await service.show(notification);

      expect(mockNotification).toHaveBeenCalledWith(
        'Test Alert',
        expect.objectContaining({
          body: 'Test notification body',
          tag: 'test-alert'
        })
      );
      expect(result).toBe(mockBrowserNotification);
    });

    test('should not show notification without permission', async () => {
      service.permission = 'denied';
      
      const notification = {
        title: 'Test Alert',
        body: 'Test notification body'
      };

      const result = await service.show(notification);

      expect(result).toBeNull();
      expect(mockServiceWorkerRegistration.showNotification).not.toHaveBeenCalled();
    });

    test('should queue notification on error', async () => {
      service.serviceWorkerRegistration = mockServiceWorkerRegistration;
      mockServiceWorkerRegistration.showNotification.mockRejectedValue(new Error('Show failed'));
      
      const notification = {
        title: 'Test Alert',
        body: 'Test notification body'
      };

      await expect(service.show(notification)).rejects.toThrow('Show failed');
      expect(service.notificationQueue).toHaveLength(1);
    });
  });

  describe('getVibrationPattern', () => {
    test('should return critical pattern for critical severity', () => {
      const pattern = service.getVibrationPattern('critical');
      expect(pattern).toEqual([200, 100, 200, 100, 200]);
    });

    test('should return high pattern for high severity', () => {
      const pattern = service.getVibrationPattern('high');
      expect(pattern).toEqual([200, 100, 200]);
    });

    test('should return medium pattern for unknown severity', () => {
      const pattern = service.getVibrationPattern('unknown');
      expect(pattern).toEqual([200]);
    });

    test('should return no vibration for low severity', () => {
      const pattern = service.getVibrationPattern('low');
      expect(pattern).toEqual([]);
    });
  });

  describe('handleNotificationClick', () => {
    const originalLocation = window.location;
    const mockFocus = jest.fn();

    beforeEach(() => {
      delete window.location;
      window.location = { pathname: '/', href: '' };
      window.focus = mockFocus;
    });

    afterEach(() => {
      window.location = originalLocation;
      delete window.focus;
    });

    test('should navigate to alert details', () => {
      const data = { alertId: 'alert-123' };
      
      service.handleNotificationClick(data);
      
      expect(window.location.href).toBe('/alerts/alert-123');
    });

    test('should focus window', () => {
      const data = { alertId: 'alert-123' };
      
      service.handleNotificationClick(data);
      
      expect(mockFocus).toHaveBeenCalled();
    });

    test('should handle missing data gracefully', () => {
      expect(() => service.handleNotificationClick(null)).not.toThrow();
      expect(() => service.handleNotificationClick({})).not.toThrow();
    });
  });

  describe('queue management', () => {
    test('should process queued notifications successfully', async () => {
      service.permission = 'granted';
      service.serviceWorkerRegistration = mockServiceWorkerRegistration;
      
      // Add notifications to queue
      service.queueNotification({ title: 'Test 1', body: 'Body 1' });
      service.queueNotification({ title: 'Test 2', body: 'Body 2' });
      
      expect(service.notificationQueue).toHaveLength(2);
      
      await service.processQueue();
      
      expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledTimes(2);
      expect(service.notificationQueue).toHaveLength(0);
    });

    test('should retry failed notifications up to 3 times', async () => {
      service.permission = 'granted';
      service.serviceWorkerRegistration = mockServiceWorkerRegistration;
      mockServiceWorkerRegistration.showNotification.mockRejectedValue(new Error('Failed'));
      
      service.queueNotification({ title: 'Test', body: 'Body' });
      
      // Process queue multiple times to trigger retries
      await expect(service.processQueue()).rejects.toThrow();
      expect(service.notificationQueue).toHaveLength(1);
      expect(service.notificationQueue[0].retryCount).toBe(1);
      
      await expect(service.processQueue()).rejects.toThrow();
      expect(service.notificationQueue[0].retryCount).toBe(2);
      
      await expect(service.processQueue()).rejects.toThrow();
      expect(service.notificationQueue).toHaveLength(0); // Removed after 3 retries
    });
  });

  describe('notification management', () => {
    beforeEach(() => {
      service.serviceWorkerRegistration = mockServiceWorkerRegistration;
    });

    test('should clear notifications with specific tag', async () => {
      const mockNotifications = [
        { close: jest.fn() },
        { close: jest.fn() }
      ];
      mockServiceWorkerRegistration.getNotifications.mockResolvedValue(mockNotifications);
      
      await service.clearNotifications('test-tag');
      
      expect(mockServiceWorkerRegistration.getNotifications).toHaveBeenCalledWith({ tag: 'test-tag' });
      mockNotifications.forEach(notification => {
        expect(notification.close).toHaveBeenCalled();
      });
    });

    test('should clear all notifications', async () => {
      const mockNotifications = [
        { close: jest.fn() },
        { close: jest.fn() },
        { close: jest.fn() }
      ];
      mockServiceWorkerRegistration.getNotifications.mockResolvedValue(mockNotifications);
      
      await service.clearAllNotifications();
      
      expect(mockServiceWorkerRegistration.getNotifications).toHaveBeenCalledWith();
      mockNotifications.forEach(notification => {
        expect(notification.close).toHaveBeenCalled();
      });
    });

    test('should get active notifications', async () => {
      const mockNotifications = [{ id: 1 }, { id: 2 }];
      mockServiceWorkerRegistration.getNotifications.mockResolvedValue(mockNotifications);
      
      const notifications = await service.getActiveNotifications();
      
      expect(notifications).toEqual(mockNotifications);
    });
  });

  describe('support detection', () => {
    test('should detect notification support', () => {
      expect(service.isSupported()).toBe(true);
    });

    test('should detect service worker support', () => {
      expect(service.isServiceWorkerSupported()).toBe(true);
    });
  });

  describe('getStats', () => {
    test('should return service statistics', () => {
      service.permission = 'granted';
      service.serviceWorkerRegistration = mockServiceWorkerRegistration;
      service.notificationQueue = [{ notification: {} }];
      
      const stats = service.getStats();
      
      expect(stats).toEqual({
        permission: 'granted',
        supported: true,
        serviceWorkerSupported: true,
        queueSize: 1,
        hasServiceWorker: true
      });
    });
  });

  describe('testNotification', () => {
    test('should send test notification successfully', async () => {
      service.permission = 'granted';
      service.serviceWorkerRegistration = mockServiceWorkerRegistration;
      
      const result = await service.testNotification();
      
      expect(result).toBe(true);
      expect(mockServiceWorkerRegistration.showNotification).toHaveBeenCalledWith(
        'Test Notification',
        expect.objectContaining({
          body: 'This is a test notification from the alert system.',
          tag: 'test-notification'
        })
      );
    });

    test('should handle test notification failure', async () => {
      service.permission = 'granted';
      service.serviceWorkerRegistration = mockServiceWorkerRegistration;
      mockServiceWorkerRegistration.showNotification.mockRejectedValue(new Error('Test failed'));
      
      const result = await service.testNotification();
      
      expect(result).toBe(false);
    });
  });
});