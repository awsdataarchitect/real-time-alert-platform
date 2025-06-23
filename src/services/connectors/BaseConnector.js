/**
 * Base Connector class for external data sources
 * 
 * This class provides common functionality for all data source connectors,
 * including error handling, retry logic, and data normalization.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Base class for all data source connectors
 */
export class BaseConnector {
  /**
   * Constructor for the BaseConnector
   * @param {Object} options - Configuration options
   * @param {string} options.sourceId - Unique identifier for this data source
   * @param {string} options.sourceType - Type of data source (e.g., 'WEATHER', 'SEISMIC')
   * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
   * @param {Function} options.logger - Logger function (default: console.log)
   */
  constructor(options = {}) {
    this.sourceId = options.sourceId || uuidv4();
    this.sourceType = options.sourceType || 'UNKNOWN';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.logger = options.logger || console.log;
  }

  /**
   * Fetch data from the external API with retry logic and caching support
   * @param {Function} fetchFn - Function that performs the actual API call
   * @param {Object} options - Additional options
   * @param {Object} options.cacheHeaders - Cache headers for conditional requests
   * @returns {Promise<Object>} - Promise resolving to the API response and headers
   * @throws {Error} - If all retry attempts fail
   */
  async fetchWithRetry(fetchFn, options = {}) {
    let lastError;
    let responseHeaders = {};
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger(`Retry attempt ${attempt} for ${this.sourceId}`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
        
        const result = await fetchFn(options.cacheHeaders);
        
        // Extract headers if available
        if (result && result.headers) {
          responseHeaders = {
            etag: result.headers.etag || result.headers['etag'],
            lastModified: result.headers['last-modified'] || result.headers.lastModified
          };
        }
        
        // Store response headers for later use
        this.responseHeaders = responseHeaders;
        
        // If this is a 304 Not Modified response, throw a specific error
        if (result && result.status === 304) {
          const notModifiedError = new Error('Not Modified');
          notModifiedError.status = 304;
          throw notModifiedError;
        }
        
        return result.data || result;
      } catch (error) {
        lastError = error;
        this.logger(`Error fetching data from ${this.sourceId}: ${error.message}`);
        
        // If not modified, we can return cached data
        if (error.status === 304) {
          throw error; // Let the caller handle this case
        }
        
        // Don't retry for certain error types
        if (error.status === 401 || error.status === 403 || error.status === 404) {
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to fetch data after ${this.maxRetries} retries: ${lastError.message}`);
  }

  /**
   * Normalize data from external API to internal alert format
   * @param {Object} data - Raw data from external API
   * @returns {Object} - Normalized alert data
   */
  normalizeData(data) {
    throw new Error('normalizeData method must be implemented by subclasses');
  }

  /**
   * Validate normalized data
   * @param {Object} normalizedData - Normalized data to validate
   * @returns {Object} - Validation result with isValid flag and errors array
   */
  validateData(normalizedData) {
    // Basic validation that should be enhanced by subclasses
    const errors = [];
    
    if (!normalizedData) {
      return { isValid: false, errors: ['Normalized data is required'] };
    }
    
    // Check required fields for alert data
    const requiredFields = [
      'eventType',
      'severity',
      'headline',
      'description'
    ];
    
    requiredFields.forEach(field => {
      if (!normalizedData[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process data from the external API
   * @returns {Promise<Object>} - Promise resolving to normalized and validated data
   */
  async processData() {
    throw new Error('processData method must be implemented by subclasses');
  }
}

export default BaseConnector;