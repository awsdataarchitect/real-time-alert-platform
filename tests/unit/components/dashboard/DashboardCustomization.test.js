import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardCustomization from '../../../../src/components/dashboard/DashboardCustomization';
import { DashboardProvider } from '../../../../src/context/DashboardContext';
import { FilterProvider } from '../../../../src/context/FilterContext';
import { MapProvider } from '../../../../src/context/MapContext';
import { API, Auth } from 'aws-amplify';

// Mock Amplify
jest.mock('aws-amplify');

// Mock context providers
jest.mock('../../../../src/context/FilterContext', () => ({
  ...jest.requireActual('../../../../src/context/FilterContext'),
  useFilter: () => ({
    filters: {
      category: 'WEATHER',
      severity: 'SEVERE',
      status: 'ACTIVE',
    }
  })
}));

jest.mock('../../../../src/context/MapContext', () => ({
  ...jest.requireActual('../../../../src/context/MapContext'),
  useMap: () => ({
    mapSettings: {
      zoom: 5,
      center: { latitude: 40.7128, longitude: -74.0060 },
      layerVisibility: { alerts: true, weather: true }
    }
  })
}));

// Mock the DashboardContext
jest.mock('../../../../src/context/DashboardContext', () => {
  const originalModule = jest.requireActual('../../../../src/context/DashboardContext');
  
  return {
    ...originalModule,
    useDashboard: () => ({
      dashboardPreferences: {
        defaultView: 'map',
        favoriteFilters: [
          JSON.stringify({
            name: 'Test Filter',
            timestamp: '2023-01-01T00:00:00.000Z',
            config: JSON.stringify({
              category: 'WEATHER',
              severity: 'SEVERE'
            })
          })
        ],
        mapSettings: {
          defaultZoom: 3,
          defaultCenter: { latitude: 37.0902, longitude: -95.7129 },
          layerVisibility: JSON.stringify({ alerts: true, weather: true })
        }
      },
      loading: false,
      error: null,
      saveFilterAsFavorite: jest.fn().mockResolvedValue({}),
      deleteFavoriteFilter: jest.fn().mockResolvedValue({}),
      saveMapSettings: jest.fn().mockResolvedValue({}),
      setDefaultView: jest.fn().mockResolvedValue({})
    })
  };
});

describe('DashboardCustomization Component', () => {
  beforeEach(() => {
    // Mock Auth.currentAuthenticatedUser
    Auth.currentAuthenticatedUser.mockResolvedValue({
      username: 'testuser',
      attributes: {
        email: 'test@example.com'
      }
    });
    
    // Mock API.graphql
    API.graphql.mockResolvedValue({
      data: {
        getUser: {
          id: 'testuser',
          dashboardPreferences: {
            defaultView: 'map',
            favoriteFilters: [],
            mapSettings: {
              defaultZoom: 3,
              defaultCenter: {
                latitude: 37.0902,
                longitude: -95.7129
              },
              layerVisibility: '{}'
            }
          }
        }
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders the component with collapsed state initially', () => {
    render(
      <MapProvider>
        <FilterProvider>
          <DashboardProvider>
            <DashboardCustomization />
          </DashboardProvider>
        </FilterProvider>
      </MapProvider>
    );
    
    expect(screen.getByText('Dashboard Customization')).toBeInTheDocument();
    expect(screen.getByText('Expand')).toBeInTheDocument();
    
    // Content should not be visible initially
    expect(screen.queryByText('Save Current Filter')).not.toBeInTheDocument();
  });

  test('expands when the toggle button is clicked', () => {
    render(
      <MapProvider>
        <FilterProvider>
          <DashboardProvider>
            <DashboardCustomization />
          </DashboardProvider>
        </FilterProvider>
      </MapProvider>
    );
    
    // Click the expand button
    fireEvent.click(screen.getByText('Expand'));
    
    // Content should now be visible
    expect(screen.getByText('Save Current Filter')).toBeInTheDocument();
    expect(screen.getByText('Saved Filters')).toBeInTheDocument();
    
    // Button text should change
    expect(screen.getByText('Collapse')).toBeInTheDocument();
  });

  test('shows saved filters when expanded', () => {
    render(
      <MapProvider>
        <FilterProvider>
          <DashboardProvider>
            <DashboardCustomization />
          </DashboardProvider>
        </FilterProvider>
      </MapProvider>
    );
    
    // Click the expand button
    fireEvent.click(screen.getByText('Expand'));
    
    // Should show the saved filter
    expect(screen.getByText('Test Filter')).toBeInTheDocument();
  });

  test('allows saving a new filter', async () => {
    const { useDashboard } = require('../../../../src/context/DashboardContext');
    const mockSaveFilter = useDashboard().saveFilterAsFavorite;
    
    render(
      <MapProvider>
        <FilterProvider>
          <DashboardProvider>
            <DashboardCustomization />
          </DashboardProvider>
        </FilterProvider>
      </MapProvider>
    );
    
    // Click the expand button
    fireEvent.click(screen.getByText('Expand'));
    
    // Enter a filter name
    fireEvent.change(screen.getByPlaceholderText('Enter filter name'), {
      target: { value: 'My New Filter' }
    });
    
    // Click save button
    fireEvent.click(screen.getByText('Save Filter'));
    
    // Check if the save function was called
    await waitFor(() => {
      expect(mockSaveFilter).toHaveBeenCalledWith('My New Filter');
    });
  });

  test('switches between tabs', () => {
    render(
      <MapProvider>
        <FilterProvider>
          <DashboardProvider>
            <DashboardCustomization />
          </DashboardProvider>
        </FilterProvider>
      </MapProvider>
    );
    
    // Click the expand button
    fireEvent.click(screen.getByText('Expand'));
    
    // Should start on filters tab
    expect(screen.getByText('Save Current Filter')).toBeInTheDocument();
    
    // Click on Map Settings tab
    fireEvent.click(screen.getByText('Map Settings'));
    
    // Should show map settings content
    expect(screen.getByText('Current Map Settings')).toBeInTheDocument();
    expect(screen.getByText('Default Zoom:')).toBeInTheDocument();
    
    // Click on Default View tab
    fireEvent.click(screen.getByText('Default View'));
    
    // Should show default view content
    expect(screen.getByText('Select Default View')).toBeInTheDocument();
    expect(screen.getByText('Map View')).toBeInTheDocument();
  });

  test('allows setting default view', async () => {
    const { useDashboard } = require('../../../../src/context/DashboardContext');
    const mockSetDefaultView = useDashboard().setDefaultView;
    
    render(
      <MapProvider>
        <FilterProvider>
          <DashboardProvider>
            <DashboardCustomization />
          </DashboardProvider>
        </FilterProvider>
      </MapProvider>
    );
    
    // Click the expand button
    fireEvent.click(screen.getByText('Expand'));
    
    // Click on Default View tab
    fireEvent.click(screen.getByText('Default View'));
    
    // Click on List View button
    fireEvent.click(screen.getByText('List View'));
    
    // Check if the setDefaultView function was called
    await waitFor(() => {
      expect(mockSetDefaultView).toHaveBeenCalledWith('list');
    });
  });

  test('allows saving map settings', async () => {
    const { useDashboard } = require('../../../../src/context/DashboardContext');
    const mockSaveMapSettings = useDashboard().saveMapSettings;
    
    render(
      <MapProvider>
        <FilterProvider>
          <DashboardProvider>
            <DashboardCustomization />
          </DashboardProvider>
        </FilterProvider>
      </MapProvider>
    );
    
    // Click the expand button
    fireEvent.click(screen.getByText('Expand'));
    
    // Click on Map Settings tab
    fireEvent.click(screen.getByText('Map Settings'));
    
    // Click save button
    fireEvent.click(screen.getByText('Save Current Map Settings as Default'));
    
    // Check if the saveMapSettings function was called
    await waitFor(() => {
      expect(mockSaveMapSettings).toHaveBeenCalled();
    });
  });
});