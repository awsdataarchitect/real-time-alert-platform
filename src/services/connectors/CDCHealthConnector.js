/**
 * CDC Health Alert Network API Connector
 * 
 * This connector integrates with the CDC Health Alert Network API to fetch health alerts
 * and normalize them to the platform's alert format.
 */

import axios from 'axios';
import BaseConnector from './BaseConnector';

/**
 * Connector for CDC Health Alert Network API
 */
export class CDCHealthConnector extends BaseConnector {
  /**
   * Constructor for the CDCHealthConnector
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - Base URL for the API (default: 'https://data.cdc.gov/resource/')
   * @param {Object} options.filters - Filters for the API request
   */
  constructor(options = {}) {
    super({
      ...options,
      sourceId: options.sourceId || 'cdc-health',
      sourceType: 'HEALTH'
    });
    
    this.baseUrl = options.baseUrl || 'https://data.cdc.gov/resource/';
    this.userAgent = options.userAgent || process.env.CDC_API_USER_AGENT || 'RealTimeAlertPlatform/1.0 (contact@example.com)';
    this.filters = options.filters || {};
  }

  /**
   * Fetch alerts from CDC Health Alert Network API with caching support
   * @param {Object} options - Additional options
   * @param {Object} options.cacheHeaders - Cache headers for conditional requests
   * @returns {Promise<Object>} - Promise resolving to the API response
   */
  async fetchAlerts(options = {}) {
    const headers = {
      'Accept': 'application/json',
      'User-Agent': this.userAgent
    };
    
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
      const response = await axios.get(`${this.baseUrl}/alerts`, {
        headers,
        params,
        validateStatus: status => (status >= 200 && status < 300) || status === 304
      });
      
      return response;
    }, options);
  }

  /**
   * Map CDC alert level to internal severity scale (1-10)
   * @param {string} cdcLevel - CDC alert level
   * @returns {number} - Internal severity scale (1-10)
   */
  mapSeverity(cdcLevel) {
    const severityMap = {
      'Emergency': 10,
      'Alert': 8,
      'Advisory': 6,
      'Update': 4,
      'Info': 2
    };
    
    return severityMap[cdcLevel] || 2;
  }

  /**
   * Map CDC certainty to internal certainty scale (0-1)
   * @param {string} cdcCertainty - CDC certainty level
   * @returns {number} - Internal certainty scale (0-1)
   */
  mapCertainty(cdcCertainty) {
    const certaintyMap = {
      'Confirmed': 1.0,
      'Likely': 0.8,
      'Possible': 0.6,
      'Unlikely': 0.3,
      'Unknown': 0.5
    };
    
    return certaintyMap[cdcCertainty] || 0.5;
  }

  /**
   * Normalize CDC alert data to internal alert format
   * @param {Object} data - Raw data from CDC API
   * @returns {Array<Object>} - Array of normalized alert data
   */
  normalizeData(data) {
    if (!data || !data.alerts || !Array.isArray(data.alerts)) {
      return [];
    }
    
    return data.alerts.map(alert => {
      // Extract location data if available
      let location = null;
      if (alert.affectedAreas && alert.affectedAreas.length > 0) {
        // Convert CDC's area format to GeoJSON if possible
        if (alert.affectedAreas[0].geometry) {
          location = alert.affectedAreas[0].geometry;
        }
      }
      
      // Create affected areas array
      const affectedAreas = (alert.affectedAreas || []).map(area => ({
        areaId: area.id || `area-${Date.now()}`,
        areaName: area.name || 'Unknown Area',
        areaType: area.type || 'REGION',
        geometry: area.geometry || null
      }));
      
      // Create resources array
      const resources = (alert.resources || []).map(resource => ({
        resourceType: resource.type || 'REFERENCE',
        mimeType: resource.mimeType || 'text/html',
        uri: resource.url || '',
        description: resource.description || 'CDC Resource'
      }));
      
      return {
        alertId: alert.id || `cdc-${Date.now()}`,
        sourceId: this.sourceId,
        sourceType: this.sourceType,
        eventType: 'HEALTH',
        subType: alert.type || 'ALERT',
        severity: this.mapSeverity(alert.level),
        certainty: this.mapCertainty(alert.certainty),
        headline: alert.headline || alert.title || 'Health Alert',
        description: alert.description || '',
        instructions: alert.recommendations || '',
        createdAt: alert.publishedAt || new Date().toISOString(),
        updatedAt: alert.updatedAt || alert.publishedAt || new Date().toISOString(),
        startTime: alert.effectiveAt || alert.publishedAt || new Date().toISOString(),
        endTime: alert.expiresAt || null,
        location: location,
        affectedAreas: affectedAreas,
        resources: resources,
        parameters: alert.parameters || {},
        status: alert.status || 'ACTIVE'
      };
    });
  }

  /**
   * Validate normalized health alert data
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
    
    // Health-specific validation
    if (normalizedData.eventType !== 'HEALTH') {
      errors.push('Invalid eventType for health alert');
    }
    
    if (!normalizedData.subType) {
      errors.push('Health alerts must have a subType');
    }
    
    // Health alerts might not always have location data, so we don't validate that
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process data from CDC Health Alert Network API with caching support
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
        this.logger(`CDC health data not modified since last request`);
        // Add response headers to options for the caller to use
        if (this.responseHeaders) {
          options.responseHeaders = this.responseHeaders;
        }
        return [];
      }
      
      this.logger(`Error processing CDC health data: ${error.message}`);
      throw error;
    }
  }
}

export default CDCHealthConnector;