/**
 * Unit tests for NOAAWeatherConnector
 */

import axios from 'axios';
import { NOAAWeatherConnector } from '../../../../src/services/connectors/NOAAWeatherConnector';

// Mock axios
jest.mock('axios');

describe('NOAAWeatherConnector', () => {
  let connector;
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = jest.fn();
    connector = new NOAAWeatherConnector({
      sourceId: 'test-noaa',
      logger: mockLogger
    });
    
    // Reset axios mock
    axios.get.mockReset();
  });
  
  describe('constructor', () => {
    test('should initialize with provided options', () => {
      const customConnector = new NOAAWeatherConnector({
        sourceId: 'custom-noaa',
        apiKey: 'test-api-key',
        baseUrl: 'https://custom-api.example.com',
        filters: { status: 'active' }
      });
      
      expect(customConnector.sourceId).toBe('custom-noaa');
      expect(customConnector.sourceType).toBe('WEATHER');
      expect(customConnector.apiKey).toBe('test-api-key');
      expect(customConnector.baseUrl).toBe('https://custom-api.example.com');
      expect(customConnector.filters).toEqual({ status: 'active' });
    });
    
    test('should initialize with default options when not provided', () => {
      expect(connector.sourceId).toBe('test-noaa');
      expect(connector.sourceType).toBe('WEATHER');
      expect(connector.apiKey).toBeUndefined();
      expect(connector.baseUrl).toBe('https://api.weather.gov');
      expect(connector.filters).toEqual({});
    });
  });
  
  describe('fetchAlerts', () => {
    test('should make API request with correct parameters', async () => {
      const mockResponse = { data: { features: [] } };
      axios.get.mockResolvedValue(mockResponse);
      
      await connector.fetchAlerts();
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.weather.gov/alerts/active',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/geo+json',
            'User-Agent': expect.any(String)
          }),
          params: {}
        })
      );
    });
    
    test('should include API key in headers when provided', async () => {
      const apiKeyConnector = new NOAAWeatherConnector({
        apiKey: 'test-api-key'
      });
      
      const mockResponse = { data: { features: [] } };
      axios.get.mockResolvedValue(mockResponse);
      
      await apiKeyConnector.fetchAlerts();
      
      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-KEY': 'test-api-key'
          })
        })
      );
    });
    
    test('should include filters in params when provided', async () => {
      const filterConnector = new NOAAWeatherConnector({
        filters: { area: 'CA', limit: 10 }
      });
      
      const mockResponse = { data: { features: [] } };
      axios.get.mockResolvedValue(mockResponse);
      
      await filterConnector.fetchAlerts();
      
      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: { area: 'CA', limit: 10 }
        })
      );
    });
  });
  
  describe('mapSeverity', () => {
    test('should map NOAA severity levels to internal scale', () => {
      expect(connector.mapSeverity('Extreme')).toBe(10);
      expect(connector.mapSeverity('Severe')).toBe(8);
      expect(connector.mapSeverity('Moderate')).toBe(6);
      expect(connector.mapSeverity('Minor')).toBe(4);
      expect(connector.mapSeverity('Unknown')).toBe(2);
      expect(connector.mapSeverity('NonExistent')).toBe(2); // Default
    });
  });
  
  describe('mapCertainty', () => {
    test('should map NOAA certainty levels to internal scale', () => {
      expect(connector.mapCertainty('Observed')).toBe(1.0);
      expect(connector.mapCertainty('Likely')).toBe(0.8);
      expect(connector.mapCertainty('Possible')).toBe(0.6);
      expect(connector.mapCertainty('Unlikely')).toBe(0.3);
      expect(connector.mapCertainty('Unknown')).toBe(0.5);
      expect(connector.mapCertainty('NonExistent')).toBe(0.5); // Default
    });
  });
  
  describe('normalizeData', () => {
    test('should handle empty or invalid data', () => {
      expect(connector.normalizeData(null)).toEqual([]);
      expect(connector.normalizeData({})).toEqual([]);
      expect(connector.normalizeData({ features: null })).toEqual([]);
      expect(connector.normalizeData({ features: 'not-an-array' })).toEqual([]);
    });
    
    test('should normalize NOAA alert data to internal format', () => {
      const mockData = {
        features: [
          {
            properties: {
              id: 'urn:noaa:alert:1',
              event: 'Flood Warning',
              severity: 'Moderate',
              certainty: 'Observed',
              headline: 'Flood Warning for County A',
              description: 'Flooding is occurring in County A',
              instruction: 'Move to higher ground',
              sent: '2023-06-01T12:00:00Z',
              effective: '2023-06-01T12:00:00Z',
              expires: '2023-06-02T12:00:00Z',
              affectedZones: ['https://api.weather.gov/zones/county/CA001'],
              parameters: { SAME: ['001001'] }
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
            }
          }
        ]
      };
      
      const normalized = connector.normalizeData(mockData);
      
      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toMatchObject({
        alertId: 'urn:noaa:alert:1',
        sourceId: 'test-noaa',
        sourceType: 'WEATHER',
        eventType: 'WEATHER',
        subType: 'Flood Warning',
        severity: 6, // Moderate maps to 6
        certainty: 1.0, // Observed maps to 1.0
        headline: 'Flood Warning for County A',
        description: 'Flooding is occurring in County A',
        instructions: 'Move to higher ground',
        createdAt: '2023-06-01T12:00:00Z',
        updatedAt: '2023-06-01T12:00:00Z',
        startTime: '2023-06-01T12:00:00Z',
        endTime: '2023-06-02T12:00:00Z',
        status: 'ACTIVE'
      });
      
      // Check location data
      expect(normalized[0].location).toEqual({
        type: 'Polygon',
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
      });
      
      // Check affected areas
      expect(normalized[0].affectedAreas).toHaveLength(1);
      expect(normalized[0].affectedAreas[0]).toMatchObject({
        areaId: 'https://api.weather.gov/zones/county/CA001',
        areaName: 'CA001',
        areaType: 'ZONE'
      });
      
      // Check parameters
      expect(normalized[0].parameters).toEqual({ SAME: ['001001'] });
    });
    
    test('should handle missing properties gracefully', () => {
      const mockData = {
        features: [
          {
            // Missing properties
            geometry: {
              type: 'Polygon',
              coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
            }
          }
        ]
      };
      
      const normalized = connector.normalizeData(mockData);
      
      expect(normalized).toHaveLength(1);
      expect(normalized[0].alertId).toMatch(/^noaa-\d+$/);
      expect(normalized[0].headline).toBe('Weather Alert');
      expect(normalized[0].description).toBe('');
    });
  });
  
  describe('validateData', () => {
    test('should validate correct weather alert data', () => {
      const validAlert = {
        eventType: 'WEATHER',
        subType: 'Tornado Warning',
        severity: 8,
        headline: 'Tornado Warning for County B',
        description: 'A tornado has been spotted',
        location: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
        }
      };
      
      const result = connector.validateData(validAlert);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject alerts with wrong event type', () => {
      const invalidAlert = {
        eventType: 'EARTHQUAKE', // Not WEATHER
        subType: 'Tornado Warning',
        severity: 8,
        headline: 'Tornado Warning for County B',
        description: 'A tornado has been spotted',
        location: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
        }
      };
      
      const result = connector.validateData(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid eventType for weather alert');
    });
    
    test('should reject alerts without subType', () => {
      const invalidAlert = {
        eventType: 'WEATHER',
        // Missing subType
        severity: 8,
        headline: 'Weather Alert',
        description: 'A weather event is occurring',
        location: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
        }
      };
      
      const result = connector.validateData(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Weather alerts must have a subType');
    });
    
    test('should reject alerts without location', () => {
      const invalidAlert = {
        eventType: 'WEATHER',
        subType: 'Tornado Warning',
        severity: 8,
        headline: 'Tornado Warning for County B',
        description: 'A tornado has been spotted'
        // Missing location
      };
      
      const result = connector.validateData(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Weather alerts must include location data');
    });
  });
  
  describe('processData', () => {
    test('should process and filter valid alerts', async () => {
      // Mock API response with one valid and one invalid alert
      const mockApiResponse = {
        features: [
          {
            properties: {
              id: 'valid-alert',
              event: 'Flood Warning',
              severity: 'Moderate',
              certainty: 'Observed',
              headline: 'Flood Warning',
              description: 'Flooding is occurring',
              sent: '2023-06-01T12:00:00Z'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
            }
          },
          {
            properties: {
              id: 'invalid-alert',
              // Missing required fields
              sent: '2023-06-01T12:00:00Z'
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
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Error processing NOAA weather data'));
    });
  });
});