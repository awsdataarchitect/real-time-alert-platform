import React, { useRef, useEffect, useState } from 'react';
import MapGL, { NavigationControl, Source, Layer, Popup } from 'react-map-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMap } from '../../context/MapContext';
import AlertMarker from './AlertMarker';
import AlertPopup from './AlertPopup';

const Map = () => {
  const mapRef = useRef();
  const { 
    alerts, 
    loading, 
    error, 
    selectedAlert, 
    setSelectedAlert,
    mapSettings,
    setMapSettings,
    getAlertSeverityColor
  } = useMap();

  const [viewport, setViewport] = useState({
    latitude: mapSettings.center.latitude,
    longitude: mapSettings.center.longitude,
    zoom: mapSettings.zoom,
    bearing: 0,
    pitch: 0
  });

  const [popupInfo, setPopupInfo] = useState(null);

  // Update viewport when map settings change
  useEffect(() => {
    setViewport(prev => ({
      ...prev,
      latitude: mapSettings.center.latitude,
      longitude: mapSettings.center.longitude,
      zoom: mapSettings.zoom
    }));
  }, [mapSettings]);

  // Save viewport changes to context
  const handleViewportChange = (newViewport) => {
    setViewport(newViewport);
    
    // Don't update context on every small change to avoid excessive re-renders
    if (Math.abs(newViewport.zoom - mapSettings.zoom) > 0.5 ||
        Math.abs(newViewport.latitude - mapSettings.center.latitude) > 0.1 ||
        Math.abs(newViewport.longitude - mapSettings.center.longitude) > 0.1) {
      setMapSettings({
        ...mapSettings,
        zoom: newViewport.zoom,
        center: {
          latitude: newViewport.latitude,
          longitude: newViewport.longitude
        }
      });
    }
  };

  // Handle marker click
  const handleMarkerClick = (alert) => {
    try {
      if (!alert || !alert.location || !alert.location.coordinates) {
        console.error('Invalid alert data for popup:', alert);
        return;
      }
      
      const coordData = JSON.parse(alert.location.coordinates);
      if (!coordData || !coordData.coordinates || !Array.isArray(coordData.coordinates) || coordData.coordinates.length < 2) {
        console.error('Invalid coordinates format:', coordData);
        return;
      }
      
      setSelectedAlert(alert);
      setPopupInfo({
        longitude: parseFloat(coordData.coordinates[0]),
        latitude: parseFloat(coordData.coordinates[1]),
        alert
      });
    } catch (err) {
      console.error('Error processing alert for popup:', err);
    }
  };

  // Close popup
  const handleClosePopup = () => {
    setPopupInfo(null);
    setSelectedAlert(null);
  };

  // Prepare GeoJSON for affected areas
  const getAffectedAreasGeoJSON = () => {
    const features = [];
    
    alerts.forEach(alert => {
      if (alert.affectedAreas && alert.affectedAreas.length > 0) {
        alert.affectedAreas.forEach(area => {
          try {
            const geometry = JSON.parse(area.geometry);
            features.push({
              type: 'Feature',
              properties: {
                id: area.areaId,
                name: area.areaName,
                alertId: alert.id,
                severity: alert.severity,
                color: getAlertSeverityColor(alert.severity)
              },
              geometry
            });
          } catch (e) {
            console.error('Error parsing area geometry:', e);
          }
        });
      }
    });
    
    return {
      type: 'FeatureCollection',
      features
    };
  };

  // Layer styles for affected areas
  const areaFillLayer = {
    id: 'area-fill',
    type: 'fill',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.3
    }
  };

  const areaLineLayer = {
    id: 'area-line',
    type: 'line',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 2
    }
  };

  if (loading) {
    return <div className="map-loading">Loading map data...</div>;
  }

  if (error) {
    return <div className="map-error">Error loading map: {error.message}</div>;
  }

  return (
    <div className="map-container">
      <MapGL
        ref={mapRef}
        {...viewport}
        width="100%"
        height="100%"
        mapStyle={mapSettings.style}
        onViewportChange={handleViewportChange}
        mapLib={import('maplibre-gl')}
      >
        {/* Navigation controls */}
        <NavigationControl position="top-right" />
        
        {/* Affected areas */}
        <Source id="affected-areas" type="geojson" data={getAffectedAreasGeoJSON()}>
          <Layer {...areaFillLayer} />
          <Layer {...areaLineLayer} />
        </Source>
        
        {/* Alert markers */}
        {alerts.map(alert => {
          if (!alert || !alert.location || !alert.location.coordinates) {
            return null;
          }
          
          try {
            const coordinates = JSON.parse(alert.location.coordinates);
            // Only show point markers
            if (coordinates && coordinates.type === 'Point' && 
                coordinates.coordinates && Array.isArray(coordinates.coordinates) && 
                coordinates.coordinates.length >= 2) {
              return (
                <AlertMarker
                  key={alert.id}
                  alert={alert}
                  onClick={() => handleMarkerClick(alert)}
                />
              );
            }
            return null;
          } catch (e) {
            console.error('Error parsing alert coordinates:', e);
            return null;
          }
        })}
        
        {/* Popup for selected alert */}
        {popupInfo && (
          <Popup
            tipSize={5}
            anchor="top"
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            closeOnClick={false}
            onClose={handleClosePopup}
          >
            <AlertPopup alert={popupInfo.alert} />
          </Popup>
        )}
      </MapGL>
    </div>
  );
};

export default Map;