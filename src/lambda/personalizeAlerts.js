/**
 * Lambda function for personalizing alerts with Amazon Bedrock
 * 
 * This function personalizes alert content based on user preferences and profile
 * using Amazon Bedrock's generative AI capabilities. It implements template-based
 * personalization to create tailored alert messages for each user.
 * 
 * Requirements:
 * - 2.3: WHEN delivering an alert THEN the system SHALL personalize the content based on the user's profile using AWS generative AI services.
 * - 4.4: WHEN a user requests more information THEN the system SHALL provide AI-generated explanations and context about the situation.
 */

import { DynamoDB } from 'aws-sdk';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { getUserPreferences } from '../services/database/userPreferenceQueries';
import { getAlertById, getRelatedHistoricalAlerts } from '../services/database/alertQueries';

// Initialize clients
const dynamoDB = new DynamoDB.DocumentClient();
const bedrockRuntime = new BedrockRuntime({ region: process.env.AWS_REGION });

// Table names from environment variables
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'alertsTable';

// Bedrock model ID
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

/**
 * Get user context for personalization
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User context for personalization
 */
export const getUserContext = async (userId) => {
  try {
    const userPreferences = await getUserPreferences(userId);
    
    if (!userPreferences) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Extract relevant information for personalization
    const {
      alertPreferences,
      notificationChannels,
      locations,
      profile
    } = userPreferences;
    
    return {
      userId,
      alertPreferences,
      notificationChannels,
      locations,
      profile
    };
  } catch (error) {
    console.error(`Error getting user context for ${userId}: ${error.message}`);
    throw error;
  }
};

/**
 * Get alert context for personalization
 * @param {string} alertId - Alert ID
 * @returns {Promise<Object>} - Alert context for personalization
 */
export const getAlertContext = async (alertId) => {
  try {
    const alert = await getAlertById(alertId);
    
    if (!alert) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }
    
    // Get related historical alerts for context
    const relatedHistoricalAlerts = await getRelatedHistoricalAlerts(alert, 3);
    
    return {
      alert,
      relatedHistoricalAlerts
    };
  } catch (error) {
    console.error(`Error getting alert context for ${alertId}: ${error.message}`);
    throw error;
  }
};

/**
 * Generate personalized alert content using Amazon Bedrock
 * @param {Object} userContext - User context for personalization
 * @param {Object} alertContext - Alert context for personalization
 * @param {string} templateType - Type of template to use (brief, detailed, etc.)
 * @returns {Promise<Object>} - Personalized alert content
 */
export const generatePersonalizedContent = async (userContext, alertContext, templateType = 'standard') => {
  try {
    const { alert, relatedHistoricalAlerts } = alertContext;
    const { profile, alertPreferences, locations } = userContext;
    
    // Determine user's preferred language
    const language = profile?.language || 'en';
    
    // Determine user's accessibility needs
    const accessibilityPreferences = profile?.accessibilityPreferences || {};
    const needsSimplifiedLanguage = accessibilityPreferences.simplifiedLanguage === true;
    const preferredFormat = accessibilityPreferences.preferredFormat || 'text';
    
    // Determine user's location context
    const userLocations = locations || [];
    const locationNames = userLocations.map(loc => loc.name).join(', ');
    
    // Determine user's alert preferences
    const preferredCategories = alertPreferences?.categories || [];
    const minSeverity = alertPreferences?.minSeverity || 1;
    
    // Determine if this alert is particularly relevant to the user
    const isHighlyRelevant = determineRelevance(alert, userContext);
    
    // Prepare historical context
    const historicalContext = relatedHistoricalAlerts.length > 0 
      ? `There have been ${relatedHistoricalAlerts.length} similar events recently.` 
      : 'This appears to be an isolated incident with no similar recent events.';
    
    // Select template based on type and user preferences
    const templatePrompt = getTemplatePrompt(templateType, needsSimplifiedLanguage, preferredFormat);
    
    // Prepare the input for Bedrock
    const prompt = `
${templatePrompt}

ALERT INFORMATION:
- Headline: ${alert.headline || 'N/A'}
- Description: ${alert.description || 'N/A'}
- Event Type: ${alert.eventType || 'N/A'}
- Severity: ${alert.severity || 'Unknown'} (on a scale of 1-10)
- Location: ${JSON.stringify(alert.location) || 'N/A'}
- Start Time: ${alert.startTime || 'N/A'}
- Status: ${alert.status || 'Active'}
- Instructions: ${alert.instructions || 'N/A'}

${alert.aiInsights ? `
AI INSIGHTS:
${JSON.stringify(alert.aiInsights, null, 2)}
` : ''}

USER CONTEXT:
- Language: ${language}
- Locations of Interest: ${locationNames || 'Not specified'}
- Preferred Alert Categories: ${preferredCategories.join(', ') || 'All categories'}
- Minimum Severity Threshold: ${minSeverity}
- Needs Simplified Language: ${needsSimplifiedLanguage ? 'Yes' : 'No'}
- Preferred Format: ${preferredFormat}
- Relevance to User: ${isHighlyRelevant ? 'High' : 'Standard'}

HISTORICAL CONTEXT:
${historicalContext}

${relatedHistoricalAlerts.length > 0 ? `
RELATED HISTORICAL ALERTS:
${relatedHistoricalAlerts.map(historicalAlert => 
  `- ${historicalAlert.headline || 'Unnamed alert'} (${historicalAlert.createdAt || 'Unknown date'}): ${historicalAlert.description || 'No description'}`
).join('\n')}
` : ''}

Generate a personalized alert message in JSON format with these sections:
{
  "headline": "string",
  "shortMessage": "string",
  "detailedMessage": "string",
  "personalizedInstructions": "string",
  "relevanceExplanation": "string",
  "additionalContext": "string"
}
`;

    // Call Bedrock
    const response = await bedrockRuntime.invokeModel({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    // Parse the response
    const responseBody = JSON.parse(Buffer.from(response.body).toString());
    const content = responseBody.content[0].text;
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Bedrock response');
    }
    
    const personalizedContent = JSON.parse(jsonMatch[0]);
    
    // Add metadata
    personalizedContent.generatedAt = new Date().toISOString();
    personalizedContent.modelId = MODEL_ID;
    personalizedContent.templateType = templateType;
    
    return personalizedContent;
  } catch (error) {
    console.error(`Error generating personalized content with Bedrock: ${error.message}`);
    throw error;
  }
};

/**
 * Determine the relevance of an alert to a user
 * @param {Object} alert - Alert object
 * @param {Object} userContext - User context
 * @returns {boolean} - Whether the alert is highly relevant to the user
 */
export const determineRelevance = (alert, userContext) => {
  try {
    const { alertPreferences, locations } = userContext;
    
    // Check if alert category is in user's preferred categories
    const preferredCategories = alertPreferences?.categories || [];
    const categoryMatch = preferredCategories.length === 0 || 
      preferredCategories.includes(alert.eventType);
    
    // Check if alert severity meets user's threshold
    const minSeverity = alertPreferences?.minSeverity || 1;
    const severityMatch = alert.severity >= minSeverity;
    
    // Check if alert location is near user's locations of interest
    let locationMatch = false;
    if (alert.location && alert.location.coordinates && locations && locations.length > 0) {
      for (const userLocation of locations) {
        if (userLocation.coordinates) {
          const distance = calculateDistance(
            alert.location.coordinates[1], alert.location.coordinates[0],
            userLocation.coordinates.latitude, userLocation.coordinates.longitude
          );
          
          // Check if alert is within user's specified radius or default to 50km
          const radius = userLocation.radius || 50;
          if (distance <= radius) {
            locationMatch = true;
            break;
          }
        }
      }
    } else {
      // If location data is missing, default to true to avoid filtering out alerts
      locationMatch = true;
    }
    
    return categoryMatch && severityMatch && locationMatch;
  } catch (error) {
    console.error(`Error determining alert relevance: ${error.message}`);
    return false;
  }
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Get template prompt based on type and user preferences
 * @param {string} templateType - Type of template to use
 * @param {boolean} needsSimplifiedLanguage - Whether to use simplified language
 * @param {string} preferredFormat - User's preferred format
 * @returns {string} - Template prompt
 */
export const getTemplatePrompt = (templateType, needsSimplifiedLanguage, preferredFormat) => {
  // Base template instructions
  let template = 'You are an emergency alert system that personalizes alerts for users.';
  
  // Add template type-specific instructions
  switch (templateType) {
    case 'brief':
      template += ' Create a very concise alert that conveys only the most critical information.';
      break;
    case 'detailed':
      template += ' Create a comprehensive alert with detailed information and context.';
      break;
    case 'actionable':
      template += ' Create an alert focused on specific actions the user should take.';
      break;
    case 'informational':
      template += ' Create an alert that provides educational context about this type of event.';
      break;
    default: // standard
      template += ' Create a balanced alert with essential information and clear instructions.';
  }
  
  // Add language complexity instructions
  if (needsSimplifiedLanguage) {
    template += ' Use simple, clear language. Avoid complex sentences, technical terms, and jargon. Use short words and sentences. Explain any necessary technical terms.';
  }
  
  // Add format-specific instructions
  switch (preferredFormat) {
    case 'audio':
      template += ' Format the content to be easily read aloud by text-to-speech systems. Use phonetic spellings for uncommon words if needed.';
      break;
    case 'visual':
      template += ' Format the content to be highly scannable with clear sections and emphasis on key points.';
      break;
    default: // text
      template += ' Format the content for clear reading on digital devices.';
  }
  
  return template;
};

/**
 * Store personalized alert content in DynamoDB
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID
 * @param {Object} personalizedContent - Personalized alert content
 * @returns {Promise<Object>} - Stored personalized alert
 */
export const storePersonalizedAlert = async (alertId, userId, personalizedContent) => {
  try {
    const personalizedAlertId = `${alertId}_${userId}`;
    
    const params = {
      TableName: ALERTS_TABLE,
      Item: {
        personalizedAlertId,
        alertId,
        userId,
        personalizedContent,
        createdAt: new Date().toISOString()
      }
    };
    
    await dynamoDB.put(params).promise();
    
    return {
      personalizedAlertId,
      alertId,
      userId,
      personalizedContent
    };
  } catch (error) {
    console.error(`Error storing personalized alert: ${error.message}`);
    throw error;
  }
};

/**
 * Process a personalization request for a single user and alert
 * @param {string} alertId - Alert ID
 * @param {string} userId - User ID
 * @param {string} templateType - Type of template to use
 * @returns {Promise<Object>} - Personalized alert
 */
export const processPersonalization = async (alertId, userId, templateType = 'standard') => {
  try {
    // Get user and alert context
    const userContext = await getUserContext(userId);
    const alertContext = await getAlertContext(alertId);
    
    // Generate personalized content
    const personalizedContent = await generatePersonalizedContent(
      userContext,
      alertContext,
      templateType
    );
    
    // Store personalized alert
    const result = await storePersonalizedAlert(alertId, userId, personalizedContent);
    
    return {
      status: 'success',
      personalizedAlert: result
    };
  } catch (error) {
    console.error(`Error processing personalization for alert ${alertId} and user ${userId}: ${error.message}`);
    return {
      status: 'error',
      alertId,
      userId,
      error: error.message
    };
  }
};

/**
 * Process personalization for multiple users
 * @param {string} alertId - Alert ID
 * @param {Array<string>} userIds - User IDs
 * @param {string} templateType - Type of template to use
 * @returns {Promise<Object>} - Processing results
 */
export const processBatchPersonalization = async (alertId, userIds, templateType = 'standard') => {
  const results = {
    total: userIds.length,
    successful: 0,
    failed: 0,
    details: []
  };
  
  for (const userId of userIds) {
    try {
      const result = await processPersonalization(alertId, userId, templateType);
      results.details.push(result);
      
      if (result.status === 'success') {
        results.successful++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error(`Unexpected error processing personalization for user ${userId}: ${error.message}`);
      results.failed++;
      results.details.push({
        status: 'error',
        alertId,
        userId,
        error: error.message
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
    console.log('Starting personalized alert generation process');
    
    // Parse request parameters
    const { alertId, userId, userIds, templateType = 'standard' } = event;
    
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
      const result = await processPersonalization(alertId, userId, templateType);
      
      return {
        statusCode: result.status === 'success' ? 200 : 500,
        body: JSON.stringify({
          message: result.status === 'success' 
            ? 'Personalized alert generated successfully' 
            : 'Error generating personalized alert',
          result
        })
      };
    } else if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Process for multiple users
      const results = await processBatchPersonalization(alertId, userIds, templateType);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Batch personalization processing completed',
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
    console.error(`Error in personalized alert generation: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in personalized alert generation process',
        error: error.message
      })
    };
  }
};

export default handler;