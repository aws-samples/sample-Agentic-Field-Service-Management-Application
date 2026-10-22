import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  Table,
  SpaceBetween,
  TextFilter,
  Pagination,
  StatusIndicator,
  Button,
  Modal,
  Box,
  FormField,
  Select,
  ColumnLayout,
  Tabs,
  Grid,
  Alert,
  Spinner,
  Flashbar
} from '@cloudscape-design/components';
import { jobService, technicianService } from '../services/dataService';
import { debugJobService, debugTechnicianService } from '../services/debugApiService';
import ServiceMap from '../components/ServiceMap';

function Scheduler() {
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [activeTab, setActiveTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Fetch jobs and technicians on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch jobs and technicians in parallel using debug services
        const [jobsData, techniciansData] = await Promise.all([
          debugJobService.getAll(),
          debugTechnicianService.getAll()
        ]);
        
        console.log('Jobs data received in Scheduler:', jobsData);
        
        setJobs(jobsData);
        setTechnicians(techniciansData);
        setError(null);
      } catch (err) {
        console.error('Error fetching scheduler data:', err);
        setError('Failed to load scheduler data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
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
    
    // Subscribe to technician updates
    const techUnsubscribe = technicianService.subscribeToUpdates((updatedTech) => {
      setTechnicians(prevTechs => {
        const index = prevTechs.findIndex(tech => tech.id === updatedTech.id);
        if (index >= 0) {
          // Update existing technician
          const newTechs = [...prevTechs];
          newTechs[index] = updatedTech;
          return newTechs;
        } else {
          // Add new technician
          return [...prevTechs, updatedTech];
        }
      });
    });
    
    // Cleanup subscriptions on unmount
    return () => {
      jobsUnsubscribe();
      techUnsubscribe();
    };
  }, []);
  
  const filteredJobs = jobs.filter(
    job => 
      job.customer?.toLowerCase().includes(filterText.toLowerCase()) ||
      job.type?.toLowerCase().includes(filterText.toLowerCase()) ||
      job.status?.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleUnassignJob = async (job) => {
    try {
      setIsLoading(true);
      await debugJobService.unassignTechnician(job.id);

      setJobs(prevJobs => prevJobs.map(j => {
        if (j.id === job.id) {
          return { ...j, status: 'Pending', assignedTechnician: null, assignedTechnicianName: null };
        }
        return j;
      }));

      setTechnicians(prevTechs => prevTechs.map(tech => {
        if (tech.id === job.assignedTechnician) {
          return { ...tech, status: 'Available', currentJob: null };
        }
        return tech;
      }));

      setNotification({
        type: 'success',
        content: `Technician unassigned from job ${job.id}`,
        dismissible: true
      });
    } catch (err) {
      console.error('Error unassigning technician:', err);
      setNotification({
        type: 'error',
        content: 'Failed to unassign technician. Please try again.',
        dismissible: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignJob = (job) => {
    setSelectedJob(job);
    setSelectedTechnician(null);
    setIsAssignModalVisible(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedJob || !selectedTechnician) {
      console.error('Cannot assign: Missing job or technician selection');
      setError('Please select a job and a technician to assign.');
      return;
    }
    
    try {
      console.log('Assigning technician:', selectedTechnician.id, 'to job:', selectedJob.id);
      setIsLoading(true);
      
      // Call API to assign technician using debugJobService
      const response = await debugJobService.assignTechnician(selectedJob.id, selectedTechnician.id);
      console.log('Assignment response:', response);
      
      // Update the jobs state with the updated job
      setJobs(prevJobs => {
        return prevJobs.map(job => {
          if (job.id === selectedJob.id) {
            // Create an updated job object that preserves all original properties
            // but updates the assignedTechnician and status to "In Progress"
            return {
              ...job,
              status: 'In Progress',
              assignedTechnician: selectedTechnician.name,
              assignedTechnicianName: selectedTechnician.name
            };
          }
          return job;
        });
      });
      
      // Update technicians state to mark the assigned technician as busy
      setTechnicians(prevTechs => {
        return prevTechs.map(tech => {
          if (tech.id === selectedTechnician.id) {
            return {
              ...tech,
              status: 'On Job',
              currentJob: selectedJob.id
            };
          }
          return tech;
        });
      });
      
      // Close modal
      setIsAssignModalVisible(false);
      setSelectedJob(null);
      setSelectedTechnician(null);
      setError(null); // Clear any previous errors
      
      // Show success notification
      setNotification({
        type: 'success',
        content: `Successfully assigned ${selectedTechnician.name} to job ${selectedJob.id}`,
        dismissible: true
      });
    } catch (err) {
      console.error('Error assigning technician:', err);
      setIsLoading(false);
      
      // Extract error message from the response if available
      let errorMessage = 'Failed to assign technician. Please try again later.';
      
      if (err.response) {
        try {
          const responseData = err.response.data;
          if (typeof responseData === 'string') {
            try {
              const parsedData = JSON.parse(responseData);
              errorMessage = parsedData.message || errorMessage;
            } catch (parseError) {
              errorMessage = responseData || errorMessage;
            }
          } else if (responseData && responseData.message) {
            errorMessage = responseData.message;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
      }
      
      setError(errorMessage);
      
      // Show error notification
      setNotification({
        type: 'error',
        content: errorMessage,
        dismissible: true
      });
      
      // Keep the modal open to allow the user to try again
    }
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'Pending':
        return <StatusIndicator type="pending">Pending</StatusIndicator>;
      case 'In Progress':
        return <StatusIndicator type="in-progress">In Progress</StatusIndicator>;
      case 'Completed':
        return <StatusIndicator type="success">Completed</StatusIndicator>;
      case 'Urgent':
        return <StatusIndicator type="error">Urgent</StatusIndicator>;
      default:
        return <StatusIndicator type="stopped">Unknown</StatusIndicator>;
    }
  };

  const getTechnicianStatusIndicator = (status) => {
    switch (status) {
      case 'Available':
        return <StatusIndicator type="success">Available</StatusIndicator>;
      case 'On Job':
        return <StatusIndicator type="in-progress">On Job</StatusIndicator>;
      case 'Off Duty':
        return <StatusIndicator type="stopped">Off Duty</StatusIndicator>;
      default:
        return <StatusIndicator type="pending">Unknown</StatusIndicator>;
    }
  };

  const getRecommendedTechnicians = (job) => {
    if (!job || !job.requiredSkills) return [];
    
    return technicians.filter(tech => 
      tech.status === 'Available' && 
      tech.skills && tech.skills.some(skill => job.requiredSkills.includes(skill))
    );
  };

  if (loading) {
    return (
      <Container
        header={
          <Header
            variant="h1"
            description="Manage service jobs and technician assignments"
          >
            Job Scheduler
          </Header>
        }
      >
        <Box textAlign="center" padding="l">
          <Spinner size="large" />
          <Box variant="p">Loading scheduler data...</Box>
        </Box>
      </Container>
    );
  }

  return (
    <SpaceBetween size="l">
      {notification && (
        <Flashbar
          items={[
            {
              type: notification.type,
              content: notification.content,
              dismissible: notification.dismissible,
              onDismiss: () => setNotification(null)
            }
          ]}
        />
      )}
      
      <Container
        header={
          <Header
            variant="h1"
            description="Manage service jobs and technician assignments"
          >
            Job Scheduler
          </Header>
        }
      >
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        <Tabs
          activeTabId={activeTab}
          onChange={({ detail }) => setActiveTab(detail.activeTabId)}
          tabs={[
            {
              label: "Service Jobs",
              id: "jobs",
              content: (
                <Table
                  columnDefinitions={[
                    {
                      id: 'id',
                      header: 'Job ID',
                      cell: item => item.id,
                      sortingField: 'id'
                    },
                    {
                      id: 'customer',
                      header: 'Customer',
                      cell: item => item.customer
                    },
                    {
                      id: 'customerId',
                      header: 'Customer ID',
                      cell: item => {
                        // Ensure the customer ID is displayed correctly
                        const customerId = item.customerId || item.customer_id;
                        return customerId || '-';
                      },
                      width: 120
                    },
                    {
                      id: 'type',
                      header: 'Job Type',
                      cell: item => item.type
                    },
                    {
                      id: 'scheduledDate',
                      header: 'Scheduled Date',
                      cell: item => item.scheduledDate || item.scheduled_date
                    },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: item => getStatusIndicator(item.status)
                    },
                    {
                      id: 'technician',
                      header: 'Assigned Technician',
                      cell: item => item.assignedTechnician || item.assigned_technician || 'Unassigned'
                    },
                    {
                      id: 'actions',
                      header: 'Actions',
                      cell: item => {
                        const isAssigned = item.status === 'In Progress' && item.assignedTechnician;
                        return (
                          <Button
                            onClick={() => isAssigned ? handleUnassignJob(item) : handleAssignJob(item)}
                            disabled={item.status === 'Completed'}
                            wrapText={false}
                          >
                            {isAssigned ? 'Unassign Technician' : 'Assign Technician'}
                          </Button>
                        );
                      },
                      width: 180
                    }
                  ]}
                  items={filteredJobs}
                  selectionType="single"
                  onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
                  selectedItems={selectedItems}
                  filter={
                    <TextFilter
                      filteringText={filterText}
                      filteringPlaceholder="Find jobs"
                      filteringAriaLabel="Filter jobs"
                      onChange={({ detail }) => setFilterText(detail.filteringText)}
                    />
                  }
                  pagination={
                    <Pagination
                      currentPageIndex={currentPage}
                      onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
                      pagesCount={Math.ceil(filteredJobs.length / 10)}
                    />
                  }
                  empty={
                    <Box textAlign="center" color="inherit">
                      <b>No jobs</b>
                      <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                        No jobs to display.
                      </Box>
                    </Box>
                  }
                />
              )
            },
            {
              label: "Technician Status",
              id: "technicians",
              content: (
                <Table
                  columnDefinitions={[
                    {
                      id: 'name',
                      header: 'Name',
                      cell: item => item.name,
                      sortingField: 'name'
                    },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: item => getTechnicianStatusIndicator(item.status)
                    },
                    {
                      id: 'location',
                      header: 'Current Location',
                      cell: item => item.currentLocation
                    },
                    {
                      id: 'skills',
                      header: 'Skills',
                      cell: item => item.skills?.join(', ') || ''
                    },
                    {
                      id: 'currentJob',
                      header: 'Current Job',
                      cell: item => item.currentJob || 'None'
                    }
                  ]}
                  items={technicians}
                  selectionType="single"
                  pagination={
                    <Pagination
                      currentPageIndex={1}
                      onChange={({ detail }) => console.log(detail.currentPageIndex)}
                      pagesCount={Math.ceil(technicians.length / 10)}
                    />
                  }
                  empty={
                    <Box textAlign="center" color="inherit">
                      <b>No technicians</b>
                      <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                        No technicians to display.
                      </Box>
                    </Box>
                  }
                />
              )
            },
            {
              label: "Service Map",
              id: "map",
              content: (
                <Container>
                  <SpaceBetween size="m">
                    <Alert type="info">
                      The map shows all service jobs and technician locations. Click on markers to see details and assign technicians.
                      Lines connect technicians to their assigned jobs.
                    </Alert>
                    <ServiceMap 
                      jobs={jobs} 
                      technicians={technicians} 
                      onAssignTechnician={handleAssignJob}
                    />
                  </SpaceBetween>
                </Container>
              )
            }
          ]}
        />
      </Container>

      {isAssignModalVisible && selectedJob && (
        <Modal
          visible={isAssignModalVisible}
          onDismiss={() => setIsAssignModalVisible(false)}
          header="Assign Technician to Job"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setIsAssignModalVisible(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleConfirmAssign} disabled={!selectedTechnician}>Confirm Assignment</Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="l">
            {error && (
              <Alert type="error" dismissible onDismiss={() => setError(null)}>
                {error}
              </Alert>
            )}
            
            <ColumnLayout columns={2}>
              <div>
                <Box variant="h3">Job Details</Box>
                <SpaceBetween size="s">
                  <FormField label="Job ID">
                    <Box>{selectedJob.id}</Box>
                  </FormField>
                  <FormField label="Customer">
                    <Box>{selectedJob.customer}</Box>
                  </FormField>
                  <FormField label="Job Type">
                    <Box>{selectedJob.type}</Box>
                  </FormField>
                  <FormField label="Required Skills">
                    <Box>{selectedJob.requiredSkills?.join(', ') || 'None specified'}</Box>
                  </FormField>
                </SpaceBetween>
              </div>
              <div>
                <FormField
                  label="Select Technician"
                  description="Choose a technician with the appropriate skills"
                >
                  <Select
                    selectedOption={selectedTechnician ? {
                      label: selectedTechnician.name,
                      value: selectedTechnician.id
                    } : null}
                    onChange={({ detail }) => {
                      const tech = technicians.find(t => t.id === detail.selectedOption.value);
                      setSelectedTechnician(tech);
                    }}
                    options={technicians
                      .filter(tech => tech.status === 'Available')
                      .map(tech => ({
                        label: `${tech.name} (${tech.skills?.join(', ') || 'No skills listed'})`,
                        value: tech.id,
                        description: `Location: ${tech.currentLocation}`
                      }))
                    }
                    filteringType="auto"
                    placeholder="Choose a technician"
                    empty="No available technicians"
                  />
                </FormField>
                <Box variant="h4" padding={{ top: 'l' }}>Recommended Technicians</Box>
                <Box>
                  {getRecommendedTechnicians(selectedJob).length > 0 ? (
                    getRecommendedTechnicians(selectedJob).map(tech => (
                      <Box key={tech.id} variant="p">
                        <strong>{tech.name}</strong> - {tech.skills?.join(', ') || 'No skills listed'}
                      </Box>
                    ))
                  ) : (
                    <Box variant="p">No technicians with matching skills are currently available.</Box>
                  )}
                </Box>
              </div>
            </ColumnLayout>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}

export default Scheduler;
