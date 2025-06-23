/**
 * Unit tests for consolidateAlerts Lambda function
 */

import { 
  calculateAlertSimilarity,
  calculateDistance,
  toRadians,
  getCommonPrefixLength,
  calculateTimeOverlap,
  findSimilarAlertGroups,
  consolidateAlertGroup,
  getRecentAlerts,
  markAlertsAsConsolidated,
  createConsolidatedAlert,
  processAlertBatch,
  handler
} from '../../src/lambda/consolidateAlerts';

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    scan: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    }
  };
});

// Mock string-similarity
jest.mock('string-similarity', () => ({
  compareTwoStrings: jest.fn((str1, str2) => {
    // Simple mock implementation for testing
    if (str1 === str2) return 1;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    return 0.2;
  })
}));

describe('consolidateAlerts Lambda', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('calculateDistance', () => {
    test('should calculate distance between two points correctly', () => {
      // New York to Los Angeles ~3,944 km
      const distance = calculateDistance(40.7128, -74.0060, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });
    
    test('should return 0 for identical points', () => {
      const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBeCloseTo(0);
    });
  });
  
  describe('toRadians', () => {
    test('should convert degrees to radians correctly', () => {
      expect(toRadians(180)).toBeCloseTo(Math.PI);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
      expect(toRadians(0)).toBeCloseTo(0);
    });
  });
  
  describe('getCommonPrefixLength', () => {
    test('should return correct common prefix length', () => {
      expect(getCommonPrefixLength('abc123', 'abc456')).toBe(3);
      expect(getCommonPrefixLength('xyz', 'abc')).toBe(0);
      expect(getCommonPrefixLength('same', 'same')).toBe(4);
      expect(getCommonPrefixLength('short', 'shorter')).toBe(5);
    });
  });
  
  describe('calculateTimeOverlap', () => {
    test('should return 0 for non-overlapping time ranges', () => {
      const start1 = new Date('2023-01-01T10:00:00Z');
      const end1 = new Date('2023-01-01T12:00:00Z');
      const start2 = new Date('2023-01-01T14:00:00Z');
      const end2 = new Date('2023-01-01T16:00:00Z');
      
      expect(calculateTimeOverlap(start1, end1, start2, end2)).toBe(0);
    });
    
    test('should calculate partial overlap correctly', () => {
      const start1 = new Date('2023-01-01T10:00:00Z');
      const end1 = new Date('2023-01-01T13:00:00Z');
      const start2 = new Date('2023-01-01T12:00:00Z');
      const end2 = new Date('2023-01-01T15:00:00Z');
      
      // 1 hour overlap in 6 hour total duration
      const expectedOverlap = 1 / 3; // 1 hour overlap / 3 hour average duration
      expect(calculateTimeOverlap(start1, end1, start2, end2)).toBeCloseTo(expectedOverlap);
    });
    
    test('should return high score for identical time ranges', () => {
      const start1 = new Date('2023-01-01T10:00:00Z');
      const end1 = new Date('2023-01-01T12:00:00Z');
      const start2 = new Date('2023-01-01T10:00:00Z');
      const end2 = new Date('2023-01-01T12:00:00Z');
      
      expect(calculateTimeOverlap(start1, end1, start2, end2)).toBe(1);
    });
  });
  
  describe('calculateAlertSimilarity', () => {
    test('should calculate high similarity for nearly identical alerts', () => {
      const alert1 = {
        headline: 'Earthquake near San Francisco',
        description: 'A 5.2 magnitude earthquake occurred near San Francisco.',
        eventType: 'earthquake',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        },
        startTime: '2023-01-01T10:00:00Z',
        endTime: '2023-01-01T12:00:00Z'
      };
      
      const alert2 = {
        headline: 'Earthquake near San Francisco',
        description: 'A 5.2 magnitude earthquake occurred near San Francisco Bay Area.',
        eventType: 'earthquake',
        location: {
          type: 'Point',
          coordinates: [-122.4200, 37.7745]
        },
        startTime: '2023-01-01T10:05:00Z',
        endTime: '2023-01-01T12:00:00Z'
      };
      
      const similarity = calculateAlertSimilarity(alert1, alert2);
      expect(similarity.overallScore).toBeGreaterThan(0.9);
    });
    
    test('should calculate low similarity for different alerts', () => {
      const alert1 = {
        headline: 'Earthquake near San Francisco',
        description: 'A 5.2 magnitude earthquake occurred near San Francisco.',
        eventType: 'earthquake',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };
      
      const alert2 = {
        headline: 'Flood warning in Miami',
        description: 'Heavy rainfall causing flooding in Miami-Dade county.',
        eventType: 'flood',
        location: {
          type: 'Point',
          coordinates: [-80.1918, 25.7617]
        }
      };
      
      const similarity = calculateAlertSimilarity(alert1, alert2);
      expect(similarity.overallScore).toBeLessThan(0.5);
    });
    
    test('should handle missing fields gracefully', () => {
      const alert1 = {
        headline: 'Earthquake near San Francisco',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749]
        }
      };
      
      const alert2 = {
        description: 'A 5.2 magnitude earthquake occurred near San Francisco.',
        eventType: 'earthquake'
      };
      
      const similarity = calculateAlertSimilarity(alert1, alert2);
      expect(similarity.overallScore).toBeGreaterThanOrEqual(0);
      expect(similarity.overallScore).toBeLessThanOrEqual(1);
    });
    
    test('should handle geohash-based location similarity', () => {
      const alert1 = {
        headline: 'Weather alert',
        geospatialData: {
          geohash: '9q8yyk'
        }
      };
      
      const alert2 = {
        headline: 'Weather alert',
        geospatialData: {
          geohash: '9q8yym'
        }
      };
      
      const similarity = calculateAlertSimilarity(alert1, alert2);
      expect(similarity.componentScores.location).toBeGreaterThan(0.8);
    });
  });
  
  describe('findSimilarAlertGroups', () => {
    test('should group similar alerts correctly', () => {
      const alerts = [
        {
          id: '1',
          headline: 'Earthquake in California',
          description: 'A 5.2 magnitude earthquake occurred in Northern California.',
          eventType: 'earthquake',
          location: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749]
          }
        },
        {
          id: '2',
          headline: 'Earthquake near San Francisco',
          description: 'A 5.0 magnitude earthquake occurred near San Francisco Bay Area.',
          eventType: 'earthquake',
          location: {
            type: 'Point',
            coordinates: [-122.4200, 37.7745]
          }
        },
        {
          id: '3',
          headline: 'Flood warning in Miami',
          description: 'Heavy rainfall causing flooding in Miami-Dade county.',
          eventType: 'flood',
          location: {
            type: 'Point',
            coordinates: [-80.1918, 25.7617]
          }
        },
        {
          id: '4',
          headline: 'Flash flood in Miami Beach',
          description: 'Flash flooding reported in Miami Beach area due to heavy rain.',
          eventType: 'flood',
          location: {
            type: 'Point',
            coordinates: [-80.1300, 25.7900]
          }
        }
      ];
      
      const groups = findSimilarAlertGroups(alerts);
      
      // Should find 2 groups: earthquakes and floods
      expect(groups.length).toBe(2);
      
      // Check that each group has the correct alerts
      const earthquakeGroup = groups.find(group => group[0].eventType === 'earthquake');
      const floodGroup = groups.find(group => group[0].eventType === 'flood');
      
      expect(earthquakeGroup).toBeDefined();
      expect(floodGroup).toBeDefined();
      
      expect(earthquakeGroup.length).toBe(2);
      expect(floodGroup.length).toBe(2);
      
      // Check that the correct IDs are in each group
      const earthquakeIds = earthquakeGroup.map(alert => alert.id).sort();
      const floodIds = floodGroup.map(alert => alert.id).sort();
      
      expect(earthquakeIds).toEqual(['1', '2']);
      expect(floodIds).toEqual(['3', '4']);
    });
    
    test('should not group dissimilar alerts', () => {
      const alerts = [
        {
          id: '1',
          headline: 'Earthquake in California',
          description: 'A 5.2 magnitude earthquake occurred in Northern California.',
          eventType: 'earthquake',
          location: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749]
          }
        },
        {
          id: '2',
          headline: 'Tornado warning in Kansas',
          description: 'Tornado warning issued for central Kansas.',
          eventType: 'tornado',
          location: {
            type: 'Point',
            coordinates: [-98.5000, 39.0000]
          }
        },
        {
          id: '3',
          headline: 'Hurricane approaching Florida',
          description: 'Category 3 hurricane approaching Florida coast.',
          eventType: 'hurricane',
          location: {
            type: 'Point',
            coordinates: [-81.5000, 27.0000]
          }
        }
      ];
      
      const groups = findSimilarAlertGroups(alerts);
      
      // No alerts should be grouped as they are all different
      expect(groups.length).toBe(0);
    });
  });
  
  describe('consolidateAlertGroup', () => {
    test('should create a consolidated alert from a group of similar alerts', () => {
      const alertGroup = [
        {
          id: '1',
          sourceId: 'source1',
          sourceType: 'USGS',
          headline: 'Earthquake in California',
          description: 'A 5.2 magnitude earthquake occurred in Northern California.',
          eventType: 'earthquake',
          location: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749]
          },
          parameters: {
            magnitude: '5.2',
            depth: '10km'
          },
          createdAt: '2023-01-01T10:00:00Z'
        },
        {
          id: '2',
          sourceId: 'source2',
          sourceType: 'EMSC',
          headline: 'Earthquake near San Francisco',
          description: 'A 5.0 magnitude earthquake occurred near San Francisco Bay Area. Some buildings reported minor damage.',
          eventType: 'earthquake',
          location: {
            type: 'Point',
            coordinates: [-122.4200, 37.7745]
          },
          parameters: {
            magnitude: '5.0',
            intensity: 'moderate'
          },
          geospatialData: {
            geohash: '9q8yyk',
            affectedArea: {
              type: 'Polygon',
              coordinates: [[[-122.5, 37.7], [-122.3, 37.7], [-122.3, 37.8], [-122.5, 37.8], [-122.5, 37.7]]]
            }
          },
          createdAt: '2023-01-01T10:05:00Z'
        }
      ];
      
      const consolidated = consolidateAlertGroup(alertGroup);
      
      // Check that the consolidated alert has the expected properties
      expect(consolidated.id).toBe('1');
      expect(consolidated.consolidatedFrom).toEqual(['1', '2']);
      expect(consolidated.sourceCount).toBe(2);
      expect(consolidated.sources.length).toBe(2);
      
      // Check that the description is enhanced
      expect(consolidated.enhancedDescription).toBeDefined();
      expect(consolidated.enhancedDescription).toContain('5.2 magnitude');
      expect(consolidated.enhancedDescription).toContain('San Francisco Bay Area');
      expect(consolidated.enhancedDescription).toContain('minor damage');
      
      // Check that geospatial data is included
      expect(consolidated.geospatialData).toBeDefined();
      expect(consolidated.geospatialData.geohash).toBe('9q8yyk');
      expect(consolidated.geospatialData.affectedArea).toBeDefined();
      
      // Check that parameters are combined
      expect(consolidated.parameters).toBeDefined();
      expect(consolidated.parameters.magnitude).toBe('5.2');
      expect(consolidated.parameters.depth).toBe('10km');
      expect(consolidated.parameters.intensity).toBe('moderate');
    });
    
    test('should handle alerts with AI classification', () => {
      const alertGroup = [
        {
          id: '1',
          headline: 'Earthquake in California',
          aiClassification: {
            primaryCategory: 'Natural Disaster',
            specificType: 'Earthquake',
            severityLevel: 6,
            confidenceScore: 0.8
          },
          createdAt: '2023-01-01T10:00:00Z'
        },
        {
          id: '2',
          headline: 'Earthquake near San Francisco',
          aiClassification: {
            primaryCategory: 'Natural Disaster',
            specificType: 'Earthquake',
            severityLevel: 7,
            confidenceScore: 0.9
          },
          createdAt: '2023-01-01T10:05:00Z'
        }
      ];
      
      const consolidated = consolidateAlertGroup(alertGroup);
      
      // Should use the classification with higher severity
      expect(consolidated.aiClassification).toBeDefined();
      expect(consolidated.aiClassification.severityLevel).toBe(7);
      expect(consolidated.aiClassification.confidenceScore).toBe(0.9);
    });
  });
  
  describe('getRecentAlerts', () => {
    test('should call DynamoDB with correct parameters', async () => {
      const mockItems = [{ id: '1' }, { id: '2' }];
      const mockPromise = jest.fn().mockResolvedValue({ Items: mockItems });
      
      const dynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
      dynamoDB.scan.mockReturnThis();
      dynamoDB.promise = mockPromise;
      
      const result = await getRecentAlerts(60, 100);
      
      expect(dynamoDB.scan).toHaveBeenCalled();
      expect(dynamoDB.scan.mock.calls[0][0]).toMatchObject({
        TableName: expect.any(String),
        FilterExpression: expect.stringContaining('createdAt >= :cutoffTime'),
        Limit: 100
      });
      
      expect(result).toEqual(mockItems);
    });
    
    test('should handle empty results', async () => {
      const mockPromise = jest.fn().mockResolvedValue({ Items: [] });
      
      const dynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
      dynamoDB.scan.mockReturnThis();
      dynamoDB.promise = mockPromise;
      
      const result = await getRecentAlerts();
      
      expect(result).toEqual([]);
    });
    
    test('should handle errors', async () => {
      const mockError = new Error('DynamoDB error');
      const mockPromise = jest.fn().mockRejectedValue(mockError);
      
      const dynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
      dynamoDB.scan.mockReturnThis();
      dynamoDB.promise = mockPromise;
      
      await expect(getRecentAlerts()).rejects.toThrow('DynamoDB error');
    });
  });
  
  describe('markAlertsAsConsolidated', () => {
    test('should update alerts in DynamoDB', async () => {
      const mockPromise = jest.fn().mockResolvedValue({});
      
      const dynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
      dynamoDB.update.mockReturnThis();
      dynamoDB.promise = mockPromise;
      
      await markAlertsAsConsolidated(['1', '2'], 'consolidated-123');
      
      expect(dynamoDB.update).toHaveBeenCalledTimes(2);
      expect(dynamoDB.update.mock.calls[0][0]).toMatchObject({
        TableName: expect.any(String),
        Key: { id: '1' },
        UpdateExpression: expect.stringContaining('consolidationStatus = :status')
      });
      expect(dynamoDB.update.mock.calls[1][0]).toMatchObject({
        TableName: expect.any(String),
        Key: { id: '2' },
        UpdateExpression: expect.stringContaining('consolidationStatus = :status')
      });
    });
    
    test('should handle errors', async () => {
      const mockError = new Error('DynamoDB error');
      const mockPromise = jest.fn().mockRejectedValue(mockError);
      
      const dynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
      dynamoDB.update.mockReturnThis();
      dynamoDB.promise = mockPromise;
      
      await expect(markAlertsAsConsolidated(['1'], 'consolidated-123')).rejects.toThrow('DynamoDB error');
    });
  });
  
  describe('createConsolidatedAlert', () => {
    test('should create a consolidated alert in DynamoDB', async () => {
      const mockPromise = jest.fn().mockResolvedValue({});
      
      const dynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
      dynamoDB.put.mockReturnThis();
      dynamoDB.promise = mockPromise;
      
      const consolidatedAlert = {
        headline: 'Consolidated Alert',
        description: 'This is a consolidated alert.'
      };
      
      const result = await createConsolidatedAlert(consolidatedAlert);
      
      expect(dynamoDB.put).toHaveBeenCalled();
      expect(dynamoDB.put.mock.calls[0][0]).toMatchObject({
        TableName: expect.any(String),
        Item: expect.objectContaining({
          headline: 'Consolidated Alert',
          description: 'This is a consolidated alert.',
          consolidationStatus: 'PRIMARY'
        })
      });
      
      expect(result).toMatchObject({
        headline: 'Consolidated Alert',
        description: 'This is a consolidated alert.',
        consolidationStatus: 'PRIMARY'
      });
    });
    
    test('should handle errors', async () => {
      const mockError = new Error('DynamoDB error');
      const mockPromise = jest.fn().mockRejectedValue(mockError);
      
      const dynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
      dynamoDB.put.mockReturnThis();
      dynamoDB.promise = mockPromise;
      
      await expect(createConsolidatedAlert({})).rejects.toThrow('DynamoDB error');
    });
  });
  
  describe('processAlertBatch', () => {
    test('should process a batch of alerts and return results', async () => {
      // Mock findSimilarAlertGroups to return a known group
      jest.spyOn(global, 'findSimilarAlertGroups').mockImplementation(() => {
        return [
          [
            { id: '1', headline: 'Alert 1' },
            { id: '2', headline: 'Alert 2' }
          ]
        ];
      });
      
      // Mock consolidateAlertGroup to return a known consolidated alert
      jest.spyOn(global, 'consolidateAlertGroup').mockImplementation(() => {
        return { id: 'mock-consolidated', headline: 'Consolidated Alert' };
      });
      
      // Mock createConsolidatedAlert to return a known result
      jest.spyOn(global, 'createConsolidatedAlert').mockImplementation(() => {
        return { id: 'consolidated-123', headline: 'Consolidated Alert' };
      });
      
      // Mock markAlertsAsConsolidated to do nothing
      jest.spyOn(global, 'markAlertsAsConsolidated').mockImplementation(() => {
        return Promise.resolve();
      });
      
      const alerts = [
        { id: '1', headline: 'Alert 1' },
        { id: '2', headline: 'Alert 2' },
        { id: '3', headline: 'Alert 3' }
      ];
      
      const results = await processAlertBatch(alerts);
      
      expect(results).toMatchObject({
        total: 3,
        groupsFound: 1,
        alertsConsolidated: 2,
        consolidatedAlertsCreated: 1
      });
      
      expect(results.details).toHaveLength(1);
      expect(results.details[0]).toMatchObject({
        consolidatedAlertId: 'consolidated-123',
        originalAlertCount: 2,
        originalAlertIds: ['1', '2']
      });
    });
    
    test('should handle errors', async () => {
      jest.spyOn(global, 'findSimilarAlertGroups').mockImplementation(() => {
        throw new Error('Processing error');
      });
      
      const alerts = [
        { id: '1', headline: 'Alert 1' },
        { id: '2', headline: 'Alert 2' }
      ];
      
      await expect(processAlertBatch(alerts)).rejects.toThrow('Processing error');
    });
  });
  
  describe('handler', () => {
    test('should process alerts and return success response', async () => {
      // Mock getRecentAlerts to return test alerts
      jest.spyOn(global, 'getRecentAlerts').mockImplementation(() => {
        return Promise.resolve([
          { id: '1', headline: 'Alert 1' },
          { id: '2', headline: 'Alert 2' }
        ]);
      });
      
      // Mock processAlertBatch to return test results
      jest.spyOn(global, 'processAlertBatch').mockImplementation(() => {
        return Promise.resolve({
          total: 2,
          groupsFound: 1,
          alertsConsolidated: 2,
          consolidatedAlertsCreated: 1,
          details: [
            {
              consolidatedAlertId: 'consolidated-123',
              originalAlertCount: 2,
              originalAlertIds: ['1', '2']
            }
          ]
        });
      });
      
      const event = {
        timeWindowMinutes: 30,
        batchSize: 50
      };
      
      const result = await handler(event, {});
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Alert consolidation completed',
        results: {
          total: 2,
          groupsFound: 1,
          alertsConsolidated: 2,
          consolidatedAlertsCreated: 1
        }
      });
    });
    
    test('should handle case with no alerts to process', async () => {
      // Mock getRecentAlerts to return empty array
      jest.spyOn(global, 'getRecentAlerts').mockImplementation(() => {
        return Promise.resolve([]);
      });
      
      const event = {};
      const result = await handler(event, {});
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'No alerts to consolidate',
        results: {
          total: 0,
          groupsFound: 0,
          alertsConsolidated: 0,
          consolidatedAlertsCreated: 0
        }
      });
    });
    
    test('should handle errors and return error response', async () => {
      // Mock getRecentAlerts to throw an error
      jest.spyOn(global, 'getRecentAlerts').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const event = {};
      const result = await handler(event, {});
      
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        message: 'Error in alert consolidation process',
        error: 'Test error'
      });
    });
  });
});