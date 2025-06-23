import React from 'react';
import { useAuth } from '../../context/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const ProtectedRoute = ({ 
  children, 
  requireAuth = true, 
  requiredRoles = [], 
  requiredPermissions = [],
  fallback = null 
}) => {
  const { 
    isAuthenticated, 
    hasAnyRole, 
    hasAnyPermission, 
    loading, 
    user 
  } = useAuth();
  const [showRegister, setShowRegister] = React.useState(false);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="loading-container" data-testid="auth-loading">
        <div className="loading-spinner" aria-label="Loading...">
          Loading...
        </div>
      </div>
    );
  }

  // If authentication is not required, render children
  if (!requireAuth) {
    return children;
  }

  // If user is not authenticated, show login/register forms
  if (!isAuthenticated()) {
    if (showRegister) {
      return (
        <RegisterForm
          onSuccess={() => window.location.reload()}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    }
    
    return (
      <LoginForm
        onSuccess={() => window.location.reload()}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  // Check role-based access
  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return (
      <div className="access-denied" data-testid="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have the required permissions to access this page.</p>
        <p>Required roles: {requiredRoles.join(', ')}</p>
        {fallback}
      </div>
    );
  }

  // Check permission-based access
  if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    return (
      <div className="access-denied" data-testid="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have the required permissions to access this page.</p>
        <p>Required permissions: {requiredPermissions.join(', ')}</p>
        {fallback}
      </div>
    );
  }

  // User is authenticated and authorized, render children
  return children;
};

export default ProtectedRoute;