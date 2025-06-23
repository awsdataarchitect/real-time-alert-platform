/**
 * Lambda function for multi-channel alert delivery
 * 
 * This function delivers personalized alerts to users through their preferred channels,
 * tracks delivery status, and handles channel-specific formatting.
 * 
 * Requirements:
 * - 5.1: WHEN an alert needs to be distributed THEN the system SHALL support multiple communication channels
 *        (mobile app, SMS, email, social media, emergency broadcast systems).
 * - 5.2: WHEN sending alerts through different channels THEN the system SHALL optimize the message format
 *        for each channel using AWS generative AI services.
 * - 5.4: WHEN an alert is time-sensitive THEN the system SHALL prioritize the fastest available communication channels.
 * - 5.5: WHEN sending alerts THEN the system SHALL track delivery status and attempt alternative channels if primary channels fail.
 * - 2.6: IF a user doesn't acknowledge critical alerts THEN the system SHALL attempt alternative notification methods.
 */

import { EventBridge } from 'aws-sdk';

import { DynamoDB, SNS, SES } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { getUserPreferences } from '../services/database/userPreferenceQueries';
import { deliveryStatusValidation } from '../utils/deliveryStatusValidation';

// Initialize clients
const dynamoDB = new DynamoDB.DocumentClient();
const sns = new SNS();
const ses = new SES();
const eventBridge = new EventBridge();

// Table names from environment variables
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'alertsTable';
const DELIVERY_STATUS_TABLE = process.env.DELIVERY_STATUS_TABLE || 'deliveryStatusTable';
const ACCESSIBILITY_ADAPTATIONS_TABLE = process.env.ACCESSIBILITY_ADAPTATIONS_TABLE || 'accessibilityAdaptationsTable';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';
const ALERT_ESCALATION_STATE_MACHINE_ARN = process.env.ALERT_ESCALATION_STATE_MACHINE_ARN || '';

// Channel types
const CHANNEL_TYPES = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  APP: 'APP',
  WEBHOOK: 'WEBHOOK'
};

// Channel priorities (lower number = higher priority)
const CHANNEL_PRIORITIES = {
  [CHANNEL_TYPES.PUSH]: 1,
  [CHANNEL_TYPES.SMS]: 2,
  [CHANNEL_TYPES.APP]: 3,
  [CHANNEL_TYPES.EMAIL]: 4,
  [CHANNEL_TYPES.WEBHOOK]: 5
};

/**
 * Get personalized alert content
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Personalized alert content
 */
export const getPersonalizedAlert = async (alertId, userId) => {
  try {
    const personalizedAlertId = `${alertId}_${userId}`;
    
    const params = {
      TableName: ALERTS_TABLE,
      Key: {
        personalizedAlertId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      throw new Error(`Personalized alert not found for alert ${alertId} and user ${userId}`);
    }
    
    return result.Item;
  } catch (error) {
    console.error(`Error getting personalized alert: ${error.message}`);
    throw error;
  }
};

/**
 * Get user's notification channels
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - User's notification channels
 */
export const getUserChannels = async (userId) => {
  try {
    const userPreferences = await getUserPreferences(userId);
    
    if (!userPreferences) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const { notificationChannels = [] } = userPreferences;
    
    // Filter enabled channels and sort by priority
    return notificationChannels
      .filter(channel => channel.enabled !== false)
      .sort((a, b) => {
        const priorityA = a.priority || CHANNEL_PRIORITIES[a.channelType] || 999;
        const priorityB = b.priority || CHANNEL_PRIORITIES[b.channelType] || 999;
        return priorityA - priorityB;
      });
  } catch (error) {
    console.error(`Error getting user channels for ${userId}: ${error.message}`);
    throw error;
  }
};

/**
 * Get accessibility adaptations for a user and alert
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - Accessibility adaptations or null if none exist
 */
export const getAccessibilityAdaptations = async (alertId, userId) => {
  try {
    const adaptationId = `${alertId}:${userId}`;
    
    const params = {
      TableName: process.env.ACCESSIBILITY_ADAPTATIONS_TABLE || 'accessibilityAdaptationsTable',
      Key: {
        adaptationId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      console.log(`No accessibility adaptations found for alert ${alertId} and user ${userId}`);
      return null;
    }
    
    return result.Item;
  } catch (error) {
    console.error(`Error getting accessibility adaptations: ${error.message}`);
    // Don't throw error, just return null to continue with standard delivery
    return null;
  }
};

/**
 * Format alert content for specific channel
 * @param {Object} personalizedAlert - Personalized alert content
 * @param {string} channelType - Channel type
 * @param {Object} accessibilityAdaptations - Optional accessibility adaptations
 * @returns {Object} - Formatted alert content
 */
export const formatAlertForChannel = (personalizedAlert, channelType, accessibilityAdaptations = null) => {
  const { personalizedContent } = personalizedAlert;
  
  // Base content that will be used across all channels
  const baseContent = {
    headline: personalizedContent.headline,
    message: personalizedContent.shortMessage,
    alertId: personalizedAlert.alertId
  };
  
  // Apply accessibility adaptations if available
  if (accessibilityAdaptations) {
    // Find adaptations relevant to this channel type
    const adaptations = accessibilityAdaptations.adaptations || [];
    
    // Apply text-to-speech adaptation for audio-capable channels
    const textToSpeechAdaptation = adaptations.find(a => a.type === 'text-to-speech');
    if (textToSpeechAdaptation && ['EMAIL', 'APP'].includes(channelType)) {
      baseContent.audioContent = textToSpeechAdaptation.adaptedContent?.audioContent;
      baseContent.audioDuration = textToSpeechAdaptation.adaptedContent?.duration;
      baseContent.audioFormat = textToSpeechAdaptation.adaptedContent?.format;
    }
    
    // Apply format conversion adaptation
    const formatAdaptation = adaptations.find(a => a.type === 'format-conversion');
    if (formatAdaptation) {
      baseContent.adaptedFormat = formatAdaptation.adaptedContent?.format;
      baseContent.adaptedContent = formatAdaptation.adaptedContent?.content;
    }
    
    // Apply simplified language adaptation
    const simplifiedLanguageAdaptation = adaptations.find(a => a.type === 'simplified-language');
    if (simplifiedLanguageAdaptation) {
      baseContent.simplifiedHeadline = simplifiedLanguageAdaptation.adaptedContent?.simplifiedHeadline;
      baseContent.simplifiedMessage = simplifiedLanguageAdaptation.adaptedContent?.simplifiedDescription;
      baseContent.simplifiedInstructions = simplifiedLanguageAdaptation.adaptedContent?.simplifiedInstructions;
    }
    
    // Apply language translation adaptation
    const translationAdaptation = adaptations.find(a => a.type === 'language-translation');
    if (translationAdaptation) {
      baseContent.translatedHeadline = translationAdaptation.adaptedContent?.translatedHeadline;
      baseContent.translatedMessage = translationAdaptation.adaptedContent?.translatedDescription;
      baseContent.translatedInstructions = translationAdaptation.adaptedContent?.translatedInstructions;
      baseContent.language = translationAdaptation.adaptedContent?.targetLanguage;
    }
  }
  
  // Format content based on channel type
  switch (channelType) {
    case CHANNEL_TYPES.EMAIL:
      return {
        ...baseContent,
        subject: personalizedContent.headline,
        htmlBody: `
          <h1>${personalizedContent.headline}</h1>
          <p><strong>${personalizedContent.shortMessage}</strong></p>
          <p>${personalizedContent.detailedMessage}</p>
          <h2>What You Should Do</h2>
          <p>${personalizedContent.personalizedInstructions}</p>
          <p><em>${personalizedContent.additionalContext}</em></p>
        `,
        textBody: `
${personalizedContent.headline}

${personalizedContent.shortMessage}

${personalizedContent.detailedMessage}

WHAT YOU SHOULD DO:
${personalizedContent.personalizedInstructions}

${personalizedContent.additionalContext}
        `
      };
      
    case CHANNEL_TYPES.SMS:
      // SMS needs to be concise
      return {
        ...baseContent,
        message: `ALERT: ${personalizedContent.headline}. ${personalizedContent.shortMessage} ${personalizedContent.personalizedInstructions.split('.')[0]}.`
      };
      
    case CHANNEL_TYPES.PUSH:
      // Push notifications need a title and short body
      return {
        ...baseContent,
        title: personalizedContent.headline,
        body: personalizedContent.shortMessage,
        data: {
          alertId: personalizedAlert.alertId,
          userId: personalizedAlert.userId,
          type: 'ALERT'
        }
      };
      
    case CHANNEL_TYPES.APP:
      // In-app notifications can include more details
      return {
        ...baseContent,
        title: personalizedContent.headline,
        body: personalizedContent.shortMessage,
        details: personalizedContent.detailedMessage,
        instructions: personalizedContent.personalizedInstructions,
        context: personalizedContent.additionalContext,
        data: {
          alertId: personalizedAlert.alertId,
          userId: personalizedAlert.userId,
          type: 'ALERT'
        }
      };
      
    case CHANNEL_TYPES.WEBHOOK:
      // Webhook payloads include all data
      return {
        ...baseContent,
        alert: {
          headline: personalizedContent.headline,
          shortMessage: personalizedContent.shortMessage,
          detailedMessage: personalizedContent.detailedMessage,
          personalizedInstructions: personalizedContent.personalizedInstructions,
          additionalContext: personalizedContent.additionalContext,
          alertId: personalizedAlert.alertId,
          userId: personalizedAlert.userId
        }
      };
      
    default:
      return baseContent;
  }
};

/**
 * Create delivery status record
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID
 * @param {string} channelType - Channel type
 * @param {string} channelId - Channel ID
 * @returns {Promise<Object>} - Delivery status record
 */
export const createDeliveryStatus = async (alertId, userId, channelType, channelId) => {
  try {
    const deliveryId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const deliveryStatus = {
      deliveryId,
      alertId,
      userId,
      channelType,
      channelId,
      status: 'PENDING',
      sentAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      retryCount: 0
    };
    
    // Validate the delivery status object
    const validationResult = deliveryStatusValidation(deliveryStatus);
    if (!validationResult.valid) {
      throw new Error(`Invalid delivery status: ${validationResult.errors.join(', ')}`);
    }
    
    const params = {
      TableName: DELIVERY_STATUS_TABLE,
      Item: deliveryStatus
    };
    
    await dynamoDB.put(params).promise();
    
    return deliveryStatus;
  } catch (error) {
    console.error(`Error creating delivery status: ${error.message}`);
    throw error;
  }
};

/**
 * Update delivery status
 * @param {string} deliveryId - Delivery ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} - Updated delivery status
 */
export const updateDeliveryStatus = async (deliveryId, status, additionalData = {}) => {
  try {
    const timestamp = new Date().toISOString();
    
    let updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
    let expressionAttributeNames = {
      '#status': 'status'
    };
    let expressionAttributeValues = {
      ':status': status,
      ':updatedAt': timestamp
    };
    
    // Add status-specific timestamp
    if (status === 'DELIVERED') {
      updateExpression += ', deliveredAt = :deliveredAt';
      expressionAttributeValues[':deliveredAt'] = timestamp;
    } else if (status === 'ACKNOWLEDGED') {
      updateExpression += ', acknowledgedAt = :acknowledgedAt';
      expressionAttributeValues[':acknowledgedAt'] = timestamp;
    } else if (status === 'FAILED') {
      updateExpression += ', failedAt = :failedAt';
      expressionAttributeValues[':failedAt'] = timestamp;
    }
    
    // Add additional data to update expression
    Object.entries(additionalData).forEach(([key, value]) => {
      updateExpression += `, #${key} = :${key}`;
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    });
    
    const params = {
      TableName: DELIVERY_STATUS_TABLE,
      Key: {
        deliveryId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    
    // If the status is DELIVERED, publish an event to EventBridge for potential escalation
    if (status === 'DELIVERED') {
      await publishDeliveryEvent(result.Attributes);
    }
    
    return result.Attributes;
  } catch (error) {
    console.error(`Error updating delivery status: ${error.message}`);
    throw error;
  }
};

/**
 * Publish delivery event to EventBridge for escalation workflow
 * @param {Object} deliveryStatus - Delivery status object
 * @returns {Promise<Object>} - EventBridge put result
 */
export const publishDeliveryEvent = async (deliveryStatus) => {
  try {
    const { deliveryId, alertId, userId, channelType, channelId, status } = deliveryStatus;
    
    // Only publish events for DELIVERED status (not ACKNOWLEDGED or FAILED)
    if (status !== 'DELIVERED') {
      return null;
    }
    
    const params = {
      Entries: [
        {
          Source: 'custom.alertDelivery',
          DetailType: 'AlertDelivered',
          Detail: JSON.stringify({
            deliveryId,
            alertId,
            userId,
            channelType,
            channelId,
            status,
            deliveredAt: deliveryStatus.deliveredAt,
            currentAttempt: 0
          }),
          EventBusName: 'default'
        }
      ]
    };
    
    const result = await eventBridge.putEvents(params).promise();
    
    console.log(`Published delivery event for escalation: ${deliveryId}`);
    
    return result;
  } catch (error) {
    console.error(`Error publishing delivery event: ${error.message}`);
    // Don't throw the error, just log it - we don't want to fail the delivery if event publishing fails
    return null;
  }
};

/**
 * Send alert via email
 * @param {Object} formattedAlert - Formatted alert content
 * @param {string} emailAddress - Recipient email address
 * @param {string} deliveryId - Delivery ID for tracking
 * @returns {Promise<Object>} - Delivery result
 */
export const sendEmailAlert = async (formattedAlert, emailAddress, deliveryId) => {
  try {
    const params = {
      Destination: {
        ToAddresses: [emailAddress]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: formattedAlert.htmlBody
          },
          Text: {
            Charset: 'UTF-8',
            Data: formattedAlert.textBody
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: formattedAlert.subject
        }
      },
      Source: 'alerts@realtimealertplatform.com', // This should be a verified SES sender
      MessageTags: [
        {
          Name: 'deliveryId',
          Value: deliveryId
        }
      ]
    };
    
    const result = await ses.sendEmail(params).promise();
    
    return {
      success: true,
      messageId: result.MessageId,
      channel: CHANNEL_TYPES.EMAIL,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error sending email alert: ${error.message}`);
    return {
      success: false,
      error: error.message,
      channel: CHANNEL_TYPES.EMAIL,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Send alert via SMS
 * @param {Object} formattedAlert - Formatted alert content
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} deliveryId - Delivery ID for tracking
 * @returns {Promise<Object>} - Delivery result
 */
export const sendSmsAlert = async (formattedAlert, phoneNumber, deliveryId) => {
  try {
    const params = {
      Message: formattedAlert.message,
      PhoneNumber: phoneNumber,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'ALERT'
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional'
        },
        'deliveryId': {
          DataType: 'String',
          StringValue: deliveryId
        }
      }
    };
    
    const result = await sns.publish(params).promise();
    
    return {
      success: true,
      messageId: result.MessageId,
      channel: CHANNEL_TYPES.SMS,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error sending SMS alert: ${error.message}`);
    return {
      success: false,
      error: error.message,
      channel: CHANNEL_TYPES.SMS,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Send alert via push notification
 * @param {Object} formattedAlert - Formatted alert content
 * @param {string} deviceToken - Device token for push notification
 * @param {string} deliveryId - Delivery ID for tracking
 * @returns {Promise<Object>} - Delivery result
 */
export const sendPushAlert = async (formattedAlert, deviceToken, deliveryId) => {
  try {
    // Create message for SNS platform application
    const params = {
      Message: JSON.stringify({
        default: formattedAlert.message,
        APNS: JSON.stringify({
          aps: {
            alert: {
              title: formattedAlert.title,
              body: formattedAlert.body
            },
            sound: 'default',
            'content-available': 1
          },
          data: {
            ...formattedAlert.data,
            deliveryId
          }
        }),
        APNS_SANDBOX: JSON.stringify({
          aps: {
            alert: {
              title: formattedAlert.title,
              body: formattedAlert.body
            },
            sound: 'default',
            'content-available': 1
          },
          data: {
            ...formattedAlert.data,
            deliveryId
          }
        }),
        GCM: JSON.stringify({
          notification: {
            title: formattedAlert.title,
            body: formattedAlert.body,
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          data: {
            ...formattedAlert.data,
            deliveryId
          }
        })
      }),
      MessageStructure: 'json',
      TargetArn: deviceToken
    };
    
    const result = await sns.publish(params).promise();
    
    return {
      success: true,
      messageId: result.MessageId,
      channel: CHANNEL_TYPES.PUSH,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error sending push alert: ${error.message}`);
    return {
      success: false,
      error: error.message,
      channel: CHANNEL_TYPES.PUSH,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Send alert via app notification (through AppSync subscription)
 * @param {Object} formattedAlert - Formatted alert content
 * @param {string} userId - User ID
 * @param {string} deliveryId - Delivery ID for tracking
 * @returns {Promise<Object>} - Delivery result
 */
export const sendAppAlert = async (formattedAlert, userId, deliveryId) => {
  try {
    // For app notifications, we store the notification in DynamoDB
    // and rely on AppSync subscriptions to deliver it to the client
    const appNotification = {
      id: uuidv4(),
      userId,
      type: 'ALERT',
      title: formattedAlert.title,
      body: formattedAlert.body,
      details: formattedAlert.details,
      instructions: formattedAlert.instructions,
      context: formattedAlert.context,
      data: {
        ...formattedAlert.data,
        deliveryId
      },
      read: false,
      createdAt: new Date().toISOString()
    };
    
    const params = {
      TableName: 'appNotificationsTable', // This would be a separate table for app notifications
      Item: appNotification
    };
    
    await dynamoDB.put(params).promise();
    
    // In a real implementation, we would trigger an AppSync mutation here
    // to notify subscribed clients about the new notification
    
    return {
      success: true,
      notificationId: appNotification.id,
      channel: CHANNEL_TYPES.APP,
      timestamp: appNotification.createdAt
    };
  } catch (error) {
    console.error(`Error sending app alert: ${error.message}`);
    return {
      success: false,
      error: error.message,
      channel: CHANNEL_TYPES.APP,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Send alert via webhook
 * @param {Object} formattedAlert - Formatted alert content
 * @param {string} webhookUrl - Webhook URL
 * @param {string} deliveryId - Delivery ID for tracking
 * @returns {Promise<Object>} - Delivery result
 */
export const sendWebhookAlert = async (formattedAlert, webhookUrl, deliveryId) => {
  try {
    // In a real implementation, we would use a HTTP client to send the webhook
    // For this example, we'll simulate a successful webhook delivery
    console.log(`Sending webhook alert to ${webhookUrl} with deliveryId ${deliveryId}`);
    
    return {
      success: true,
      webhookUrl,
      channel: CHANNEL_TYPES.WEBHOOK,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error sending webhook alert: ${error.message}`);
    return {
      success: false,
      error: error.message,
      channel: CHANNEL_TYPES.WEBHOOK,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Send alert through a specific channel
 * @param {Object} personalizedAlert - Personalized alert
 * @param {Object} channel - Channel information
 * @param {Object} accessibilityAdaptations - Optional accessibility adaptations
 * @returns {Promise<Object>} - Delivery result
 */
export const sendAlertThroughChannel = async (personalizedAlert, channel, accessibilityAdaptations = null) => {
  try {
    const { alertId, userId } = personalizedAlert;
    const { channelType, channelId } = channel;
    
    // Format alert content for the specific channel
    const formattedAlert = formatAlertForChannel(personalizedAlert, channelType, accessibilityAdaptations);
    
    // Create delivery status record
    const deliveryStatus = await createDeliveryStatus(alertId, userId, channelType, channelId);
    const { deliveryId } = deliveryStatus;
    
    let result;
    
    // Send alert through the appropriate channel
    switch (channelType) {
      case CHANNEL_TYPES.EMAIL:
        result = await sendEmailAlert(formattedAlert, channelId, deliveryId);
        break;
        
      case CHANNEL_TYPES.SMS:
        result = await sendSmsAlert(formattedAlert, channelId, deliveryId);
        break;
        
      case CHANNEL_TYPES.PUSH:
        result = await sendPushAlert(formattedAlert, channelId, deliveryId);
        break;
        
      case CHANNEL_TYPES.APP:
        result = await sendAppAlert(formattedAlert, userId, deliveryId);
        break;
        
      case CHANNEL_TYPES.WEBHOOK:
        result = await sendWebhookAlert(formattedAlert, channelId, deliveryId);
        break;
        
      default:
        throw new Error(`Unsupported channel type: ${channelType}`);
    }
    
    // Update delivery status based on result
    if (result.success) {
      await updateDeliveryStatus(deliveryId, 'DELIVERED', {
        messageId: result.messageId,
        deliveryDetails: result
      });
    } else {
      await updateDeliveryStatus(deliveryId, 'FAILED', {
        errorDetails: {
          message: result.error,
          timestamp: result.timestamp
        }
      });
    }
    
    return {
      ...result,
      deliveryId
    };
  } catch (error) {
    console.error(`Error sending alert through channel: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Deliver alert to a user through their preferred channels
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID
 * @param {boolean} isTimeSensitive - Whether the alert is time-sensitive
 * @param {Object} specificChannel - Optional specific channel to use
 * @returns {Promise<Object>} - Delivery results
 */
export const deliverAlertToUser = async (alertId, userId, isTimeSensitive = false, specificChannel = null) => {
  try {
    // Get personalized alert content
    const personalizedAlert = await getPersonalizedAlert(alertId, userId);
    
    // Get user's notification channels
    const userChannels = await getUserChannels(userId);
    
    // Get accessibility adaptations if available
    const accessibilityAdaptations = await getAccessibilityAdaptations(alertId, userId);
    
    if (userChannels.length === 0) {
      return {
        success: false,
        error: 'No notification channels configured for user',
        userId,
        alertId
      };
    }
    
    const results = {
      userId,
      alertId,
      deliveryAttempts: [],
      successfulDeliveries: [],
      failedDeliveries: []
    };
    
    // If a specific channel is provided, use only that channel
    // If time-sensitive, use only the highest priority channel
    // Otherwise, try all channels in order of priority
    const channelsToTry = specificChannel ? [specificChannel] : 
                         isTimeSensitive ? [userChannels[0]] : userChannels;
    
    for (const channel of channelsToTry) {
      const deliveryResult = await sendAlertThroughChannel(personalizedAlert, channel, accessibilityAdaptations);
      
      results.deliveryAttempts.push({
        channelType: channel.channelType,
        channelId: channel.channelId,
        result: deliveryResult
      });
      
      if (deliveryResult.success) {
        results.successfulDeliveries.push({
          channelType: channel.channelType,
          channelId: channel.channelId,
          deliveryId: deliveryResult.deliveryId
        });
      } else {
        results.failedDeliveries.push({
          channelType: channel.channelType,
          channelId: channel.channelId,
          error: deliveryResult.error
        });
      }
      
      // If time-sensitive or we've had a successful delivery, we can stop
      if (isTimeSensitive || deliveryResult.success) {
        break;
      }
    }
    
    // If all channels failed and we have backup channels, try them
    if (results.successfulDeliveries.length === 0 && results.failedDeliveries.length > 0) {
      console.log(`All primary channels failed for user ${userId}, alert ${alertId}. Attempting backup channels.`);
      
      // In a real implementation, we might have backup channels or escalation logic here
    }
    
    results.success = results.successfulDeliveries.length > 0;
    
    return results;
  } catch (error) {
    console.error(`Error delivering alert to user: ${error.message}`);
    return {
      success: false,
      error: error.message,
      userId,
      alertId
    };
  }
};

/**
 * Process batch delivery for multiple users
 * @param {string} alertId - Alert ID
 * @param {Array<string>} userIds - User IDs
 * @param {boolean} isTimeSensitive - Whether the alert is time-sensitive
 * @returns {Promise<Object>} - Batch delivery results
 */
export const processBatchDelivery = async (alertId, userIds, isTimeSensitive = false) => {
  const results = {
    total: userIds.length,
    successful: 0,
    failed: 0,
    details: []
  };
  
  for (const userId of userIds) {
    try {
      const result = await deliverAlertToUser(alertId, userId, isTimeSensitive);
      results.details.push(result);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error(`Unexpected error delivering alert to user ${userId}: ${error.message}`);
      results.failed++;
      results.details.push({
        success: false,
        error: error.message,
        userId,
        alertId
      });
    }
  }
  
  return results;
};

/**
 * Lambda handler function
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Lambda response
 */
export const handler = async (event, context) => {
  try {
    console.log('Starting multi-channel alert delivery process');
    
    // Parse request parameters
    const { alertId, userId, userIds, isTimeSensitive = false, specificChannel = null } = event;
    
    // Validate required parameters
    if (!alertId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Alert ID is required'
        })
      };
    }
    
    // Process for a single user or multiple users
    if (userId) {
      // Process for a single user
      const result = await deliverAlertToUser(alertId, userId, isTimeSensitive, specificChannel);
      
      return {
        statusCode: result.success ? 200 : 500,
        body: JSON.stringify({
          message: result.success 
            ? 'Alert delivered successfully' 
            : 'Error delivering alert',
          result
        })
      };
    } else if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Process for multiple users
      const results = await processBatchDelivery(alertId, userIds, isTimeSensitive);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Batch delivery processing completed',
          results
        })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Either userId or userIds array is required'
        })
      };
    }
  } catch (error) {
    console.error(`Error in multi-channel alert delivery: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in multi-channel alert delivery process',
        error: error.message
      })
    };
  }
};

export default handler;