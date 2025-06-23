/**
 * NOAA Weather API Connector
 * 
 * This connector integrates with the NOAA Weather API to fetch weather alerts
 * and normalize them to the platform's alert format.
 */

import axios from 'axios';
import BaseConnector from './BaseConnector';

/**
 * Connector for NOAA Weather API
 */
export class NOAAWeatherConnector extends BaseConnector {
  /**
   * Constructor for the NOAAWeatherConnector
   * @param {Object} options - Configuration options
   * @param {string} options.apiKey - API key for NOAA Weather API (optional)
   * @param {string} options.baseUrl - Base URL for the API (default: 'https://api.weather.gov')
   * @param {Object} options.filters - Filters for the API request
   */
  constructor(options = {}) {
    super({
      ...options,
      sourceId: options.sourceId || 'noaa-weather',
      sourceType: 'WEATHER'
    });
    
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.weather.gov';
    this.filters = options.filters || {};
  }

  /**
   * Fetch alerts from NOAA Weather API with caching support
   * @param {Object} options - Additional options
   * @param {Object} options.cacheHeaders - Cache headers for conditional requests
   * @returns {Promise<Object>} - Promise resolving to the API response
   */
  async fetchAlerts(options = {}) {
    const headers = {
      'Accept': 'application/geo+json',
      'User-Agent': '(real-time-alert-platform, contact@example.com)'
    };
    
    if (this.apiKey) {
      headers['X-API-KEY'] = this.apiKey;
    }
    
    // Add cache headers if available
    if (options.cacheHeaders) {
      if (options.cacheHeaders.etag) {
        headers['If-None-Match'] = options.cacheHeaders.etag;
      }
      if (options.cacheHeaders.lastModified) {
        headers['If-Modified-Since'] = options.cacheHeaders.lastModified;
      }
    }
    
    const params = {
      ...this.filters
    };
    
    return this.fetchWithRetry(async () => {
      const response = await axios.get(`${this.baseUrl}/alerts/active`, {
        headers,
        params,
        validateStatus: status => (status >= 200 && status < 300) || status === 304
      });
      
      return response;
    }, options);
  }

  /**
   * Map NOAA severity to internal severity scale (1-10)
   * @param {string} noaaSeverity - NOAA severity level
   * @returns {number} - Internal severity scale (1-10)
   */
  mapSeverity(noaaSeverity) {
    const severityMap = {
      'Extreme': 10,
      'Severe': 8,
      'Moderate': 6,
      'Minor': 4,
      'Unknown': 2
    };
    
    return severityMap[noaaSeverity] || 2;
  }

  /**
   * Map NOAA certainty to internal certainty scale (0-1)
   * @param {string} noaaCertainty - NOAA certainty level
   * @returns {number} - Internal certainty scale (0-1)
   */
  mapCertainty(noaaCertainty) {
    const certaintyMap = {
      'Observed': 1.0,
      'Likely': 0.8,
      'Possible': 0.6,
      'Unlikely': 0.3,
      'Unknown': 0.5
    };
    
    return certaintyMap[noaaCertainty] || 0.5;
  }

  /**
   * Normalize NOAA alert data to internal alert format
   * @param {Object} data - Raw data from NOAA API
   * @returns {Array<Object>} - Array of normalized alert data
   */
  normalizeData(data) {
    if (!data || !data.features || !Array.isArray(data.features)) {
      return [];
    }
    
    return data.features.map(feature => {
      const properties = feature.properties || {};
      const geometry = feature.geometry || {};
      
      return {
        alertId: properties.id || `noaa-${Date.now()}`,
        sourceId: this.sourceId,
        sourceType: this.sourceType,
        eventType: 'WEATHER',
        subType: properties.event || 'ALERT',
        severity: this.mapSeverity(properties.severity),
        certainty: this.mapCertainty(properties.certainty),
        headline: properties.headline || properties.event || 'Weather Alert',
        description: properties.description || '',
        instructions: properties.instruction || '',
        createdAt: properties.sent || new Date().toISOString(),
        updatedAt: properties.sent || new Date().toISOString(),
        startTime: properties.effective || new Date().toISOString(),
        endTime: properties.expires || null,
        location: geometry,
        affectedAreas: properties.affectedZones ? properties.affectedZones.map(zone => ({
          areaId: zone,
          areaName: zone.split('/').pop(),
          areaType: 'ZONE',
          geometry: null // Would need additional API call to get geometry
        })) : [],
        resources: properties.references ? properties.references.map(ref => ({
          resourceType: 'REFERENCE',
          mimeType: 'application/geo+json',
          uri: ref.id,
          description: ref.identifier
        })) : [],
        parameters: properties.parameters || {},
        status: 'ACTIVE'
      };
    });
  }

  /**
   * Validate normalized weather alert data
   * @param {Object} normalizedData - Normalized data to validate
   * @returns {Object} - Validation result with isValid flag and errors array
   */
  validateData(normalizedData) {
    // First perform base validation
    const baseValidation = super.validateData(normalizedData);
    if (!baseValidation.isValid) {
      return baseValidation;
    }
    
    const errors = [];
    
    // Weather-specific validation
    if (normalizedData.eventType !== 'WEATHER') {
      errors.push('Invalid eventType for weather alert');
    }
    
    if (!normalizedData.subType) {
      errors.push('Weather alerts must have a subType');
    }
    
    // Validate location data
    if (!normalizedData.location) {
      errors.push('Weather alerts must include location data');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process data from NOAA Weather API with caching support
   * @param {Object} options - Additional options
   * @param {Object} options.cacheHeaders - Cache headers for conditional requests
   * @returns {Promise<Array<Object>>} - Promise resolving to normalized and validated alerts
   */
  async processData(options = {}) {
    try {
      // Store options for later use
      this.options = options;
      
      // Fetch data with caching support
      const data = await this.fetchAlerts(options);
      const normalizedAlerts = this.normalizeData(data);
      
      // Filter out invalid alerts
      const validatedAlerts = normalizedAlerts.filter(alert => {
        const validation = this.validateData(alert);
        if (!validation.isValid) {
          this.logger(`Invalid alert data: ${validation.errors.join(', ')}`);
          return false;
        }
        return true;
      });
      
      // Add response headers to options for the caller to use
      if (this.responseHeaders) {
        options.responseHeaders = this.responseHeaders;
      }
      
      return validatedAlerts;
    } catch (error) {
      // If the error is 304 Not Modified, return an empty array
      // The caller should use cached data in this case
      if (error.status === 304) {
        this.logger(`NOAA weather data not modified since last request`);
        // Add response headers to options for the caller to use
        if (this.responseHeaders) {
          options.responseHeaders = this.responseHeaders;
        }
        return [];
      }
      
      this.logger(`Error processing NOAA weather data: ${error.message}`);
      throw error;
    }
  }
}

export default NOAAWeatherConnector;