// Mock data service for development when backend is not deployed
export const mockAlerts = [
  {
    id: '1',
    title: 'Severe Weather Alert',
    description: 'Heavy rain and thunderstorms expected in the area',
    severity: 'HIGH',
    category: 'WEATHER',
    locationName: 'San Francisco',
    locationState: 'CA',
    latitude: 37.7749,
    longitude: -122.4194,
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
    locationName: 'Los Angeles',
    locationState: 'CA',
    latitude: 34.0522,
    longitude: -118.2437,
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