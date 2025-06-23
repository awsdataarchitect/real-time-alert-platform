import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../../../src/pages/Settings';

// Mock the theme context
const mockToggleTheme = jest.fn();
const mockToggleHighContrast = jest.fn();
const mockChangeFontSize = jest.fn();

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    highContrast: false,
    fontSize: 'medium',
    toggleTheme: mockToggleTheme,
    toggleHighContrast: mockToggleHighContrast,
    changeFontSize: mockChangeFontSize
  })
}));

describe('Settings Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders settings with correct structure', () => {
    render(<Settings />);
    
    expect(screen.getByTestId('settings')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Customize your alert platform experience')).toBeInTheDocument();
  });

  test('displays all settings sections', () => {
    render(<Settings />);
    
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
  });

  test('displays theme toggle with correct initial state', () => {
    render(<Settings />);
    
    const themeButton = screen.getByText('Light');
    expect(themeButton).toBeInTheDocument();
  });

  test('calls toggleTheme when theme button is clicked', () => {
    render(<Settings />);
    
    const themeButton = screen.getByText('Light');
    fireEvent.click(themeButton);
    
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  test('displays high contrast toggle with correct initial state', () => {
    render(<Settings />);
    
    const contrastButton = screen.getByText('Off');
    expect(contrastButton).toBeInTheDocument();
    expect(contrastButton).not.toHaveClass('active');
  });

  test('calls toggleHighContrast when high contrast button is clicked', () => {
    render(<Settings />);
    
    const contrastButton = screen.getByText('Off');
    fireEvent.click(contrastButton);
    
    expect(mockToggleHighContrast).toHaveBeenCalledTimes(1);
  });

  test('displays font size selector with correct initial value', () => {
    render(<Settings />);
    
    const fontSizeSelect = screen.getByDisplayValue('Medium');
    expect(fontSizeSelect).toBeInTheDocument();
  });

  test('calls changeFontSize when font size is changed', () => {
    render(<Settings />);
    
    const fontSizeSelect = screen.getByDisplayValue('Medium');
    fireEvent.change(fontSizeSelect, { target: { value: 'large' } });
    
    expect(mockChangeFontSize).toHaveBeenCalledWith('large');
  });

  test('has proper accessibility attributes', () => {
    render(<Settings />);
    
    // Check for proper labeling
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('High Contrast')).toBeInTheDocument();
    expect(screen.getByText('Font Size')).toBeInTheDocument();
    
    // Check for descriptions
    expect(screen.getByText('Choose between light and dark themes')).toBeInTheDocument();
    expect(screen.getByText('Increase contrast for better visibility')).toBeInTheDocument();
    expect(screen.getByText('Adjust text size for better readability')).toBeInTheDocument();
    
    // Check aria-pressed attributes
    const toggleButtons = screen.getAllByRole('button');
    const pressedButtons = toggleButtons.filter(button => 
      button.hasAttribute('aria-pressed')
    );
    expect(pressedButtons.length).toBeGreaterThan(0);
  });

  test('displays notification settings', () => {
    render(<Settings />);
    
    expect(screen.getByText('Browser Notifications')).toBeInTheDocument();
    expect(screen.getByText('Sound Alerts')).toBeInTheDocument();
    expect(screen.getByText('Receive alerts through browser notifications')).toBeInTheDocument();
    expect(screen.getByText('Play sound when new alerts arrive')).toBeInTheDocument();
  });

  test('displays accessibility settings', () => {
    render(<Settings />);
    
    expect(screen.getByText('Screen Reader Support')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Navigation')).toBeInTheDocument();
    expect(screen.getByText('Enhanced support for screen readers')).toBeInTheDocument();
    expect(screen.getByText('Navigate using keyboard shortcuts')).toBeInTheDocument();
  });

  test('has correct section headings with proper hierarchy', () => {
    render(<Settings />);
    
    const mainHeading = screen.getByRole('heading', { level: 2 });
    expect(mainHeading).toHaveTextContent('Settings');
    
    const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(sectionHeadings).toHaveLength(3);
    expect(sectionHeadings[0]).toHaveTextContent('Appearance');
    expect(sectionHeadings[1]).toHaveTextContent('Notifications');
    expect(sectionHeadings[2]).toHaveTextContent('Accessibility');
  });
});