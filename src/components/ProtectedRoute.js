import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Spinner, Box } from '@cloudscape-design/components';

// Protected route component that redirects to login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [localLoading, setLocalLoading] = useState(true);
  
  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated, 'loading:', loading);
  
  useEffect(() => {
    // If auth context has finished loading, use its state
    if (!loading) {
      setLocalLoading(false);
    }
  }, [isAuthenticated, loading]);

  // Show loading spinner while checking authentication
  if (loading || localLoading) {
    console.log('ProtectedRoute - showing loading spinner');
    return (
      <Container>
        <Box textAlign="center" padding="xl">
          <Spinner size="large" />
          <Box variant="h2" padding="m">
            Loading...
          </Box>
        </Box>
      </Container>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log('ProtectedRoute - not authenticated, redirecting to /login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render the protected content if authenticated
  console.log('ProtectedRoute - authenticated, rendering children');
  return children;
};

export default ProtectedRoute;
