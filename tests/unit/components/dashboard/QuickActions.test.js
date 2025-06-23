import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickActions from '../../../../src/components/dashboard/QuickActions';

// Mock console.log to test action clicks
const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('QuickActions Component', () => {
  beforeEach(() => {
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  test('renders quick actions with correct structure', () => {
    render(<QuickActions />);
    
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
  });

  test('displays all action cards', () => {
    render(<QuickActions />);
    
    expect(screen.getByText('Emergency Contacts')).toBeInTheDocument();
    expect(screen.getByText('Report Incident')).toBeInTheDocument();
    expect(screen.getByText('Evacuation Routes')).toBeInTheDocument();
    expect(screen.getByText('Emergency Resources')).toBeInTheDocument();
  });

  test('displays action descriptions', () => {
    render(<QuickActions />);
    
    expect(screen.getByText('Access emergency contact information')).toBeInTheDocument();
    expect(screen.getByText('Report a new incident or emergency')).toBeInTheDocument();
    expect(screen.getByText('View evacuation routes and safe zones')).toBeInTheDocument();
    expect(screen.getByText('Find nearby emergency resources')).toBeInTheDocument();
  });

  test('action cards are clickable and trigger actions', () => {
    render(<QuickActions />);
    
    const emergencyButton = screen.getByText('Emergency Contacts').closest('button');
    const reportButton = screen.getByText('Report Incident').closest('button');
    const evacuationButton = screen.getByText('Evacuation Routes').closest('button');
    const resourcesButton = screen.getByText('Emergency Resources').closest('button');
    
    fireEvent.click(emergencyButton);
    expect(consoleSpy).toHaveBeenCalledWith('Emergency contacts');
    
    fireEvent.click(reportButton);
    expect(consoleSpy).toHaveBeenCalledWith('Report incident');
    
    fireEvent.click(evacuationButton);
    expect(consoleSpy).toHaveBeenCalledWith('Evacuation routes');
    
    fireEvent.click(resourcesButton);
    expect(consoleSpy).toHaveBeenCalledWith('Emergency resources');
  });

  test('displays emergency banner', () => {
    render(<QuickActions />);
    
    expect(screen.getByText('Emergency Hotline:')).toBeInTheDocument();
    expect(screen.getByText('911')).toBeInTheDocument();
  });

  test('has proper accessibility attributes', () => {
    render(<QuickActions />);
    
    // Check that action cards have proper descriptions
    const emergencyCard = screen.getByText('Emergency Contacts').closest('button');
    expect(emergencyCard).toHaveAttribute('aria-describedby', 'emergency-description');
    
    const reportCard = screen.getByText('Report Incident').closest('button');
    expect(reportCard).toHaveAttribute('aria-describedby', 'report-description');
    
    const evacuationCard = screen.getByText('Evacuation Routes').closest('button');
    expect(evacuationCard).toHaveAttribute('aria-describedby', 'evacuation-description');
    
    const resourcesCard = screen.getByText('Emergency Resources').closest('button');
    expect(resourcesCard).toHaveAttribute('aria-describedby', 'resources-description');
  });

  test('displays action icons', () => {
    render(<QuickActions />);
    
    // Check that icons are present and have aria-hidden
    const icons = screen.getAllByLabelText((content, element) => {
      return element?.getAttribute('aria-hidden') === 'true' && 
             element?.classList.contains('action-icon');
    });
    
    expect(icons).toHaveLength(4);
  });

  test('has correct CSS classes for styling', () => {
    render(<QuickActions />);
    
    const quickActions = screen.getByTestId('quick-actions');
    expect(quickActions).toHaveClass('quick-actions');
    
    // Check for actions grid
    const actionsGrid = quickActions.querySelector('.actions-grid');
    expect(actionsGrid).toBeInTheDocument();
    
    // Check for action cards
    const actionCards = quickActions.querySelectorAll('.action-card');
    expect(actionCards).toHaveLength(4);
    
    // Check for emergency banner
    const emergencyBanner = quickActions.querySelector('.emergency-banner');
    expect(emergencyBanner).toBeInTheDocument();
  });

  test('emergency banner has proper structure', () => {
    render(<QuickActions />);
    
    const banner = screen.getByText('Emergency Hotline:').closest('.emergency-banner');
    expect(banner).toBeInTheDocument();
    
    // Check for banner icon with aria-hidden
    const bannerIcon = banner.querySelector('.banner-icon[aria-hidden="true"]');
    expect(bannerIcon).toBeInTheDocument();
  });
});