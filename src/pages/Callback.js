import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Spinner, Box } from '@cloudscape-design/components';
import { useAuth } from '../context/AuthContext';

function Callback() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  console.log('Callback component rendered, isAuthenticated:', isAuthenticated, 'loading:', loading);
  
  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        console.log('Callback - authenticated, redirecting to dashboard');
        navigate('/dashboard');
      } else {
        console.log('Callback - not authenticated, redirecting to login');
        navigate('/login');
      }
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <Container>
      <Box textAlign="center" padding="xl">
        <Spinner size="large" />
        <Box variant="h2" padding="m">
          Processing authentication...
        </Box>
      </Box>
    </Container>
  );
}

export default Callback;
