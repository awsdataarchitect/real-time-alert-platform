import React from 'react';
import { render, screen } from '@testing-library/react';
import Map from '../../../../src/components/map/Map';
import { MapProvider } from '../../../../src/context/MapContext';
import { API } from 'aws-amplify';

// Mock the MapGL component and other dependencies
jest.mock('react-map-gl', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="map-gl">{children}</div>,
  NavigationControl: () => <div data-testid="navigation-control" />,
  Source: ({ children }) => <div data-testid="map-source">{children}</div>,
  Layer: (props) => <div data-testid={`map-layer-${props.id}`} />,
  Popup: ({ children, onClose }) => (
    <div data-testid="map-popup">
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  ),
  Marker: ({ children }) => <div data-testid="map-marker">{children}</div>
}));

// Mock the AWS Amplify API
jest.mock('aws-amplify', () => ({
  API: {
    graphql: jest.fn(),
  },
  graphqlOperation: jest.fn((query, variables) => ({ query, variables })),
}));

// Mock the context
jest.mock('../../../../src/context/MapContext', () => ({
  useMap: () => ({
    alerts: [],
    loading: false,
    error: null,
    selectedAlert: null,
    setSelectedAlert: jest.fn(),
    mapSettings: {
      zoom: 3,
      center: { latitude: 37.0902, longitude: -95.7129 },
      style: 'mapbox://styles/mapbox/streets-v11',
    },
    setMapSettings: jest.fn(),
    getAlertSeverityColor: jest.fn(() => '#FF0000'),
    getAlertCategoryIcon: jest.fn(() => 'alert'),
  }),
  MapProvider: ({ children }) => <div data-testid="map-provider">{children}</div>,
}));

describe('Map Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state', () => {
    // Override the mock to show loading state
    jest.spyOn(require('../../../../src/context/MapContext'), 'useMap').mockImplementation(() => ({
      alerts: [],
      loading: true,
      error: null,
      selectedAlert: null,
      setSelectedAlert: jest.fn(),
      mapSettings: {
        zoom: 3,
        center: { latitude: 37.0902, longitude: -95.7129 },
        style: 'mapbox://styles/mapbox/streets-v11',
      },
      setMapSettings: jest.fn(),
      getAlertSeverityColor: jest.fn(),
      getAlertCategoryIcon: jest.fn(),
    }));

    render(<Map />);
    expect(screen.getByText('Loading map data...')).toBeInTheDocument();
  });

  test('renders error state', () => {
    // Override the mock to show error state
    jest.spyOn(require('../../../../src/context/MapContext'), 'useMap').mockImplementation(() => ({
      alerts: [],
      loading: false,
      error: { message: 'Failed to load map data' },
      selectedAlert: null,
      setSelectedAlert: jest.fn(),
      mapSettings: {
        zoom: 3,
        center: { latitude: 37.0902, longitude: -95.7129 },
        style: 'mapbox://styles/mapbox/streets-v11',
      },
      setMapSettings: jest.fn(),
      getAlertSeverityColor: jest.fn(),
      getAlertCategoryIcon: jest.fn(),
    }));

    render(<Map />);
    expect(screen.getByText('Error loading map: Failed to load map data')).toBeInTheDocument();
  });

  test('renders map with markers when alerts are available', () => {
    // Override the mock to provide alerts
    jest.spyOn(require('../../../../src/context/MapContext'), 'useMap').mockImplementation(() => ({
      alerts: [
        {
          id: '1',
          headline: 'Test Alert',
          description: 'Test Description',
          severity: 'SEVERE',
          category: 'WEATHER',
          location: {
            type: 'Point',
            coordinates: JSON.stringify({
              type: 'Point',
              coordinates: [-95.7129, 37.0902]
            })
          },
          startTime: '2023-01-01T00:00:00Z',
          status: 'ACTIVE'
        }
      ],
      loading: false,
      error: null,
      selectedAlert: null,
      setSelectedAlert: jest.fn(),
      mapSettings: {
        zoom: 3,
        center: { latitude: 37.0902, longitude: -95.7129 },
        style: 'mapbox://styles/mapbox/streets-v11',
      },
      setMapSettings: jest.fn(),
      getAlertSeverityColor: jest.fn(() => '#FF6600'),
      getAlertCategoryIcon: jest.fn(() => 'weather'),
    }));

    render(<Map />);
    expect(screen.getByTestId('map-gl')).toBeInTheDocument();
    expect(screen.getByTestId('navigation-control')).toBeInTheDocument();
    expect(screen.getByTestId('map-source')).toBeInTheDocument();
  });
});