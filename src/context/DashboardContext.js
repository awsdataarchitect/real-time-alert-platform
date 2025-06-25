import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser as getAmplifyCurrentUser } from 'aws-amplify/auth';
const client = generateClient();
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
  // Remove dependencies to avoid circular dependency issues
  // const { filters } = useFilter();
  // const { mapSettings } = useMap();
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
    const fetchCurrentUser = async () => {
      try {
        const user = await getAmplifyCurrentUser();
        setCurrentUser(user);
        
        // Fetch user's dashboard preferences
        if (user) {
          await fetchUserPreferences(user.username);
        }
      } catch (err) {
        console.log('Not authenticated', err);
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Fetch user preferences from the backend
  const fetchUserPreferences = async (userId) => {
    try {
      setLoading(true);
      // Use mock data for now until backend is deployed
      const response = {
        data: {
          getUser: {
            dashboardPreferences: {
              defaultView: 'dashboard',
              favoriteFilters: [],
              mapSettings: {
                defaultZoom: 3,
                defaultCenter: {
                  latitude: 37.0902,
                  longitude: -95.7129
                },
                layerVisibility: {}
              }
            }
          }
        }
      };
      
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
        config: JSON.stringify({})
      };
      
      // Add to existing favorites
      const updatedFavorites = [
        ...dashboardPreferences.favoriteFilters || [],
        JSON.stringify(filterConfig)
      ];
      
      // TODO: Update in backend when deployed
      // await client.graphql({
      //   query: saveFavoriteFilter,
      //   variables: {
      //     userId: currentUser.username,
      //     filterName,
      //     currentFilters: updatedFavorites
      //   }
      // });
      
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
      
      // TODO: Update in backend when deployed
      // await client.graphql({
      //   query: saveFavoriteFilter,
      //   variables: {
      //     userId: currentUser.username,
      //     currentFilters: updatedFavorites
      //   }
      // });
      
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
      
      // TODO: Update in backend when deployed
      /*
      await client.graphql({
        query: updateMapSettings,
        variables: {
          userId: currentUser.username,
          defaultZoom: 3,
          defaultCenter: {
            latitude: 37.0902,
            longitude: -95.7129
          },
          layerVisibility: JSON.stringify({})
        }
      });
      */
      
      // Update local state
      setDashboardPreferences({
        ...dashboardPreferences,
        mapSettings: {
          defaultZoom: 3,
          defaultCenter: { latitude: 37.0902, longitude: -95.7129 },
          layerVisibility: JSON.stringify({})
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
      
      // TODO: Update in backend when deployed
      /*
      await client.graphql({
        query: updateDefaultView,
        variables: {
          userId: currentUser.username,
          defaultView: view
        }
      });
      */
      
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
      
      // TODO: Update in backend when deployed
      /*
      await client.graphql({
        query: updateUserDashboardPreferences,
        variables: {
          userId: currentUser.username,
          dashboardPreferences: preferences
        });
      */
      
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