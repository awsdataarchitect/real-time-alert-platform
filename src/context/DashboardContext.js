import React, { createContext, useContext, useState, useEffect } from 'react';
import { API, graphqlOperation, Auth } from 'aws-amplify';
import { 
  updateUserDashboardPreferences, 
  saveFavoriteFilter, 
  updateMapSettings, 
  updateDefaultView 
} from '../graphql/mutations';
import { useFilter } from './FilterContext';
import { useMap } from './MapContext';

const DashboardContext = createContext();

export const DashboardProvider = ({ children }) => {
  const { filters } = useFilter();
  const { mapSettings } = useMap();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Dashboard preferences state
  const [dashboardPreferences, setDashboardPreferences] = useState({
    defaultView: 'map', // Default view: 'map', 'list', 'grid'
    favoriteFilters: [], // Array of saved filter configurations
    mapSettings: {
      defaultZoom: 3,
      defaultCenter: { latitude: 37.0902, longitude: -95.7129 },
      layerVisibility: JSON.stringify({
        alerts: true,
        weather: true,
        traffic: false,
        satellite: false
      })
    }
  });

  // Get current authenticated user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        setCurrentUser(user);
        
        // Fetch user's dashboard preferences
        if (user) {
          await fetchUserPreferences(user.username);
        }
      } catch (err) {
        console.log('Not authenticated', err);
      }
    };
    
    getCurrentUser();
  }, []);

  // Fetch user preferences from the backend
  const fetchUserPreferences = async (userId) => {
    try {
      setLoading(true);
      const response = await API.graphql(
        graphqlOperation(`
          query GetUserPreferences($id: ID!) {
            getUser(id: $id) {
              id
              dashboardPreferences {
                defaultView
                favoriteFilters
                mapSettings {
                  defaultZoom
                  defaultCenter {
                    latitude
                    longitude
                  }
                  layerVisibility
                }
              }
            }
          }
        `, { id: userId })
      );
      
      const userPreferences = response.data.getUser.dashboardPreferences;
      
      if (userPreferences) {
        setDashboardPreferences(userPreferences);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching user preferences:', err);
      setError(err);
      setLoading(false);
    }
  };

  // Save current filter configuration as a favorite
  const saveFilterAsFavorite = async (filterName) => {
    if (!currentUser) {
      setError(new Error('User not authenticated'));
      return;
    }
    
    try {
      setLoading(true);
      
      // Create a serialized version of the current filters
      const filterConfig = {
        name: filterName,
        timestamp: new Date().toISOString(),
        config: JSON.stringify(filters)
      };
      
      // Add to existing favorites
      const updatedFavorites = [
        ...dashboardPreferences.favoriteFilters || [],
        JSON.stringify(filterConfig)
      ];
      
      // Update in backend
      await API.graphql(
        graphqlOperation(saveFavoriteFilter, {
          userId: currentUser.username,
          filterName,
          currentFilters: updatedFavorites
        })
      );
      
      // Update local state
      setDashboardPreferences({
        ...dashboardPreferences,
        favoriteFilters: updatedFavorites
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error saving favorite filter:', err);
      setError(err);
      setLoading(false);
    }
  };

  // Delete a favorite filter
  const deleteFavoriteFilter = async (filterIndex) => {
    if (!currentUser) {
      setError(new Error('User not authenticated'));
      return;
    }
    
    try {
      setLoading(true);
      
      // Remove from favorites array
      const updatedFavorites = [...dashboardPreferences.favoriteFilters];
      updatedFavorites.splice(filterIndex, 1);
      
      // Update in backend
      await API.graphql(
        graphqlOperation(saveFavoriteFilter, {
          userId: currentUser.username,
          currentFilters: updatedFavorites
        })
      );
      
      // Update local state
      setDashboardPreferences({
        ...dashboardPreferences,
        favoriteFilters: updatedFavorites
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error deleting favorite filter:', err);
      setError(err);
      setLoading(false);
    }
  };

  // Save current map settings
  const saveMapSettings = async () => {
    if (!currentUser) {
      setError(new Error('User not authenticated'));
      return;
    }
    
    try {
      setLoading(true);
      
      // Update in backend
      await API.graphql(
        graphqlOperation(updateMapSettings, {
          userId: currentUser.username,
          defaultZoom: mapSettings.zoom,
          defaultCenter: {
            latitude: mapSettings.center.latitude,
            longitude: mapSettings.center.longitude
          },
          layerVisibility: JSON.stringify(mapSettings.layerVisibility || {})
        })
      );
      
      // Update local state
      setDashboardPreferences({
        ...dashboardPreferences,
        mapSettings: {
          defaultZoom: mapSettings.zoom,
          defaultCenter: mapSettings.center,
          layerVisibility: JSON.stringify(mapSettings.layerVisibility || {})
        }
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error saving map settings:', err);
      setError(err);
      setLoading(false);
    }
  };

  // Set default view
  const setDefaultView = async (view) => {
    if (!currentUser) {
      setError(new Error('User not authenticated'));
      return;
    }
    
    try {
      setLoading(true);
      
      // Update in backend
      await API.graphql(
        graphqlOperation(updateDefaultView, {
          userId: currentUser.username,
          defaultView: view
        })
      );
      
      // Update local state
      setDashboardPreferences({
        ...dashboardPreferences,
        defaultView: view
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error setting default view:', err);
      setError(err);
      setLoading(false);
    }
  };

  // Save all dashboard preferences at once
  const saveAllPreferences = async (preferences) => {
    if (!currentUser) {
      setError(new Error('User not authenticated'));
      return;
    }
    
    try {
      setLoading(true);
      
      // Update in backend
      await API.graphql(
        graphqlOperation(updateUserDashboardPreferences, {
          userId: currentUser.username,
          dashboardPreferences: preferences
        })
      );
      
      // Update local state
      setDashboardPreferences(preferences);
      
      setLoading(false);
    } catch (err) {
      console.error('Error saving dashboard preferences:', err);
      setError(err);
      setLoading(false);
    }
  };

  const value = {
    dashboardPreferences,
    loading,
    error,
    saveFilterAsFavorite,
    deleteFavoriteFilter,
    saveMapSettings,
    setDefaultView,
    saveAllPreferences
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};