/**
 * Unit tests for CDCHealthConnector
 */

import axios from 'axios';
import { CDCHealthConnector } from '../../../../src/services/connectors/CDCHealthConnector';

// Mock axios
jest.mock('axios');

describe('CDCHealthConnector', () => {
  let connector;
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = jest.fn();
    connector = new CDCHealthConnector({
      sourceId: 'test-cdc',
      userAgent: 'TestApp/1.0 (test@example.com)',
      logger: mockLogger
    });
    
    // Reset axios mock
    axios.get.mockReset();
  });
  
  describe('constructor', () => {
    test('should initialize with provided options', () => {
      const customConnector = new CDCHealthConnector({
        sourceId: 'custom-cdc',
        userAgent: 'CustomApp/1.0 (custom@example.com)',
        baseUrl: 'https://custom-api.example.com',
        filters: { status: 'active' }
      });
      
      expect(customConnector.sourceId).toBe('custom-cdc');
      expect(customConnector.sourceType).toBe('HEALTH');
      expect(customConnector.userAgent).toBe('CustomApp/1.0 (custom@example.com)');
      expect(customConnector.baseUrl).toBe('https://custom-api.example.com');
      expect(customConnector.filters).toEqual({ status: 'active' });
    });
    
    test('should initialize with default options when not provided', () => {
      expect(connector.sourceId).toBe('test-cdc');
      expect(connector.sourceType).toBe('HEALTH');
      expect(connector.userAgent).toBe('TestApp/1.0 (test@example.com)');
      expect(connector.baseUrl).toBe('https://data.cdc.gov/resource/');
      expect(connector.filters).toEqual({});
    });
    
    test('should log warning when API key is not provided', () => {
      const noKeyLogger = jest.fn();
      const noKeyConnector = new CDCHealthConnector({
        logger: noKeyLogger
      });
      
      expect(noKeyLogger).toHaveBeenCalledWith(expect.stringContaining('requires an API key'));
    });
  });
  
  describe('fetchAlerts', () => {
    test('should make API request with correct parameters', async () => {
      const mockResponse = { data: { alerts: [] } };
      axios.get.mockResolvedValue(mockResponse);
      
      await connector.fetchAlerts();
      
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.cdc.gov/v1/han/alerts',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': expect.any(String),
            'X-API-KEY': 'test-api-key'
          }),
          params: {}
        })
      );
    });
    
    test('should include filters in params when provided', async () => {
      const filterConnector = new CDCHealthConnector({
        userAgent: 'TestApp/1.0 (test@example.com)',
        filters: { region: 'US-CA', limit: 10 }
      });
      
      const mockResponse = { data: { alerts: [] } };
      axios.get.mockResolvedValue(mockResponse);
      
      await filterConnector.fetchAlerts();
      
      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: { region: 'US-CA', limit: 10 }
        })
      );
    });
  });
  
  describe('mapSeverity', () => {
    test('should map CDC alert levels to internal scale', () => {
      expect(connector.mapSeverity('Emergency')).toBe(10);
      expect(connector.mapSeverity('Alert')).toBe(8);
      expect(connector.mapSeverity('Advisory')).toBe(6);
      expect(connector.mapSeverity('Update')).toBe(4);
      expect(connector.mapSeverity('Info')).toBe(2);
      expect(connector.mapSeverity('NonExistent')).toBe(2); // Default
    });
  });
  
  describe('mapCertainty', () => {
    test('should map CDC certainty levels to internal scale', () => {
      expect(connector.mapCertainty('Confirmed')).toBe(1.0);
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
      expect(connector.normalizeData({ alerts: null })).toEqual([]);
      expect(connector.normalizeData({ alerts: 'not-an-array' })).toEqual([]);
    });
    
    test('should normalize CDC alert data to internal format', () => {
      const mockData = {
        alerts: [
          {
            id: 'han-00123',
            type: 'Disease Outbreak',
            level: 'Alert',
            certainty: 'Confirmed',
            headline: 'Measles Outbreak in County A',
            description: 'Multiple cases of measles have been reported',
            recommendations: 'Get vaccinated if not already immune',
            publishedAt: '2023-06-01T12:00:00Z',
            updatedAt: '2023-06-01T14:00:00Z',
            effectiveAt: '2023-06-01T12:00:00Z',
            expiresAt: '2023-07-01T12:00:00Z',
            status: 'ACTIVE',
            affectedAreas: [
              {
                id: 'area-001',
                name: 'County A',
                type: 'COUNTY',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
                }
              }
            ],
            resources: [
              {
                type: 'GUIDANCE',
                mimeType: 'text/html',
                url: 'https://www.cdc.gov/measles/guidance',
                description: 'CDC Measles Guidance'
              }
            ],
            parameters: { 
              diseaseCode: 'B05',
              caseCount: '12'
            }
          }
        ]
      };
      
      const normalized = connector.normalizeData(mockData);
      
      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toMatchObject({
        alertId: 'han-00123',
        sourceId: 'test-cdc',
        sourceType: 'HEALTH',
        eventType: 'HEALTH',
        subType: 'Disease Outbreak',
        severity: 8, // Alert maps to 8
        certainty: 1.0, // Confirmed maps to 1.0
        headline: 'Measles Outbreak in County A',
        description: 'Multiple cases of measles have been reported',
        instructions: 'Get vaccinated if not already immune',
        createdAt: '2023-06-01T12:00:00Z',
        updatedAt: '2023-06-01T14:00:00Z',
        startTime: '2023-06-01T12:00:00Z',
        endTime: '2023-07-01T12:00:00Z',
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
        areaId: 'area-001',
        areaName: 'County A',
        areaType: 'COUNTY'
      });
      
      // Check resources
      expect(normalized[0].resources).toHaveLength(1);
      expect(normalized[0].resources[0]).toMatchObject({
        resourceType: 'GUIDANCE',
        uri: 'https://www.cdc.gov/measles/guidance',
        description: 'CDC Measles Guidance'
      });
      
      // Check parameters
      expect(normalized[0].parameters).toEqual({ 
        diseaseCode: 'B05',
        caseCount: '12'
      });
    });
    
    test('should handle missing properties gracefully', () => {
      const mockData = {
        alerts: [
          {
            // Minimal data
            id: 'minimal-alert'
          }
        ]
      };
      
      const normalized = connector.normalizeData(mockData);
      
      expect(normalized).toHaveLength(1);
      expect(normalized[0].alertId).toBe('minimal-alert');
      expect(normalized[0].headline).toBe('Health Alert');
      expect(normalized[0].description).toBe('');
      expect(normalized[0].affectedAreas).toEqual([]);
      expect(normalized[0].resources).toEqual([]);
    });
  });
  
  describe('validateData', () => {
    test('should validate correct health alert data', () => {
      const validAlert = {
        eventType: 'HEALTH',
        subType: 'Disease Outbreak',
        severity: 8,
        headline: 'Measles Outbreak in County A',
        description: 'Multiple cases of measles have been reported'
      };
      
      const result = connector.validateData(validAlert);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject alerts with wrong event type', () => {
      const invalidAlert = {
        eventType: 'WEATHER', // Not HEALTH
        subType: 'Disease Outbreak',
        severity: 8,
        headline: 'Measles Outbreak in County A',
        description: 'Multiple cases of measles have been reported'
      };
      
      const result = connector.validateData(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid eventType for health alert');
    });
    
    test('should reject alerts without subType', () => {
      const invalidAlert = {
        eventType: 'HEALTH',
        // Missing subType
        severity: 8,
        headline: 'Health Alert',
        description: 'A health event is occurring'
      };
      
      const result = connector.validateData(invalidAlert);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Health alerts must have a subType');
    });
  });
  
  describe('processData', () => {
    test('should process and filter valid alerts', async () => {
      // Mock API response with one valid and one invalid alert
      const mockApiResponse = {
        alerts: [
          {
            id: 'valid-alert',
            type: 'Disease Outbreak',
            level: 'Alert',
            headline: 'Valid Health Alert',
            description: 'This is a valid alert'
          },
          {
            id: 'invalid-alert',
            // Missing required fields
            description: 'This is an invalid alert'
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
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Error processing CDC health data'));
    });
  });
});