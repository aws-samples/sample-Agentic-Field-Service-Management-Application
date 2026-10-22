import React from 'react';
import { 
  Container, 
  Header, 
  SpaceBetween, 
  Button,
  FormField,
  Input,
  Box
} from '@cloudscape-design/components';

function App() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f2f3f3'
    }}>
      <Container
        header={
          <Header variant="h1" description="Simple test page to verify React is working">
            HVAC Field Service Management
          </Header>
        }
        style={{ maxWidth: '400px', width: '100%' }}
      >
        <SpaceBetween size="l">
          <Box variant="p">
            This is a simplified version of the application to test if React is working correctly.
          </Box>
          
          <FormField label="Email">
            <Input
              type="email"
              placeholder="Enter your email"
            />
          </FormField>
          
          <FormField label="Password">
            <Input
              type="password"
              placeholder="Enter your password"
            />
          </FormField>
          
          <Button
            variant="primary"
            fullWidth
          >
            Sign In
          </Button>
          
          <Box textAlign="center">
            <a href="/test.html">View Test HTML Page</a>
          </Box>
        </SpaceBetween>
      </Container>
    </div>
  );
}

export default App;
