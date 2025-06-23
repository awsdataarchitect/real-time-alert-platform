/**
 * Unit tests for LocalAlertProcessor
 */

import LocalAlertProcessor from '../../../../src/services/local/LocalAlertProcessor.js';

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn()
};
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('LocalAlertProcessor', () => {
  let processor;
  let mockNotificationService;

  beforeEach(() => {
    processor = new LocalAlertProcessor();
    mockNotificationService = {
      show: jest.fn().mockResolvedValue(true)
    };
    processor.setNotificationService(mockNotificationService);
    
    // Reset mocks
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('test-device-123');
  });

  describe('initialization', () => {
    test('should initialize with default processing rules', () => {
      expect(processor.processingRules).toBeDefined();
      expect(processor.processingRules.severity).toBeDefined();
      expect(processor.processingRules.keywords).toBeDefined();
      expect(processor.processingRules.geospatial).toBeDefined();
    });

    test('should initialize empty alert queue', () => {
      expect(processor.alertQueue).toEqual([]);
    });
  });

  describe('validateAlert', () => {
    test('should validate alert with required fields', () => {
      const validAlert = {
        id: 'alert-123',
        type: 'earthquake',
        description: 'Magnitude 5.0 earthquake detected',
        timestamp: '2023-01-01T00:00:00Z'
      };

      expect(processor.validateAlert(validAlert)).toBe(true);
    });

    test('should reject alert missing required fields', () => {
      const invalidAlert = {
        id: 'alert-123',
        type: 'earthquake'
        // missing description and timestamp
      };

      expect(processor.validateAlert(invalidAlert)).toBe(false);
    });

    test('should reject null or undefined alert', () => {
      expect(processor.validateAlert(null)).toBe(false);
      expect(processor.validateAlert(undefined)).toBe(false);
    });
  });

  describe('classifyAlert', () => {
    test('should classify earthquake alert correctly', () => {
      const alert = {
        id: 'alert-123',
        type: 'seismic',
        title: 'Earthquake Alert',
        description: 'Magnitude 6.0 earthquake detected near city center',
        timestamp: '2023-01-01T00:00:00Z'
      };

      const classified = processor.classifyAlert(alert);

      expect(classified.classifiedType).toBe('earthquake');
      expect(classified.severity).toBe('critical');
      expect(classified.confidence).toBeGreaterThan(0);
      expect(classified.processedLocally).toBe(true);
    });

    test('should classify fire alert correctly', () => {
      const alert = {
        id: 'alert-456',
        type: 'fire',
        title: 'Wildfire Alert',
        description: 'Large wildfire spreading rapidly, evacuation recommended',
        timestamp: '2023-01-01T00:00:00Z'
      };

      const classified = processor.classifyAlert(alert);

      expect(classified.classifiedType).toBe('fire');
      expect(classified.severity).toBe('critical');
    });

    test('should classify weather alert correctly', () => {
      const alert = {
        id: 'alert-789',
        type: 'weather',
        title: 'Storm Warning',
        description: 'Severe thunderstorm approaching with high winds',
        timestamp: '2023-01-01T00:00:00Z'
      };

      const classified = processor.classifyAlert(alert);

      expect(classified.classifiedType).toBe('weather');
      expect(classified.severity).toBe('high');
    });

    test('should default to general type for unrecognized content', () => {
      const alert = {
        id: 'alert-999',
        type: 'unknown',
        title: 'Random Alert',
        description: 'Some random information',
        timestamp: '2023-01-01T00:00:00Z'
      };

      const classified = processor.classifyAlert(alert);

      expect(classified.classifiedType).toBe('general');
      expect(classified.severity).toBe('low');
    });
  });

  describe('calculateConfidence', () => {
    test('should calculate high confidence for multiple keyword matches', () => {
      const content = 'earthquake magnitude seismic tremor detected';
      const confidence = processor.calculateConfidence(content, 'earthquake');
      
      expect(confidence).toBeGreaterThan(0.5);
    });

    test('should calculate low confidence for few keyword matches', () => {
      const content = 'earthquake detected';
      const confidence = processor.calculateConfidence(content, 'earthquake');
      
      expect(confidence).toBeLessThan(1.0);
    });

    test('should return 0 confidence for no matches', () => {
      const content = 'random text with no keywords';
      const confidence = processor.calculateConfidence(content, 'earthquake');
      
      expect(confidence).toBe(0);
    });
  });

  describe('calculateDistance', () => {
    test('should calculate distance between two points', () => {
      const point1 = { latitude: 40.7128, longitude: -74.0060 }; // NYC
      const point2 = { latitude: 34.0522, longitude: -118.2437 }; // LA
      
      const distance = processor.calculateDistance(point1, point2);
      
      // Distance between NYC and LA is approximately 3,944 km
      expect(distance).toBeGreaterThan(3900000); // 3900 km in meters
      expect(distance).toBeLessThan(4000000); // 4000 km in meters
    });

    test('should return 0 for same points', () => {
      const point = { latitude: 40.7128, longitude: -74.0060 };
      
      const distance = processor.calculateDistance(point, point);
      
      expect(distance).toBe(0);
    });
  });

  describe('shouldNotify', () => {
    test('should notify for critical alerts', () => {
      const alert = { severity: 'critical' };
      
      expect(processor.shouldNotify(alert)).toBe(true);
    });

    test('should notify for high severity nearby alerts', () => {
      const alert = { 
        severity: 'high',
        isNearby: true
      };
      
      expect(processor.shouldNotify(alert)).toBe(true);
    });

    test('should notify for alerts within urgency radius', () => {
      const alert = { 
        severity: 'medium',
        distanceFromUser: 5000 // 5km - within urgency radius
      };
      
      expect(processor.shouldNotify(alert)).toBe(true);
    });

    test('should not notify for low severity distant alerts', () => {
      const alert = { 
        severity: 'low',
        isNearby: false,
        distanceFromUser: 50000 // 50km - outside urgency radius
      };
      
      expect(processor.shouldNotify(alert)).toBe(false);
    });
  });

  describe('generateNotificationTitle', () => {
    test('should generate critical alert title', () => {
      const alert = { severity: 'critical', classifiedType: 'earthquake' };
      
      const title = processor.generateNotificationTitle(alert);
      
      expect(title).toContain('🚨 CRITICAL ALERT');
      expect(title).toContain('EARTHQUAKE');
    });

    test('should generate high priority alert title', () => {
      const alert = { severity: 'high', classifiedType: 'fire' };
      
      const title = processor.generateNotificationTitle(alert);
      
      expect(title).toContain('⚠️ HIGH PRIORITY');
      expect(title).toContain('FIRE');
    });
  });

  describe('generateNotificationBody', () => {
    test('should include description in notification body', () => {
      const alert = { 
        description: 'Test alert description',
        confidence: 0.9
      };
      
      const body = processor.generateNotificationBody(alert);
      
      expect(body).toContain('Test alert description');
    });

    test('should include distance information when available', () => {
      const alert = { 
        description: 'Test alert',
        distanceFromUser: 15000, // 15km
        confidence: 0.9
      };
      
      const body = processor.generateNotificationBody(alert);
      
      expect(body).toContain('15km from your location');
    });

    test('should include confidence warning for low confidence', () => {
      const alert = { 
        description: 'Test alert',
        confidence: 0.5 // Low confidence
      };
      
      const body = processor.generateNotificationBody(alert);
      
      expect(body).toContain('Automated classification - verify details');
    });
  });

  describe('processAlert', () => {
    test('should process valid alert successfully', async () => {
      const alert = {
        id: 'alert-123',
        type: 'earthquake',
        title: 'Earthquake Alert',
        description: 'Magnitude 5.0 earthquake detected',
        timestamp: '2023-01-01T00:00:00Z'
      };

      const processed = await processor.processAlert(alert);

      expect(processed.classifiedType).toBe('earthquake');
      expect(processed.severity).toBe('critical');
      expect(processed.processedLocally).toBe(true);
      expect(processor.alertQueue).toHaveLength(1);
    });

    test('should throw error for invalid alert', async () => {
      const invalidAlert = { id: 'invalid' };

      await expect(processor.processAlert(invalidAlert)).rejects.toThrow('Invalid alert data');
    });

    test('should send notification for critical alert', async () => {
      const alert = {
        id: 'alert-critical',
        type: 'earthquake',
        title: 'Critical Earthquake',
        description: 'Major earthquake detected',
        timestamp: '2023-01-01T00:00:00Z'
      };

      await processor.processAlert(alert);

      expect(mockNotificationService.show).toHaveBeenCalled();
    });
  });

  describe('enrichAlert', () => {
    test('should add local timestamp and device ID', async () => {
      const alert = {
        id: 'alert-123',
        type: 'test'
      };

      const enriched = await processor.enrichAlert(alert);

      expect(enriched.localTimestamp).toBeDefined();
      expect(enriched.deviceId).toBe('test-device-123');
    });

    test('should add geospatial context when location available', async () => {
      const alert = {
        id: 'alert-123',
        type: 'test',
        location: { latitude: 40.7128, longitude: -74.0060 }
      };

      // Mock successful geolocation
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 40.7500,
            longitude: -74.0000
          }
        });
      });

      const enriched = await processor.enrichAlert(alert);

      expect(enriched.distanceFromUser).toBeDefined();
      expect(enriched.isNearby).toBeDefined();
    });
  });

  describe('getDeviceId', () => {
    test('should return stored device ID', () => {
      localStorageMock.getItem.mockReturnValue('stored-device-id');
      
      const deviceId = processor.getDeviceId();
      
      expect(deviceId).toBe('stored-device-id');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('deviceId');
    });

    test('should generate and store new device ID if none exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const deviceId = processor.getDeviceId();
      
      expect(deviceId).toMatch(/^device_[a-z0-9]{9}$/);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('deviceId', deviceId);
    });
  });

  describe('queue management', () => {
    test('should return queued alerts', () => {
      processor.alertQueue = [{ id: 'alert-1' }, { id: 'alert-2' }];
      
      const queued = processor.getQueuedAlerts();
      
      expect(queued).toHaveLength(2);
      expect(queued[0].id).toBe('alert-1');
    });

    test('should clear queue', () => {
      processor.alertQueue = [{ id: 'alert-1' }, { id: 'alert-2' }];
      
      processor.clearQueue();
      
      expect(processor.alertQueue).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    test('should return processing statistics', () => {
      processor.alertQueue = [
        { id: 'alert-1', processedAt: '2023-01-01T00:00:00Z' }
      ];
      
      const stats = processor.getStats();
      
      expect(stats.queueSize).toBe(1);
      expect(stats.lastProcessed).toBe('2023-01-01T00:00:00Z');
      expect(stats.rulesVersion).toBeDefined();
    });

    test('should handle empty queue', () => {
      const stats = processor.getStats();
      
      expect(stats.queueSize).toBe(0);
      expect(stats.lastProcessed).toBeNull();
    });
  });
});