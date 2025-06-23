/**
 * Webhook Connector for real-time data ingestion
 * 
 * This connector handles incoming webhook data from external sources,
 * validates the data, and normalizes it to the internal alert format.
 */

import { BaseConnector } from './BaseConnector';
import { v4 as uuidv4 } from 'uuid';

/**
 * WebhookConnector class for handling real-time data from webhooks
 */
export class WebhookConnector extends BaseConnector {
  /**
   * Constructor for the WebhookConnector
   * @param {Object} options - Configuration options
   * @param {string} options.sourceId - Unique identifier for this data source
   * @param {string} options.sourceType - Type of data source
   * @param {Object} options.schema - JSON schema for validating incoming data
   * @param {Function} options.normalizer - Custom normalizer function
   * @param {Object} options.rateLimits - Rate limiting configuration
   * @param {number} options.rateLimits.maxRequests - Maximum requests per window
   * @param {number} options.rateLimits.timeWindow - Time window in milliseconds
   */
  constructor(options = {}) {
    super({
      sourceId: options.sourceId || uuidv4(),
      sourceType: options.sourceType || 'WEBHOOK',
      ...options
    });
    
    this.schema = options.schema || null;
    this.normalizer = options.normalizer || null;
    this.rateLimits = options.rateLimits || {
      maxRequests: 100,
      timeWindow: 60000 // 1 minute
    };
    
    // Initialize rate limiting tracking
    this.requestCounts = new Map();
  }

  /**
   * Process incoming webhook data
   * @param {Object} data - Raw data from webhook
   * @param {Object} metadata - Additional metadata about the request
   * @param {string} metadata.sourceIp - IP address of the source
   * @param {string} metadata.timestamp - Timestamp of the request
   * @param {string} metadata.signature - Signature for verification
   * @returns {Promise<Object>} - Promise resolving to normalized and validated data
   * @throws {Error} - If data is invalid or rate limit is exceeded
   */
  async processWebhookData(data, metadata = {}) {
    // Check rate limits
    if (this.isRateLimited(metadata.sourceIp)) {
      throw new Error('Rate limit exceeded');
    }
    
    // Validate signature if provided
    if (metadata.signature && !this.verifySignature(data, metadata.signature)) {
      throw new Error('Invalid signature');
    }
    
    // Validate data against schema if provided
    if (this.schema && !this.validateAgainstSchema(data)) {
      throw new Error('Data does not match required schema');
    }
    
    // Normalize data
    const normalizedData = this.normalizeData(data);
    
    // Validate normalized data
    const validationResult = this.validateData(normalizedData);
    if (!validationResult.isValid) {
      throw new Error(`Invalid data: ${validationResult.errors.join(', ')}`);
    }
    
    return normalizedData;
  }

  /**
   * Check if the source IP is rate limited
   * @param {string} sourceIp - IP address of the source
   * @returns {boolean} - True if rate limited, false otherwise
   */
  isRateLimited(sourceIp) {
    if (!sourceIp) return false;
    
    const now = Date.now();
    const key = sourceIp;
    
    // Clean up old entries
    for (const [ip, data] of this.requestCounts.entries()) {
      if (now - data.timestamp > this.rateLimits.timeWindow) {
        this.requestCounts.delete(ip);
      }
    }
    
    // Check if IP exists in tracking
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, {
        count: 1,
        timestamp: now
      });
      return false;
    }
    
    // Get current count
    const data = this.requestCounts.get(key);
    
    // Reset if outside time window
    if (now - data.timestamp > this.rateLimits.timeWindow) {
      this.requestCounts.set(key, {
        count: 1,
        timestamp: now
      });
      return false;
    }
    
    // Check if over limit
    if (data.count >= this.rateLimits.maxRequests) {
      return true;
    }
    
    // Increment count
    data.count += 1;
    this.requestCounts.set(key, data);
    
    return false;
  }

  /**
   * Verify the signature of the incoming data
   * @param {Object} data - Raw data from webhook
   * @param {string} signature - Signature to verify
   * @returns {boolean} - True if signature is valid, false otherwise
   */
  verifySignature(data, signature) {
    // Implementation will depend on the signature method used
    // This is a placeholder for the actual implementation
    return true;
  }

  /**
   * Validate data against JSON schema
   * @param {Object} data - Raw data from webhook
   * @returns {boolean} - True if data is valid, false otherwise
   */
  validateAgainstSchema(data) {
    // Implementation will depend on the schema validation library used
    // This is a placeholder for the actual implementation
    if (!this.schema) return true;
    
    // Simple validation logic (should be replaced with proper schema validation)
    for (const [key, required] of Object.entries(this.schema)) {
      if (required && !data[key]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Normalize data from webhook to internal alert format
   * @param {Object} data - Raw data from webhook
   * @returns {Object} - Normalized alert data
   */
  normalizeData(data) {
    // Use custom normalizer if provided
    if (this.normalizer && typeof this.normalizer === 'function') {
      return this.normalizer(data);
    }
    
    // Default normalization logic
    return {
      sourceId: this.sourceId,
      sourceType: this.sourceType,
      category: data.category || 'OTHER',
      eventType: data.eventType || data.type || 'UNKNOWN',
      subType: data.subType,
      severity: data.severity || 'UNKNOWN',
      certainty: data.certainty || 'UNKNOWN',
      headline: data.headline || data.title || 'No headline provided',
      description: data.description || data.message || 'No description provided',
      instructions: data.instructions,
      startTime: data.startTime || new Date().toISOString(),
      endTime: data.endTime,
      status: data.status || 'ACTIVE',
      location: data.location || {
        type: 'Point',
        coordinates: [0, 0] // Default coordinates
      },
      locationHash: data.locationHash,
      affectedAreas: data.affectedAreas || [],
      resources: data.resources || [],
      parameters: data.parameters || {},
      version: 1
    };
  }

  /**
   * Process data from the external API
   * This method is required by BaseConnector but not used for webhooks
   * @returns {Promise<Object>} - Promise resolving to normalized and validated data
   */
  async processData() {
    throw new Error('WebhookConnector does not support processData. Use processWebhookData instead.');
  }
}

export default WebhookConnector;