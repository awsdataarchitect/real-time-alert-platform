import React from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * Higher-order component for authentication and authorization
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} options - Authorization options
 * @param {boolean} options.requireAuth - Whether authentication is required
 * @param {string[]} options.requiredRoles - Required user roles
 * @param {string[]} options.requiredPermissions - Required permissions
 * @param {React.Component} options.fallback - Component to show when access is denied
 */
const withAuth = (WrappedComponent, options = {}) => {
  const {
    requireAuth = true,
    requiredRoles = [],
    requiredPermissions = [],
    fallback = null
  } = options;

  const AuthenticatedComponent = (props) => {
    const { 
      isAuthenticated, 
      hasAnyRole, 
      hasAnyPermission, 
      loading,
      user,
      getUserRole
    } = useAuth();

    // Show loading while checking authentication
    if (loading) {
      return (
        <div className="loading-container" data-testid="auth-loading">
          <div className="loading-spinner" aria-label="Loading...">
            Loading...
          </div>
        </div>
      );
    }

    // If authentication is not required, render component
    if (!requireAuth) {
      return <WrappedComponent {...props} user={user} userRole={getUserRole()} />;
    }

    // Check if user is authenticated
    if (!isAuthenticated()) {
      return (
        <div className="auth-required" data-testid="auth-required">
          <h2>Authentication Required</h2>
          <p>Please log in to access this feature.</p>
          {fallback}
        </div>
      );
    }

    // Check role-based access
    if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
      return (
        <div className="access-denied" data-testid="access-denied-role">
          <h2>Access Denied</h2>
          <p>You don't have the required role to access this feature.</p>
          <p>Required roles: {requiredRoles.join(', ')}</p>
          <p>Your role: {getUserRole()}</p>
          {fallback}
        </div>
      );
    }

    // Check permission-based access
    if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
      return (
        <div className="access-denied" data-testid="access-denied-permission">
          <h2>Access Denied</h2>
          <p>You don't have the required permissions to access this feature.</p>
          <p>Required permissions: {requiredPermissions.join(', ')}</p>
          {fallback}
        </div>
      );
    }

    // User is authenticated and authorized
    return <WrappedComponent {...props} user={user} userRole={getUserRole()} />;
  };

  // Set display name for debugging
  AuthenticatedComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;

  return AuthenticatedComponent;
};

export default withAuth;