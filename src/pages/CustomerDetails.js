import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  ColumnLayout,
  Box,
  SpaceBetween,
  Button,
  BarChart,
  PieChart,
  LineChart,
  StatusIndicator,
  Tabs,
  Alert,
  Spinner,
  Table,
  ProgressBar
} from '@cloudscape-design/components';
import { metricsService, jobService } from '../services/dataService';
import { debugMetricsService, debugJobService } from '../services/debugApiService';
import serviceHistoryService from '../services/serviceHistoryService';
import CustomerMetrics from '../components/CustomerMetrics';

function CustomerDetails({ customer, onBack }) {
  const [metrics, setMetrics] = useState(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Fetch metrics, service history, and jobs on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch metrics using debugMetricsService
        const metricsData = await debugMetricsService.getByCustomerId(customer.id);
        setMetrics(metricsData);
        
        // Fetch service history
        const historyData = await serviceHistoryService.getByCustomerId(customer.id);
        setServiceHistory(historyData);
        
        // Fetch all jobs using debugJobService
        const jobsData = await debugJobService.getAll();
        console.log('All jobs from API:', jobsData);
        console.log('Current customer ID:', customer.id);
        
        // Filter jobs for this customer that are pending or in progress
        const customerJobs = jobsData.filter(job => {
          // Case-insensitive status check
          const status = job.status ? job.status.toLowerCase() : '';
          const jobCustomerId = job.customerId || job.customer_id; // Handle different field names
          
          const isMatch = (jobCustomerId === customer.id) && 
            (status === 'pending' || 
             status === 'in progress' || 
             status === 'urgent' || 
             status === 'in-progress');
          
          console.log(`Job ${job.id} - customerId: ${jobCustomerId}, status: ${job.status}, isMatch: ${isMatch}`);
          return isMatch;
        });
        
        console.log('Found jobs for customer', customer.id, ':', customerJobs);
        
        // Format jobs for the maintenance schedule
        const formattedJobs = customerJobs.map(job => ({
          date: job.scheduledDate || job.scheduled_date,
          type: job.type,
          priority: job.status && job.status.toLowerCase() === 'urgent' ? 'high' : 'medium',
          status: job.status && job.status.toLowerCase().includes('progress') ? 'in-progress' : 'scheduled',
          technician: job.assignedTechnician || job.assigned_technician || 'Unassigned',
          jobId: job.id,
          description: job.description || `${job.type} for ${customer.name}`
        }));
        
        setPendingJobs(formattedJobs);
        
        setError(null);
      } catch (err) {
        console.error(`Error fetching data for customer ${customer.id}:`, err);
        setError('Failed to load customer data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Subscribe to real-time metrics updates for this customer
    const metricsUnsubscribe = debugMetricsService.subscribeToCustomerMetrics(customer.id, (updatedMetrics) => {
      setMetrics(prevMetrics => {
        // Keep historical data from previous metrics
        return {
          ...prevMetrics,
          ...updatedMetrics
        };
      });
    });
    
    // Cleanup subscription on unmount
    return () => {
      metricsUnsubscribe();
    };
  }, [customer.id]);
  
  // Handle back button click
  const handleBack = () => {
    onBack();
  };
  
  // Get system status indicator
  const getSystemStatus = () => {
    if (!metrics || !metrics.systemStatus) {
      return <StatusIndicator type="pending">Unknown</StatusIndicator>;
    }
    
    const status = metrics.systemStatus.overall;
    
    if (status === 'Healthy') {
      return <StatusIndicator type="success">Healthy</StatusIndicator>;
    } else if (status === 'Warning') {
      return <StatusIndicator type="warning">Warning</StatusIndicator>;
    } else if (status === 'Needs Maintenance') {
      return <StatusIndicator type="error">Maintenance Required</StatusIndicator>;
    } else {
      return <StatusIndicator type="pending">{status || 'Unknown'}</StatusIndicator>;
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // Render loading state
  if (loading) {
    return (
      <Container>
        <Box textAlign="center" padding={{ top: 'l', bottom: 'l' }}>
          <Spinner size="large" />
          <Box variant="p" padding={{ top: 'm' }}>
            Loading customer data...
          </Box>
        </Box>
      </Container>
    );
  }
  
  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            actions={
              <Button onClick={handleBack} iconName="arrow-left">
                Back to Dashboard
              </Button>
            }
          >
            {customer.name}
          </Header>
        }
      >
        {error && (
          <Alert type="error" dismissible>
            {error}
          </Alert>
        )}
        
        <ColumnLayout columns={3} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Location</Box>
            <Box variant="p">{customer.location}</Box>
          </div>
          
          <div>
            <Box variant="awsui-key-label">HVAC Model</Box>
            <Box variant="p">{customer.hvacModel}</Box>
          </div>
          
          <div>
            <Box variant="awsui-key-label">System Status</Box>
            <Box variant="p">{getSystemStatus()}</Box>
          </div>
          
          <div>
            <Box variant="awsui-key-label">Installation Date</Box>
            <Box variant="p">{formatDate(customer.installationDate)}</Box>
          </div>
          
          <div>
            <Box variant="awsui-key-label">Last Service</Box>
            <Box variant="p">
              {metrics && metrics.systemStatus ? formatDate(metrics.systemStatus.lastMaintenance) : 'N/A'}
            </Box>
          </div>
          
          <div>
            <Box variant="awsui-key-label">Next Service</Box>
            <Box variant="p">
              {metrics && metrics.systemStatus ? formatDate(metrics.systemStatus.nextMaintenance) : 'N/A'}
            </Box>
          </div>
        </ColumnLayout>
      </Container>
      
      <Tabs
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <SpaceBetween size="l">
                <CustomerMetrics customerId={customer.id} />
                
                <Container
                  header={
                    <Header
                      variant="h2"
                      description="Upcoming maintenance and service jobs"
                    >
                      Maintenance Schedule
                    </Header>
                  }
                >
                  {pendingJobs.length === 0 ? (
                    <Box textAlign="center" padding={{ top: 'm', bottom: 'm' }}>
                      No pending maintenance jobs.
                    </Box>
                  ) : (
                    <Table
                      columnDefinitions={[
                        {
                          id: 'date',
                          header: 'Date',
                          cell: item => formatDate(item.date)
                        },
                        {
                          id: 'type',
                          header: 'Type',
                          cell: item => item.type
                        },
                        {
                          id: 'description',
                          header: 'Description',
                          cell: item => item.description
                        },
                        {
                          id: 'priority',
                          header: 'Priority',
                          cell: item => (
                            <StatusIndicator type={item.priority === 'high' ? 'error' : 'info'}>
                              {item.priority === 'high' ? 'High' : 'Medium'}
                            </StatusIndicator>
                          )
                        },
                        {
                          id: 'status',
                          header: 'Status',
                          cell: item => (
                            <StatusIndicator type={item.status === 'in-progress' ? 'in-progress' : 'pending'}>
                              {item.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                            </StatusIndicator>
                          )
                        },
                        {
                          id: 'technician',
                          header: 'Technician',
                          cell: item => item.technician
                        }
                      ]}
                      items={pendingJobs}
                      trackBy="jobId"
                      empty={
                        <Box textAlign="center" padding={{ top: 'm', bottom: 'm' }}>
                          No pending maintenance jobs.
                        </Box>
                      }
                    />
                  )}
                </Container>
                
                <Container
                  header={
                    <Header
                      variant="h2"
                      description="Past service and maintenance history"
                    >
                      Service History
                    </Header>
                  }
                >
                  {serviceHistory.length === 0 ? (
                    <Box textAlign="center" padding={{ top: 'm', bottom: 'm' }}>
                      No service history available.
                    </Box>
                  ) : (
                    <Table
                      columnDefinitions={[
                        {
                          id: 'date',
                          header: 'Date',
                          cell: item => formatDate(item.date)
                        },
                        {
                          id: 'type',
                          header: 'Type',
                          cell: item => item.type
                        },
                        {
                          id: 'technician',
                          header: 'Technician',
                          cell: item => item.technician
                        },
                        {
                          id: 'notes',
                          header: 'Notes',
                          cell: item => item.notes
                        }
                      ]}
                      items={serviceHistory}
                      trackBy="id"
                      empty={
                        <Box textAlign="center" padding={{ top: 'm', bottom: 'm' }}>
                          No service history available.
                        </Box>
                      }
                    />
                  )}
                </Container>
              </SpaceBetween>
            )
          },
          {
            id: 'metrics',
            label: 'Detailed Metrics',
            content: (
              <CustomerMetrics customerId={customer.id} />
            )
          },
          {
            id: 'maintenance',
            label: 'Maintenance',
            content: (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="Maintenance schedule and history"
                  >
                    Maintenance
                  </Header>
                }
              >
                <SpaceBetween size="l">
                  <Box variant="h3">Upcoming Maintenance</Box>
                  {pendingJobs.length === 0 ? (
                    <Box textAlign="center" padding={{ top: 'm', bottom: 'm' }}>
                      No pending maintenance jobs.
                    </Box>
                  ) : (
                    <Table
                      columnDefinitions={[
                        {
                          id: 'date',
                          header: 'Date',
                          cell: item => formatDate(item.date)
                        },
                        {
                          id: 'type',
                          header: 'Type',
                          cell: item => item.type
                        },
                        {
                          id: 'description',
                          header: 'Description',
                          cell: item => item.description
                        },
                        {
                          id: 'priority',
                          header: 'Priority',
                          cell: item => (
                            <StatusIndicator type={item.priority === 'high' ? 'error' : 'info'}>
                              {item.priority === 'high' ? 'High' : 'Medium'}
                            </StatusIndicator>
                          )
                        },
                        {
                          id: 'status',
                          header: 'Status',
                          cell: item => (
                            <StatusIndicator type={item.status === 'in-progress' ? 'in-progress' : 'pending'}>
                              {item.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                            </StatusIndicator>
                          )
                        },
                        {
                          id: 'technician',
                          header: 'Technician',
                          cell: item => item.technician
                        }
                      ]}
                      items={pendingJobs}
                      trackBy="jobId"
                      empty={
                        <Box textAlign="center" padding={{ top: 'm', bottom: 'm' }}>
                          No pending maintenance jobs.
                        </Box>
                      }
                    />
                  )}
                  
                  <Box variant="h3">Service History</Box>
                  {serviceHistory.length === 0 ? (
                    <Box textAlign="center" padding={{ top: 'm', bottom: 'm' }}>
                      No service history available.
                    </Box>
                  ) : (
                    <Table
                      columnDefinitions={[
                        {
                          id: 'date',
                          header: 'Date',
                          cell: item => formatDate(item.date)
                        },
                        {
                          id: 'type',
                          header: 'Type',
                          cell: item => item.type
                        },
                        {
                          id: 'technician',
                          header: 'Technician',
                          cell: item => item.technician
                        },
                        {
                          id: 'notes',
                          header: 'Notes',
                          cell: item => item.notes
                        }
                      ]}
                      items={serviceHistory}
                      trackBy="id"
                      empty={
                        <Box textAlign="center" padding={{ top: 'm', bottom: 'm' }}>
                          No service history available.
                        </Box>
                      }
                    />
                  )}
                </SpaceBetween>
              </Container>
            )
          }
        ]}
      />
    </SpaceBetween>
  );
}

export default CustomerDetails;
