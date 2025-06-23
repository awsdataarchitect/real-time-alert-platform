import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimelineVisualization from '../../../../src/components/alerts/TimelineVisualization';
import { API } from 'aws-amplify';
import { useFilter } from '../../../../src/context/FilterContext';
import { useMap } from '../../../../src/context/MapContext';

// Mock the dependencies
jest.mock('aws-amplify');
jest.mock('../../../../src/context/FilterContext');
jest.mock('../../../../src/context/MapContext');

describe('TimelineVisualization', () => {
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
      getAlertSeverityColor: jest.fn().mockReturnValue('#ff0000')
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
    render(<TimelineVisualization />);
    expect(screen.getByText('Loading timeline data...')).toBeInTheDocument();
  });

  test('renders the timeline controls', async () => {
    render(<TimelineVisualization />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Select time range')).toBeInTheDocument();
      expect(screen.getByLabelText('Select grouping')).toBeInTheDocument();
    });
  });

  test('changes time range when dropdown is changed', async () => {
    render(<TimelineVisualization />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Select time range')).toBeInTheDocument();
    });
    
    const timeRangeSelect = screen.getByLabelText('Select time range');
    fireEvent.change(timeRangeSelect, { target: { value: 'month' } });
    
    expect(timeRangeSelect.value).toBe('month');
    expect(API.graphql).toHaveBeenCalledTimes(2); // Initial call + after change
  });

  test('changes grouping when dropdown is changed', async () => {
    render(<TimelineVisualization />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Select grouping')).toBeInTheDocument();
    });
    
    const groupBySelect = screen.getByLabelText('Select grouping');
    fireEvent.change(groupBySelect, { target: { value: 'week' } });
    
    expect(groupBySelect.value).toBe('week');
    expect(API.graphql).toHaveBeenCalledTimes(2); // Initial call + after change
  });

  test('displays error message when API call fails', async () => {
    API.graphql = jest.fn().mockRejectedValue(new Error('API Error'));
    
    render(<TimelineVisualization />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error loading timeline data/)).toBeInTheDocument();
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
    
    render(<TimelineVisualization />);
    
    await waitFor(() => {
      expect(screen.getByText('No alert data available for the selected time range.')).toBeInTheDocument();
    });
  });

  test('renders the canvas when data is available', async () => {
    render(<TimelineVisualization />);
    
    await waitFor(() => {
      const canvas = screen.getByLabelText('Alert timeline chart');
      expect(canvas).toBeInTheDocument();
      expect(canvas.tagName).toBe('CANVAS');
    });
  });
});