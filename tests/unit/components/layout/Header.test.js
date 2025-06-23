import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../../../../src/components/layout/Header';

// Mock the theme context
const mockToggleTheme = jest.fn();
const mockToggleHighContrast = jest.fn();

jest.mock('../../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    highContrast: false,
    toggleTheme: mockToggleTheme,
    toggleHighContrast: mockToggleHighContrast
  })
}));

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders header with correct structure', () => {
    render(<Header />);
    
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Real-Time Alert Platform')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('displays navigation links', () => {
    render(<Header />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  test('has accessibility features', () => {
    render(<Header />);
    
    const menuToggle = screen.getByLabelText('Toggle navigation menu');
    expect(menuToggle).toBeInTheDocument();
    expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
    
    const themeToggle = screen.getByLabelText('Switch to dark theme');
    expect(themeToggle).toBeInTheDocument();
    
    const contrastToggle = screen.getByLabelText('Enable high contrast mode');
    expect(contrastToggle).toBeInTheDocument();
  });

  test('toggles mobile menu when menu button is clicked', () => {
    render(<Header />);
    
    const menuToggle = screen.getByLabelText('Toggle navigation menu');
    const nav = screen.getByRole('navigation');
    
    expect(nav).not.toHaveClass('nav-open');
    
    fireEvent.click(menuToggle);
    expect(nav).toHaveClass('nav-open');
    expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
    
    fireEvent.click(menuToggle);
    expect(nav).not.toHaveClass('nav-open');
    expect(menuToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('calls toggleTheme when theme button is clicked', () => {
    render(<Header />);
    
    const themeToggle = screen.getByLabelText('Switch to dark theme');
    fireEvent.click(themeToggle);
    
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  test('calls toggleHighContrast when accessibility button is clicked', () => {
    render(<Header />);
    
    const contrastToggle = screen.getByLabelText('Enable high contrast mode');
    fireEvent.click(contrastToggle);
    
    expect(mockToggleHighContrast).toHaveBeenCalledTimes(1);
  });

  test('displays correct theme toggle text for dark theme', () => {
    // Mock dark theme
    jest.doMock('../../../../src/context/ThemeContext', () => ({
      useTheme: () => ({
        theme: 'dark',
        highContrast: false,
        toggleTheme: mockToggleTheme,
        toggleHighContrast: mockToggleHighContrast
      })
    }));

    // Re-import and render with dark theme
    const HeaderDark = require('../../../../src/components/layout/Header').default;
    render(<HeaderDark />);
    
    expect(screen.getByLabelText('Switch to light theme')).toBeInTheDocument();
  });

  test('displays correct contrast toggle text when high contrast is enabled', () => {
    // Mock high contrast enabled
    jest.doMock('../../../../src/context/ThemeContext', () => ({
      useTheme: () => ({
        theme: 'light',
        highContrast: true,
        toggleTheme: mockToggleTheme,
        toggleHighContrast: mockToggleHighContrast
      })
    }));

    // Re-import and render with high contrast
    const HeaderHighContrast = require('../../../../src/components/layout/Header').default;
    render(<HeaderHighContrast />);
    
    expect(screen.getByLabelText('Disable high contrast mode')).toBeInTheDocument();
  });
});