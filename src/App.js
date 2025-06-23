import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import AlertDetailPage from './pages/AlertDetailPage';
import Settings from './pages/Settings';
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
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AccessibilityProvider>
      <AuthProvider>
        <Router>
          <AppLayout />
        </Router>
      </AuthProvider>
    </AccessibilityProvider>
  );
}

export default App;