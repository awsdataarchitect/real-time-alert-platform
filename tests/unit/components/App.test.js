import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../../src/App';

// Mock the child components
jest.mock('../../../src/components/layout/Header', () => {
  return function MockHeader() {
    return <div data-testid="header">Header</div>;
  };
});

jest.mock('../../../src/components/layout/Sidebar', () => {
  return function MockSidebar() {
    return <div data-testid="sidebar">Sidebar</div>;
  };
});

jest.mock('../../../src/pages/Dashboard', () => {
  return function MockDashboard() {
    return <div data-testid="dashboard">Dashboard</div>;
  };
});

jest.mock('../../../src/pages/AlertDetailPage', () => {
  return function MockAlertDetailPage() {
    return <div data-testid="alert-detail">Alert Detail</div>;
  };
});

jest.mock('../../../src/pages/Settings', () => {
  return function MockSettings() {
    return <div data-testid="settings">Settings</div>;
  };
});

// Mock the theme context
jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    highContrast: false,
    fontSize: 'medium'
  }),
  ThemeProvider: ({ children }) => <div>{children}</div>
}));

describe('App Component', () => {
  const renderApp = (initialEntries = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    );
  };

  test('renders app with correct structure', () => {
    renderApp();
    
    expect(screen.getByTestId('app')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('applies theme class correctly', () => {
    renderApp();
    
    const appElement = screen.getByTestId('app');
    expect(appElement).toHaveClass('app', 'light');
  });

  test('renders Dashboard on root route', () => {
    renderApp(['/']);
    
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  test('renders AlertDetailPage on alert route', () => {
    renderApp(['/alert/123']);
    
    expect(screen.getByTestId('alert-detail')).toBeInTheDocument();
  });

  test('renders Settings on settings route', () => {
    renderApp(['/settings']);
    
    expect(screen.getByTestId('settings')).toBeInTheDocument();
  });

  test('has proper accessibility attributes', () => {
    renderApp();
    
    const mainContent = screen.getByRole('main');
    expect(mainContent).toHaveClass('main-content');
  });
});