import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext';
import { MapProvider } from './context/MapContext';
import { SimpleMapProvider } from './context/SimpleMapContext';
import { FilterProvider } from './context/FilterContext';
import { DashboardProvider } from './context/DashboardContext';
import TestMapContext from './components/TestMapContext';
import SimpleMapTest from './components/SimpleMapTest';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import AlertDetailPage from './pages/AlertDetailPage';
import Settings from './pages/Settings';
import ActiveAlerts from './pages/ActiveAlerts';
import AlertMap from './pages/AlertMap';
import AlertHistory from './pages/AlertHistory';
import { createSkipLink } from './utils/keyboardNavigation';
import './config/amplify'; // Initialize Amplify configuration
import './styles/App.css';

// Component to handle route announcements
const RouteAnnouncer = () => {
  const location = useLocation();
  const { announcePageChange } = useAccessibility();

  useEffect(() => {
    const getPageName = (pathname) => {
      switch (pathname) {
        case '/':
          return 'Dashboard';
        case '/settings':
          return 'Settings';
        default:
          if (pathname.startsWith('/alert/')) {
            return 'Alert Details';
          }
          return 'Page';
      }
    };

    const pageName = getPageName(location.pathname);
    announcePageChange(pageName);
  }, [location.pathname, announcePageChange]);

  return null;
};

// Main App Layout Component
const AppLayout = () => {
  const { theme } = useTheme();

  useEffect(() => {
    // Create skip links
    const skipToMain = createSkipLink('main-content', 'Skip to main content');
    const skipToNav = createSkipLink('sidebar-nav', 'Skip to navigation');
    
    // Insert skip links at the beginning of the body
    document.body.insertBefore(skipToMain, document.body.firstChild);
    document.body.insertBefore(skipToNav, document.body.firstChild);

    return () => {
      // Cleanup skip links
      if (skipToMain.parentNode) {
        skipToMain.parentNode.removeChild(skipToMain);
      }
      if (skipToNav.parentNode) {
        skipToNav.parentNode.removeChild(skipToNav);
      }
    };
  }, []);

  return (
    <div className={`app ${theme}`} data-testid="app">
      <div className="app-layout">
        <ProtectedRoute requireAuth={false}>
          <Header />
        </ProtectedRoute>
        <div className="app-content">
          <ProtectedRoute requireAuth={false}>
            <Sidebar />
          </ProtectedRoute>
          <main 
            id="main-content" 
            className="main-content" 
            role="main"
            tabIndex="-1"
          >
            <RouteAnnouncer />
            <Routes>
              <Route 
                path="/" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/alert/:id" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AlertDetailPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/alerts" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <ActiveAlerts />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/map" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AlertMap />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/history" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AlertHistory />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AccessibilityProvider>
          <AuthProvider>
            <MapProvider>
              <SimpleMapProvider>
                <FilterProvider>
                  <DashboardProvider>
                    <AppLayout />
                  </DashboardProvider>
                </FilterProvider>
              </SimpleMapProvider>
            </MapProvider>
          </AuthProvider>
        </AccessibilityProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;