/**
 * Lambda function for generating recommendations using Amazon Strands Agent
 * This function analyzes historical alert data and current alert conditions
 * to generate actionable recommendations for users.
 * 
 * Requirements:
 * - 4.3: Generate recommended actions based on historical data and best practices
 * - 4.5: Update recommendations in real-time when alert conditions change
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { StrandsClient } = require('../services/strands/StrandsClient');
const { getAlertById, getRelatedHistoricalAlerts } = require('../services/database/alertQueries');
const { saveRecommendation } = require('../services/database/recommendationQueries');

// Initialize AWS services
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.ALERTS_TABLE_NAME;

/**
 * Main Lambda handler function
 */
exports.handler = async (event) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    // Extract alert ID from the event
    const alertId = event.alertId;
    if (!alertId) {
      throw new Error('Alert ID is required');
    }
    
    // Get the current alert data
    const alert = await getAlertById(alertId);
    if (!alert) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }
    
    // Get historical alerts related to this alert type and location
    const historicalAlerts = await getRelatedHistoricalAlerts(alert);
    
    // Generate recommendations using Strands Agent
    const recommendations = await generateRecommendationsWithStrands(alert, historicalAlerts);
    
    // Save recommendations to database
    const recommendationId = uuidv4();
    await saveRecommendation({
      recommendationId,
      alertId,
      recommendations,
      createdAt: new Date().toISOString(),
      confidence: recommendations.confidenceScore
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Recommendations generated successfully',
        recommendationId,
        recommendations
      })
    };
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error generating recommendations',
        error: error.message
      })
    };
  }
};

/**
 * Generate recommendations using Strands Agent
 * 
 * @param {Object} currentAlert - The current alert data
 * @param {Array} historicalAlerts - Historical alerts related to the current alert
 * @returns {Object} Generated recommendations
 */
async function generateRecommendationsWithStrands(currentAlert, historicalAlerts) {
  try {
    // Initialize Strands client
    const strandsClient = new StrandsClient();
    
    // Prepare context for the Strands Agent
    const context = prepareStrandsContext(currentAlert, historicalAlerts);
    
    // Call Strands Agent to generate recommendations
    const response = await strandsClient.generateRecommendations(context);
    
    // Process and structure the recommendations
    return {
      generalRecommendations: response.generalRecommendations || [],
      specificActions: response.specificActions || [],
      priorityLevel: response.priorityLevel || 'medium',
      timeframe: response.timeframe || 'immediate',
      confidenceScore: response.confidenceScore || 0.7,
      sources: response.sources || [],
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in Strands Agent recommendation generation:', error);
    // Provide fallback recommendations if Strands fails
    return generateFallbackRecommendations(currentAlert);
  }
}

/**
 * Prepare context data for Strands Agent
 * 
 * @param {Object} currentAlert - The current alert data
 * @param {Array} historicalAlerts - Historical alerts related to the current alert
 * @returns {Object} Context for Strands Agent
 */
function prepareStrandsContext(currentAlert, historicalAlerts) {
  // Extract relevant information from the current alert
  const {
    eventType,
    subType,
    severity,
    location,
    headline,
    description,
    startTime,
    affectedAreas
  } = currentAlert;
  
  // Format historical alerts for context
  const formattedHistoricalAlerts = historicalAlerts.map(alert => ({
    eventType: alert.eventType,
    subType: alert.subType,
    severity: alert.severity,
    headline: alert.headline,
    startTime: alert.startTime,
    effectiveActions: alert.effectiveActions || [],
    outcomes: alert.outcomes || []
  }));
  
  // Return structured context for Strands Agent
  return {
    currentAlert: {
      eventType,
      subType,
      severity,
      location,
      headline,
      description,
      startTime,
      affectedAreas
    },
    historicalAlerts: formattedHistoricalAlerts,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate fallback recommendations if Strands Agent fails
 * 
 * @param {Object} alert - The current alert data
 * @returns {Object} Fallback recommendations
 */
function generateFallbackRecommendations(alert) {
  // Basic fallback recommendations based on alert type
  const baseRecommendations = {
    weather: [
      'Stay indoors and away from windows',
      'Monitor local weather updates',
      'Prepare emergency supplies',
      'Follow evacuation orders if issued'
    ],
    earthquake: [
      'Drop, cover, and hold on',
      'Stay away from windows and exterior walls',
      'If outdoors, move to an open area away from buildings',
      'Be prepared for aftershocks'
    ],
    health: [
      'Follow public health guidelines',
      'Maintain proper hygiene practices',
      'Seek medical attention if symptoms develop',
      'Stay informed through official health channels'
    ],
    security: [
      'Avoid the affected area',
      'Follow instructions from authorities',
      'Report suspicious activity',
      'Stay informed through official channels'
    ]
  };
  
  // Select appropriate recommendations based on alert type
  const alertType = alert.eventType.toLowerCase();
  const recommendations = Object.keys(baseRecommendations).includes(alertType) 
    ? baseRecommendations[alertType] 
    : baseRecommendations.security;
  
  return {
    generalRecommendations: recommendations,
    specificActions: [],
    priorityLevel: alert.severity > 7 ? 'high' : 'medium',
    timeframe: 'immediate',
    confidenceScore: 0.5,
    sources: ['System fallback recommendations'],
    updatedAt: new Date().toISOString()
  };
}