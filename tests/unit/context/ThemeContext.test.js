import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../../src/context/ThemeContext';

// Test component to use the theme context
const TestComponent = () => {
  const { 
    theme, 
    highContrast, 
    fontSize, 
    toggleTheme, 
    toggleHighContrast, 
    changeFontSize 
  } = useTheme();

  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="high-contrast">{highContrast.toString()}</div>
      <div data-testid="font-size">{fontSize}</div>
      <button onClick={toggleTheme} data-testid="toggle-theme">
        Toggle Theme
      </button>
      <button onClick={toggleHighContrast} data-testid="toggle-contrast">
        Toggle Contrast
      </button>
      <button onClick={() => changeFontSize('large')} data-testid="change-font">
        Change Font
      </button>
    </div>
  );
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset document attributes
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-high-contrast');
    document.documentElement.removeAttribute('data-font-size');
  });

  test('provides default theme values', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
    expect(screen.getByTestId('font-size')).toHaveTextContent('medium');
  });

  test('loads saved preferences from localStorage', () => {
    localStorageMock.getItem.mockImplementation((key) => {
      switch (key) {
        case 'theme': return 'dark';
        case 'highContrast': return 'true';
        case 'fontSize': return 'large';
        default: return null;
      }
    });

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('true');
    expect(screen.getByTestId('font-size')).toHaveTextContent('large');
  });

  test('toggles theme correctly', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId('toggle-theme');
    
    // Initial state should be light
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    
    // Toggle to dark
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    
    // Toggle back to light
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  test('toggles high contrast correctly', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId('toggle-contrast');
    
    // Initial state should be false
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
    
    // Toggle to true
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('true');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('highContrast', true);
    
    // Toggle back to false
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('highContrast', false);
  });

  test('changes font size correctly', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const changeButton = screen.getByTestId('change-font');
    
    // Initial state should be medium
    expect(screen.getByTestId('font-size')).toHaveTextContent('medium');
    
    // Change to large
    fireEvent.click(changeButton);
    expect(screen.getByTestId('font-size')).toHaveTextContent('large');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('fontSize', 'large');
  });

  test('sets document attributes correctly', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Check initial document attributes
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('false');
    expect(document.documentElement.getAttribute('data-font-size')).toBe('medium');

    // Toggle theme and check document attribute
    fireEvent.click(screen.getByTestId('toggle-theme'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Toggle high contrast and check document attribute
    fireEvent.click(screen.getByTestId('toggle-contrast'));
    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');

    // Change font size and check document attribute
    fireEvent.click(screen.getByTestId('change-font'));
    expect(document.documentElement.getAttribute('data-font-size')).toBe('large');
  });

  test('throws error when useTheme is used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');
    
    consoleSpy.mockRestore();
  });
});