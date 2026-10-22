import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  ColumnLayout,
  StatusIndicator,
  ProgressBar,
  LineChart,
  Button,
  Spinner
} from '@cloudscape-design/components';
import { debugMetricsService } from '../services/debugApiService';
import { API_CONFIG } from '../config/api-config';

// Initial data structure for historical metrics
const initialMetricsData = {
  temperature: [],
  humidity: [],
  airflow: [],
  pressure: [],
  energyUsage: [],
  filterStatus: []
};

function CustomerMetrics({ customerId }) {
  const [metrics, setMetrics] = useState(null);
  const [historicalData, setHistoricalData] = useState(initialMetricsData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch latest metrics for the customer
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching metrics for customer:', customerId);
      
      // Use the debugMetricsService to fetch metrics
      const data = await debugMetricsService.getByCustomerId(customerId);
      console.log('Metrics data:', data);
      
      setMetrics(data);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
      
      // Process historical data if available
      if (data.temperature && data.temperature.history) {
        setHistoricalData(prevData => ({
          ...prevData,
          temperature: data.temperature.history.map(item => ({
            x: new Date(item.timestamp).getTime(),
            y: item.value
          }))
        }));
      }
      
      if (data.humidity && data.humidity.history) {
        setHistoricalData(prevData => ({
          ...prevData,
          humidity: data.humidity.history.map(item => ({
            x: new Date(item.timestamp).getTime(),
            y: item.value
          }))
        }));
      }
      
      if (data.energyUsage && data.energyUsage.history) {
        setHistoricalData(prevData => ({
          ...prevData,
          energyUsage: data.energyUsage.history.map(item => ({
            x: new Date(item.timestamp).getTime(),
            y: item.value
          }))
        }));
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Failed to load metrics data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  // Fetch metrics on component mount and when customerId changes
  useEffect(() => {
    fetchMetrics();
    
    // Set up polling for metrics updates if auto-refresh is enabled
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchMetrics();
      }, 30000); // Poll every 30 seconds
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [customerId, autoRefresh, fetchMetrics]); // Added fetchMetrics as dependency

  // Get status indicator for filter status
  const getFilterStatusIndicator = () => {
    if (!metrics || !metrics.systemStatus || !metrics.systemStatus.components) {
      return <StatusIndicator type="pending">Unknown</StatusIndicator>;
    }
    
    const filterStatus = metrics.systemStatus.components.filter;
    
    if (filterStatus === 'Healthy') {
      return <StatusIndicator type="success">Good</StatusIndicator>;
    } else if (filterStatus === 'Warning') {
      return <StatusIndicator type="warning">Fair</StatusIndicator>;
    } else if (filterStatus === 'Needs Replacement') {
      return <StatusIndicator type="error">Replace</StatusIndicator>;
    } else {
      return <StatusIndicator type="pending">{filterStatus || 'Unknown'}</StatusIndicator>;
    }
  };

  // Render loading state
  if (loading && !metrics) {
    return (
      <Container
        header={
          <Header
            variant="h2"
            description="Real-time HVAC system metrics"
          >
            System Metrics
          </Header>
        }
      >
        <Box textAlign="center" padding={{ top: 'l', bottom: 'l' }}>
          <Spinner size="large" />
          <Box variant="p" padding={{ top: 'm' }}>
            Loading metrics data...
          </Box>
        </Box>
      </Container>
    );
  }

  // Render error state
  if (error && !metrics) {
    return (
      <Container
        header={
          <Header
            variant="h2"
            description="Real-time HVAC system metrics"
          >
            System Metrics
          </Header>
        }
      >
        <Box textAlign="center" padding={{ top: 'l', bottom: 'l' }}>
          <Box variant="p" color="text-status-error">
            {error}
          </Box>
          <Button onClick={fetchMetrics} variant="primary">
            Retry
          </Button>
        </Box>
      </Container>
    );
  }

  // Render metrics data
  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Real-time HVAC system metrics"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={fetchMetrics} iconName="refresh" />
              <Button
                onClick={toggleAutoRefresh}
                variant={autoRefresh ? "primary" : "normal"}
              >
                {autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
              </Button>
            </SpaceBetween>
          }
        >
          System Metrics
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Box variant="small">
          Last updated: {formatDate(lastUpdated)}
        </Box>
        
        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="l">
            <Box>
              <Box variant="awsui-key-label">Temperature</Box>
              <Box variant="h2">
                {metrics && metrics.temperature ? `${metrics.temperature.current.toFixed(1)}°F` : 'N/A'}
              </Box>
              <Box variant="small">
                Set point: {metrics && metrics.temperature ? `${metrics.temperature.setPoint}°F` : 'N/A'}
              </Box>
            </Box>
            
            <Box>
              <Box variant="awsui-key-label">Humidity</Box>
              <Box variant="h2">
                {metrics && metrics.humidity ? `${metrics.humidity.current.toFixed(1)}%` : 'N/A'}
              </Box>
              <Box variant="small">
                Set point: {metrics && metrics.humidity ? `${metrics.humidity.setPoint}%` : 'N/A'}
              </Box>
            </Box>
            
            <Box>
              <Box variant="awsui-key-label">Energy Usage</Box>
              <Box variant="h2">
                {metrics && metrics.energyUsage ? `${metrics.energyUsage.daily.toFixed(1)} kWh` : 'N/A'}
              </Box>
              <Box variant="small">
                Weekly: {metrics && metrics.energyUsage ? `${metrics.energyUsage.weekly.toFixed(1)} kWh` : 'N/A'}
              </Box>
            </Box>
          </SpaceBetween>
          
          <SpaceBetween size="l">
            <Box>
              <Box variant="awsui-key-label">System Status</Box>
              <Box variant="h2">
                <StatusIndicator type={
                  metrics && metrics.systemStatus && metrics.systemStatus.overall === 'Healthy' ? 'success' :
                  metrics && metrics.systemStatus && metrics.systemStatus.overall === 'Warning' ? 'warning' :
                  metrics && metrics.systemStatus && metrics.systemStatus.overall === 'Needs Maintenance' ? 'error' :
                  'pending'
                }>
                  {metrics && metrics.systemStatus ? metrics.systemStatus.overall : 'Unknown'}
                </StatusIndicator>
              </Box>
            </Box>
            
            <Box>
              <Box variant="awsui-key-label">Filter Status</Box>
              <Box variant="h2">
                {getFilterStatusIndicator()}
              </Box>
            </Box>
            
            <Box>
              <Box variant="awsui-key-label">Maintenance</Box>
              <Box variant="h2">
                {metrics && metrics.systemStatus ? metrics.systemStatus.nextMaintenance : 'N/A'}
              </Box>
              <Box variant="small">
                Last: {metrics && metrics.systemStatus ? metrics.systemStatus.lastMaintenance : 'N/A'}
              </Box>
            </Box>
          </SpaceBetween>
        </ColumnLayout>
        
        <Box>
          <Box variant="h3">Temperature History (24 Hours)</Box>
          <LineChart
            series={[
              {
                title: 'Temperature',
                type: 'line',
                data: historicalData.temperature,
                valueFormatter: (value) => `${value.toFixed(1)}°F`
              }
            ]}
            xDomain={historicalData.temperature.length > 0 ? [
              historicalData.temperature[historicalData.temperature.length - 1].x,
              historicalData.temperature[0].x
            ] : undefined}
            yDomain={[60, 90]}
            i18nStrings={{
              xTickFormatter: (value) => {
                const date = new Date(value);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            }}
            height={200}
          />
        </Box>
        
        <Box>
          <Box variant="h3">Humidity History (24 Hours)</Box>
          <LineChart
            series={[
              {
                title: 'Humidity',
                type: 'line',
                data: historicalData.humidity,
                valueFormatter: (value) => `${value.toFixed(1)}%`
              }
            ]}
            xDomain={historicalData.humidity.length > 0 ? [
              historicalData.humidity[historicalData.humidity.length - 1].x,
              historicalData.humidity[0].x
            ] : undefined}
            yDomain={[20, 70]}
            i18nStrings={{
              xTickFormatter: (value) => {
                const date = new Date(value);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            }}
            height={200}
          />
        </Box>
        
        <Box>
          <Box variant="h3">Energy Usage History (30 Days)</Box>
          <LineChart
            series={[
              {
                title: 'Energy Usage',
                type: 'line',
                data: historicalData.energyUsage,
                valueFormatter: (value) => `${value.toFixed(1)} kWh`
              }
            ]}
            xDomain={historicalData.energyUsage.length > 0 ? [
              historicalData.energyUsage[historicalData.energyUsage.length - 1].x,
              historicalData.energyUsage[0].x
            ] : undefined}
            i18nStrings={{
              xTickFormatter: (value) => {
                const date = new Date(value);
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              }
            }}
            height={200}
          />
        </Box>
      </SpaceBetween>
    </Container>
  );
}

export default CustomerMetrics;
