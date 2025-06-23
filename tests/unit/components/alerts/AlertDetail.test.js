import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AlertDetail from '../../../../src/components/alerts/AlertDetail';
import { API } from 'aws-amplify';

// Mock the Amplify API
jest.mock('aws-amplify', () => ({
  API: {
    graphql: jest.fn()
  },
  graphqlOperation: jest.fn((query, variables) => ({ query, variables }))
}));

// Mock the MapContext
jest.mock('../../../../src/context/MapContext', () => ({
  useMap: () => ({
    getAlertSeverityColor: (severity) => {
      const colors = {
        EXTREME: '#FF0000',
        SEVERE: '#FF6600',
        MODERATE: '#FFCC00',
        MINOR: '#00CC00'
      };
      return colors[severity] || '#AAAAAA';
    },
    getAlertCategoryIcon: (category) => {
      const icons = {
        WEATHER: 'weather',
        EARTHQUAKE: 'earthquake',
        HEALTH: 'health'
      };
      return icons[category] || 'alert';
    }
  })
}));

// Mock child components
jest.mock('../../../../src/components/alerts/AlertActions', () => {
  return function MockAlertActions({ alert }) {
    return <div data-testid="alert-actions">Alert Actions Mock</div>;
  };
});

jest.mock('../../../../src/components/alerts/AlertTimeline', () => {
  return function MockAlertTimeline({ alert }) {
    return <div data-testid="alert-timeline">Alert Timeline Mock</div>;
  };
});

jest.mock('../../../../src/components/alerts/AlertRelated', () => {
  return function MockAlertRelated({ alertId, eventType, subType }) {
    return <div data-testid="alert-related">Alert Related Mock</div>;
  };
});

describe('AlertDetail Component', () => {
  const mockAlert = {
    id: 'test-alert-123',
    sourceId: 'source-123',
    sourceType: 'WEATHER_SERVICE',
    category: 'WEATHER',
    eventType: 'STORM',
    subType: 'THUNDERSTORM',
    severity: 'SEVERE',
    certainty: 'OBSERVED',
    headline: 'Severe Thunderstorm Warning',
    description: 'A severe thunderstorm is approaching the area with potential for strong winds and hail.',
    instructions: 'Seek shelter immediately and stay away from windows.',
    createdAt: '2023-06-15T10:30:00Z',
    updatedAt: '2023-06-15T10:35:00Z',
    startTime: '2023-06-15T11:00:00Z',
    endTime: '2023-06-15T13:00:00Z',
    status: 'ACTIVE',
    location: {
      type: 'Point',
      coordinates: '{"type":"Point","coordinates":[-122.4194,37.7749]}'
    },
    affectedAreas: [
      {
        areaId: 'area-123',
        areaName: 'Downtown',
        areaType: 'URBAN',
        geometry: '{"type":"Polygon","coordinates":[[[-122.42,37.78],[-122.40,37.78],[-122.40,37.76],[-122.42,37.76],[-122.42,37.78]]]}'
      }
    ],
    resources: [
      {
        resourceType: 'IMAGE',
        mimeType: 'image/jpeg',
        uri: 'https://example.com/storm.jpg',
        description: 'Storm radar image'
      }
    ],
    parameters: '{"windSpeed":"60mph","hailSize":"1inch"}',
    aiInsights: {
      analysis: 'This storm is moving quickly and has potential for flash flooding in low-lying areas.',
      recommendations: [
        'Move to interior rooms on the lowest floor',
        'Avoid using electrical appliances'
      ],
      confidenceScore: 0.85,
      sources: [
        'National Weather Service',
        'Local Doppler Radar'
      ]
    },
    version: 2
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state initially', () => {
    API.graphql.mockResolvedValueOnce({
      data: { getAlert: mockAlert }
    });

    render(<AlertDetail alertId="test-alert-123" onClose={() => {}} />);
    
    expect(screen.getByText('Loading alert details...')).toBeInTheDocument();
  });

  test('renders alert details after loading', async () => {
    API.graphql.mockResolvedValueOnce({
      data: { getAlert: mockAlert }
    });

    render(<AlertDetail alertId="test-alert-123" onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Severe Thunderstorm Warning')).toBeInTheDocument();
    });
    
    expect(screen.getByText('A severe thunderstorm is approaching the area with potential for strong winds and hail.')).toBeInTheDocument();
    expect(screen.getByText('Seek shelter immediately and stay away from windows.')).toBeInTheDocument();
    expect(screen.getByText('SEVERE')).toBeInTheDocument();
    expect(screen.getByText('WEATHER')).toBeInTheDocument();
    
    // Check for sections
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText('Timing')).toBeInTheDocument();
    expect(screen.getByText('Additional Information')).toBeInTheDocument();
    expect(screen.getByText('Affected Areas')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('AI Insights')).toBeInTheDocument();
    
    // Check for child components
    expect(screen.getByTestId('alert-actions')).toBeInTheDocument();
    expect(screen.getByTestId('alert-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('alert-related')).toBeInTheDocument();
  });

  test('renders error state when API call fails', async () => {
    API.graphql.mockRejectedValueOnce(new Error('Failed to fetch alert'));

    render(<AlertDetail alertId="test-alert-123" onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error loading alert details/)).toBeInTheDocument();
    });
  });

  test('renders not found state when alert is null', async () => {
    API.graphql.mockResolvedValueOnce({
      data: { getAlert: null }
    });

    render(<AlertDetail alertId="non-existent-alert" onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Alert not found')).toBeInTheDocument();
    });
  });

  test('calls onClose when close button is clicked', async () => {
    const mockOnClose = jest.fn();
    API.graphql.mockResolvedValueOnce({
      data: { getAlert: mockAlert }
    });

    render(<AlertDetail alertId="test-alert-123" onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Severe Thunderstorm Warning')).toBeInTheDocument();
    });
    
    const closeButton = screen.getByLabelText('Close alert details');
    closeButton.click();
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});