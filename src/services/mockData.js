// Mock data service for development when backend is not deployed
export const mockAlerts = [
  {
    id: '1',
    title: 'Severe Weather Alert',
    description: 'Heavy rain and thunderstorms expected in the area',
    severity: 'HIGH',
    category: 'WEATHER',
    location: {
      type: 'Point',
      coordinates: '{"type":"Point","coordinates":[-122.4194,37.7749]}'
    },
    locationName: 'San Francisco',
    locationState: 'CA',
    source: 'National Weather Service',
    sourceId: 'NWS-001',
    eventType: 'Thunderstorm',
    startTime: new Date().toISOString(),
    isActive: true,
    tags: ['weather', 'rain', 'storm']
  },
  {
    id: '2',
    title: 'Traffic Incident',
    description: 'Major accident on Highway 101, expect delays',
    severity: 'MEDIUM',
    category: 'TRAFFIC',
    location: {
      type: 'Point',
      coordinates: '{"type":"Point","coordinates":[-118.2437,34.0522]}'
    },
    locationName: 'Los Angeles',
    locationState: 'CA',
    source: 'CalTrans',
    sourceId: 'CT-002',
    eventType: 'Accident',
    startTime: new Date(Date.now() - 3600000).toISOString(),
    isActive: true,
    tags: ['traffic', 'accident', 'highway']
  }
];

export const getMockAlerts = () => {
  return Promise.resolve({
    data: {
      listAlerts: {
        items: mockAlerts
      }
    }
  });
};
// Mock function to get a single alert by ID
export const getMockAlertById = (id) => {
  // Find the alert in our mock data
  const alert = mockAlerts.find(alert => alert.id === id);
  
  if (!alert) {
    return Promise.reject(new Error('Alert not found'));
  }
  
  // Ensure we have valid dates
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  
  // Enhance the alert with additional details for the detail page
  const enhancedAlert = {
    ...alert,
    headline: alert.title,
    certainty: 'Observed',
    sourceType: alert.source,
    createdAt: oneHourAgo.toISOString(),
    updatedAt: now.toISOString(),
    instructions: alert.category === 'WEATHER' 
      ? 'Seek shelter immediately and stay away from windows. Monitor local news for updates.'
      : alert.category === 'TRAFFIC'
      ? 'Avoid the affected area and seek alternative routes. Follow instructions from authorities.'
      : 'Follow official guidance and stay informed through reliable sources.',
    affectedAreas: [
      {
        areaId: 'area-001',
        areaName: alert.locationName,
        areaType: 'City',
        geometry: null
      }
    ],
    resources: [
      {
        resourceType: 'Website',
        mimeType: 'text/html',
        uri: 'https://example.com/resources',
        description: 'Official information source'
      }
    ],
    parameters: JSON.stringify({
      additionalInfo: 'Mock data for demonstration purposes'
    }),
    aiInsights: {
      analysis: `This ${alert.category.toLowerCase()} alert affects ${alert.locationName} and surrounding areas. Based on historical data, similar events have lasted approximately 3-5 hours.`,
      recommendations: [
        'Stay informed through official channels',
        'Follow safety protocols for this type of event',
        'Check on vulnerable neighbors if safe to do so'
      ],
      confidenceScore: 0.87,
      sources: [
        'Historical event data',
        'Current conditions analysis',
        'Official recommendations'
      ]
    },
    version: '1.0'
  };
  
  return Promise.resolve({
    data: {
      getAlert: enhancedAlert
    }
  });
};
