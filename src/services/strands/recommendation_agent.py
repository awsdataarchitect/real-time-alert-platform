"""
Recommendation Agent using Strands Agents SDK

This script implements a Strands Agent that generates recommendations
based on alert data and historical patterns.
"""

import json
import logging
import os
from typing import Dict, List, Any

from strands import Agent, tool
from strands_tools import retrieve

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("recommendation_agent")

# Define custom tools for the recommendation agent
@tool
def analyze_historical_patterns(alerts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze historical alerts to identify patterns and effective actions.
    
    Args:
        alerts: List of historical alert data
        
    Returns:
        Dictionary containing identified patterns and effective actions
    """
    if not alerts or len(alerts) == 0:
        return {
            "patterns": [],
            "effective_actions": []
        }
    
    # Group alerts by type
    alert_types = {}
    for alert in alerts:
        event_type = alert.get("eventType", "unknown")
        if event_type not in alert_types:
            alert_types[event_type] = []
        alert_types[event_type].append(alert)
    
    # Extract patterns and effective actions
    patterns = []
    effective_actions = []
    
    for event_type, type_alerts in alert_types.items():
        # Identify common actions that were effective
        actions_count = {}
        for alert in type_alerts:
            for action in alert.get("effectiveActions", []):
                if action not in actions_count:
                    actions_count[action] = 0
                actions_count[action] += 1
        
        # Add top actions to the list
        top_actions = sorted(actions_count.items(), key=lambda x: x[1], reverse=True)
        for action, count in top_actions[:3]:
            effective_actions.append({
                "action": action,
                "eventType": event_type,
                "frequency": count,
                "confidence": min(count / len(type_alerts), 0.95)
            })
        
        # Identify patterns in timing, severity, and location
        if len(type_alerts) >= 3:
            patterns.append({
                "eventType": event_type,
                "count": len(type_alerts),
                "averageSeverity": sum(a.get("severity", 0) for a in type_alerts) / len(type_alerts),
                "description": f"Pattern of {event_type} alerts identified with {len(type_alerts)} occurrences"
            })
    
    return {
        "patterns": patterns,
        "effective_actions": effective_actions
    }

@tool
def get_best_practices(event_type: str, sub_type: str = None) -> List[str]:
    """
    Retrieve best practices for handling specific types of alerts.
    
    Args:
        event_type: The type of event (weather, earthquake, health, etc.)
        sub_type: Optional sub-type for more specific recommendations
        
    Returns:
        List of best practice recommendations
    """
    # This would typically connect to a knowledge base or database
    # For now, we'll use a simple mapping of best practices
    best_practices = {
        "weather": {
            "hurricane": [
                "Evacuate if directed by local authorities",
                "Secure outdoor objects that could become projectiles",
                "Prepare emergency supplies including food, water, and medications",
                "Stay away from windows during the storm",
                "Monitor NOAA Weather Radio for updates"
            ],
            "tornado": [
                "Move to an interior room on the lowest floor",
                "Stay away from windows",
                "Cover your head and neck",
                "Monitor local weather alerts",
                "Have emergency supplies ready"
            ],
            "flood": [
                "Move to higher ground immediately",
                "Do not walk, swim, or drive through flood waters",
                "Stay off bridges over fast-moving water",
                "Evacuate if told to do so",
                "Prepare emergency supplies"
            ],
            "default": [
                "Stay informed through official weather channels",
                "Prepare emergency supplies",
                "Follow evacuation orders if issued",
                "Secure your property if time allows",
                "Have a communication plan with family members"
            ]
        },
        "earthquake": {
            "default": [
                "Drop, cover, and hold on",
                "If indoors, stay away from windows and exterior walls",
                "If outdoors, move to an open area away from buildings and power lines",
                "Be prepared for aftershocks",
                "Check for injuries and damage after shaking stops",
                "Listen to emergency radio for instructions"
            ]
        },
        "health": {
            "epidemic": [
                "Follow public health guidelines",
                "Practice good hygiene including frequent handwashing",
                "Maintain social distancing as recommended",
                "Wear appropriate protective equipment if advised",
                "Stay home if you develop symptoms",
                "Seek medical attention if symptoms worsen"
            ],
            "default": [
                "Follow guidance from health authorities",
                "Maintain proper hygiene practices",
                "Stay informed through official health channels",
                "Prepare necessary medications and supplies",
                "Have emergency contacts readily available"
            ]
        },
        "security": {
            "default": [
                "Follow instructions from authorities",
                "Avoid the affected area",
                "Report suspicious activity to authorities",
                "Stay informed through official channels",
                "Have an emergency plan and supplies ready"
            ]
        },
        "default": [
            "Stay informed through official channels",
            "Follow instructions from authorities",
            "Have emergency supplies ready",
            "Develop and practice an emergency plan",
            "Help neighbors who may need assistance"
        ]
    }
    
    # Get best practices for the event type and sub-type
    if event_type.lower() in best_practices:
        type_practices = best_practices[event_type.lower()]
        if sub_type and sub_type.lower() in type_practices:
            return type_practices[sub_type.lower()]
        elif "default" in type_practices:
            return type_practices["default"]
    
    # Return default best practices if specific ones not found
    return best_practices["default"]

# Create the Strands Agent
agent = Agent(
    model=os.environ.get("STRANDS_MODEL_ID", "us.anthropic.claude-3-7-sonnet-20250219-v1:0"),
    tools=[analyze_historical_patterns, get_best_practices, retrieve],
    system_prompt="""
    You are an expert emergency management and public safety recommendation system.
    Your role is to analyze alert data and generate actionable recommendations based on:
    1. The current alert details
    2. Historical patterns from similar alerts
    3. Best practices for the specific type of emergency
    
    Your recommendations should be:
    - Clear and actionable
    - Prioritized by importance
    - Specific to the situation
    - Based on evidence and best practices
    
    For each recommendation, provide:
    - The recommended action
    - Why it's important
    - How urgently it should be implemented
    
    Always cite your sources and provide a confidence score for your recommendations.
    """
)

def lambda_handler(event, context):
    """
    AWS Lambda handler function for the Strands Agent
    
    Args:
        event: Lambda event data
        context: Lambda context
        
    Returns:
        Dictionary with generated recommendations
    """
    try:
        logger.info("Received event: %s", json.dumps(event))
        
        # Extract action and context from the event
        action = event.get("action")
        if action != "generateRecommendations":
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": f"Unsupported action: {action}"
                })
            }
        
        # Extract context data
        context_data = event.get("context", {})
        current_alert = context_data.get("currentAlert", {})
        historical_alerts = context_data.get("historicalAlerts", [])
        
        # Validate required data
        if not current_alert:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": "Current alert data is required"
                })
            }
        
        # Prepare the prompt for the agent
        prompt = f"""
        Generate recommendations for the following alert:
        
        ALERT DETAILS:
        Type: {current_alert.get('eventType')}
        Sub-type: {current_alert.get('subType', 'N/A')}
        Severity: {current_alert.get('severity', 'Unknown')}
        Headline: {current_alert.get('headline', 'N/A')}
        Description: {current_alert.get('description', 'N/A')}
        Location: {json.dumps(current_alert.get('location', {}))}
        Affected Areas: {json.dumps(current_alert.get('affectedAreas', []))}
        
        Based on the alert details, historical data, and best practices:
        1. Analyze historical patterns from similar alerts
        2. Identify best practices for this type of event
        3. Generate specific recommendations for this situation
        
        Format your response as a JSON object with the following structure:
        {{
            "recommendations": {{
                "general": ["List of general recommendations"],
                "specific": ["List of specific actions tailored to this alert"]
            }},
            "priorityLevel": "high|medium|low",
            "timeframe": "immediate|short-term|long-term",
            "confidenceScore": 0.0-1.0,
            "sources": ["List of sources or justifications"]
        }}
        """
        
        # Call the Strands Agent
        response = agent(prompt)
        
        # Extract the JSON response from the agent's message
        message_text = response.message
        json_start = message_text.find('{')
        json_end = message_text.rfind('}') + 1
        
        if json_start >= 0 and json_end > json_start:
            recommendations_json = message_text[json_start:json_end]
            recommendations = json.loads(recommendations_json)
        else:
            # Fallback if JSON parsing fails
            recommendations = {
                "recommendations": {
                    "general": ["Stay informed through official channels", 
                               "Follow instructions from authorities"],
                    "specific": []
                },
                "priorityLevel": "medium",
                "timeframe": "immediate",
                "confidenceScore": 0.5,
                "sources": ["System generated recommendations"]
            }
        
        return {
            "statusCode": 200,
            "body": json.dumps(recommendations)
        }
        
    except Exception as e:
        logger.error("Error generating recommendations: %s", str(e), exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": f"Failed to generate recommendations: {str(e)}"
            })
        }

# For local testing
if __name__ == "__main__":
    test_event = {
        "action": "generateRecommendations",
        "context": {
            "currentAlert": {
                "eventType": "weather",
                "subType": "hurricane",
                "severity": 8,
                "headline": "Hurricane Warning for Coastal Areas",
                "description": "Category 3 hurricane approaching with expected landfall in 24 hours.",
                "location": {"lat": 25.7617, "lng": -80.1918},
                "affectedAreas": [
                    {"areaId": "area-123", "areaName": "Miami-Dade County", "areaType": "county"}
                ]
            },
            "historicalAlerts": [
                {
                    "eventType": "weather",
                    "subType": "hurricane",
                    "severity": 7,
                    "headline": "Hurricane Warning",
                    "startTime": "2024-05-15T10:00:00Z",
                    "effectiveActions": [
                        "Early evacuation of coastal areas",
                        "Securing critical infrastructure",
                        "Establishing emergency shelters"
                    ],
                    "outcomes": ["Minimal casualties", "Significant property damage"]
                }
            ]
        }
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))