import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../../../../src/components/layout/Sidebar';

describe('Sidebar Component', () => {
  test('renders sidebar with correct structure', () => {
    render(<Sidebar />);
    
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('menubar')).toBeInTheDocument();
  });

  test('displays all menu items', () => {
    render(<Sidebar />);
    
    const menuItems = [
      'Dashboard',
      'Active Alerts',
      'Alert Map',
      'Alert History',
      'Settings'
    ];
    
    menuItems.forEach(item => {
      expect(screen.getByLabelText(item)).toBeInTheDocument();
    });
  });

  test('has correct menu item links', () => {
    render(<Sidebar />);
    
    expect(screen.getByLabelText('Dashboard')).toHaveAttribute('href', '/');
    expect(screen.getByLabelText('Active Alerts')).toHaveAttribute('href', '/alerts');
    expect(screen.getByLabelText('Alert Map')).toHaveAttribute('href', '/map');
    expect(screen.getByLabelText('Alert History')).toHaveAttribute('href', '/history');
    expect(screen.getByLabelText('Settings')).toHaveAttribute('href', '/settings');
  });

  test('toggles collapsed state when toggle button is clicked', () => {
    render(<Sidebar />);
    
    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' });
    const toggleButton = screen.getByLabelText('Collapse sidebar');
    
    expect(sidebar).not.toHaveClass('sidebar-collapsed');
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    
    fireEvent.click(toggleButton);
    
    expect(sidebar).toHaveClass('sidebar-collapsed');
    expect(screen.getByLabelText('Expand sidebar')).toHaveAttribute('aria-expanded', 'false');
    
    fireEvent.click(screen.getByLabelText('Expand sidebar'));
    
    expect(sidebar).not.toHaveClass('sidebar-collapsed');
    expect(screen.getByLabelText('Collapse sidebar')).toHaveAttribute('aria-expanded', 'true');
  });

  test('has proper accessibility attributes', () => {
    render(<Sidebar />);
    
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(5);
    
    menuItems.forEach(item => {
      expect(item).toHaveAttribute('aria-label');
      expect(item).toHaveAttribute('title');
    });
  });

  test('displays icons for each menu item', () => {
    render(<Sidebar />);
    
    // Check that icons are present (they have aria-hidden="true")
    const icons = screen.getAllByLabelText((content, element) => {
      return element?.getAttribute('aria-hidden') === 'true' && 
             element?.classList.contains('sidebar-icon');
    });
    
    expect(icons).toHaveLength(5);
  });
});