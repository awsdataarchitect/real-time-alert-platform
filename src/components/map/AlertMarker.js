import React from 'react';
import { Marker } from 'react-map-gl';
import { useMap } from '../../context/MapContext';

const AlertMarker = ({ alert, onClick }) => {
  const { getAlertSeverityColor, getAlertCategoryIcon } = useMap();
  
  // Parse coordinates from GeoJSON
  const getCoordinates = () => {
    try {
      const locationData = JSON.parse(alert.location.coordinates);
      if (locationData.type === 'Point') {
        return {
          longitude: locationData.coordinates[0],
          latitude: locationData.coordinates[1]
        };
      }
      // For non-point geometries, use the first coordinate as a marker
      if (locationData.coordinates && locationData.coordinates.length > 0) {
        if (Array.isArray(locationData.coordinates[0])) {
          return {
            longitude: locationData.coordinates[0][0],
            latitude: locationData.coordinates[0][1]
          };
        }
      }
      return null;
    } catch (e) {
      console.error('Error parsing coordinates:', e);
      return null;
    }
  };

  const coordinates = getCoordinates();
  if (!coordinates) return null;

  const severityColor = getAlertSeverityColor(alert.severity);
  const categoryIcon = getAlertCategoryIcon(alert.category);

  return (
    <Marker
      longitude={coordinates.longitude}
      latitude={coordinates.latitude}
      offsetLeft={-15}
      offsetTop={-30}
    >
      <div 
        className="alert-marker"
        onClick={onClick}
        style={{ 
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        <svg 
          height="30" 
          width="30" 
          viewBox="0 0 24 24"
          style={{
            fill: severityColor,
            stroke: '#000',
            strokeWidth: '0.5px'
          }}
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
        <div 
          className="alert-marker-icon"
          style={{
            position: 'absolute',
            top: '5px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}
        >
          {categoryIcon.charAt(0).toUpperCase()}
        </div>
      </div>
    </Marker>
  );
};

export default AlertMarker;