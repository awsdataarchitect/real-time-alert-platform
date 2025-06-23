import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import AlertMarker from '../../../../src/components/map/AlertMarker';

// Mock the Marker component from react-map-gl
jest.mock('react-map-gl', () => ({
  Marker: ({ children, longitude, latitude }) => (
    <div data-testid="map-marker" data-longitude={longitude} data-latitude={latitude}>
      {children}
    </div>
  ),
}));

// Mock the useMap hook
jest.mock('../../../../src/context/MapContext', () => ({
  useMap: () => ({
    getAlertSeverityColor: (severity) => {
      const colors = {
        EXTREME: '#FF0000',
        SEVERE: '#FF6600',
        MODERATE: '#FFCC00',
        MINOR: '#00CC00',
      };
      return colors[severity] || '#AAAAAA';
    },
    getAlertCategoryIcon: (category) => {
      const icons = {
        WEATHER: 'weather',
        EARTHQUAKE: 'earthquake',
        HEALTH: 'health',
      };
      return icons[category] || 'alert';
    },
  }),
}));

describe('AlertMarker Component', () => {
  const mockAlert = {
    id: '1',
    headline: 'Test Alert',
    severity: 'SEVERE',
    category: 'WEATHER',
    location: {
      coordinates: JSON.stringify({
        type: 'Point',
        coordinates: [-95.7129, 37.0902]
      })
    }
  };

  const mockOnClick = jest.fn();

  test('renders marker with correct coordinates', () => {
    const { getByTestId } = render(
      <AlertMarker alert={mockAlert} onClick={mockOnClick} />
    );
    
    const marker = getByTestId('map-marker');
    expect(marker).toBeInTheDocument();
    expect(marker.dataset.longitude).toBe('-95.7129');
    expect(marker.dataset.latitude).toBe('37.0902');
  });

  test('calls onClick when marker is clicked', () => {
    const { getByTestId } = render(
      <AlertMarker alert={mockAlert} onClick={mockOnClick} />
    );
    
    const markerContent = getByTestId('map-marker').querySelector('.alert-marker');
    fireEvent.click(markerContent);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  test('handles non-point geometry', () => {
    const polygonAlert = {
      ...mockAlert,
      location: {
        coordinates: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[-95.7129, 37.0902], [-95.8, 37.1], [-95.6, 37.2], [-95.7129, 37.0902]]]
        })
      }
    };
    
    const { getByTestId } = render(
      <AlertMarker alert={polygonAlert} onClick={mockOnClick} />
    );
    
    const marker = getByTestId('map-marker');
    expect(marker).toBeInTheDocument();
    expect(marker.dataset.longitude).toBe('-95.7129');
    expect(marker.dataset.latitude).toBe('37.0902');
  });

  test('handles invalid coordinates gracefully', () => {
    const invalidAlert = {
      ...mockAlert,
      location: {
        coordinates: 'invalid json'
      }
    };
    
    const { container } = render(
      <AlertMarker alert={invalidAlert} onClick={mockOnClick} />
    );
    
    // Should not render anything with invalid coordinates
    expect(container.firstChild).toBeNull();
  });
});