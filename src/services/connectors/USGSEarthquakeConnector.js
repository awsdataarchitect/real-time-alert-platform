/**
 * USGS Earthquake API Connector
 * 
 * This connector integrates with the USGS Earthquake API to fetch earthquake data
 * and normalize it to the platform's alert format.
 */

import axios from 'axios';
import BaseConnector from './BaseConnector';

/**
 * Connector for USGS Earthquake API
 */
export class USGSEarthquakeConnector extends BaseConnector {
  /**
   * Constructor for the USGSEarthquakeConnector
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - Base URL for the API (default: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary')
   * @param {string} options.timeRange - Time range for earthquakes (default: 'hour')
   * @param {string} options.minMagnitude - Minimum magnitude to include (default: 'significant')
   */
  constructor(options = {}) {
    super({
      ...options,
      sourceId: options.sourceId || 'usgs-earthquake',
      sourceType: 'SEISMIC'
    });
    
    this.baseUrl = options.baseUrl || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';
    this.userAgent = options.userAgent || process.env.USGS_API_USER_AGENT || 'RealTimeAlertPlatform/1.0 (contact@example.com)';
    this.timeRange = options.timeRange || 'hour';
    this.minMagnitude = options.minMagnitude || 'significant';
  }

  /**
   * Fetch earthquake data from USGS API with caching support
   * @param {Object} options - Additional options
   * @param {Object} options.cacheHeaders - Cache headers for conditional requests
   * @returns {Promise<Object>} - Promise resolving to the API response
   */
  async fetchEarthquakes(options = {}) {
    return this.fetchWithRetry(async (cacheHeaders) => {
      const headers = {
        'User-Agent': this.userAgent
      };
      
      // Add cache headers if available
      if (cacheHeaders) {
        if (cacheHeaders.etag) {
          headers['If-None-Match'] = cacheHeaders.etag;
        }
        if (cacheHeaders.lastModified) {
          headers['If-Modified-Since'] = cacheHeaders.lastModified;
        }
      }
      
      const response = await axios.get(`${this.baseUrl}/${this.minMagnitude}_${this.timeRange}.geojson`, {
        headers,
        validateStatus: status => (status >= 200 && status < 300) || status === 304
      });
      
      return response;
    }, options);
  }

  /**
   * Map earthquake magnitude to internal severity scale (1-10)
   * @param {number} magnitude - Earthquake magnitude
   * @returns {number} - Internal severity scale (1-10)
   */
  mapSeverity(magnitude) {
    if (magnitude >= 8.0) return 10;
    if (magnitude >= 7.0) return 9;
    if (magnitude >= 6.0) return 8;
    if (magnitude >= 5.0) return 7;
    if (magnitude >= 4.0) return 6;
    if (magnitude >= 3.0) return 5;
    if (magnitude >= 2.0) return 4;
    if (magnitude >= 1.0) return 3;
    return 2;
  }

  /**
   * Normalize USGS earthquake data to internal alert format
   * @param {Object} data - Raw data from USGS API
   * @returns {Array<Object>} - Array of normalized alert data
   */
  normalizeData(data) {
    if (!data || !data.features || !Array.isArray(data.features)) {
      return [];
    }
    
    return data.features.map(feature => {
      const properties = feature.properties || {};
      const geometry = feature.geometry || {};
      
      // Calculate certainty based on status and significance
      let certainty = 0.5;
      if (properties.status === 'reviewed') {
        certainty = 0.9;
      } else if (properties.status === 'automatic') {
        certainty = 0.6;
      }
      
      // Create headline and description
      const magnitude = properties.mag || 0;
      const place = properties.place || 'Unknown location';
      const headline = `Magnitude ${magnitude} Earthquake near ${place}`;
      const description = properties.title || headline;
      
      return {
        alertId: properties.ids || `usgs-${Date.now()}`,
        sourceId: this.sourceId,
        sourceType: this.sourceType,
        eventType: 'EARTHQUAKE',
        subType: 'EARTHQUAKE',
        severity: this.mapSeverity(magnitude),
        certainty: certainty,
        headline: headline,
        description: description,
        instructions: 'If you are in the affected area, follow local emergency instructions.',
        createdAt: properties.time ? new Date(properties.time).toISOString() : new Date().toISOString(),
        updatedAt: properties.updated ? new Date(properties.updated).toISOString() : new Date().toISOString(),
        startTime: properties.time ? new Date(properties.time).toISOString() : new Date().toISOString(),
        endTime: null, // Earthquakes don't have an end time
        location: geometry,
        affectedAreas: [],
        resources: [
          {
            resourceType: 'DETAILS',
            mimeType: 'text/html',
            uri: properties.url || '',
            description: 'USGS Earthquake Details'
          }
        ],
        parameters: {
          magnitude: properties.mag,
          depth: properties.depth,
          tsunami: properties.tsunami ? 'Possible' : 'Not expected',
          significance: properties.sig
        },
        status: 'ACTIVE'
      };
    });
  }

  /**
   * Validate normalized earthquake alert data
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
    
    // Earthquake-specific validation
    if (normalizedData.eventType !== 'EARTHQUAKE') {
      errors.push('Invalid eventType for earthquake alert');
    }
    
    // Validate location data
    if (!normalizedData.location) {
      errors.push('Earthquake alerts must include location data');
    }
    
    // Validate magnitude parameter
    if (!normalizedData.parameters || normalizedData.parameters.magnitude === undefined) {
      errors.push('Earthquake alerts must include magnitude parameter');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process data from USGS Earthquake API with caching support
   * @param {Object} options - Additional options
   * @param {Object} options.cacheHeaders - Cache headers for conditional requests
   * @returns {Promise<Array<Object>>} - Promise resolving to normalized and validated alerts
   */
  async processData(options = {}) {
    try {
      // Store options for later use
      this.options = options;
      
      // Fetch data with caching support
      const data = await this.fetchEarthquakes(options);
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
        this.logger(`USGS earthquake data not modified since last request`);
        // Add response headers to options for the caller to use
        if (this.responseHeaders) {
          options.responseHeaders = this.responseHeaders;
        }
        return [];
      }
      
      this.logger(`Error processing USGS earthquake data: ${error.message}`);
      throw error;
    }
  }
}

export default USGSEarthquakeConnector;