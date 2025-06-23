/**
 * Lambda function for alert escalation
 * 
 * This function handles the escalation workflow for unacknowledged alerts,
 * selecting alternative channels and tracking escalation attempts.
 * 
 * Requirements:
 * - 2.6: IF a user doesn't acknowledge critical alerts THEN the system SHALL attempt alternative notification methods.
 * - 5.5: WHEN sending alerts THEN the system SHALL track delivery status and attempt alternative channels if primary channels fail.
 */

import { DynamoDB } from 'aws-sdk';
import { getUserPreferences } from '../services/database/userPreferenceQueries';
import { deliveryStatusValidation } from '../utils/deliveryStatusValidation';

// Initialize clients
const dynamoDB = new DynamoDB.DocumentClient();

// Table names from environment variables
const DELIVERY_STATUS_TABLE = process.env.DELIVERY_STATUS_TABLE || 'deliveryStatusTable';
const ESCALATION_CONFIG_TABLE = process.env.ESCALATION_CONFIG_TABLE || 'escalationConfigTable';
const ACCESSIBILITY_ADAPTATIONS_TABLE = process.env.ACCESSIBILITY_ADAPTATIONS_TABLE || 'accessibilityAdaptationsTable';

// Channel types
const CHANNEL_TYPES = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  APP: 'APP',
  WEBHOOK: 'WEBHOOK'
};

// Default escalation configuration
const DEFAULT_ESCALATION_CONFIG = {
  maxAttempts: 3,
  waitTimes: [5 * 60, 15 * 60, 30 * 60], // Wait times in seconds (5 min, 15 min, 30 min)
  channelPriority: [
    CHANNEL_TYPES.PUSH,
    CHANNEL_TYPES.SMS,
    CHANNEL_TYPES.EMAIL,
    CHANNEL_TYPES.APP,
    CHANNEL_TYPES.WEBHOOK
  ]
};

/**
 * Check the delivery status of an alert
 * @param {string} deliveryId - Delivery ID
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Delivery status check result
 */
export const checkDeliveryStatus = async (deliveryId, alertId, userId) => {
  try {
    // Get the delivery status from DynamoDB
    const params = {
      TableName: DELIVERY_STATUS_TABLE,
      Key: {
        deliveryId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      throw new Error(`Delivery status not found for deliveryId: ${deliveryId}`);
    }
    
    const deliveryStatus = result.Item;
    
    // Check if the alert has been acknowledged
    const acknowledged = deliveryStatus.status === 'ACKNOWLEDGED';
    
    return {
      deliveryId,
      alertId,
      userId,
      acknowledged,
      deliveryStatus,
      currentAttempt: deliveryStatus.escalationAttempt || 0,
      previousChannels: deliveryStatus.previousChannels || [],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error checking delivery status: ${error.message}`);
    throw error;
  }
};

/**
 * Get escalation configuration for a user
 * @param {string} userId - User ID
 * @param {string} alertId - Alert ID
 * @param {string} deliveryId - Delivery ID
 * @param {number} currentAttempt - Current escalation attempt
 * @returns {Promise<Object>} - Escalation configuration
 */
export const getEscalationConfig = async (userId, alertId, deliveryId, currentAttempt) => {
  try {
    // Get user preferences to check for custom escalation settings
    const userPreferences = await getUserPreferences(userId);
    
    // Use user's custom escalation config if available, otherwise use default
    const escalationConfig = userPreferences?.escalationConfig || DEFAULT_ESCALATION_CONFIG;
    
    // Determine if we should escalate based on max attempts
    const shouldEscalate = currentAttempt < escalationConfig.maxAttempts;
    
    // Get the wait time for this attempt (use the last wait time if we're beyond the array length)
    const waitTimeIndex = Math.min(currentAttempt, escalationConfig.waitTimes.length - 1);
    const waitTime = escalationConfig.waitTimes[waitTimeIndex];
    
    return {
      deliveryId,
      alertId,
      userId,
      currentAttempt,
      escalationConfig,
      shouldEscalate,
      waitTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error getting escalation config: ${error.message}`);
    throw error;
  }
};

/**
 * Check if user needs accessibility adaptations
 * @param {string} userId - User ID
 * @param {string} alertId - Alert ID
 * @returns {Promise<boolean>} - Whether user needs accessibility adaptations
 */
export const checkAccessibilityNeeds = async (userId, alertId) => {
  try {
    // Get user preferences to check for accessibility needs
    const userPreferences = await getUserPreferences(userId);
    
    if (!userPreferences || !userPreferences.profile || !userPreferences.profile.accessibilityPreferences) {
      return false;
    }
    
    // Check if user has any accessibility preferences that would require adaptations
    const { accessibilityPreferences } = userPreferences.profile;
    
    const needsAdaptations = (
      accessibilityPreferences.audioEnabled || 
      accessibilityPreferences.preferredFormat || 
      accessibilityPreferences.colorScheme || 
      accessibilityPreferences.textSize || 
      (accessibilityPreferences.additionalNeeds && accessibilityPreferences.additionalNeeds.length > 0) ||
      (accessibilityPreferences.language && accessibilityPreferences.language !== 'en')
    );
    
    return needsAdaptations;
  } catch (error) {
    console.error(`Error checking accessibility needs: ${error.message}`);
    return false; // Default to no adaptations needed if there's an error
  }
};

/**
 * Request accessibility adaptations for an alert
 * @param {string} userId - User ID
 * @param {string} alertId - Alert ID
 * @returns {Promise<Object>} - Lambda invocation result
 */
export const requestAccessibilityAdaptations = async (userId, alertId) => {
  try {
    // Check if adaptations already exist
    const adaptationId = `${alertId}:${userId}`;
    
    const params = {
      TableName: ACCESSIBILITY_ADAPTATIONS_TABLE,
      Key: {
        adaptationId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (result.Item) {
      console.log(`Accessibility adaptations already exist for alert ${alertId} and user ${userId}`);
      return {
        statusCode: 200,
        body: {
          message: 'Accessibility adaptations already exist',
          adaptationId
        }
      };
    }
    
    // Invoke the accessibility adaptations Lambda
    const lambda = new AWS.Lambda();
    
    const lambdaParams = {
      FunctionName: process.env.ACCESSIBILITY_ADAPTATIONS_FUNCTION || 'accessibilityAdaptations',
      InvocationType: 'Event', // Asynchronous invocation
      Payload: JSON.stringify({
        alertId,
        userId
      })
    };
    
    await lambda.invoke(lambdaParams).promise();
    
    return {
      statusCode: 202, // Accepted
      body: {
        message: 'Accessibility adaptations requested',
        alertId,
        userId
      }
    };
  } catch (error) {
    console.error(`Error requesting accessibility adaptations: ${error.message}`);
    return {
      statusCode: 500,
      body: {
        message: 'Error requesting accessibility adaptations',
        error: error.message
      }
    };
  }
};

/**
 * Select an alternative channel for alert delivery
 * @param {string} userId - User ID
 * @param {string} alertId - Alert ID
 * @param {string} deliveryId - Delivery ID
 * @param {number} currentAttempt - Current escalation attempt
 * @param {Object} escalationConfig - Escalation configuration
 * @param {Array} previousChannels - Previously used channels
 * @returns {Promise<Object>} - Selected alternative channel
 */
export const selectAlternativeChannel = async (userId, alertId, deliveryId, currentAttempt, escalationConfig, previousChannels) => {
  try {
    // Get user's notification channels
    const userPreferences = await getUserPreferences(userId);
    
    if (!userPreferences) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const { notificationChannels = [] } = userPreferences;
    
    // Filter enabled channels
    const enabledChannels = notificationChannels.filter(channel => channel.enabled !== false);
    
    if (enabledChannels.length === 0) {
      return {
        deliveryId,
        alertId,
        userId,
        currentAttempt,
        channelAvailable: false,
        reason: 'No enabled channels available',
        timestamp: new Date().toISOString()
      };
    }
    
    // Filter out previously used channels
    const unusedChannels = enabledChannels.filter(channel => 
      !previousChannels.some(prev => 
        prev.channelType === channel.channelType && prev.channelId === channel.channelId
      )
    );
    
    if (unusedChannels.length === 0) {
      // If all channels have been tried, start over with the highest priority channel
      // This is useful when we have more escalation attempts than available channels
      console.log('All channels have been tried, starting over with highest priority channel');
    }
    
    // Use either unused channels or all enabled channels if all have been tried
    const candidateChannels = unusedChannels.length > 0 ? unusedChannels : enabledChannels;
    
    // Sort channels by priority according to escalation config
    const sortedChannels = candidateChannels.sort((a, b) => {
      const priorityA = escalationConfig.channelPriority.indexOf(a.channelType);
      const priorityB = escalationConfig.channelPriority.indexOf(b.channelType);
      return priorityA - priorityB;
    });
    
    // Select the highest priority channel
    const selectedChannel = sortedChannels[0];
    
    return {
      deliveryId,
      alertId,
      userId,
      currentAttempt,
      channelAvailable: true,
      selectedChannel,
      previousChannels,
      escalationConfig,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error selecting alternative channel: ${error.message}`);
    throw error;
  }
};

/**
 * Log escalation failure
 * @param {string} userId - User ID
 * @param {string} alertId - Alert ID
 * @param {string} deliveryId - Delivery ID
 * @param {string} reason - Failure reason
 * @returns {Promise<Object>} - Escalation failure log
 */
export const logEscalationFailure = async (userId, alertId, deliveryId, reason) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Update delivery status with escalation failure
    const params = {
      TableName: DELIVERY_STATUS_TABLE,
      Key: {
        deliveryId
      },
      UpdateExpression: 'SET escalationStatus = :status, escalationFailureReason = :reason, updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':status': 'FAILED',
        ':reason': reason,
        ':timestamp': timestamp
      }
    };
    
    await dynamoDB.update(params).promise();
    
    // Log the failure for monitoring
    console.error(`Escalation failed for alert ${alertId}, user ${userId}: ${reason}`);
    
    return {
      deliveryId,
      alertId,
      userId,
      escalationStatus: 'FAILED',
      reason,
      timestamp
    };
  } catch (error) {
    console.error(`Error logging escalation failure: ${error.message}`);
    throw error;
  }
};

/**
 * Update escalation status after delivery attempt
 * @param {string} userId - User ID
 * @param {string} alertId - Alert ID
 * @param {string} deliveryId - Delivery ID
 * @param {number} currentAttempt - Current escalation attempt
 * @param {Object} selectedChannel - Selected channel for delivery
 * @param {Object} deliveryResult - Result of delivery attempt
 * @returns {Promise<Object>} - Updated escalation status
 */
export const updateEscalationStatus = async (userId, alertId, deliveryId, currentAttempt, selectedChannel, deliveryResult) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Extract delivery success status from the result
    const success = deliveryResult.statusCode === 200 && 
                   JSON.parse(deliveryResult.body).result.success;
    
    // Get the new delivery ID from the result if available
    const newDeliveryId = success ? 
      JSON.parse(deliveryResult.body).result.deliveryId : 
      null;
    
    // Update the original delivery status with escalation information
    const params = {
      TableName: DELIVERY_STATUS_TABLE,
      Key: {
        deliveryId
      },
      UpdateExpression: 'SET escalationAttempt = :attempt, escalationStatus = :status, lastEscalationAt = :timestamp, updatedAt = :timestamp, escalationDeliveryId = :newDeliveryId',
      ExpressionAttributeValues: {
        ':attempt': currentAttempt,
        ':status': success ? 'DELIVERED' : 'FAILED',
        ':timestamp': timestamp,
        ':newDeliveryId': newDeliveryId || 'NONE'
      }
    };
    
    await dynamoDB.update(params).promise();
    
    // Return the updated status with wait time for the next check
    return {
      deliveryId,
      alertId,
      userId,
      currentAttempt,
      escalationStatus: success ? 'DELIVERED' : 'FAILED',
      selectedChannel,
      newDeliveryId,
      waitTime: success ? 60 : 30, // Wait longer if successful to give user time to acknowledge
      timestamp
    };
  } catch (error) {
    console.error(`Error updating escalation status: ${error.message}`);
    throw error;
  }
};

/**
 * Increment escalation attempt counter
 * @param {string} userId - User ID
 * @param {string} alertId - Alert ID
 * @param {string} deliveryId - Delivery ID
 * @param {number} currentAttempt - Current escalation attempt
 * @param {Object} escalationConfig - Escalation configuration
 * @param {Array} previousChannels - Previously used channels
 * @param {Object} selectedChannel - Last selected channel
 * @returns {Promise<Object>} - Updated escalation attempt
 */
export const incrementAttempt = async (userId, alertId, deliveryId, currentAttempt, escalationConfig, previousChannels, selectedChannel) => {
  try {
    const timestamp = new Date().toISOString();
    const newAttempt = currentAttempt + 1;
    
    // Add the selected channel to previous channels
    const updatedPreviousChannels = [...previousChannels];
    if (selectedChannel) {
      updatedPreviousChannels.push(selectedChannel);
    }
    
    // Update delivery status with new attempt count
    const params = {
      TableName: DELIVERY_STATUS_TABLE,
      Key: {
        deliveryId
      },
      UpdateExpression: 'SET escalationAttempt = :attempt, previousChannels = :channels, updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':attempt': newAttempt,
        ':channels': updatedPreviousChannels,
        ':timestamp': timestamp
      }
    };
    
    await dynamoDB.update(params).promise();
    
    // Check if we've reached the maximum number of attempts
    const maxAttemptsReached = newAttempt >= escalationConfig.maxAttempts;
    
    return {
      deliveryId,
      alertId,
      userId,
      currentAttempt: newAttempt,
      previousChannels: updatedPreviousChannels,
      escalationConfig,
      maxAttemptsReached,
      escalationSummary: {
        totalAttempts: newAttempt,
        channels: updatedPreviousChannels,
        startedAt: previousChannels.length > 0 ? previousChannels[0].timestamp : timestamp,
        completedAt: maxAttemptsReached ? timestamp : null
      },
      timestamp
    };
  } catch (error) {
    console.error(`Error incrementing escalation attempt: ${error.message}`);
    throw error;
  }
};

/**
 * Complete the escalation process
 * @param {string} userId - User ID
 * @param {string} alertId - Alert ID
 * @param {string} deliveryId - Delivery ID
 * @param {Object} escalationSummary - Summary of escalation process
 * @returns {Promise<Object>} - Escalation completion result
 */
export const completeEscalation = async (userId, alertId, deliveryId, escalationSummary) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Update delivery status with completion information
    const params = {
      TableName: DELIVERY_STATUS_TABLE,
      Key: {
        deliveryId
      },
      UpdateExpression: 'SET escalationStatus = :status, escalationCompletedAt = :timestamp, updatedAt = :timestamp, escalationSummary = :summary',
      ExpressionAttributeValues: {
        ':status': 'COMPLETED',
        ':timestamp': timestamp,
        ':summary': escalationSummary
      }
    };
    
    await dynamoDB.update(params).promise();
    
    // Log the completion for monitoring
    console.log(`Escalation completed for alert ${alertId}, user ${userId} after ${escalationSummary.totalAttempts} attempts`);
    
    return {
      deliveryId,
      alertId,
      userId,
      escalationStatus: 'COMPLETED',
      escalationSummary,
      timestamp
    };
  } catch (error) {
    console.error(`Error completing escalation: ${error.message}`);
    throw error;
  }
};

/**
 * Lambda handler function
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Lambda response
 */
export const handler = async (event, context) => {
  try {
    console.log('Starting alert escalation process', JSON.stringify(event));
    
    // Extract action and parameters from the event
    const { action, ...params } = event;
    
    // Execute the appropriate function based on the action
    switch (action) {
      case 'checkDeliveryStatus':
        return await checkDeliveryStatus(params.deliveryId, params.alertId, params.userId);
        
      case 'getEscalationConfig':
        return await getEscalationConfig(params.userId, params.alertId, params.deliveryId, params.currentAttempt);
        
      case 'selectAlternativeChannel':
        return await selectAlternativeChannel(
          params.userId, 
          params.alertId, 
          params.deliveryId, 
          params.currentAttempt, 
          params.escalationConfig, 
          params.previousChannels
        );
        
      case 'logEscalationFailure':
        return await logEscalationFailure(params.userId, params.alertId, params.deliveryId, params.reason);
        
      case 'updateEscalationStatus':
        return await updateEscalationStatus(
          params.userId, 
          params.alertId, 
          params.deliveryId, 
          params.currentAttempt, 
          params.selectedChannel, 
          params.deliveryResult
        );
        
      case 'incrementAttempt':
        return await incrementAttempt(
          params.userId, 
          params.alertId, 
          params.deliveryId, 
          params.currentAttempt, 
          params.escalationConfig, 
          params.previousChannels, 
          params.selectedChannel
        );
        
      case 'completeEscalation':
        return await completeEscalation(params.userId, params.alertId, params.deliveryId, params.escalationSummary);
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`Error in alert escalation: ${error.message}`);
    throw error;
  }
};

export default handler;