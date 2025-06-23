/**
 * Data Source Connectors Index
 * 
 * This module exports all data source connectors and provides utility functions
 * for working with them.
 */

import USGSEarthquakeConnector from './USGSEarthquakeConnector';
import NOAAWeatherConnector from './NOAAWeatherConnector';
import CDCHealthConnector from './CDCHealthConnector';
import WebhookConnector from './WebhookConnector';

/**
 * Get a connector instance by type
 * @param {string} type - Connector type
 * @param {Object} options - Connector options
 * @returns {Object} - Connector instance
 * @throws {Error} - If connector type is not supported
 */
export const getConnector = (type, options = {}) => {
  switch (type.toLowerCase()) {
    case 'usgs':
    case 'earthquake':
      return new USGSEarthquakeConnector(options);
    case 'noaa':
    case 'weather':
      return new NOAAWeatherConnector(options);
    case 'cdc':
    case 'health':
      return new CDCHealthConnector(options);
    case 'webhook':
      return new WebhookConnector(options);
    default:
      throw new Error(`Unsupported connector type: ${type}`);
  }
};

/**
 * Process data from all connectors with caching support
 * @param {Object} options - Options for all connectors
 * @param {Object} options.cacheData - Cache data for connectors
 * @returns {Promise<Array<Object>>} - Promise resolving to all alerts from all connectors
 */
export const processAllConnectors = async (options = {}) => {
  const connectors = [
    new USGSEarthquakeConnector(options.usgs || {}),
    new NOAAWeatherConnector(options.noaa || {}),
    new CDCHealthConnector(options.cdc || {})
  ];
  
  // Create options objects for each connector with cache headers if available
  const connectorOptions = connectors.map(connector => {
    const sourceId = connector.sourceId;
    const cacheData = options.cacheData && options.cacheData[sourceId];
    
    return {
      cacheHeaders: cacheData ? {
        etag: cacheData.etag,
        lastModified: cacheData.lastModified
      } : undefined
    };
  });
  
  const results = await Promise.allSettled(
    connectors.map((connector, index) => connector.processData(connectorOptions[index]))
  );
  
  const alerts = [];
  const responseHeaders = {};
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      alerts.push(...result.value);
      
      // Store response headers for cache updates
      const connector = connectors[index];
      const connectorOptions = connectorOptions[index];
      if (connectorOptions && connectorOptions.responseHeaders) {
        responseHeaders[connector.sourceId] = connectorOptions.responseHeaders;
      }
    } else {
      const connectorName = connectors[index].constructor.name;
      console.error(`Error processing data from ${connectorName}: ${result.reason}`);
    }
  });
  
  // Add response headers to options for the caller to use
  options.responseHeaders = responseHeaders;
  
  return alerts;
};

export { USGSEarthquakeConnector, NOAAWeatherConnector, CDCHealthConnector, WebhookConnector };