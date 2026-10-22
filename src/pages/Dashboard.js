import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  Table,
  Box,
  SpaceBetween,
  TextFilter,
  Pagination,
  StatusIndicator,
  Button,
  Alert,
  Spinner
} from '@cloudscape-design/components';
import { customerService, metricsService } from '../services/dataService';
import serviceHistoryService from '../services/serviceHistoryService';
import { jobService } from '../services/dataService';
import { debugCustomerService, debugJobService, debugMetricsService } from '../services/debugApiService';

function Dashboard({ onCustomerSelect }) {
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerMetrics, setCustomerMetrics] = useState({});
  const [serviceHistory, setServiceHistory] = useState({});
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch customers, metrics, jobs, and service history on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        
        // Fetch customers, jobs, and service history in parallel using debug services
        const [customersData, jobsData, historyData] = await Promise.all([
          debugCustomerService.getAll(),
          debugJobService.getAll(),
          serviceHistoryService.getAll()
        ]);
        
        setCustomers(customersData);
        setJobs(jobsData);
        
        // Group service history by customer ID
        const historyByCustomer = historyData.reduce((acc, record) => {
          if (!acc[record.customerId]) {
            acc[record.customerId] = [];
          }
          acc[record.customerId].push(record);
          return acc;
        }, {});
        
        setServiceHistory(historyByCustomer);
        
        // Fetch latest metrics for each customer using debug service
        const metricsPromises = customersData.map(async (customer) => {
          try {
            const metrics = await debugMetricsService.getByCustomerId(customer.id);
            return { customerId: customer.id, metrics };
          } catch (err) {
            console.error(`Error fetching metrics for customer ${customer.id}:`, err);
            return { customerId: customer.id, metrics: null };
          }
        });
        
        const metricsResults = await Promise.all(metricsPromises);
        
        // Convert to object with customer ID as key
        const metricsMap = metricsResults.reduce((acc, result) => {
          if (result.metrics) {
            acc[result.customerId] = result.metrics;
          }
          return acc;
        }, {});
        
        setCustomerMetrics(metricsMap);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Subscribe to customer updates
    const customerUnsubscribe = customerService.subscribeToUpdates((updatedData) => {
      if (updatedData.deleted) {
        // Remove deleted customer
        setCustomers(prevCustomers => 
          prevCustomers.filter(customer => customer.id !== updatedData.id)
        );
      } else {
        // Update or add customer
        setCustomers(prevCustomers => {
          const index = prevCustomers.findIndex(c => c.id === updatedData.id);
          if (index >= 0) {
            // Update existing customer
            const newCustomers = [...prevCustomers];
            newCustomers[index] = updatedData;
            return newCustomers;
          } else {
            // Add new customer
            return [...prevCustomers, updatedData];
          }
        });
      }
    });
    
    // Subscribe to job updates
    const jobsUnsubscribe = jobService.subscribeToUpdates((updatedJob) => {
      setJobs(prevJobs => {
        const index = prevJobs.findIndex(job => job.id === updatedJob.id);
        if (index >= 0) {
          // Update existing job
          const newJobs = [...prevJobs];
          newJobs[index] = updatedJob;
          return newJobs;
        } else {
          // Add new job
          return [...prevJobs, updatedJob];
        }
      });
    });
    
    // Subscribe to service history updates
    const historyUnsubscribe = serviceHistoryService.subscribeToUpdates((updatedRecord) => {
      setServiceHistory(prev => {
        const customerId = updatedRecord.customerId;
        const newHistory = { ...prev };
        
        if (!newHistory[customerId]) {
          newHistory[customerId] = [];
        }
        
        if (updatedRecord.deleted) {
          // Remove deleted record
          newHistory[customerId] = newHistory[customerId].filter(record => record.id !== updatedRecord.id);
        } else {
          // Update or add record
          const index = newHistory[customerId].findIndex(record => record.id === updatedRecord.id);
          if (index >= 0) {
            // Update existing record
            newHistory[customerId][index] = updatedRecord;
          } else {
            // Add new record
            newHistory[customerId].push(updatedRecord);
          }
        }
        
        return newHistory;
      });
    });
    
    // Cleanup subscriptions on unmount
    return () => {
      customerUnsubscribe();
      jobsUnsubscribe();
      historyUnsubscribe();
    };
  }, []);
  
  const filteredCustomers = customers.filter(
    customer => 
      customer.name.toLowerCase().includes(filterText.toLowerCase()) ||
      customer.location.toLowerCase().includes(filterText.toLowerCase())
  );

  // Determine system status based on real-time metrics
  const getSystemStatus = (customerId) => {
    const metrics = customerMetrics[customerId];
    
    if (!metrics) return { type: 'pending', label: 'Unknown' };
    
    // Check if metrics has the expected structure
    if (!metrics.systemStatus) {
      return { type: 'pending', label: 'Unknown' };
    }
    
    // Use the overall system status from the metrics
    const status = metrics.systemStatus.overall;
    
    if (status === 'Needs Maintenance' || metrics.systemStatus.components.filter === 'Needs Replacement') {
      return { type: 'error', label: 'Maintenance Required' };
    } else if (status === 'Warning' || metrics.temperature.current > metrics.temperature.setPoint + 5) {
      return { type: 'warning', label: 'Warning' };
    } else {
      return { type: 'success', label: 'Healthy' };
    }
  };

  // Get the most recent service date for a customer
  const getLastServiceDate = (customerId) => {
    const history = serviceHistory[customerId] || [];
    
    if (history.length === 0) {
      return 'No service history';
    }
    
    // Sort by date (newest first) and return the first one
    const sortedHistory = [...history].sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    return sortedHistory[0].date;
  };

  const getStatusIndicator = (customerId) => {
    const status = getSystemStatus(customerId);
    return <StatusIndicator type={status.type}>{status.label}</StatusIndicator>;
  };

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            description="Overview of all HVAC maintenance customers and their system statuses"
          >
            Customer Dashboard
          </Header>
        }
      >
        {error && (
          <Alert type="error" dismissible>
            {error}
          </Alert>
        )}
        
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: 'Customer Name',
              cell: item => item.name,
              sortingField: 'name'
            },
            {
              id: 'location',
              header: 'Location',
              cell: item => item.location
            },
            {
              id: 'hvacModel',
              header: 'HVAC Model',
              cell: item => item.hvacModel
            },
            {
              id: 'lastService',
              header: 'Last Service',
              cell: item => getLastServiceDate(item.id)
            },
            {
              id: 'status',
              header: 'Status',
              cell: item => getStatusIndicator(item.id)
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <Button onClick={() => onCustomerSelect(item)}>View Details</Button>
              )
            }
          ]}
          items={filteredCustomers}
          loading={loading}
          loadingText="Loading customers"
          selectionType="single"
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          selectedItems={selectedItems}
          filter={
            <TextFilter
              filteringText={filterText}
              filteringPlaceholder="Find customers"
              filteringAriaLabel="Filter customers"
              onChange={({ detail }) => setFilterText(detail.filteringText)}
            />
          }
          pagination={
            <Pagination
              currentPageIndex={currentPage}
              onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
              pagesCount={Math.ceil(filteredCustomers.length / 10)}
            />
          }
          empty={
            <Box textAlign="center" color="inherit">
              <b>No customers</b>
              <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                No customers to display.
              </Box>
            </Box>
          }
        />
      </Container>
    </SpaceBetween>
  );
}

export default Dashboard;
