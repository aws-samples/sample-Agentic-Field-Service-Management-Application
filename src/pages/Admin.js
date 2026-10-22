import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Button,
  ColumnLayout,
  StatusIndicator,
  Alert,
  Spinner,
  Table,
  Toggle
} from '@cloudscape-design/components';
import { useAuth } from '../context/AuthContext';
import { getApiConfig } from '../config/api-config';
import { getAuthHeaders } from '../utils/auth-headers';

const apiConfig = getApiConfig();


// API endpoint for simulator control
const SIMULATOR_API_ENDPOINT = apiConfig.apiEndpoint + '/simulator';



function Admin() {
  const [simulatorStatus, setSimulatorStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
 

  // Fetch simulator status
  const fetchSimulatorStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching simulator status from:', SIMULATOR_API_ENDPOINT);
      
      const response = await fetch(SIMULATOR_API_ENDPOINT, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        }
      });
      
      console.log('Status response:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch simulator status: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Raw simulator status data:', responseData);
      
      // Handle the nested response structure
      let data;
      if (responseData.body) {
        // If the response has a body property (stringified JSON), parse it
        try {
          if (typeof responseData.body === 'string') {
            data = JSON.parse(responseData.body);
          } else {
            data = responseData.body;
          }
        } catch (parseError) {
          console.error('Error parsing response body:', parseError);
          data = responseData;
        }
      } else {
        // Otherwise, use the response data directly
        data = responseData;
      }
      
      console.log('Processed simulator status data:', data);
      
      setSimulatorStatus(data.enabled);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
    } catch (err) {
      console.error('Error fetching simulator status:', err);
      setError('Failed to fetch simulator status. Please try again later. Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Start simulator
  const startSimulator = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting simulator...');
      
      const response = await fetch(SIMULATOR_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        }
      });
      
      console.log('Start response:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Failed to start simulator: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Raw start simulator data:', responseData);
      
      // Handle the nested response structure
      let data;
      if (responseData.body) {
        // If the response has a body property (stringified JSON), parse it
        try {
          if (typeof responseData.body === 'string') {
            data = JSON.parse(responseData.body);
          } else {
            data = responseData.body;
          }
        } catch (parseError) {
          console.error('Error parsing response body:', parseError);
          data = responseData;
        }
      } else {
        // Otherwise, use the response data directly
        data = responseData;
      }
      
      console.log('Processed start simulator data:', data);
      
      setSimulatorStatus(data.enabled);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
      
      // Show success message
      setError({ type: 'success', message: 'Simulator started successfully!' });
    } catch (err) {
      console.error('Error starting simulator:', err);
      setError('Failed to start simulator. Please try again later. Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Stop simulator
  const stopSimulator = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Stopping simulator...');
      
      const response = await fetch(SIMULATOR_API_ENDPOINT, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        }
      });
      
      console.log('Stop response:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Failed to stop simulator: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Raw stop simulator data:', responseData);
      
      // Handle the nested response structure
      let data;
      if (responseData.body) {
        // If the response has a body property (stringified JSON), parse it
        try {
          if (typeof responseData.body === 'string') {
            data = JSON.parse(responseData.body);
          } else {
            data = responseData.body;
          }
        } catch (parseError) {
          console.error('Error parsing response body:', parseError);
          data = responseData;
        }
      } else {
        // Otherwise, use the response data directly
        data = responseData;
      }
      
      console.log('Processed stop simulator data:', data);
      
      setSimulatorStatus(data.enabled);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
      
      // Show success message
      setError({ type: 'success', message: 'Simulator stopped successfully!' });
    } catch (err) {
      console.error('Error stopping simulator:', err);
      setError('Failed to stop simulator. Please try again later. Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle simulator status
  const toggleSimulator = () => {
    if (simulatorStatus) {
      stopSimulator();
    } else {
      startSimulator();
    }
  };

  // Fetch simulator status on component mount
  useEffect(() => {
    fetchSimulatorStatus();
    
    // Set up polling for status updates
    const intervalId = setInterval(() => {
      fetchSimulatorStatus();
    }, 10000); // Poll every 10 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Container
      header={
        <Header
          variant="h1"
          description="Control and monitor the HVAC metrics simulator"
        >
          Admin Dashboard
        </Header>
      }
    >
      {error && typeof error === 'string' && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {error && typeof error === 'object' && error.type === 'success' && (
        <Alert type="success" dismissible onDismiss={() => setError(null)}>
          {error.message}
        </Alert>
      )}
      
      <SpaceBetween size="l">
        <ColumnLayout columns={2}>
          <Box
            variant="awsui-key-label"
            padding={{ top: 'l', bottom: 'l', horizontal: 'l' }}
          >
            <SpaceBetween size="m">
              <div>
                <Box variant="h2">HVAC Metrics Simulator</Box>
                <Box variant="p">
                  Generate simulated HVAC metrics for all customers in the system.
                </Box>
              </div>
              
              {loading ? (
                <Spinner size="normal" />
              ) : (
                <SpaceBetween size="m">
                  <div>
                    <Box variant="awsui-key-label">Status</Box>
                    {simulatorStatus ? (
                      <StatusIndicator type="success">Running</StatusIndicator>
                    ) : (
                      <StatusIndicator type="stopped">Stopped</StatusIndicator>
                    )}
                  </div>
                  
                  <div>
                    <Box variant="awsui-key-label">Last Updated</Box>
                    <Box variant="p">{formatDate(lastUpdated)}</Box>
                  </div>
                  
                  <Toggle
                    checked={simulatorStatus === true}
                    onChange={toggleSimulator}
                    disabled={loading}
                  >
                    {simulatorStatus ? 'Simulator is running' : 'Simulator is stopped'}
                  </Toggle>
                  
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button
                      variant="primary"
                      onClick={startSimulator}
                      disabled={loading || simulatorStatus === true}
                    >
                      Start Simulator
                    </Button>
                    
                    <Button
                      variant="normal"
                      onClick={stopSimulator}
                      disabled={loading || simulatorStatus === false}
                    >
                      Stop Simulator
                    </Button>
                  </SpaceBetween>
                </SpaceBetween>
              )}
            </SpaceBetween>
          </Box>
          
          <Box
            variant="awsui-key-label"
            padding={{ top: 'l', bottom: 'l', horizontal: 'l' }}
          >
            <SpaceBetween size="m">
              <div>
                <Box variant="h2">Simulator Information</Box>
                <Box variant="p">
                  The HVAC metrics simulator generates the following metrics for each customer:
                </Box>
              </div>
              
              <Table
                columnDefinitions={[
                  {
                    id: 'metric',
                    header: 'Metric',
                    cell: item => item.name
                  },
                  {
                    id: 'range',
                    header: 'Range',
                    cell: item => item.range
                  },
                  {
                    id: 'unit',
                    header: 'Unit',
                    cell: item => item.unit
                  }
                ]}
                items={[
                  { name: 'Temperature', range: '68-78', unit: '°F' },
                  { name: 'Humidity', range: '30-60', unit: '%' },
                  { name: 'Airflow', range: '200-500', unit: 'CFM' },
                  { name: 'Pressure', range: '14-16', unit: 'PSI' },
                  { name: 'Energy Usage', range: '2-5', unit: 'kWh' },
                  { name: 'Filter Status', range: '0-100', unit: '%' }
                ]}
              />
              
              <Box variant="p">
                The simulator runs every minute when enabled, updating metrics for all customers in the system.
              </Box>
            </SpaceBetween>
          </Box>
        </ColumnLayout>
      </SpaceBetween>
    </Container>
  );
}

export default Admin;
