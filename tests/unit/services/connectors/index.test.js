/**
 * Unit tests for connectors index module
 */

import { getConnector, processAllConnectors } from '../../../../src/services/connectors';
import { USGSEarthquakeConnector } from '../../../../src/services/connectors/USGSEarthquakeConnector';
import { NOAAWeatherConnector } from '../../../../src/services/connectors/NOAAWeatherConnector';
import { CDCHealthConnector } from '../../../../src/services/connectors/CDCHealthConnector';
import { WebhookConnector } from '../../../../src/services/connectors/WebhookConnector';

// Mock the connector classes
jest.mock('../../../../src/services/connectors/USGSEarthquakeConnector');
jest.mock('../../../../src/services/connectors/NOAAWeatherConnector');
jest.mock('../../../../src/services/connectors/CDCHealthConnector');
jest.mock('../../../../src/services/connectors/WebhookConnector');

describe('connectors index module', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation();
    
    // Set up mock implementations
    USGSEarthquakeConnector.mockImplementation(() => ({
      constructor: { name: 'USGSEarthquakeConnector' },
      processData: jest.fn()
    }));
    
    NOAAWeatherConnector.mockImplementation(() => ({
      constructor: { name: 'NOAAWeatherConnector' },
      processData: jest.fn()
    }));
    
    CDCHealthConnector.mockImplementation(() => ({
      constructor: { name: 'CDCHealthConnector' },
      processData: jest.fn()
    }));
    
    WebhookConnector.mockImplementation(() => ({
      constructor: { name: 'WebhookConnector' },
      processData: jest.fn(),
      processWebhookData: jest.fn()
    }));
  });
  
  describe('getConnector', () => {
    test('should return USGSEarthquakeConnector for "usgs" type', () => {
      const connector = getConnector('usgs');
      expect(connector).toBeDefined();
      expect(USGSEarthquakeConnector).toHaveBeenCalled();
    });
    
    test('should return USGSEarthquakeConnector for "earthquake" type', () => {
      const connector = getConnector('earthquake');
      expect(connector).toBeDefined();
      expect(USGSEarthquakeConnector).toHaveBeenCalled();
    });
    
    test('should return NOAAWeatherConnector for "noaa" type', () => {
      const connector = getConnector('noaa');
      expect(connector).toBeDefined();
      expect(NOAAWeatherConnector).toHaveBeenCalled();
    });
    
    test('should return NOAAWeatherConnector for "weather" type', () => {
      const connector = getConnector('weather');
      expect(connector).toBeDefined();
      expect(NOAAWeatherConnector).toHaveBeenCalled();
    });
    
    test('should return CDCHealthConnector for "cdc" type', () => {
      const connector = getConnector('cdc');
      expect(connector).toBeDefined();
      expect(CDCHealthConnector).toHaveBeenCalled();
    });
    
    test('should return CDCHealthConnector for "health" type', () => {
      const connector = getConnector('health');
      expect(connector).toBeDefined();
      expect(CDCHealthConnector).toHaveBeenCalled();
    });
    
    test('should pass options to connector constructor', () => {
      const options = { apiKey: 'test-key' };
      getConnector('usgs', options);
      expect(USGSEarthquakeConnector).toHaveBeenCalledWith(options);
    });
    
    test('should return WebhookConnector for "webhook" type', () => {
      const connector = getConnector('webhook');
      expect(connector).toBeDefined();
      expect(WebhookConnector).toHaveBeenCalled();
    });
    
    test('should throw error for unsupported connector type', () => {
      expect(() => getConnector('invalid')).toThrow('Unsupported connector type');
    });
  });
  
  describe('processAllConnectors', () => {
    test('should process data from all connectors', async () => {
      // Set up mock return values
      const mockUSGSAlerts = [{ alertId: 'usgs-1' }, { alertId: 'usgs-2' }];
      const mockNOAAAlerts = [{ alertId: 'noaa-1' }];
      const mockCDCAlerts = [{ alertId: 'cdc-1' }, { alertId: 'cdc-2' }, { alertId: 'cdc-3' }];
      
      USGSEarthquakeConnector.mockImplementation(() => ({
        constructor: { name: 'USGSEarthquakeConnector' },
        processData: jest.fn().mockResolvedValue(mockUSGSAlerts)
      }));
      
      NOAAWeatherConnector.mockImplementation(() => ({
        constructor: { name: 'NOAAWeatherConnector' },
        processData: jest.fn().mockResolvedValue(mockNOAAAlerts)
      }));
      
      CDCHealthConnector.mockImplementation(() => ({
        constructor: { name: 'CDCHealthConnector' },
        processData: jest.fn().mockResolvedValue(mockCDCAlerts)
      }));
      
      // Call processAllConnectors
      const result = await processAllConnectors();
      
      // Verify all connectors were created
      expect(USGSEarthquakeConnector).toHaveBeenCalled();
      expect(NOAAWeatherConnector).toHaveBeenCalled();
      expect(CDCHealthConnector).toHaveBeenCalled();
      
      // Verify result contains all alerts
      expect(result).toHaveLength(6);
      expect(result).toEqual(expect.arrayContaining([
        ...mockUSGSAlerts,
        ...mockNOAAAlerts,
        ...mockCDCAlerts
      ]));
    });
    
    test('should handle errors from connectors', async () => {
      // Set up mock return values with one connector failing
      USGSEarthquakeConnector.mockImplementation(() => ({
        constructor: { name: 'USGSEarthquakeConnector' },
        processData: jest.fn().mockResolvedValue([{ alertId: 'usgs-1' }])
      }));
      
      NOAAWeatherConnector.mockImplementation(() => ({
        constructor: { name: 'NOAAWeatherConnector' },
        processData: jest.fn().mockRejectedValue(new Error('NOAA API error'))
      }));
      
      CDCHealthConnector.mockImplementation(() => ({
        constructor: { name: 'CDCHealthConnector' },
        processData: jest.fn().mockResolvedValue([{ alertId: 'cdc-1' }])
      }));
      
      // Call processAllConnectors
      const result = await processAllConnectors();
      
      // Verify result contains alerts from successful connectors
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([
        { alertId: 'usgs-1' },
        { alertId: 'cdc-1' }
      ]));
      
      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('NOAAWeatherConnector'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('NOAA API error'));
    });
    
    test('should pass options to connectors', async () => {
      // Set up options
      const options = {
        usgs: { timeRange: 'day' },
        noaa: { filters: { area: 'CA' } },
        cdc: { userAgent: 'TestApp/1.0 (test@example.com)' }
      };
      
      // Mock connectors to resolve with empty arrays
      USGSEarthquakeConnector.mockImplementation(() => ({
        constructor: { name: 'USGSEarthquakeConnector' },
        processData: jest.fn().mockResolvedValue([])
      }));
      
      NOAAWeatherConnector.mockImplementation(() => ({
        constructor: { name: 'NOAAWeatherConnector' },
        processData: jest.fn().mockResolvedValue([])
      }));
      
      CDCHealthConnector.mockImplementation(() => ({
        constructor: { name: 'CDCHealthConnector' },
        processData: jest.fn().mockResolvedValue([])
      }));
      
      // Call processAllConnectors with options
      await processAllConnectors(options);
      
      // Verify options were passed to connectors
      expect(USGSEarthquakeConnector).toHaveBeenCalledWith(options.usgs);
      expect(NOAAWeatherConnector).toHaveBeenCalledWith(options.noaa);
      expect(CDCHealthConnector).toHaveBeenCalledWith(options.cdc);
    });
  });
});