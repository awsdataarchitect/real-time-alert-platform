/**
 * Unit tests for processGeospatial Lambda function
 */

import {
  handler,
  getAlertsForProcessing,
  calculateGeohash,
  calculateNeighboringGeohashes,
  determineAffectedArea,
  estimatePopulationImpact,
  updateAlertGeospatialData,
  processAlert,
  processAlertBatch
} from '../../../src/lambda/processGeospatial';

// Mock the AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    scan: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    }
  };
});

// Mock the turf library
jest.mock('@turf/turf', () => {
  return {
    point: jest.fn((coords) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coords } })),
    polygon: jest.fn((coords) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: coords } })),
    buffer: jest.fn((feature, radius) => ({ 
      type: 'Feature', 
      geometry: { 
        type: 'Polygon', 
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] 
      } 
    })),
    area: jest.fn(() => 10000000) // 10 km²
  };
});

// Mock the geohash utility functions
jest.mock('../../../src/utils/geohash', () => {
  return {
    encodeGeohash: jest.fn((lat, lng) => 'u4pruydqqvj'),
    decodeGeohash: jest.fn((hash) => ({ latitude: 37.7749, longitude: -122.4194 })),
    getNeighbors: jest.fn(() => ({
      n: 'u4pruydqqvm',
      ne: 'u4pruydqqvq',
      e: 'u4pruydqqvn',
      se: 'u4pruydqqvj',
      s: 'u4pruydqqvh',
      sw: 'u4pruydqqv5',
      w: 'u4pruydqqv4',
      nw: 'u4pruydqqv6'
    })),
    getGeohashFromGeoJson: jest.fn(() => 'u4pruydqqvj')
  };
});

describe('processGeospatial Lambda', () => {
  let mockDynamoDB;
  let mockGeohash;
  let mockTurf;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get reference to mock DynamoDB client
    mockDynamoDB = require('aws-sdk').DynamoDB.DocumentClient();
    
    // Get reference to mock geohash utilities
    mockGeohash = require('../../../src/utils/geohash');
    
    // Get reference to mock turf
    mockTurf = require('@turf/turf');
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    
    // Set default mock for Date.now and toISOString
    jest.spyOn(Date.prototype, 'toISOString').mockImplementation(() => '2021-07-01T00:00:00Z');
  });
  
  describe('getAlertsForProcessing', () => {
    test('should retrieve alerts for geospatial processing from DynamoDB', async () => {
      // Mock DynamoDB response
      const mockAlerts = [
        { id: 'alert-1', location: { type: 'Point', coordinates: [-122.4194, 37.7749] } },
        { id: 'alert-2', location: { type: 'Polygon', coordinates: [[[-122.4, 37.7], [-122.5, 37.7], [-122.5, 37.8], [-122.4, 37.8], [-122.4, 37.7]]] } }
      ];
      
      mockDynamoDB.promise.mockResolvedValueOnce({ Items: mockAlerts });
      
      // Call getAlertsForProcessing
      const result = await getAlertsForProcessing(5);
      
      // Verify DynamoDB scan was called with correct parameters
      expect(mockDynamoDB.scan).toHaveBeenCalledWith({
        TableName: expect.any(String),
        FilterExpression: expect.stringContaining('attribute_exists(location)'),
        Limit: 5
      });
      
      // Verify result
      expect(result).toEqual(mockAlerts);
    });
    
    test('should handle errors from DynamoDB', async () => {
      // Mock DynamoDB error
      mockDynamoDB.promise.mockRejectedValueOnce(new Error('DynamoDB error'));
      
      // Call getAlertsForProcessing and expect it to throw
      await expect(getAlertsForProcessing()).rejects.toThrow('DynamoDB error');
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('DynamoDB error'));
    });
  });
  
  describe('calculateGeohash', () => {
    test('should calculate geohash for an alert with location data', () => {
      // Mock alert
      const mockAlert = {
        id: 'alert-1',
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] }
      };
      
      // Call calculateGeohash
      const result = calculateGeohash(mockAlert);
      
      // Verify getGeohashFromGeoJson was called with correct parameters
      expect(mockGeohash.getGeohashFromGeoJson).toHaveBeenCalledWith(mockAlert.location);
      
      // Verify result
      expect(result).toBe('u4pruydqqvj');
    });
    
    test('should throw error for alert without location data', () => {
      // Mock alert without location
      const mockAlert = {
        id: 'alert-1'
      };
      
      // Call calculateGeohash and expect it to throw
      expect(() => calculateGeohash(mockAlert)).toThrow('Alert does not have location data');
    });
  });
  
  describe('calculateNeighboringGeohashes', () => {
    test('should calculate neighboring geohashes', () => {
      // Call calculateNeighboringGeohashes
      const result = calculateNeighboringGeohashes('u4pruydqqvj');
      
      // Verify getNeighbors was called with correct parameters
      expect(mockGeohash.getNeighbors).toHaveBeenCalledWith('u4pruydqqvj');
      
      // Verify result
      expect(result).toEqual([
        'u4pruydqqvm',
        'u4pruydqqvq',
        'u4pruydqqvn',
        'u4pruydqqvj',
        'u4pruydqqvh',
        'u4pruydqqv5',
        'u4pruydqqv4',
        'u4pruydqqv6'
      ]);
    });
  });
  
  describe('determineAffectedArea', () => {
    test('should determine affected area for point location', () => {
      // Mock alert with point location
      const mockAlert = {
        id: 'alert-1',
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        severity: 7,
        eventType: 'EARTHQUAKE',
        parameters: { magnitude: 6.2 }
      };
      
      // Call determineAffectedArea
      const result = determineAffectedArea(mockAlert);
      
      // Verify turf.point and turf.buffer were called
      expect(mockTurf.point).toHaveBeenCalledWith([-122.4194, 37.7749]);
      expect(mockTurf.buffer).toHaveBeenCalled();
      
      // Verify result
      expect(result).toEqual({
        type: 'Polygon',
        coordinates: expect.any(Array)
      });
    });
    
    test('should determine affected area for polygon location', () => {
      // Mock alert with polygon location
      const mockAlert = {
        id: 'alert-1',
        location: { 
          type: 'Polygon', 
          coordinates: [[[-122.4, 37.7], [-122.5, 37.7], [-122.5, 37.8], [-122.4, 37.8], [-122.4, 37.7]]]
        }
      };
      
      // Call determineAffectedArea
      const result = determineAffectedArea(mockAlert);
      
      // Verify turf.polygon and turf.buffer were called
      expect(mockTurf.polygon).toHaveBeenCalledWith(mockAlert.location.coordinates);
      expect(mockTurf.buffer).toHaveBeenCalled();
      
      // Verify result
      expect(result).toEqual({
        type: 'Polygon',
        coordinates: expect.any(Array)
      });
    });
    
    test('should throw error for alert without location data', () => {
      // Mock alert without location
      const mockAlert = {
        id: 'alert-1'
      };
      
      // Call determineAffectedArea and expect it to throw
      expect(() => determineAffectedArea(mockAlert)).toThrow('Alert does not have location data');
    });
    
    test('should throw error for unsupported location type', () => {
      // Mock alert with unsupported location type
      const mockAlert = {
        id: 'alert-1',
        location: { type: 'LineString', coordinates: [[-122.4, 37.7], [-122.5, 37.8]] }
      };
      
      // Call determineAffectedArea and expect it to throw
      expect(() => determineAffectedArea(mockAlert)).toThrow('Unsupported location type');
    });
  });
  
  describe('estimatePopulationImpact', () => {
    test('should estimate population impact for affected area', () => {
      // Mock affected area
      const mockAffectedArea = {
        type: 'Polygon',
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
      };
      
      // Call estimatePopulationImpact
      const result = estimatePopulationImpact(mockAffectedArea);
      
      // Verify turf.area was called
      expect(mockTurf.area).toHaveBeenCalledWith(mockAffectedArea);
      
      // Verify result
      expect(result).toEqual({
        areaKm2: '10.00',
        estimatedPopulation: 1000,
        densityEstimate: 'medium',
        confidence: 'low'
      });
    });
    
    test('should handle errors in population impact estimation', () => {
      // Mock turf.area to throw error
      mockTurf.area.mockImplementationOnce(() => {
        throw new Error('Area calculation error');
      });
      
      // Mock affected area
      const mockAffectedArea = {
        type: 'Polygon',
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
      };
      
      // Call estimatePopulationImpact
      const result = estimatePopulationImpact(mockAffectedArea);
      
      // Verify error handling
      expect(result).toEqual({
        areaKm2: 0,
        estimatedPopulation: 0,
        densityEstimate: 'unknown',
        confidence: 'none',
        error: 'Area calculation error'
      });
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Area calculation error'));
    });
  });
  
  describe('updateAlertGeospatialData', () => {
    test('should update alert geospatial data in DynamoDB', async () => {
      // Mock DynamoDB response
      const mockUpdatedAlert = {
        id: 'alert-1',
        sourceId: 'source-1',
        geospatialData: {
          geohash: 'u4pruydqqvj',
          neighboringGeohashes: ['u4pruydqqvm', 'u4pruydqqvq']
        }
      };
      
      mockDynamoDB.promise.mockResolvedValueOnce({ Attributes: mockUpdatedAlert });
      
      // Mock geospatial data
      const geospatialData = {
        geohash: 'u4pruydqqvj',
        neighboringGeohashes: ['u4pruydqqvm', 'u4pruydqqvq'],
        affectedArea: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
        },
        populationImpact: {
          areaKm2: '10.00',
          estimatedPopulation: 1000
        }
      };
      
      // Call updateAlertGeospatialData
      const result = await updateAlertGeospatialData('alert-1', 'source-1', geospatialData);
      
      // Verify DynamoDB update was called with correct parameters
      expect(mockDynamoDB.update).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { id: 'alert-1', sourceId: 'source-1' },
        UpdateExpression: expect.stringContaining('geospatialData'),
        ExpressionAttributeValues: expect.any(Object),
        ReturnValues: 'ALL_NEW'
      });
      
      // Verify result
      expect(result).toEqual(mockUpdatedAlert);
    });
    
    test('should handle errors from DynamoDB', async () => {
      // Mock DynamoDB error
      mockDynamoDB.promise.mockRejectedValueOnce(new Error('DynamoDB error'));
      
      // Call updateAlertGeospatialData and expect it to throw
      await expect(updateAlertGeospatialData('alert-1', 'source-1', {})).rejects.toThrow('DynamoDB error');
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('DynamoDB error'));
    });
  });
  
  describe('processAlert', () => {
    test('should process alert with location data', async () => {
      // Mock alert
      const mockAlert = {
        id: 'alert-1',
        sourceId: 'source-1',
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        severity: 7,
        eventType: 'EARTHQUAKE'
      };
      
      // Mock updateAlertGeospatialData
      jest.spyOn({ updateAlertGeospatialData }, 'updateAlertGeospatialData')
        .mockResolvedValueOnce({});
      
      // Call processAlert
      const result = await processAlert(mockAlert);
      
      // Verify result
      expect(result).toEqual({
        alertId: 'alert-1',
        status: 'processed',
        geohash: 'u4pruydqqvj',
        affectedAreaType: 'Polygon'
      });
    });
    
    test('should skip alert without location data', async () => {
      // Mock alert without location
      const mockAlert = {
        id: 'alert-1',
        sourceId: 'source-1'
      };
      
      // Call processAlert
      const result = await processAlert(mockAlert);
      
      // Verify result
      expect(result).toEqual({
        alertId: 'alert-1',
        status: 'skipped',
        reason: 'No location data'
      });
    });
    
    test('should handle errors during processing', async () => {
      // Mock alert
      const mockAlert = {
        id: 'alert-1',
        sourceId: 'source-1',
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] }
      };
      
      // Mock calculateGeohash to throw error
      jest.spyOn({ calculateGeohash }, 'calculateGeohash')
        .mockImplementationOnce(() => {
          throw new Error('Geohash calculation error');
        });
      
      // Call processAlert
      const result = await processAlert(mockAlert);
      
      // Verify result
      expect(result).toEqual({
        alertId: 'alert-1',
        status: 'failed',
        error: 'Geohash calculation error'
      });
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Geohash calculation error'));
    });
  });
  
  describe('processAlertBatch', () => {
    test('should process a batch of alerts', async () => {
      // Mock alerts
      const mockAlerts = [
        { id: 'alert-1', sourceId: 'source-1', location: { type: 'Point', coordinates: [-122.4194, 37.7749] } },
        { id: 'alert-2', sourceId: 'source-1' }, // No location, should be skipped
        { id: 'alert-3', sourceId: 'source-1', location: { type: 'Polygon', coordinates: [[[-122.4, 37.7], [-122.5, 37.7], [-122.5, 37.8], [-122.4, 37.8], [-122.4, 37.7]]] } }
      ];
      
      // Mock processAlert
      jest.spyOn({ processAlert }, 'processAlert')
        .mockResolvedValueOnce({
          alertId: 'alert-1',
          status: 'processed',
          geohash: 'u4pruydqqvj',
          affectedAreaType: 'Polygon'
        })
        .mockResolvedValueOnce({
          alertId: 'alert-2',
          status: 'skipped',
          reason: 'No location data'
        })
        .mockResolvedValueOnce({
          alertId: 'alert-3',
          status: 'processed',
          geohash: 'u4pruydqqvj',
          affectedAreaType: 'Polygon'
        });
      
      // Call processAlertBatch
      const result = await processAlertBatch(mockAlerts);
      
      // Verify result
      expect(result).toEqual({
        total: 3,
        processed: 2,
        failed: 0,
        skipped: 1,
        details: [
          {
            alertId: 'alert-1',
            status: 'processed',
            geohash: 'u4pruydqqvj',
            affectedAreaType: 'Polygon'
          },
          {
            alertId: 'alert-2',
            status: 'skipped',
            reason: 'No location data'
          },
          {
            alertId: 'alert-3',
            status: 'processed',
            geohash: 'u4pruydqqvj',
            affectedAreaType: 'Polygon'
          }
        ]
      });
    });
    
    test('should handle processing failures', async () => {
      // Mock alerts
      const mockAlerts = [
        { id: 'alert-1', sourceId: 'source-1', location: { type: 'Point', coordinates: [-122.4194, 37.7749] } },
        { id: 'alert-2', sourceId: 'source-1', location: { type: 'Point', coordinates: [-122.4194, 37.7749] } }
      ];
      
      // Mock processAlert to succeed for first alert and fail for second
      jest.spyOn({ processAlert }, 'processAlert')
        .mockResolvedValueOnce({
          alertId: 'alert-1',
          status: 'processed',
          geohash: 'u4pruydqqvj',
          affectedAreaType: 'Polygon'
        })
        .mockRejectedValueOnce(new Error('Unexpected error'));
      
      // Call processAlertBatch
      const result = await processAlertBatch(mockAlerts);
      
      // Verify result
      expect(result).toEqual({
        total: 2,
        processed: 1,
        failed: 1,
        skipped: 0,
        details: [
          {
            alertId: 'alert-1',
            status: 'processed',
            geohash: 'u4pruydqqvj',
            affectedAreaType: 'Polygon'
          },
          {
            alertId: 'alert-2',
            status: 'failed',
            error: 'Unexpected error'
          }
        ]
      });
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'));
    });
  });
  
  describe('handler', () => {
    test('should process alerts for geospatial analysis', async () => {
      // Mock getAlertsForProcessing
      jest.spyOn({ getAlertsForProcessing }, 'getAlertsForProcessing')
        .mockResolvedValueOnce([
          { id: 'alert-1', sourceId: 'source-1', location: { type: 'Point', coordinates: [-122.4194, 37.7749] } },
          { id: 'alert-2', sourceId: 'source-1', location: { type: 'Polygon', coordinates: [[[-122.4, 37.7], [-122.5, 37.7], [-122.5, 37.8], [-122.4, 37.8], [-122.4, 37.7]]] } }
        ]);
      
      // Mock processAlertBatch
      jest.spyOn({ processAlertBatch }, 'processAlertBatch')
        .mockResolvedValueOnce({
          total: 2,
          processed: 2,
          failed: 0,
          skipped: 0,
          details: []
        });
      
      // Call handler
      const result = await handler({ batchSize: 5 }, {});
      
      // Verify response
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Geospatial processing completed',
        results: {
          total: 2,
          processed: 2,
          failed: 0,
          skipped: 0,
          details: []
        }
      });
      
      // Verify getAlertsForProcessing was called with correct batch size
      expect(getAlertsForProcessing).toHaveBeenCalledWith(5);
    });
    
    test('should handle case with no alerts to process', async () => {
      // Mock getAlertsForProcessing to return empty array
      jest.spyOn({ getAlertsForProcessing }, 'getAlertsForProcessing')
        .mockResolvedValueOnce([]);
      
      // Call handler
      const result = await handler({}, {});
      
      // Verify response
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: 'No alerts to process',
        results: {
          total: 0,
          processed: 0,
          failed: 0,
          skipped: 0
        }
      });
    });
    
    test('should handle errors in handler', async () => {
      // Mock getAlertsForProcessing to throw error
      jest.spyOn({ getAlertsForProcessing }, 'getAlertsForProcessing')
        .mockRejectedValueOnce(new Error('Unexpected error'));
      
      // Call handler
      const result = await handler({}, {});
      
      // Verify error response
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        message: 'Error in geospatial processing',
        error: 'Unexpected error'
      });
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'));
    });
  });
});