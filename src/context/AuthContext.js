import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, signIn, signOut, signUp, confirmSignUp, fetchAuthSession } from 'aws-amplify/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// User roles enum
export const USER_ROLES = {
  ADMINISTRATOR: 'Administrators',
  ALERT_MANAGER: 'AlertManagers',
  USER: 'Users',
  GUEST: 'Guests'
};

// Permission levels
export const PERMISSIONS = {
  READ_ALERTS: 'read:alerts',
  CREATE_ALERTS: 'create:alerts',
  UPDATE_ALERTS: 'update:alerts',
  DELETE_ALERTS: 'delete:alerts',
  MANAGE_USERS: 'manage:users',
  VIEW_ANALYTICS: 'view:analytics',
  SYSTEM_ADMIN: 'system:admin'
};

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMINISTRATOR]: [
    PERMISSIONS.READ_ALERTS,
    PERMISSIONS.CREATE_ALERTS,
    PERMISSIONS.UPDATE_ALERTS,
    PERMISSIONS.DELETE_ALERTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.SYSTEM_ADMIN
  ],
  [USER_ROLES.ALERT_MANAGER]: [
    PERMISSIONS.READ_ALERTS,
    PERMISSIONS.CREATE_ALERTS,
    PERMISSIONS.UPDATE_ALERTS,
    PERMISSIONS.DELETE_ALERTS,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  [USER_ROLES.USER]: [
    PERMISSIONS.READ_ALERTS
  ],
  [USER_ROLES.GUEST]: [
    PERMISSIONS.READ_ALERTS
  ]
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on component mount
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      
      // Extract user groups from JWT token
      const groups = session?.tokens?.accessToken?.payload?.['cognito:groups'] || [];
      
      setUser(currentUser);
      setUserGroups(groups);
      setError(null);
    } catch (err) {
      console.log('No authenticated user found');
      setUser(null);
      setUserGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const { isSignedIn } = await signIn({ username, password });
      
      if (isSignedIn) {
        await checkAuthState();
        return { success: true };
      }
      
      return { success: false, error: 'Sign in failed' };
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
      return { success: false, error: err.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await signOut();
      setUser(null);
      setUserGroups([]);
      setError(null);
      return { success: true };
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message || 'Logout failed');
      return { success: false, error: err.message || 'Logout failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, password, email, attributes = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
            ...attributes
          }
        }
      });

      return { 
        success: true, 
        isSignUpComplete, 
        userId, 
        nextStep,
        requiresConfirmation: nextStep?.signUpStep === 'CONFIRM_SIGN_UP'
      };
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed');
      return { success: false, error: err.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const confirmRegistration = async (username, confirmationCode) => {
    try {
      setLoading(true);
      setError(null);
      
      const { isSignUpComplete } = await confirmSignUp({
        username,
        confirmationCode
      });

      if (isSignUpComplete) {
        return { success: true };
      }
      
      return { success: false, error: 'Confirmation failed' };
    } catch (err) {
      console.error('Confirmation error:', err);
      setError(err.message || 'Confirmation failed');
      return { success: false, error: err.message || 'Confirmation failed' };
    } finally {
      setLoading(false);
    }
  };

  // Authorization helpers
  const hasRole = (role) => {
    return userGroups.includes(role);
  };

  const hasPermission = (permission) => {
    return userGroups.some(group => 
      ROLE_PERMISSIONS[group]?.includes(permission)
    );
  };

  const hasAnyRole = (roles) => {
    return roles.some(role => userGroups.includes(role));
  };

  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  const isAuthenticated = () => {
    return !!user;
  };

  const isAdmin = () => {
    return hasRole(USER_ROLES.ADMINISTRATOR);
  };

  const isAlertManager = () => {
    return hasRole(USER_ROLES.ALERT_MANAGER) || hasRole(USER_ROLES.ADMINISTRATOR);
  };

  const getUserRole = () => {
    if (hasRole(USER_ROLES.ADMINISTRATOR)) return USER_ROLES.ADMINISTRATOR;
    if (hasRole(USER_ROLES.ALERT_MANAGER)) return USER_ROLES.ALERT_MANAGER;
    if (hasRole(USER_ROLES.USER)) return USER_ROLES.USER;
    return USER_ROLES.GUEST;
  };

  const value = {
    // State
    user,
    userGroups,
    loading,
    error,
    
    // Authentication methods
    login,
    logout,
    register,
    confirmRegistration,
    checkAuthState,
    
    // Authorization methods
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAnyPermission,
    isAuthenticated,
    isAdmin,
    isAlertManager,
    getUserRole,
    
    // Constants
    USER_ROLES,
    PERMISSIONS
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;