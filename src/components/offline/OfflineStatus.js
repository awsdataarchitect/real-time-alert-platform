/**
 * OfflineStatus Component
 * Displays offline status, sync progress, and offline capabilities
 */

import React, { useState } from 'react';
import useOffline from '../../hooks/useOffline';
import './OfflineStatus.css';

const OfflineStatus = ({ showDetails = false, className = '' }) => {
  const {
    isOnline,
    syncStatus,
    pendingOperations,
    serviceWorkerUpdate,
    forceSync,
    updateServiceWorker,
    refreshStats,
    getConnectionQuality,
    isSyncing,
    hasPendingOperations
  } = useOffline();

  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const connectionQuality = getConnectionQuality();

  const handleForceSync = async () => {
    if (!isOnline) return;
    
    try {
      await forceSync();
    } catch (error) {
      console.error('Failed to force sync:', error);
    }
  };

  const handleRefreshStats = async () => {
    setIsRefreshing(true);
    try {
      await refreshStats();
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = () => {
    if (isSyncing) return '🔄';
    if (!isOnline) return '📡';
    if (hasPendingOperations) return '⏳';
    return '✅';
  };

  const getStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (!isOnline) return 'Offline';
    if (hasPendingOperations) return `${pendingOperations} pending`;
    return 'Online';
  };

  const getConnectionQualityIcon = () => {
    switch (connectionQuality) {
      case 'excellent': return '📶';
      case 'good': return '📶';
      case 'poor': return '📶';
      case 'offline': return '📡';
      default: return '📶';
    }
  };

  if (!showDetails) {
    return (
      <div className={`offline-status-compact ${className}`}>
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-icon">{getStatusIcon()}</span>
          <span className="status-text">{getStatusText()}</span>
        </div>
        
        {serviceWorkerUpdate && (
          <button 
            className="update-button"
            onClick={updateServiceWorker}
            title="Update available"
          >
            🔄 Update
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`offline-status-detailed ${className}`}>
      <div className="status-header">
        <div className="status-main">
          <span className="status-icon large">{getStatusIcon()}</span>
          <div className="status-info">
            <div className="status-title">{getStatusText()}</div>
            <div className="status-subtitle">
              {isOnline ? (
                <>
                  <span className="connection-quality">
                    {getConnectionQualityIcon()} {connectionQuality}
                  </span>
                  {hasPendingOperations && (
                    <span className="pending-count">
                      • {pendingOperations} operations pending
                    </span>
                  )}
                </>
              ) : (
                'Working offline'
              )}
            </div>
          </div>
        </div>

        <div className="status-actions">
          {isOnline && (
            <button
              className="sync-button"
              onClick={handleForceSync}
              disabled={isSyncing}
              title="Force sync"
            >
              {isSyncing ? '🔄' : '↻'}
            </button>
          )}
          
          <button
            className="refresh-button"
            onClick={handleRefreshStats}
            disabled={isRefreshing}
            title="Refresh stats"
          >
            {isRefreshing ? '🔄' : '📊'}
          </button>

          <button
            className="details-toggle"
            onClick={() => setShowDetailedStats(!showDetailedStats)}
            title="Toggle details"
          >
            {showDetailedStats ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {showDetailedStats && (
        <OfflineStatusDetails />
      )}

      {serviceWorkerUpdate && (
        <div className="update-notification">
          <div className="update-message">
            <span className="update-icon">🔄</span>
            <span>A new version is available</span>
          </div>
          <button 
            className="update-action-button"
            onClick={updateServiceWorker}
          >
            Update Now
          </button>
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="sync-error">
          <span className="error-icon">⚠️</span>
          <span>Sync failed. Will retry automatically.</span>
        </div>
      )}
    </div>
  );
};

const OfflineStatusDetails = () => {
  const { offlineStats, cacheStatus } = useOffline();
  
  if (!offlineStats) {
    return <div className="loading-stats">Loading stats...</div>;
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="offline-status-details">
      <div className="stats-section">
        <h4>Storage</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Alerts</span>
            <span className="stat-value">{offlineStats.storage.alerts || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Preferences</span>
            <span className="stat-value">{offlineStats.storage.userPreferences || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pending Sync</span>
            <span className="stat-value">{offlineStats.storage.syncQueue || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Conflicts</span>
            <span className="stat-value">{offlineStats.storage.conflicts || 0}</span>
          </div>
        </div>
      </div>

      <div className="stats-section">
        <h4>Cache</h4>
        <div className="cache-stats">
          {Object.entries(cacheStatus).map(([cacheName, count]) => (
            <div key={cacheName} className="cache-item">
              <span className="cache-name">{cacheName}</span>
              <span className="cache-count">{count} items</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-section">
        <h4>Sync Info</h4>
        <div className="sync-info">
          <div className="sync-item">
            <span className="sync-label">Last Sync</span>
            <span className="sync-value">{formatDate(offlineStats.lastSync)}</span>
          </div>
          <div className="sync-item">
            <span className="sync-label">Pending Operations</span>
            <span className="sync-value">{offlineStats.pendingOperations}</span>
          </div>
        </div>
      </div>

      <div className="offline-features">
        <h4>Available Offline</h4>
        <div className="feature-list">
          <div className="feature-item">📋 View cached alerts</div>
          <div className="feature-item">⚙️ Access preferences</div>
          <div className="feature-item">🗺️ Basic map features</div>
          <div className="feature-item">📱 Local notifications</div>
          <div className="feature-item">📊 Alert history</div>
        </div>
      </div>
    </div>
  );
};

export default OfflineStatus;