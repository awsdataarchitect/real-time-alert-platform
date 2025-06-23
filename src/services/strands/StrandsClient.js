/**
 * StrandsClient.js
 * 
 * Client for interacting with Amazon Strands Agent to generate recommendations
 * based on alert data and historical patterns.
 */

const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');

class StrandsClient {
  constructor(config = {}) {
    this.config = {
      region: config.region || process.env.AWS_REGION || 'us-west-2',
      modelId: config.modelId || 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
      ...config
    };
    
    // Initialize AWS SDK clients
    this.bedrock = new AWS.BedrockRuntime({ region: this.config.region });
    this.lambda = new AWS.Lambda({ region: this.config.region });
    
    // Path to the Strands Agent Python script
    this.agentScriptPath = process.env.STRANDS_AGENT_SCRIPT_PATH || '/opt/python/recommendation_agent.py';
  }
  
  /**
   * Generate recommendations using Strands Agent
   * 
   * @param {Object} context - Context data for recommendation generation
   * @returns {Object} Generated recommendations
   */
  async generateRecommendations(context) {
    try {
      // Call the Strands Agent Lambda function
      const response = await this.invokeStrandsAgent(context);
      return this.processStrandsResponse(response);
    } catch (error) {
      console.error('Error invoking Strands Agent:', error);
      throw new Error(`Failed to generate recommendations: ${error.message}`);
    }
  }
  
  /**
   * Invoke the Strands Agent Lambda function
   * 
   * @param {Object} context - Context data for recommendation generation
   * @returns {Object} Raw response from Strands Agent
   */
  async invokeStrandsAgent(context) {
    // Prepare the payload for the Strands Agent Lambda
    const payload = {
      action: 'generateRecommendations',
      context: context,
      config: {
        modelId: this.config.modelId,
        maxTokens: 2000,
        temperature: 0.2,
        topP: 0.95
      }
    };
    
    // Invoke the Strands Agent Lambda function
    const params = {
      FunctionName: process.env.STRANDS_AGENT_LAMBDA || 'strands-recommendation-agent',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload)
    };
    
    const response = await this.lambda.invoke(params).promise();
    
    if (response.FunctionError) {
      throw new Error(`Strands Agent Lambda error: ${response.FunctionError}`);
    }
    
    return JSON.parse(response.Payload);
  }
  
  /**
   * Process and structure the response from Strands Agent
   * 
   * @param {Object} response - Raw response from Strands Agent
   * @returns {Object} Processed recommendations
   */
  processStrandsResponse(response) {
    // Validate response structure
    if (!response || !response.body) {
      throw new Error('Invalid response from Strands Agent');
    }
    
    const result = JSON.parse(response.body);
    
    // Ensure the response has the expected structure
    if (!result.recommendations) {
      throw new Error('Recommendations not found in Strands Agent response');
    }
    
    return {
      generalRecommendations: result.recommendations.general || [],
      specificActions: result.recommendations.specific || [],
      priorityLevel: result.priorityLevel || 'medium',
      timeframe: result.timeframe || 'immediate',
      confidenceScore: result.confidenceScore || 0.7,
      sources: result.sources || [],
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  StrandsClient
};