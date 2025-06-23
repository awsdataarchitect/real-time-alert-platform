/**
 * Unit tests for OfflineStatus component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OfflineStatus from '../../../../src/components/offline/OfflineStatus';
import useOffline from '../../../../src/hooks/useOffline';

// Mock useOffline hook
jest.mock('../../../../src/hooks/useOffline');

describe('OfflineStatus', () => {
  const mockUseOffline = {
    isOnline: true,
    syncStatus: 'idle',
    pendingOperations: 0,
    serviceWorkerUpdate: false,
    forceSync: jest.fn(),
    updateServiceWorker: jest.fn(),
    refreshStats: jest.fn(),
    getConnectionQuality: jest.fn(() => 'excellent'),
    isSyncing: false,
    hasPendingOperations: false,
    offlineStats: {
      storage: {
        alerts: 5,
        userPreferences: 1,
        syncQueue: 2,
        conflicts: 0,
      },
      cache: {
        'static-v1': 10,
        'dynamic-v1': 5,
      },
      pendingOperations: 2,
      lastSync: '2023-01-01T12:00:00Z',
    },
    cacheStatus: {
      'static-v1': 10,
      'dynamic-v1': 5,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useOffline.mockReturnValue(mockUseOffline);
  });

  describe('compact mode', () => {
    it('should render online status', () => {
      render(<OfflineStatus />);
      
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });

    it('should render offline status', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        isOnline: false,
      });

      render(<OfflineStatus />);
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByText('📡')).toBeInTheDocument();
    });

    it('should render syncing status', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        syncStatus: 'syncing',
        isSyncing: true,
      });

      render(<OfflineStatus />);
      
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
      expect(screen.getByText('🔄')).toBeInTheDocument();
    });

    it('should render pending operations', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        pendingOperations: 3,
        hasPendingOperations: true,
      });

      render(<OfflineStatus />);
      
      expect(screen.getByText('3 pending')).toBeInTheDocument();
      expect(screen.getByText('⏳')).toBeInTheDocument();
    });

    it('should show update button when service worker update is available', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        serviceWorkerUpdate: true,
      });

      render(<OfflineStatus />);
      
      const updateButton = screen.getByText('🔄 Update');
      expect(updateButton).toBeInTheDocument();
      
      fireEvent.click(updateButton);
      expect(mockUseOffline.updateServiceWorker).toHaveBeenCalled();
    });
  });

  describe('detailed mode', () => {
    it('should render detailed status information', () => {
      render(<OfflineStatus showDetails={true} />);
      
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByText('📶 excellent')).toBeInTheDocument();
    });

    it('should show pending operations in subtitle', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        pendingOperations: 2,
        hasPendingOperations: true,
      });

      render(<OfflineStatus showDetails={true} />);
      
      expect(screen.getByText('• 2 operations pending')).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      render(<OfflineStatus showDetails={true} />);
      
      expect(screen.getByTitle('Force sync')).toBeInTheDocument();
      expect(screen.getByTitle('Refresh stats')).toBeInTheDocument();
      expect(screen.getByTitle('Toggle details')).toBeInTheDocument();
    });

    it('should handle force sync', async () => {
      render(<OfflineStatus showDetails={true} />);
      
      const syncButton = screen.getByTitle('Force sync');
      fireEvent.click(syncButton);
      
      expect(mockUseOffline.forceSync).toHaveBeenCalled();
    });

    it('should handle refresh stats', async () => {
      render(<OfflineStatus showDetails={true} />);
      
      const refreshButton = screen.getByTitle('Refresh stats');
      fireEvent.click(refreshButton);
      
      expect(mockUseOffline.refreshStats).toHaveBeenCalled();
    });

    it('should toggle detailed stats', () => {
      render(<OfflineStatus showDetails={true} />);
      
      const toggleButton = screen.getByTitle('Toggle details');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('Storage')).toBeInTheDocument();
      expect(screen.getByText('Cache')).toBeInTheDocument();
      expect(screen.getByText('Sync Info')).toBeInTheDocument();
    });

    it('should disable sync button when offline', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        isOnline: false,
      });

      render(<OfflineStatus showDetails={true} />);
      
      const syncButton = screen.getByTitle('Force sync');
      fireEvent.click(syncButton);
      
      expect(mockUseOffline.forceSync).not.toHaveBeenCalled();
    });

    it('should disable sync button when syncing', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        isSyncing: true,
      });

      render(<OfflineStatus showDetails={true} />);
      
      const syncButton = screen.getByTitle('Force sync');
      expect(syncButton).toBeDisabled();
    });

    it('should show update notification', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        serviceWorkerUpdate: true,
      });

      render(<OfflineStatus showDetails={true} />);
      
      expect(screen.getByText('A new version is available')).toBeInTheDocument();
      
      const updateButton = screen.getByText('Update Now');
      fireEvent.click(updateButton);
      
      expect(mockUseOffline.updateServiceWorker).toHaveBeenCalled();
    });

    it('should show sync error', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        syncStatus: 'error',
      });

      render(<OfflineStatus showDetails={true} />);
      
      expect(screen.getByText('Sync failed. Will retry automatically.')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });
  });

  describe('detailed stats', () => {
    beforeEach(() => {
      render(<OfflineStatus showDetails={true} />);
      
      // Toggle to show detailed stats
      const toggleButton = screen.getByTitle('Toggle details');
      fireEvent.click(toggleButton);
    });

    it('should render storage statistics', () => {
      expect(screen.getByText('Storage')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // alerts count
      expect(screen.getByText('1')).toBeInTheDocument(); // preferences count
      expect(screen.getByText('2')).toBeInTheDocument(); // sync queue count
      expect(screen.getByText('0')).toBeInTheDocument(); // conflicts count
    });

    it('should render cache statistics', () => {
      expect(screen.getByText('Cache')).toBeInTheDocument();
      expect(screen.getByText('static-v1')).toBeInTheDocument();
      expect(screen.getByText('10 items')).toBeInTheDocument();
      expect(screen.getByText('dynamic-v1')).toBeInTheDocument();
      expect(screen.getByText('5 items')).toBeInTheDocument();
    });

    it('should render sync information', () => {
      expect(screen.getByText('Sync Info')).toBeInTheDocument();
      expect(screen.getByText('Last Sync')).toBeInTheDocument();
      expect(screen.getByText('Pending Operations')).toBeInTheDocument();
    });

    it('should render offline features', () => {
      expect(screen.getByText('Available Offline')).toBeInTheDocument();
      expect(screen.getByText('📋 View cached alerts')).toBeInTheDocument();
      expect(screen.getByText('⚙️ Access preferences')).toBeInTheDocument();
      expect(screen.getByText('🗺️ Basic map features')).toBeInTheDocument();
      expect(screen.getByText('📱 Local notifications')).toBeInTheDocument();
      expect(screen.getByText('📊 Alert history')).toBeInTheDocument();
    });

    it('should show loading state when stats are not available', () => {
      useOffline.mockReturnValue({
        ...mockUseOffline,
        offlineStats: null,
      });

      render(<OfflineStatus showDetails={true} />);
      
      const toggleButton = screen.getByTitle('Toggle details');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('Loading stats...')).toBeInTheDocument();
    });

    it('should format dates correctly', () => {
      const lastSync = '2023-01-01T12:00:00Z';
      const formattedDate = new Date(lastSync).toLocaleString();
      
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<OfflineStatus showDetails={true} />);
      
      expect(screen.getByTitle('Force sync')).toBeInTheDocument();
      expect(screen.getByTitle('Refresh stats')).toBeInTheDocument();
      expect(screen.getByTitle('Toggle details')).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<OfflineStatus showDetails={true} />);
      
      const syncButton = screen.getByTitle('Force sync');
      syncButton.focus();
      expect(document.activeElement).toBe(syncButton);
    });
  });

  describe('error handling', () => {
    it('should handle force sync errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockUseOffline.forceSync.mockRejectedValue(new Error('Sync failed'));

      render(<OfflineStatus showDetails={true} />);
      
      const syncButton = screen.getByTitle('Force sync');
      fireEvent.click(syncButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to force sync:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should handle refresh stats errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockUseOffline.refreshStats.mockRejectedValue(new Error('Refresh failed'));

      render(<OfflineStatus showDetails={true} />);
      
      const refreshButton = screen.getByTitle('Refresh stats');
      fireEvent.click(refreshButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to refresh stats:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});