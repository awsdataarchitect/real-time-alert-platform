/**
 * Unit tests for USGSEarthquakeConnector
 */

import axios from 'axios';
import { USGSEarthquakeConnector } from '../../../../src/services/connectors/USGSEarthquakeConnector';

// Mock axios
jest.mock('axios');

describe('USGSEarthquakeConnector', () => {
  let connector;
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = jest.fn();
    connector = new USGSEarthquakeConnector({
      sourceId: 'test-usgs',
      logger: mockLogger
    });
    
    // Reset axios mock
    axios.get.mockReset();
  });
  
  describe('constructor', () => {
    test('should initialize with provided options', () => {
      const customConnector = new USGSEarthquakeConnector({
        sourceId: 'custom-usgs',
        baseUrl: 'https://custom-api.example.com',
        timeRange: 'day',
        minMagnitude: 'all'
      });
      
      expect(customConnector.sourceId).toBe('custom-usgs');
      expect(customConnector.sourceType).toBe('SEISMIC');
      expect(customConnector.baseUrl).toBe('https://custom-api.example.com');
      expect(customConnector.timeRange).toBe('day');
      expect(customConnector.minMagnitude).toBe('all');
    });
    
    test('should initialize with default options when not provided', () => {
      expect(connector.sourceId).toBe('test-usgs');
      expect(connector.sourceType).toBe('SEISMIC');
      expect(connector.baseUrl).toBe('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary');
      expect(connector.timeRange).toBe('hour');
      expect(connector.minMagnitude).toBe('significant');
    });
  });
  
  describe('fetchEarthquakes', () => {
    test('should make API request with correct URL', async () => {
      const mockResponse = { data: { features: [] } };
      axios.get.mockResolvedValue(mockResponse);
      
      await connector.fetchEarthquakes();
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_hour.geojson'
      );
    });
    
    test('should use custom parameters when provided', async () => {
      const customConnector = new USGSEarthquakeConnector({
        timeRange: 'day',
        minMagnitude: '4.5'
      });
      
      const mockResponse = { data: { features: [] } };
      axios.get.mockResolvedValue(mockResponse);
      
      await customConnector.fetchEarthquakes();
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'
      );
    });
  });
  
  describe('mapSeverity', () => {
    test('should map earthquake magnitude to internal severity scale', () => {
      expect(connector.mapSeverity(8.5)).toBe(10);
      expect(connector.mapSeverity(7.5)).toBe(9);
      expect(connector.mapSeverity(6.5)).toBe(8);
      expect(connector.mapSeverity(5.5)).toBe(7);
      expect(connector.mapSeverity(4.5)).toBe(6);
      expect(connector.mapSeverity(3.5)).toBe(5);
      expect(connector.mapSeverity(2.5)).toBe(4);
      expect(connector.mapSeverity(1.5)).toBe(3);
      expect(connector.mapSeverity(0.5)).toBe(2);
    });
  });
  
  describe('normalizeData', () => {
    test('should handle empty or invalid data', () => {
      expect(connector.normalizeData(null)).toEqual([]);
      expect(connector.normalizeData({})).toEqual([]);
      expect(connector.normalizeData({ features: null })).toEqual([]);
      expect(connector.normalizeData({ features: 'not-an-array' })).toEqual([]);
    });
    
    test('should normalize USGS earthquake data to internal format', () => {
      const mockData = {
        features: [
          {
            properties: {
              ids: 'us1000abcd',
              mag: 6.2,
              place: 'Northern California',
              time: 1622548800000, // 2021-06-01T12:00:00Z
              updated: 1622549100000, // 2021-06-01T12:05:00Z
              status: 'reviewed',
              title: 'M 6.2 - Northern California',
              url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us1000abcd',
              tsunami: 0,
              sig: 800,
              depth: 10.5
            },
            geometry: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749, 10.5]
            }
          }
        ]
      };
      
      const normalized = connector.normalizeData(mockData);
      
      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toMatchObject({
        alertId: 'us1000abcd',
        sourceId: 'test-usgs',
        sourceType: 'SEISMIC',
        eventType: 'EARTHQUAKE',
        subType: 'EARTHQUAKE',
        severity: 8, // 6.2 magnitude maps to 8
        certainty: 0.9, // 'reviewed' status maps to 0.9
        headline: 'Magnitude 6.2 Earthquake near Northern California',
        description: 'M 6.2 - Northern California',
        createdAt: '2021-06-01T12:00:00.000Z',
        updatedAt: '2021-06-01T12:05:00.000Z',
        startTime: '2021-06-01T12:00:00.000Z',
        endTime: null,
        status: 'ACTIVE'
      });
      
      // Check location data
      expect(normalized[0].location).toEqual({
        type: 'Point',
        coordinates: [-122.4194, 37.7749, 10.5]
      });
      
      // Check resources
      expect(normalized[0].resources).toHaveLength(1);
      expect(normalized[0].resources[0]).toMatchObject({
        resourceType: 'DETAILS',
        uri: 'https://earthquake.usgs.gov/earthquakes/eventpage/us1000abcd',
        description: 'USGS Earthquake Details'
      });
      
      // Check parameters
      expect(normalized[0].parameters).toMatchObject({
        magnitude: 6.2,
        depth: 10.5,
        tsunami: 'Not expected',
        significance: 800
      });
    });
    
    test('should handle missing properties gracefully', () => {
      const mockData = {
        features: [
          {
            // Missing properties
            geometry: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749, 10.5]
            }
          }
        ]
      };
      
      const normalized = connector.normalizeData(mockData);
      
      expect(normalized).toHaveLength(1);
      expect(normalized[0].alertId).toMatch(/^usgs-\d+$/);
      expect(normalized[0].headline).toBe('Magnitude 0 Earthquake near Unknown location');
      expect(normalized[0].severity).toBe(2); // Default for magnitude 0
    });
  });
  
  describe('validateData', () => {
    test('should validate correct earthquake alert data', () => {
      const validAlert = {
        eventType: 'EARTHQUAKE',
        subType: 'EARTHQUAKE',
        severity: 8,
        headline: 'Magnitude 6.2 Earthquake near Northern California',
        description: 'M 6.2 - Northern California',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749, 10.5]
        },
        parameters: {
          magnitude: 6.2,
          depth: 10.5
        }
      };
      
      const result = connector.validateData(validAlert);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject alerts with wrong event type', () => {
      const invalidAlert = {
        eventType: 'WEATHER', // Not EARTHQUAKE
        subType: 'EARTHQUAKE',
        severity: 8,
        headline: 'Magnitude 6.2 Earthquake near Northern California',
        description: 'M 6.2 - Northern California',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749, 10.5]
        },
        parameters: {
          magnitude: 6.2,
          depth: 10.5
        }
      };
      
      const result = connector.validateData(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid eventType for earthquake alert');
    });
    
    test('should reject alerts without location', () => {
      const invalidAlert = {
        eventType: 'EARTHQUAKE',
        subType: 'EARTHQUAKE',
        severity: 8,
        headline: 'Magnitude 6.2 Earthquake near Northern California',
        description: 'M 6.2 - Northern California',
        // Missing location
        parameters: {
          magnitude: 6.2,
          depth: 10.5
        }
      };
      
      const result = connector.validateData(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Earthquake alerts must include location data');
    });
    
    test('should reject alerts without magnitude parameter', () => {
      const invalidAlert = {
        eventType: 'EARTHQUAKE',
        subType: 'EARTHQUAKE',
        severity: 8,
        headline: 'Magnitude 6.2 Earthquake near Northern California',
        description: 'M 6.2 - Northern California',
        location: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749, 10.5]
        },
        parameters: {
          // Missing magnitude
          depth: 10.5
        }
      };
      
      const result = connector.validateData(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Earthquake alerts must include magnitude parameter');
    });
  });
  
  describe('processData', () => {
    test('should process and filter valid alerts', async () => {
      // Mock API response with one valid and one invalid alert
      const mockApiResponse = {
        features: [
          {
            properties: {
              ids: 'valid-alert',
              mag: 6.2,
              place: 'Northern California',
              time: 1622548800000,
              status: 'reviewed',
              title: 'M 6.2 - Northern California',
              depth: 10.5
            },
            geometry: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749, 10.5]
            }
          },
          {
            properties: {
              ids: 'invalid-alert',
              // Missing magnitude
              place: 'Southern California',
              time: 1622548800000
            }
            // Missing geometry
          }
        ]
      };
      
      axios.get.mockResolvedValue({ data: mockApiResponse });
      
      const result = await connector.processData();
      
      expect(result).toHaveLength(1);
      expect(result[0].alertId).toBe('valid-alert');
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Invalid alert data'));
    });
    
    test('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('API error'));
      
      await expect(connector.processData()).rejects.toThrow('API error');
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Error processing USGS earthquake data'));
    });
  });
});