/**
 * Utility functions for validating delivery status objects
 */

/**
 * Validate a delivery status object
 * @param {Object} deliveryStatus - Delivery status object to validate
 * @returns {Object} - Validation result with valid flag and errors array
 */
export const deliveryStatusValidation = (deliveryStatus) => {
  const errors = [];
  
  // Check required fields
  const requiredFields = ['deliveryId', 'alertId', 'userId', 'channelType', 'channelId', 'status'];
  requiredFields.forEach(field => {
    if (!deliveryStatus[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Validate status
  const validStatuses = ['PENDING', 'DELIVERED', 'FAILED', 'ACKNOWLEDGED'];
  if (deliveryStatus.status && !validStatuses.includes(deliveryStatus.status)) {
    errors.push(`Invalid status: ${deliveryStatus.status}. Must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Validate channel type
  const validChannelTypes = ['EMAIL', 'SMS', 'PUSH', 'APP', 'WEBHOOK'];
  if (deliveryStatus.channelType && !validChannelTypes.includes(deliveryStatus.channelType)) {
    errors.push(`Invalid channel type: ${deliveryStatus.channelType}. Must be one of: ${validChannelTypes.join(', ')}`);
  }
  
  // Validate timestamps
  const timestampFields = [
    'sentAt', 'deliveredAt', 'acknowledgedAt', 'failedAt', 'createdAt', 'updatedAt',
    'lastEscalationAt', 'escalationCompletedAt'
  ];
  timestampFields.forEach(field => {
    if (deliveryStatus[field] && !isValidISOTimestamp(deliveryStatus[field])) {
      errors.push(`Invalid timestamp format for ${field}: ${deliveryStatus[field]}`);
    }
  });
  
  // Validate retry count
  if (deliveryStatus.retryCount !== undefined && 
      (typeof deliveryStatus.retryCount !== 'number' || deliveryStatus.retryCount < 0)) {
    errors.push(`Invalid retry count: ${deliveryStatus.retryCount}. Must be a non-negative number.`);
  }
  
  // Validate escalation attempt
  if (deliveryStatus.escalationAttempt !== undefined && 
      (typeof deliveryStatus.escalationAttempt !== 'number' || deliveryStatus.escalationAttempt < 0)) {
    errors.push(`Invalid escalation attempt: ${deliveryStatus.escalationAttempt}. Must be a non-negative number.`);
  }
  
  // Validate escalation status
  const validEscalationStatuses = ['PENDING', 'DELIVERED', 'FAILED', 'COMPLETED'];
  if (deliveryStatus.escalationStatus && !validEscalationStatuses.includes(deliveryStatus.escalationStatus)) {
    errors.push(`Invalid escalation status: ${deliveryStatus.escalationStatus}. Must be one of: ${validEscalationStatuses.join(', ')}`);
  }
  
  // Validate previous channels array
  if (deliveryStatus.previousChannels !== undefined) {
    if (!Array.isArray(deliveryStatus.previousChannels)) {
      errors.push('previousChannels must be an array');
    } else {
      deliveryStatus.previousChannels.forEach((channel, index) => {
        if (!channel.channelType || !validChannelTypes.includes(channel.channelType)) {
          errors.push(`Invalid channel type in previousChannels[${index}]: ${channel.channelType}`);
        }
        if (!channel.channelId) {
          errors.push(`Missing channelId in previousChannels[${index}]`);
        }
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Check if a string is a valid ISO timestamp
 * @param {string} timestamp - Timestamp to validate
 * @returns {boolean} - Whether the timestamp is valid
 */
const isValidISOTimestamp = (timestamp) => {
  if (typeof timestamp !== 'string') {
    return false;
  }
  
  try {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && timestamp === date.toISOString();
  } catch (error) {
    return false;
  }
};

export default deliveryStatusValidation;