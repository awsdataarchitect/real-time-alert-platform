import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from '../../../src/pages/Dashboard';

// Mock the child components
jest.mock('../../../src/components/map/Map', () => {
  return function MockMap() {
    return <div data-testid="map">Map Component</div>;
  };
});

jest.mock('../../../src/components/dashboard/AlertSummary', () => {
  return function MockAlertSummary() {
    return <div data-testid="alert-summary">Alert Summary</div>;
  };
});

jest.mock('../../../src/components/dashboard/QuickActions', () => {
  return function MockQuickActions() {
    return <div data-testid="quick-actions">Quick Actions</div>;
  };
});

describe('Dashboard Component', () => {
  test('renders dashboard with correct structure', () => {
    render(<Dashboard />);
    
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.getByText('Emergency Alert Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Real-time monitoring of critical events and alerts')).toBeInTheDocument();
  });

  test('displays all dashboard sections', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Alert Map')).toBeInTheDocument();
    expect(screen.getByText('Alert Summary')).toBeInTheDocument();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  test('renders child components', () => {
    render(<Dashboard />);
    
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.getByTestId('alert-summary')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
  });

  test('has proper accessibility structure', () => {
    render(<Dashboard />);
    
    // Check for section headings with proper IDs
    expect(screen.getByText('Alert Map')).toHaveAttribute('id', 'map-heading');
    expect(screen.getByText('Alert Summary')).toHaveAttribute('id', 'summary-heading');
    expect(screen.getByText('Quick Actions')).toHaveAttribute('id', 'actions-heading');
    
    // Check for sections with aria-labelledby
    const sections = screen.getAllByRole('region');
    expect(sections).toHaveLength(3);
    
    sections.forEach(section => {
      expect(section).toHaveAttribute('aria-labelledby');
    });
  });

  test('has correct CSS classes for responsive layout', () => {
    render(<Dashboard />);
    
    const dashboard = screen.getByTestId('dashboard');
    expect(dashboard).toHaveClass('dashboard');
    
    const grid = dashboard.querySelector('.dashboard-grid');
    expect(grid).toBeInTheDocument();
    
    const sections = dashboard.querySelectorAll('.dashboard-section');
    expect(sections).toHaveLength(3);
  });
});