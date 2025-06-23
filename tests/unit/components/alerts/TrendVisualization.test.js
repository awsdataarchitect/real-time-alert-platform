import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrendVisualization from '../../../../src/components/alerts/TrendVisualization';
import { API } from 'aws-amplify';
import { useFilter } from '../../../../src/context/FilterContext';
import { useMap } from '../../../../src/context/MapContext';

// Mock the dependencies
jest.mock('aws-amplify');
jest.mock('../../../../src/context/FilterContext');
jest.mock('../../../../src/context/MapContext');

describe('TrendVisualization', () => {
  // Mock data
  const mockAlerts = [
    {
      id: '1',
      headline: 'Severe Thunderstorm Warning',
      description: 'A severe thunderstorm is approaching the area',
      severity: 'SEVERE',
      category: 'WEATHER',
      status: 'ACTIVE',
      sourceType: 'NOAA',
      eventType: 'THUNDERSTORM',
      startTime: '2025-06-20T10:00:00Z',
      createdAt: '2025-06-20T09:45:00Z'
    },
    {
      id: '2',
      headline: 'Flash Flood Warning',
      description: 'Flash flooding is occurring in the area',
      severity: 'EXTREME',
      category: 'FLOOD',
      status: 'ACTIVE',
      sourceType: 'NOAA',
      eventType: 'FLOOD',
      startTime: '2025-06-20T11:30:00Z',
      createdAt: '2025-06-20T11:15:00Z'
    },
    {
      id: '3',
      headline: 'Earthquake Report',
      description: 'A 4.5 magnitude earthquake has been detected',
      severity: 'MODERATE',
      category: 'EARTHQUAKE',
      status: 'ACTIVE',
      sourceType: 'USGS',
      eventType: 'EARTHQUAKE',
      startTime: '2025-06-19T22:15:00Z',
      createdAt: '2025-06-19T22:20:00Z'
    },
    {
      id: '4',
      headline: 'Air Quality Alert',
      description: 'Air quality has reached unhealthy levels',
      severity: 'MINOR',
      category: 'HEALTH',
      status: 'ACTIVE',
      sourceType: 'EPA',
      eventType: 'AIR_QUALITY',
      startTime: '2025-06-18T08:00:00Z',
      createdAt: '2025-06-18T07:45:00Z'
    },
    {
      id: '5',
      headline: 'Test Emergency Alert',
      description: 'This is a test of the emergency alert system',
      severity: 'MINOR',
      category: 'OTHER',
      status: 'TEST',
      sourceType: 'SYSTEM',
      eventType: 'TEST',
      startTime: '2025-06-21T14:00:00Z',
      createdAt: '2025-06-21T13:55:00Z'
    }
  ];

  // Setup mocks before each test
  beforeEach(() => {
    // Mock API.graphql
    API.graphql = jest.fn().mockResolvedValue({
      data: {
        listAlerts: {
          items: mockAlerts
        }
      }
    });

    // Mock useFilter hook
    useFilter.mockReturnValue({
      filters: {}
    });

    // Mock useMap hook
    useMap.mockReturnValue({
      getAlertSeverityColor: jest.fn().mockReturnValue('#ff0000'),
      getAlertCategoryIcon: jest.fn().mockReturnValue('warning')
    });

    // Mock canvas methods
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn()
    });
  });

  test('renders the component with loading state', () => {
    render(<TrendVisualization />);
    expect(screen.getByText('Loading trend data...')).toBeInTheDocument();
  });

  test('renders the visualization type selector', async () => {
    render(<TrendVisualization />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Select visualization type')).toBeInTheDocument();
    });
  });

  test('changes visualization type when dropdown is changed', async () => {
    render(<TrendVisualization />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Select visualization type')).toBeInTheDocument();
    });
    
    const visualizationTypeSelect = screen.getByLabelText('Select visualization type');
    fireEvent.change(visualizationTypeSelect, { target: { value: 'severity' } });
    
    expect(visualizationTypeSelect.value).toBe('severity');
    expect(API.graphql).toHaveBeenCalledTimes(2); // Initial call + after change
  });

  test('displays error message when API call fails', async () => {
    API.graphql = jest.fn().mockRejectedValue(new Error('API Error'));
    
    render(<TrendVisualization />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error loading trend data/)).toBeInTheDocument();
    });
  });

  test('displays empty message when no data is available', async () => {
    API.graphql = jest.fn().mockResolvedValue({
      data: {
        listAlerts: {
          items: []
        }
      }
    });
    
    render(<TrendVisualization />);
    
    await waitFor(() => {
      expect(screen.getByText('No alert data available for trend analysis.')).toBeInTheDocument();
    });
  });

  test('renders the canvas when data is available', async () => {
    render(<TrendVisualization />);
    
    await waitFor(() => {
      const canvas = screen.getByLabelText('Alert trend chart');
      expect(canvas).toBeInTheDocument();
      expect(canvas.tagName).toBe('CANVAS');
    });
  });

  test('identifies trends when sufficient data is available', async () => {
    // Create mock data with clear trends
    const trendyMockAlerts = [
      ...mockAlerts,
      // Add more alerts with increasing counts to create a trend
      {
        id: '6',
        headline: 'Another Weather Alert',
        description: 'Another weather event',
        severity: 'SEVERE',
        category: 'WEATHER',
        status: 'ACTIVE',
        sourceType: 'NOAA',
        eventType: 'THUNDERSTORM',
        startTime: '2025-06-22T10:00:00Z',
        createdAt: '2025-06-22T09:45:00Z'
      },
      {
        id: '7',
        headline: 'Yet Another Weather Alert',
        description: 'Yet another weather event',
        severity: 'EXTREME',
        category: 'WEATHER',
        status: 'ACTIVE',
        sourceType: 'NOAA',
        eventType: 'THUNDERSTORM',
        startTime: '2025-06-23T10:00:00Z',
        createdAt: '2025-06-23T09:45:00Z'
      }
    ];
    
    API.graphql = jest.fn().mockResolvedValue({
      data: {
        listAlerts: {
          items: trendyMockAlerts
        }
      }
    });
    
    render(<TrendVisualization />);
    
    // Wait for the component to render with data
    await waitFor(() => {
      expect(screen.queryByText('Loading trend data...')).not.toBeInTheDocument();
    });
    
    // The trend identification logic should run and potentially identify trends
    // but since it's canvas-based and the actual DOM doesn't show the trends directly,
    // we can't easily test the visual output
    
    // We can verify the canvas is rendered
    const canvas = screen.getByLabelText('Alert trend chart');
    expect(canvas).toBeInTheDocument();
  });
});