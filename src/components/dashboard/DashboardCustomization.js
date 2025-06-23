import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useFilter } from '../../context/FilterContext';
import { useMap } from '../../context/MapContext';
import './DashboardCustomization.css';

const DashboardCustomization = () => {
  const { 
    dashboardPreferences, 
    loading, 
    error, 
    saveFilterAsFavorite, 
    deleteFavoriteFilter, 
    saveMapSettings, 
    setDefaultView 
  } = useDashboard();
  
  const { filters } = useFilter();
  const { mapSettings } = useMap();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [activeTab, setActiveTab] = useState('filters');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSaveFilter = async (e) => {
    e.preventDefault();
    
    if (!newFilterName.trim()) {
      setErrorMessage('Please enter a filter name');
      return;
    }
    
    try {
      await saveFilterAsFavorite(newFilterName);
      setNewFilterName('');
      setSuccessMessage('Filter saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage('Failed to save filter');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDeleteFilter = async (index) => {
    try {
      await deleteFavoriteFilter(index);
      setSuccessMessage('Filter deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage('Failed to delete filter');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleSaveMapSettings = async () => {
    try {
      await saveMapSettings();
      setSuccessMessage('Map settings saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage('Failed to save map settings');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleSetDefaultView = async (view) => {
    try {
      await setDefaultView(view);
      setSuccessMessage('Default view updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage('Failed to update default view');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // Parse favorite filters from JSON strings
  const parsedFavoriteFilters = (dashboardPreferences.favoriteFilters || [])
    .map(filterStr => {
      try {
        return JSON.parse(filterStr);
      } catch (e) {
        return null;
      }
    })
    .filter(filter => filter !== null);

  return (
    <div className="dashboard-customization">
      <div className="customization-header">
        <h3>Dashboard Customization</h3>
        <button 
          className="toggle-button"
          onClick={toggleExpand}
          aria-expanded={isExpanded}
          aria-controls="customization-controls"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded && (
        <div 
          id="customization-controls"
          className="customization-content"
        >
          {errorMessage && <div className="error-message">{errorMessage}</div>}
          {successMessage && <div className="success-message">{successMessage}</div>}
          
          <div className="customization-tabs">
            <button 
              className={activeTab === 'filters' ? 'active' : ''}
              onClick={() => setActiveTab('filters')}
            >
              Saved Filters
            </button>
            <button 
              className={activeTab === 'map' ? 'active' : ''}
              onClick={() => setActiveTab('map')}
            >
              Map Settings
            </button>
            <button 
              className={activeTab === 'view' ? 'active' : ''}
              onClick={() => setActiveTab('view')}
            >
              Default View
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'filters' && (
              <div className="filters-tab">
                <h4>Save Current Filter</h4>
                <form onSubmit={handleSaveFilter} className="save-filter-form">
                  <input
                    type="text"
                    value={newFilterName}
                    onChange={(e) => setNewFilterName(e.target.value)}
                    placeholder="Enter filter name"
                    disabled={loading}
                  />
                  <button 
                    type="submit" 
                    disabled={loading || !newFilterName.trim()}
                  >
                    {loading ? 'Saving...' : 'Save Filter'}
                  </button>
                </form>

                <h4>Saved Filters</h4>
                {parsedFavoriteFilters.length === 0 ? (
                  <p>No saved filters yet.</p>
                ) : (
                  <ul className="saved-filters-list">
                    {parsedFavoriteFilters.map((filter, index) => (
                      <li key={index} className="saved-filter-item">
                        <div className="filter-info">
                          <span className="filter-name">{filter.name}</span>
                          <span className="filter-date">
                            {new Date(filter.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="filter-actions">
                          <button 
                            onClick={() => handleDeleteFilter(index)}
                            className="delete-filter"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'map' && (
              <div className="map-tab">
                <h4>Current Map Settings</h4>
                <div className="map-settings">
                  <div className="setting-group">
                    <label>Default Zoom:</label>
                    <span>{mapSettings.zoom}</span>
                  </div>
                  <div className="setting-group">
                    <label>Default Center:</label>
                    <span>
                      Lat: {mapSettings.center.latitude.toFixed(4)}, 
                      Lng: {mapSettings.center.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleSaveMapSettings}
                  disabled={loading}
                  className="save-settings-button"
                >
                  {loading ? 'Saving...' : 'Save Current Map Settings as Default'}
                </button>
              </div>
            )}

            {activeTab === 'view' && (
              <div className="view-tab">
                <h4>Select Default View</h4>
                <div className="view-options">
                  <button 
                    className={dashboardPreferences.defaultView === 'map' ? 'selected' : ''}
                    onClick={() => handleSetDefaultView('map')}
                    disabled={loading}
                  >
                    Map View
                  </button>
                  <button 
                    className={dashboardPreferences.defaultView === 'list' ? 'selected' : ''}
                    onClick={() => handleSetDefaultView('list')}
                    disabled={loading}
                  >
                    List View
                  </button>
                  <button 
                    className={dashboardPreferences.defaultView === 'grid' ? 'selected' : ''}
                    onClick={() => handleSetDefaultView('grid')}
                    disabled={loading}
                  >
                    Grid View
                  </button>
                </div>
                <p className="current-default">
                  Current default: <strong>{dashboardPreferences.defaultView || 'map'}</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardCustomization;