import React, { createContext, useState, useEffect, useContext } from 'react';
import { directAuthService } from '../services/directAuthService';

// Create the authentication context
export const AuthContext = createContext();

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  console.log('AuthProvider rendered');

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
      console.log('AuthProvider - checking authentication');
      try {
        setLoading(true);
        const isAuth = await directAuthService.isAuthenticated();
        console.log('AuthProvider - isAuthenticated result:', isAuth);
        
        if (isAuth) {
          const currentUser = await directAuthService.getCurrentUser();
          console.log('AuthProvider - currentUser:', currentUser);
          setUser(currentUser);
          setIsAuthenticated(true);
        } else {
          console.log('AuthProvider - not authenticated');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (err) {
        console.error('Authentication check failed:', err);
        setError(err);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Sign in function
  const signIn = async (username, password) => {
    console.log('AuthProvider - signIn attempt for:', username);
    try {
      setLoading(true);
      setError(null);
      const result = await directAuthService.signIn(username, password);
      console.log('AuthProvider - signIn result:', result);
      
      if (result.challengeName === 'NEW_PASSWORD_REQUIRED') {
        return { challengeName: 'NEW_PASSWORD_REQUIRED', username };
      }

      if (result.challengeName === 'PASSWORD_RESET_REQUIRED') {
        return { challengeName: 'PASSWORD_RESET_REQUIRED', username };
      }
      
      const currentUser = await directAuthService.getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
      return { user: currentUser };
    } catch (err) {
      console.error('AuthProvider - signIn error:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Complete new password challenge
  const completeNewPassword = async (username, newPassword) => {
    console.log('AuthProvider - completeNewPassword for:', username);
    try {
      setLoading(true);
      setError(null);
      await directAuthService.completeNewPassword(username, newPassword);
      
      // Get user info after password change
      const currentUser = await directAuthService.getCurrentUser();
      console.log('AuthProvider - currentUser after password change:', currentUser);
      setUser(currentUser);
      setIsAuthenticated(true);
      return currentUser;
    } catch (err) {
      console.error('AuthProvider - completeNewPassword error:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    console.log('AuthProvider - signOut');
    try {
      setLoading(true);
      
      // Call the authService signOut method
      await directAuthService.signOut();
      
      // Clear all local state
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      
      console.log('AuthProvider - signOut successful');
      return true;
    } catch (err) {
      console.error('AuthProvider - signOut error:', err);
      
      // Even if there's an error, clear the local state
      setUser(null);
      setIsAuthenticated(false);
      
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get JWT token
  const getJwtToken = async () => {
    try {
      return await directAuthService.getJwtToken();
    } catch (err) {
      console.error('Error getting JWT token:', err);
      return null;
    }
  };

  // Initiate forgot password flow
  const forgotPassword = async (username) => {
    try {
      return await directAuthService.forgotPassword(username);
    } catch (err) {
      console.error('AuthProvider - forgotPassword error:', err);
      throw err;
    }
  };

  // Confirm forgot password with code + new password
  const confirmForgotPassword = async (username, code, newPassword) => {
    try {
      return await directAuthService.confirmForgotPassword(username, code, newPassword);
    } catch (err) {
      console.error('AuthProvider - confirmForgotPassword error:', err);
      throw err;
    }
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    signIn,
    signOut,
    completeNewPassword,
    forgotPassword,
    confirmForgotPassword,
    getJwtToken
  };

  console.log('AuthProvider - current state:', { user, loading, error, isAuthenticated });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
