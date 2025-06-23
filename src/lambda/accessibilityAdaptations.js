const AWS = require('aws-sdk');
const bedrock = new AWS.BedrockRuntime();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * Lambda function to adapt alert content for accessibility needs using Amazon Bedrock
 * 
 * This function takes an alert and user preferences, then adapts the content
 * to meet specific accessibility requirements including:
 * - Text-to-speech conversion
 * - Format simplification
 * - Language translation
 * - Visual adaptations (high contrast descriptions)
 * - Simplified language for cognitive accessibility
 */
exports.handler = async (event) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    // Extract alert and user information from the event
    const { alertId, userId } = event;
    
    if (!alertId || !userId) {
      throw new Error('Missing required parameters: alertId and userId are required');
    }
    
    // Fetch the alert and user data
    const [alert, user] = await Promise.all([
      getAlert(alertId),
      getUser(userId)
    ]);
    
    // Check if user has accessibility preferences
    if (!user.profile.accessibilityPreferences) {
      console.log('User has no accessibility preferences defined');
      return {
        statusCode: 200,
        body: {
          alertId,
          userId,
          adaptations: [],
          message: 'No accessibility adaptations needed'
        }
      };
    }
    
    // Determine which adaptations are needed based on user preferences
    const adaptations = determineRequiredAdaptations(user.profile.accessibilityPreferences);
    
    // Process adaptations in parallel
    const adaptationResults = await Promise.all(
      adaptations.map(adaptation => 
        processAdaptation(adaptation, alert, user.profile)
      )
    );
    
    // Save the adapted content to DynamoDB
    await saveAdaptations(alertId, userId, adaptationResults);
    
    return {
      statusCode: 200,
      body: {
        alertId,
        userId,
        adaptations: adaptationResults.map(result => ({
          type: result.type,
          status: 'completed'
        })),
        message: 'Accessibility adaptations completed successfully'
      }
    };
  } catch (error) {
    console.error('Error processing accessibility adaptations:', error);
    return {
      statusCode: 500,
      body: {
        message: 'Error processing accessibility adaptations',
        error: error.message
      }
    };
  }
};

/**
 * Fetch alert data from DynamoDB
 */
async function getAlert(alertId) {
  const params = {
    TableName: process.env.ALERTS_TABLE,
    Key: { alertId }
  };
  
  const result = await dynamoDB.get(params).promise();
  
  if (!result.Item) {
    throw new Error(`Alert not found: ${alertId}`);
  }
  
  return result.Item;
}

/**
 * Fetch user data from DynamoDB
 */
async function getUser(userId) {
  const params = {
    TableName: process.env.USERS_TABLE,
    Key: { userId }
  };
  
  const result = await dynamoDB.get(params).promise();
  
  if (!result.Item) {
    throw new Error(`User not found: ${userId}`);
  }
  
  return result.Item;
}

/**
 * Determine which adaptations are needed based on user preferences
 */
function determineRequiredAdaptations(accessibilityPreferences) {
  const adaptations = [];
  
  // Check for text-to-speech preference
  if (accessibilityPreferences.audioEnabled) {
    adaptations.push('text-to-speech');
  }
  
  // Check for preferred format
  if (accessibilityPreferences.preferredFormat) {
    adaptations.push('format-conversion');
  }
  
  // Check for color scheme preference (for visual adaptations)
  if (accessibilityPreferences.colorScheme) {
    adaptations.push('visual-adaptation');
  }
  
  // Check for text size preference
  if (accessibilityPreferences.textSize) {
    adaptations.push('text-size-adaptation');
  }
  
  // Check for additional needs
  if (accessibilityPreferences.additionalNeeds && 
      accessibilityPreferences.additionalNeeds.includes('simplified-language')) {
    adaptations.push('simplified-language');
  }
  
  // Check for language translation needs
  if (accessibilityPreferences.language && 
      accessibilityPreferences.language !== 'en') {
    adaptations.push('language-translation');
  }
  
  return adaptations;
}

/**
 * Process a specific adaptation using Amazon Bedrock
 */
async function processAdaptation(adaptationType, alert, userProfile) {
  console.log(`Processing adaptation: ${adaptationType}`);
  
  // Prepare the content to be adapted
  const content = prepareContentForAdaptation(alert);
  
  // Prepare the result object
  const result = {
    type: adaptationType,
    originalContent: content,
    adaptedContent: null
  };
  
  try {
    switch (adaptationType) {
      case 'text-to-speech':
        result.adaptedContent = await convertTextToSpeech(content);
        break;
        
      case 'format-conversion':
        result.adaptedContent = await convertFormat(content, userProfile.accessibilityPreferences.preferredFormat);
        break;
        
      case 'visual-adaptation':
        result.adaptedContent = await adaptVisualDescription(content, userProfile.accessibilityPreferences.colorScheme);
        break;
        
      case 'text-size-adaptation':
        // This is handled client-side, but we include metadata
        result.adaptedContent = {
          content,
          metadata: {
            textSize: userProfile.accessibilityPreferences.textSize
          }
        };
        break;
        
      case 'simplified-language':
        result.adaptedContent = await simplifyLanguage(content);
        break;
        
      case 'language-translation':
        result.adaptedContent = await translateContent(content, userProfile.language);
        break;
        
      default:
        throw new Error(`Unsupported adaptation type: ${adaptationType}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error processing ${adaptationType} adaptation:`, error);
    result.error = error.message;
    return result;
  }
}

/**
 * Prepare alert content for adaptation
 */
function prepareContentForAdaptation(alert) {
  return {
    headline: alert.headline,
    description: alert.description,
    instructions: alert.instructions,
    severity: alert.severity,
    eventType: alert.eventType,
    location: alert.location
  };
}

/**
 * Convert text to speech using Amazon Bedrock
 */
async function convertTextToSpeech(content) {
  // Combine the relevant content into a single narrative
  const narrative = `
    Alert: ${content.headline}. 
    Severity level: ${content.severity}. 
    ${content.description}
    
    Instructions: ${content.instructions}
  `;
  
  // Call Amazon Bedrock for text-to-speech conversion
  const params = {
    modelId: 'amazon.titan-text-express-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: narrative,
      textToSpeechConfig: {
        voice: 'alloy',
        engine: 'neural'
      }
    })
  };
  
  try {
    // For now, we're mocking this call since we're not actually calling Bedrock
    // In a real implementation, we would call bedrock.invokeModel(params)
    
    // Mock response
    return {
      audioContent: 'base64-encoded-audio-content-would-be-here',
      format: 'mp3',
      duration: calculateApproximateDuration(narrative)
    };
  } catch (error) {
    console.error('Error calling Bedrock for text-to-speech:', error);
    throw error;
  }
}

/**
 * Calculate approximate audio duration based on text length
 */
function calculateApproximateDuration(text) {
  // Average speaking rate is about 150 words per minute
  // So we estimate 2.5 words per second
  const wordCount = text.split(/\s+/).length;
  const durationSeconds = Math.ceil(wordCount / 2.5);
  return durationSeconds;
}

/**
 * Convert content to a specific format
 */
async function convertFormat(content, preferredFormat) {
  // Call Amazon Bedrock to convert the content to the preferred format
  const prompt = `
    Convert the following alert information to ${preferredFormat} format:
    
    Headline: ${content.headline}
    Description: ${content.description}
    Instructions: ${content.instructions}
    Severity: ${content.severity}
    Event Type: ${content.eventType}
  `;
  
  const params = {
    modelId: 'anthropic.claude-v2',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      prompt,
      max_tokens_to_sample: 500,
      temperature: 0.1,
      top_p: 0.9,
    })
  };
  
  try {
    // For now, we're mocking this call since we're not actually calling Bedrock
    // In a real implementation, we would call bedrock.invokeModel(params)
    
    // Mock response based on preferred format
    let formattedContent;
    
    switch (preferredFormat.toLowerCase()) {
      case 'bullet-points':
        formattedContent = `
          • ALERT: ${content.headline}
          • SEVERITY: ${content.severity}/10
          • TYPE: ${content.eventType}
          • DETAILS: ${content.description}
          • WHAT TO DO:
            • ${content.instructions.split('. ').join('\n            • ')}
        `;
        break;
        
      case 'short-summary':
        formattedContent = `
          EMERGENCY ALERT - ${content.eventType.toUpperCase()}
          
          ${content.headline}. Severity: ${content.severity}/10.
          
          TAKE ACTION: ${content.instructions}
        `;
        break;
        
      case 'detailed':
      default:
        formattedContent = `
          EMERGENCY ALERT
          
          Type: ${content.eventType}
          Severity: ${content.severity}/10
          
          ${content.headline}
          
          DETAILS:
          ${content.description}
          
          INSTRUCTIONS:
          ${content.instructions}
        `;
    }
    
    return {
      format: preferredFormat,
      content: formattedContent.trim()
    };
  } catch (error) {
    console.error('Error calling Bedrock for format conversion:', error);
    throw error;
  }
}

/**
 * Adapt visual descriptions for accessibility
 */
async function adaptVisualDescription(content, colorScheme) {
  // Call Amazon Bedrock to adapt visual descriptions
  const prompt = `
    Adapt the following alert description for someone who needs ${colorScheme} color scheme:
    
    Headline: ${content.headline}
    Description: ${content.description}
    Instructions: ${content.instructions}
  `;
  
  const params = {
    modelId: 'anthropic.claude-v2',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      prompt,
      max_tokens_to_sample: 500,
      temperature: 0.1,
      top_p: 0.9,
    })
  };
  
  try {
    // For now, we're mocking this call since we're not actually calling Bedrock
    // In a real implementation, we would call bedrock.invokeModel(params)
    
    // Mock response
    return {
      colorScheme,
      adaptedDescription: `${content.description} [Adapted for ${colorScheme} visibility]`,
      adaptedInstructions: `${content.instructions} [Adapted for ${colorScheme} visibility]`,
      visualMetadata: {
        contrastRatio: colorScheme === 'high-contrast' ? '7:1' : '4.5:1',
        fontRecommendation: 'sans-serif',
        colorPalette: colorScheme
      }
    };
  } catch (error) {
    console.error('Error calling Bedrock for visual adaptation:', error);
    throw error;
  }
}

/**
 * Simplify language for cognitive accessibility
 */
async function simplifyLanguage(content) {
  // Call Amazon Bedrock to simplify the language
  const prompt = `
    Simplify the following alert information to be easily understood by someone with cognitive disabilities:
    
    Headline: ${content.headline}
    Description: ${content.description}
    Instructions: ${content.instructions}
  `;
  
  const params = {
    modelId: 'anthropic.claude-v2',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      prompt,
      max_tokens_to_sample: 500,
      temperature: 0.1,
      top_p: 0.9,
    })
  };
  
  try {
    // For now, we're mocking this call since we're not actually calling Bedrock
    // In a real implementation, we would call bedrock.invokeModel(params)
    
    // Mock response
    return {
      simplifiedHeadline: `${content.headline} [Simplified]`,
      simplifiedDescription: `${content.description} [Simplified language]`,
      simplifiedInstructions: `${content.instructions} [Simplified steps]`,
      readabilityMetrics: {
        fleschKincaidGrade: 5.0,
        wordsPerSentence: 8.2
      }
    };
  } catch (error) {
    console.error('Error calling Bedrock for language simplification:', error);
    throw error;
  }
}

/**
 * Translate content to the user's preferred language
 */
async function translateContent(content, targetLanguage) {
  // Call Amazon Bedrock to translate the content
  const textToTranslate = `
    Headline: ${content.headline}
    Description: ${content.description}
    Instructions: ${content.instructions}
  `;
  
  const params = {
    modelId: 'amazon.titan-text-express-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: textToTranslate,
      targetLanguage
    })
  };
  
  try {
    // For now, we're mocking this call since we're not actually calling Bedrock
    // In a real implementation, we would call bedrock.invokeModel(params)
    
    // Mock response
    return {
      sourceLanguage: 'en',
      targetLanguage,
      translatedHeadline: `${content.headline} [Translated to ${targetLanguage}]`,
      translatedDescription: `${content.description} [Translated to ${targetLanguage}]`,
      translatedInstructions: `${content.instructions} [Translated to ${targetLanguage}]`
    };
  } catch (error) {
    console.error('Error calling Bedrock for translation:', error);
    throw error;
  }
}

/**
 * Save the adapted content to DynamoDB
 */
async function saveAdaptations(alertId, userId, adaptationResults) {
  const params = {
    TableName: process.env.ACCESSIBILITY_ADAPTATIONS_TABLE,
    Item: {
      adaptationId: `${alertId}:${userId}`,
      alertId,
      userId,
      adaptations: adaptationResults,
      createdAt: new Date().toISOString()
    }
  };
  
  return dynamoDB.put(params).promise();
}