import React, { createContext, useContext, useState, useEffect } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { onCreateAlert, onUpdateAlert } from '../graphql/subscriptions';

const MapContext = createContext();

export const MapProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [mapSettings, setMapSettings] = useState({
    zoom: 3,
    center: { latitude: 37.0902, longitude: -95.7129 }, // Default to US center
    style: 'mapbox://styles/mapbox/streets-v11',
  });

  // Fetch initial alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        // Query for active alerts
        const response = await API.graphql(
          graphqlOperation(`
            query ListActiveAlerts {
              alertsByStatus(
                status: ACTIVE
                sortDirection: DESC
                limit: 100
              ) {
                items {
                  id
                  headline
                  description
                  severity
                  category
                  location {
                    type
                    coordinates
                  }
                  createdAt
                  startTime
                  endTime
                  status
                }
              }
            }
          `)
        );
        
        const alertData = response.data.alertsByStatus.items;
        setAlerts(alertData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching alerts:', err);
        setError(err);
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  // Subscribe to new alerts
  useEffect(() => {
    const createSubscription = API.graphql(
      graphqlOperation(onCreateAlert)
    ).subscribe({
      next: ({ value }) => {
        const newAlert = value.data.onCreateAlert;
        setAlerts(currentAlerts => [...currentAlerts, newAlert]);
      },
      error: (error) => console.error('Subscription error:', error),
    });

    const updateSubscription = API.graphql(
      graphqlOperation(onUpdateAlert)
    ).subscribe({
      next: ({ value }) => {
        const updatedAlert = value.data.onUpdateAlert;
        setAlerts(currentAlerts => 
          currentAlerts.map(alert => 
            alert.id === updatedAlert.id ? updatedAlert : alert
          )
        );
        
        // If the selected alert was updated, update it as well
        if (selectedAlert && selectedAlert.id === updatedAlert.id) {
          setSelectedAlert(updatedAlert);
        }
      },
      error: (error) => console.error('Subscription error:', error),
    });

    return () => {
      createSubscription.unsubscribe();
      updateSubscription.unsubscribe();
    };
  }, [selectedAlert]);

  // Filter alerts by location
  const filterAlertsByLocation = async (latitude, longitude, radiusInKm) => {
    try {
      setLoading(true);
      const response = await API.graphql(
        graphqlOperation(`
          query SearchAlertsByLocation($location: LocationFilterInput!) {
            searchAlertsByLocation(
              location: $location
              filter: { status: { eq: "ACTIVE" } }
              limit: 100
            ) {
              items {
                id
                headline
                description
                severity
                category
                location {
                  type
                  coordinates
                }
                createdAt
                startTime
                endTime
                status
              }
            }
          }
        `, {
          location: {
            nearPoint: { latitude, longitude },
            withinRadius: radiusInKm
          }
        })
      );
      
      const alertData = response.data.searchAlertsByLocation.items;
      setAlerts(alertData);
      setLoading(false);
    } catch (err) {
      console.error('Error filtering alerts by location:', err);
      setError(err);
      setLoading(false);
    }
  };

  // Get alert severity color
  const getAlertSeverityColor = (severity) => {
    switch (severity) {
      case 'EXTREME':
        return '#FF0000'; // Red
      case 'SEVERE':
        return '#FF6600'; // Orange
      case 'MODERATE':
        return '#FFCC00'; // Yellow
      case 'MINOR':
        return '#00CC00'; // Green
      default:
        return '#AAAAAA'; // Gray for unknown
    }
  };

  // Get alert category icon
  const getAlertCategoryIcon = (category) => {
    switch (category) {
      case 'WEATHER':
        return 'weather';
      case 'EARTHQUAKE':
        return 'earthquake';
      case 'TSUNAMI':
        return 'tsunami';
      case 'VOLCANO':
        return 'volcano';
      case 'FIRE':
        return 'fire';
      case 'FLOOD':
        return 'flood';
      case 'HEALTH':
        return 'health';
      case 'SECURITY':
        return 'security';
      case 'INFRASTRUCTURE':
        return 'infrastructure';
      case 'TRANSPORTATION':
        return 'transportation';
      default:
        return 'alert';
    }
  };

  const value = {
    alerts,
    loading,
    error,
    selectedAlert,
    setSelectedAlert,
    mapSettings,
    setMapSettings,
    filterAlertsByLocation,
    getAlertSeverityColor,
    getAlertCategoryIcon
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
};