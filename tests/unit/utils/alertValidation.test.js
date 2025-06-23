/**
 * Unit tests for alert validation utilities
 */
import { validateAlert, prepareAlertForStorage, checkAlertSimilarity } from '../../../src/utils/alertValidation';
import { getGeohashFromGeoJson } from '../../../src/utils/geohash';

// Mock the geohash module
jest.mock('../../../src/utils/geohash', () => ({
  getGeohashFromGeoJson: jest.fn().mockReturnValue('abc123')
}));

describe('Alert Validation', () => {
  describe('validateAlert', () => {
    test('should validate a valid alert', () => {
      const validAlert = {
        sourceId: 'source-123',
        sourceType: 'WEATHER_SERVICE',
        category: 'WEATHER',
        eventType: 'TORNADO',
        severity: 'SEVERE',
        certainty: 'OBSERVED',
        headline: 'Tornado Warning',
        description: 'A tornado has been spotted in the area',
        startTime: '2023-06-01T12:00:00Z',
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };

      const result = validateAlert(validAlert);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const invalidAlert = {
        sourceId: 'source-123',
        // Missing sourceType
        category: 'WEATHER',
        // Missing eventType
        severity: 'SEVERE',
        certainty: 'OBSERVED',
        headline: 'Tornado Warning',
        // Missing description
        startTime: '2023-06-01T12:00:00Z',
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };

      const result = validateAlert(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: sourceType');
      expect(result.errors).toContain('Missing required field: eventType');
      expect(result.errors).toContain('Missing required field: description');
    });

    test('should validate location correctly', () => {
      const invalidLocationAlert = {
        sourceId: 'source-123',
        sourceType: 'WEATHER_SERVICE',
        category: 'WEATHER',
        eventType: 'TORNADO',
        severity: 'SEVERE',
        certainty: 'OBSERVED',
        headline: 'Tornado Warning',
        description: 'A tornado has been spotted in the area',
        startTime: '2023-06-01T12:00:00Z',
        status: 'ACTIVE',
        location: {
          type: 'InvalidType',
          coordinates: [-122.4194, 37.7749]
        }
      };

      const result = validateAlert(invalidLocationAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid location type: InvalidType. Must be one of: Point, Polygon, MultiPolygon');
    });

    test('should validate date ranges correctly', () => {
      const invalidDateAlert = {
        sourceId: 'source-123',
        sourceType: 'WEATHER_SERVICE',
        category: 'WEATHER',
        eventType: 'TORNADO',
        severity: 'SEVERE',
        certainty: 'OBSERVED',
        headline: 'Tornado Warning',
        description: 'A tornado has been spotted in the area',
        startTime: '2023-06-01T12:00:00Z',
        endTime: '2023-06-01T10:00:00Z', // End time before start time
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };

      const result = validateAlert(invalidDateAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End time must be after start time');
    });
  });

  describe('prepareAlertForStorage', () => {
    test('should add locationHash if not present', () => {
      const alert = {
        sourceId: 'source-123',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };

      const prepared = prepareAlertForStorage(alert);
      expect(prepared.locationHash).toBe('abc123');
      expect(getGeohashFromGeoJson).toHaveBeenCalledWith(alert.location);
    });

    test('should add version if not present', () => {
      const alert = {
        sourceId: 'source-123'
      };

      const prepared = prepareAlertForStorage(alert);
      expect(prepared.version).toBe(1);
    });

    test('should add timestamps if not present', () => {
      const alert = {
        sourceId: 'source-123'
      };

      const prepared = prepareAlertForStorage(alert);
      expect(prepared.createdAt).toBeDefined();
      expect(prepared.updatedAt).toBeDefined();
    });

    test('should not overwrite existing values', () => {
      const alert = {
        sourceId: 'source-123',
        locationHash: 'existing-hash',
        version: 5,
        createdAt: '2023-01-01T00:00:00Z'
      };

      const prepared = prepareAlertForStorage(alert);
      expect(prepared.locationHash).toBe('existing-hash');
      expect(prepared.version).toBe(5);
      expect(prepared.createdAt).toBe('2023-01-01T00:00:00Z');
      expect(prepared.updatedAt).toBeDefined(); // updatedAt should always be updated
    });
  });

  describe('checkAlertSimilarity', () => {
    test('should identify duplicate alerts with same sourceId', () => {
      const alert1 = {
        sourceId: 'source-123',
        eventType: 'TORNADO',
        category: 'WEATHER'
      };

      const alert2 = {
        sourceId: 'source-123',
        eventType: 'DIFFERENT',
        category: 'DIFFERENT'
      };

      const result = checkAlertSimilarity(alert1, alert2);
      expect(result.isDuplicate).toBe(true);
      expect(result.similarity).toBe(10);
    });

    test('should calculate similarity based on multiple factors', () => {
      const alert1 = {
        sourceId: 'source-123',
        eventType: 'TORNADO',
        category: 'WEATHER',
        locationHash: 'abc123',
        startTime: '2023-06-01T12:00:00Z',
        headline: 'Tornado Warning for San Francisco'
      };

      const alert2 = {
        sourceId: 'source-456',
        eventType: 'TORNADO',
        category: 'WEATHER',
        locationHash: 'abc456', // First 3 chars match
        startTime: '2023-06-01T12:30:00Z', // 30 minutes later
        headline: 'Tornado Warning issued for San Francisco area'
      };

      const result = checkAlertSimilarity(alert1, alert2);
      expect(result.similarity).toBeGreaterThan(0);
      // We don't test the exact score as it depends on the implementation details
    });

    test('should identify non-similar alerts', () => {
      const alert1 = {
        sourceId: 'source-123',
        eventType: 'TORNADO',
        category: 'WEATHER',
        locationHash: 'abc123',
        startTime: '2023-06-01T12:00:00Z',
        headline: 'Tornado Warning for San Francisco'
      };

      const alert2 = {
        sourceId: 'source-456',
        eventType: 'EARTHQUAKE',
        category: 'EARTHQUAKE',
        locationHash: 'xyz789', // Completely different
        startTime: '2023-06-02T12:00:00Z', // 24 hours later
        headline: 'Earthquake detected in Los Angeles'
      };

      const result = checkAlertSimilarity(alert1, alert2);
      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBeLessThan(8); // Threshold for duplication
    });
  });
});