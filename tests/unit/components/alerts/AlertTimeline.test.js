import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AlertTimeline from '../../../../src/components/alerts/AlertTimeline';
import { useMap } from '../../../../src/context/MapContext';

// Mock the dependencies
jest.mock('../../../../src/context/MapContext');
jest.mock('../../../../src/components/alerts/TimelineVisualization', () => {
  return function MockTimelineVisualization() {
    return <div data-testid="timeline-visualization">Timeline Visualization Component</div>;
  };
});
jest.mock('../../../../src/components/alerts/TrendVisualization', () => {
  return function MockTrendVisualization() {
    return <div data-testid="trend-visualization">Trend Visualization Component</div>;
  };
});

describe('AlertTimeline', () => {
  // Mock data
  const mockAlert = {
    id: '1',
    headline: 'Severe Thunderstorm Warning',
    description: 'A severe thunderstorm is approaching the area',
    severity: 'SEVERE',
    category: 'WEATHER',
    status: 'ACTIVE',
    sourceType: 'NOAA',
    eventType: 'THUNDERSTORM',
    startTime: '2025-06-20T10:00:00Z',
    endTime: '2025-06-20T16:00:00Z',
    createdAt: '2025-06-20T09:45:00Z',
    updatedAt: '2025-06-20T09:45:00Z'
  };

  // Setup mocks before each test
  beforeEach(() => {
    // Mock useMap hook
    useMap.mockReturnValue({
      getAlertSeverityColor: jest.fn().mockReturnValue('#ff0000')
    });

    // Mock Date.now() to return a fixed timestamp
    jest.spyOn(Date, 'now').mockImplementation(() => new Date('2025-06-20T12:00:00Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders the timeline component', () => {
    render(<AlertTimeline alert={mockAlert} />);
    expect(screen.getByText('Timeline & Trends')).toBeInTheDocument();
  });

  test('displays timeline events correctly', () => {
    render(<AlertTimeline alert={mockAlert} />);
    
    // Check for event labels
    expect(screen.getByText('Alert Created')).toBeInTheDocument();
    expect(screen.getByText('Alert Start')).toBeInTheDocument();
    expect(screen.getByText('Alert End')).toBeInTheDocument();
  });

  test('calculates timeline position correctly', () => {
    render(<AlertTimeline alert={mockAlert} />);
    
    // The progress bar should be visible
    const progressBar = document.querySelector('.alert-timeline-progress');
    expect(progressBar).toBeInTheDocument();
    
    // With our mocked time (12:00), we should be 33% through a 10:00-16:00 timeline
    // But we can't easily test the exact percentage due to how styles are applied
    expect(progressBar).toHaveStyle('width: 33%');
  });

  test('handles alert with no end time', () => {
    const alertWithNoEnd = {
      ...mockAlert,
      endTime: null
    };
    
    render(<AlertTimeline alert={alertWithNoEnd} />);
    
    // The progress bar should still be visible
    const progressBar = document.querySelector('.alert-timeline-progress');
    expect(progressBar).toBeInTheDocument();
    
    // With no end time, it should default to 50%
    expect(progressBar).toHaveStyle('width: 50%');
  });

  test('handles alert with update time', () => {
    const alertWithUpdate = {
      ...mockAlert,
      updatedAt: '2025-06-20T11:30:00Z'
    };
    
    render(<AlertTimeline alert={alertWithUpdate} />);
    
    // Should show the update event
    expect(screen.getByText('Alert Updated')).toBeInTheDocument();
  });

  test('displays the timeline legend', () => {
    render(<AlertTimeline alert={mockAlert} />);
    
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.getByText('Ended/Scheduled End')).toBeInTheDocument();
  });
  
  test('switches to timeline visualization tab when clicked', () => {
    render(<AlertTimeline alert={mockAlert} />);
    
    // Click the timeline visualization tab
    fireEvent.click(screen.getByText('Timeline Visualization'));
    
    // Should show the timeline visualization component
    expect(screen.getByTestId('timeline-visualization')).toBeInTheDocument();
    expect(screen.queryByTestId('trend-visualization')).not.toBeInTheDocument();
  });
  
  test('switches to trend analysis tab when clicked', () => {
    render(<AlertTimeline alert={mockAlert} />);
    
    // Click the trend analysis tab
    fireEvent.click(screen.getByText('Trend Analysis'));
    
    // Should show the trend visualization component
    expect(screen.getByTestId('trend-visualization')).toBeInTheDocument();
    expect(screen.queryByTestId('timeline-visualization')).not.toBeInTheDocument();
  });
  
  test('switches back to timeline tab when clicked', () => {
    render(<AlertTimeline alert={mockAlert} />);
    
    // First switch to another tab
    fireEvent.click(screen.getByText('Trend Analysis'));
    
    // Then switch back to timeline tab
    fireEvent.click(screen.getByText('Timeline'));
    
    // Should show the timeline events
    expect(screen.getByText('Alert Created')).toBeInTheDocument();
    expect(screen.queryByTestId('trend-visualization')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timeline-visualization')).not.toBeInTheDocument();
  });
});