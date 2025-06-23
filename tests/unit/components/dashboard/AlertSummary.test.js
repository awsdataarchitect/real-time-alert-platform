import React from 'react';
import { render, screen } from '@testing-library/react';
import AlertSummary from '../../../../src/components/dashboard/AlertSummary';

describe('AlertSummary Component', () => {
  test('renders alert summary with correct structure', () => {
    render(<AlertSummary />);
    
    expect(screen.getByTestId('alert-summary')).toBeInTheDocument();
    expect(screen.getByText('Total Alerts')).toBeInTheDocument();
    expect(screen.getByText('Recent Alerts')).toBeInTheDocument();
  });

  test('displays alert statistics correctly', () => {
    render(<AlertSummary />);
    
    // Check total alerts
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Total Alerts')).toBeInTheDocument();
    
    // Check severity counts
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    
    // Check specific counts
    expect(screen.getByText('3')).toBeInTheDocument(); // Critical
    expect(screen.getByText('5')).toBeInTheDocument(); // High
    expect(screen.getByText('1')).toBeInTheDocument(); // Low
  });

  test('displays recent alerts list', () => {
    render(<AlertSummary />);
    
    // Check for recent alert titles
    expect(screen.getByText('Severe Thunderstorm Warning')).toBeInTheDocument();
    expect(screen.getByText('Air Quality Alert')).toBeInTheDocument();
    expect(screen.getByText('Road Closure')).toBeInTheDocument();
    
    // Check for alert types
    expect(screen.getByText('Weather')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Traffic')).toBeInTheDocument();
    
    // Check for locations
    expect(screen.getByText('Downtown Area')).toBeInTheDocument();
    expect(screen.getByText('Industrial District')).toBeInTheDocument();
    expect(screen.getByText('Highway 101')).toBeInTheDocument();
  });

  test('displays alert timestamps', () => {
    render(<AlertSummary />);
    
    expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('15 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('1 hour ago')).toBeInTheDocument();
  });

  test('has proper accessibility structure', () => {
    render(<AlertSummary />);
    
    // Check for list structure
    const alertList = screen.getByRole('list');
    expect(alertList).toBeInTheDocument();
    
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
    
    // Check for severity icons with proper labels
    const severityIcons = screen.getAllByLabelText(/severity$/);
    expect(severityIcons).toHaveLength(3);
  });

  test('displays view all button', () => {
    render(<AlertSummary />);
    
    const viewAllButton = screen.getByLabelText('View all alerts');
    expect(viewAllButton).toBeInTheDocument();
    expect(viewAllButton).toHaveTextContent('View All Alerts');
  });

  test('has correct CSS classes for styling', () => {
    render(<AlertSummary />);
    
    const summary = screen.getByTestId('alert-summary');
    expect(summary).toHaveClass('alert-summary');
    
    // Check for stat cards
    const statCards = summary.querySelectorAll('.stat-item');
    expect(statCards).toHaveLength(4);
    
    // Check for severity classes
    expect(summary.querySelector('.stat-item.critical')).toBeInTheDocument();
    expect(summary.querySelector('.stat-item.high')).toBeInTheDocument();
    expect(summary.querySelector('.stat-item.medium')).toBeInTheDocument();
    expect(summary.querySelector('.stat-item.low')).toBeInTheDocument();
  });

  test('displays severity icons correctly', () => {
    render(<AlertSummary />);
    
    // Check that severity icons are present and have aria-hidden
    const icons = screen.getAllByLabelText((content, element) => {
      return element?.getAttribute('aria-hidden') === 'true' && 
             element?.classList.contains('stat-icon');
    });
    
    expect(icons).toHaveLength(4); // One for each severity level
  });
});