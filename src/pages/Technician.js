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
  Textarea,
  ColumnLayout,
  Tabs,
  ExpandableSection,
  Alert,
  Spinner,
  Select,
  Multiselect
} from '@cloudscape-design/components';
import { jobService, technicianService, partsService } from '../services/dataService';
import { debugJobService, debugTechnicianService } from '../services/debugApiService';
import serviceHistoryService from '../services/serviceHistoryService';
import { mockHvacDocumentation } from '../data/mockData';

function Technician() {
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isJobDetailsModalVisible, setIsJobDetailsModalVisible] = useState(false);
  const [isCompleteJobModalVisible, setIsCompleteJobModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [partsUsed, setPartsUsed] = useState([]);
  const [availableParts, setAvailableParts] = useState([]);
  const [compatibleParts, setCompatibleParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState({ label: 'All Technicians', value: 'all' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch jobs and technicians on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch jobs, technicians, and parts in parallel using debug services
        const [jobsData, techniciansData, partsData] = await Promise.all([
          debugJobService.getAll(),
          debugTechnicianService.getAll(),
          partsService.getAll()
        ]);
        
        setAllJobs(jobsData);
        setJobs(jobsData); // Initially show all jobs
        
        // Process parts data to ensure all required fields are present
        const processedParts = partsData.map(part => ({
          ...part,
          name: part.name || 'Unknown Part',
          partNumber: part.partNumber || 'Unknown',
          description: part.description || 'No description available',
          price: part.unitPrice || part.price || 0,
          unitPrice: part.unitPrice || part.price || 0,
          inventory: typeof part.inventory === 'number' ? part.inventory : 0,
          category: part.category || 'Uncategorized'
        }));
        console.log(`Processed ${processedParts.length} parts from API`);
        setAvailableParts(processedParts);
        
        // Format technicians for the dropdown
        const techOptions = [
          { label: 'All Technicians', value: 'all' },
          ...techniciansData.map(tech => ({
            label: tech.name,
            value: tech.name
          }))
        ];
        setTechnicians(techOptions);
        
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Subscribe to job updates
    const unsubscribe = jobService.subscribeToUpdates((updatedJob) => {
      setAllJobs(prevJobs => {
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
      
      // Also update filtered jobs if needed
      setJobs(prevJobs => {
        // If all technicians are selected or the job matches the selected technician
        if (selectedTechnician.value === 'all' || 
            updatedJob.assignedTechnician === selectedTechnician.value) {
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
        }
        return prevJobs;
      });
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);
  
  // Filter jobs when technician selection changes
  useEffect(() => {
    if (selectedTechnician.value === 'all') {
      setJobs(allJobs);
    } else {
      const filteredJobs = allJobs.filter(job => 
        job.assignedTechnician === selectedTechnician.value
      );
      setJobs(filteredJobs);
    }
  }, [selectedTechnician, allJobs]);
  
  const filteredJobs = jobs.filter(
    job => 
      job.customer?.toLowerCase().includes(filterText.toLowerCase()) ||
      job.type?.toLowerCase().includes(filterText.toLowerCase()) ||
      job.status?.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleViewJobDetails = (job) => {
    console.log('Job details:', JSON.stringify(job, null, 2));
    
    // Find the HVAC model from various possible field names
    const hvacModel = job.hvacModel || job.hvac_model || job.HVACModel || job.hvacmodel || job.model;
    console.log('HVAC Model found:', hvacModel);
    console.log('Available documentation models:', Object.keys(mockHvacDocumentation));
    
    // Check if the HVAC model exists in the documentation
    const modelExists = hvacModel && Object.keys(mockHvacDocumentation).includes(hvacModel);
    console.log('Model exists in documentation:', modelExists);
    
    // Try to find a partial match if exact match doesn't exist
    let bestMatch = null;
    if (hvacModel && !modelExists) {
      bestMatch = Object.keys(mockHvacDocumentation).find(model => 
        model.toLowerCase().includes(hvacModel.toLowerCase()) || 
        hvacModel.toLowerCase().includes(model.toLowerCase())
      );
      console.log('Best partial match found:', bestMatch);
    }
    
    // Ensure the job has an hvacModel property with the correct value
    const updatedJob = {
      ...job,
      hvacModel: modelExists ? hvacModel : (bestMatch || hvacModel || 'Unknown')
    };
    
    console.log('Updated job with HVAC model:', updatedJob.hvacModel);
    
    setSelectedJob(updatedJob);
    setIsJobDetailsModalVisible(true);
    fetchCompatibleParts(updatedJob);
  };

  const handleCompleteJob = (job) => {
    console.log('Completing job:', JSON.stringify(job, null, 2));
    
    // Find the HVAC model from various possible field names
    const hvacModel = job.hvacModel || job.hvac_model || job.HVACModel || job.hvacmodel || job.model;
    console.log('HVAC Model found:', hvacModel);
    
    // Check if the HVAC model exists in the documentation
    const modelExists = hvacModel && Object.keys(mockHvacDocumentation).includes(hvacModel);
    console.log('Model exists in documentation:', modelExists);
    
    // Try to find a partial match if exact match doesn't exist
    let bestMatch = null;
    if (hvacModel && !modelExists) {
      bestMatch = Object.keys(mockHvacDocumentation).find(model => 
        model.toLowerCase().includes(hvacModel.toLowerCase()) || 
        hvacModel.toLowerCase().includes(model.toLowerCase())
      );
      console.log('Best partial match found:', bestMatch);
    }
    
    // Ensure the job has an hvacModel property with the correct value
    const updatedJob = {
      ...job,
      hvacModel: modelExists ? hvacModel : (bestMatch || hvacModel || 'Unknown')
    };
    
    console.log('Updated job with HVAC model:', updatedJob.hvacModel);
    
    setSelectedJob(updatedJob);
    setCompletionNotes('');
    setPartsUsed([]);
    fetchCompatibleParts(updatedJob);
    setIsCompleteJobModalVisible(true);
  };

  // Function to fetch compatible parts for a job
  const fetchCompatibleParts = async (job) => {
    try {
      setLoadingParts(true);
      console.log('Fetching compatible parts for job:', job);
      
      if (!job || !job.hvacModel) {
        // If no HVAC model is specified, show all parts
        console.log('No HVAC model specified, showing all available parts');
        
        // Ensure all parts have the required properties
        const processedParts = availableParts.map(part => ({
          name: part.name || 'Unknown Part',
          partNumber: part.partNumber || 'Unknown',
          description: part.description || 'No description available',
          price: part.unitPrice || part.price || 0,
          unitPrice: part.unitPrice || part.price || 0,
          inventory: typeof part.inventory === 'number' ? part.inventory : 0,
          category: part.category || 'Uncategorized'
        }));
        
        console.log(`Processed ${processedParts.length} available parts`);
        setCompatibleParts(processedParts);
        return;
      }
      
      console.log(`Fetching parts for HVAC model: ${job.hvacModel}`);
      
      try {
        const partsData = await partsService.getByHvacModel(job.hvacModel);
        console.log(`Received ${partsData.length} parts from API for model ${job.hvacModel}`);
        
        // Ensure all parts have the required properties
        const processedParts = partsData.map(part => ({
          ...part,
          name: part.name || 'Unknown Part',
          partNumber: part.partNumber || 'Unknown',
          description: part.description || 'No description available',
          price: part.unitPrice || part.price || 0,
          unitPrice: part.unitPrice || part.price || 0,
          inventory: typeof part.inventory === 'number' ? part.inventory : 0,
          category: part.category || 'Uncategorized'
        }));
        
        console.log(`Processed ${processedParts.length} compatible parts`);
        setCompatibleParts(processedParts);
      } catch (error) {
        console.error('Error fetching compatible parts from API:', error);
        
        // Fallback to filtering available parts manually
        console.log('Falling back to filtering available parts manually');
        
        const filteredParts = availableParts.filter(part => 
          part.fitment && 
          Array.isArray(part.fitment) && 
          part.fitment.some(model => model === job.hvacModel)
        );
        
        // Ensure all parts have the required properties
        const processedParts = filteredParts.map(part => ({
          ...part,
          name: part.name || 'Unknown Part',
          partNumber: part.partNumber || 'Unknown',
          description: part.description || 'No description available',
          price: part.unitPrice || part.price || 0,
          unitPrice: part.unitPrice || part.price || 0,
          inventory: typeof part.inventory === 'number' ? part.inventory : 0,
          category: part.category || 'Uncategorized'
        }));
        
        console.log(`Filtered ${processedParts.length} compatible parts manually`);
        setCompatibleParts(processedParts);
      }
    } catch (error) {
      console.error('Error in fetchCompatibleParts:', error);
      // Set empty array to avoid null/undefined errors
      setCompatibleParts([]);
    } finally {
      setLoadingParts(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!selectedJob || !completionNotes) {
      console.error('Cannot complete job: Missing job or completion notes');
      return;
    }
    
    if (partsUsed.length === 0) {
      console.error('Cannot complete job: No parts selected');
      return;
    }
    
    try {
      console.log('Starting job completion process...');
      console.log('Selected parts:', partsUsed);
      
      // Find the full part details for each selected part
      const selectedPartsWithDetails = partsUsed.map(selectedPart => {
        const fullPart = compatibleParts.find(p => p.partNumber === selectedPart.value);
        return {
          selectedPart,
          fullPart
        };
      });
      
      console.log('Selected parts with details:', selectedPartsWithDetails);
      
      // Update inventory for each part used
      const partsUpdatePromises = partsUsed.map(async (part) => {
        try {
          // Default to quantity 1
          const quantity = 1;
          const partNumber = part.value;
          
          console.log(`Updating inventory for part ${partNumber}, quantity: ${quantity}`);
          
          if (!partNumber) {
            console.error('Invalid part: Missing part number');
            return null;
          }
          
          try {
            await partsService.updateInventory(partNumber, quantity);
            
            return {
              partNumber: partNumber,
              name: part.label ? part.label.split(' (')[0] : 'Unknown Part',
              quantity: quantity
            };
          } catch (error) {
            console.error(`Error updating inventory for part ${partNumber}:`, error);
            // Return the part anyway to allow job completion
            return {
              partNumber: partNumber,
              name: part.label ? part.label.split(' (')[0] : 'Unknown Part',
              quantity: quantity,
              error: 'Inventory update failed'
            };
          }
        } catch (error) {
          console.error(`Error processing part:`, error);
          return null;
        }
      });
      
      // Wait for all inventory updates to complete
      const updatedPartsWithNulls = await Promise.all(partsUpdatePromises);
      // Filter out null values
      const updatedParts = updatedPartsWithNulls.filter(part => part !== null);
      
      console.log('All parts inventory updated:', updatedParts);
      
      if (updatedParts.length === 0) {
        console.error('No parts were successfully updated');
        // Continue anyway to complete the job
      }
      
      // Call API to complete job
      console.log('Completing job with API call...');
      const completedBy = selectedTechnician.value === 'all' ? 'John Smith' : selectedTechnician.value;
      const completedDate = new Date().toISOString().split('T')[0];
      
      await jobService.completeJob(selectedJob.id, {
        completionNotes,
        partsUsed: updatedParts,
        completedBy,
        completedDate
      });
      
      console.log('Job completed successfully!');
      
      // Update the jobs state with the updated job
      setJobs(prevJobs => {
        return prevJobs.map(job => {
          if (job.id === selectedJob.id) {
            // Create an updated job object that preserves all original properties
            // but updates the status to completed
            return {
              ...job,
              status: 'Completed',
              completionNotes,
              partsUsed: updatedParts,
              completedBy,
              completedDate
            };
          }
          return job;
        });
      });
      
      // Also update allJobs state
      setAllJobs(prevJobs => {
        return prevJobs.map(job => {
          if (job.id === selectedJob.id) {
            return {
              ...job,
              status: 'Completed',
              completionNotes,
              partsUsed: updatedParts
            };
          }
          return job;
        });
      });
      
      // Add entry to service history
      const today = new Date().toISOString().split('T')[0];
      const technicianName = selectedTechnician.value === 'all' ? 'John Smith' : selectedTechnician.value;
      
      await serviceHistoryService.addRecord({
        customerId: selectedJob.customerId || selectedJob.customer_id,
        date: today,
        type: selectedJob.type,
        technician: technicianName,
        notes: completionNotes + (partsUsed ? `\nParts used: ${partsUsed}` : '')
      });
      
      // Close modal
      setIsCompleteJobModalVisible(false);
      setSelectedJob(null);
      setCompletionNotes('');
      setPartsUsed('');
    } catch (err) {
      console.error('Error completing job:', err);
      setError('Failed to complete job. Please try again later.');
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

  const getJobTypeIndicator = (type) => {
    switch (type) {
      case 'Routine Maintenance':
        return <StatusIndicator type="info">Routine Maintenance</StatusIndicator>;
      case 'Emergency Repair':
        return <StatusIndicator type="error">Emergency Repair</StatusIndicator>;
      case 'Installation':
        return <StatusIndicator type="success">Installation</StatusIndicator>;
      default:
        return <StatusIndicator type="pending">{type}</StatusIndicator>;
    }
  };

  if (loading) {
    return (
      <Container
        header={
          <Header
            variant="h1"
            description="View and manage your assigned service jobs"
          >
            Technician Dashboard
          </Header>
        }
      >
        <Box textAlign="center" padding="l">
          <Spinner size="large" />
          <Box variant="p">Loading jobs...</Box>
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
            description="View and manage your assigned service jobs"
          >
            Technician Dashboard
          </Header>
        }
      >
        <SpaceBetween size="l">
          {error && (
            <Alert type="error" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          <Alert type="info">
            Welcome to the Technician Dashboard. You can view and manage service jobs here.
          </Alert>
          
          <FormField
            label="Filter by Technician"
            description="Select a technician to view their assigned jobs"
          >
            <Select
              selectedOption={selectedTechnician}
              onChange={({ detail }) => setSelectedTechnician(detail.selectedOption)}
              options={technicians}
              filteringType="auto"
              placeholder="Choose a technician"
            />
          </FormField>
          
          <Table
            columnDefinitions={[
              {
                id: 'id',
                header: 'Job ID',
                cell: item => item.id,
                sortingField: 'id',
                width: 100
              },
              {
                id: 'customer',
                header: 'Customer',
                cell: item => item.customer,
                width: 150
              },
              {
                id: 'customerId',
                header: 'Customer ID',
                cell: item => item.customerId || item.customer_id || '-',
                width: 120
              },
              {
                id: 'type',
                header: 'Job Type',
                cell: item => getJobTypeIndicator(item.type),
                width: 160
              },
              {
                id: 'scheduledDate',
                header: 'Scheduled Date',
                cell: item => item.scheduledDate || item.scheduled_date,
                width: 130
              },
              {
                id: 'status',
                header: 'Status',
                cell: item => getStatusIndicator(item.status),
                width: 120
              },
              {
                id: 'assignedTechnician',
                header: 'Assigned Technician',
                cell: item => item.assignedTechnician || item.assigned_technician || 'Unassigned',
                width: 150
              },
              {
                id: 'actions',
                header: 'Actions',
                cell: item => (
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button onClick={() => handleViewJobDetails(item)}>View Details</Button>
                    <Button 
                      variant="primary"
                      disabled={item.status === 'Completed'} 
                      onClick={() => handleCompleteJob(item)}
                    >
                      Complete Job
                    </Button>
                  </SpaceBetween>
                ),
                width: 250
              }
            ]}
            items={filteredJobs}
            selectionType="single"
            onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
            selectedItems={selectedItems}
            resizableColumns
            stickyHeader
            wrapLines={false}
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
        </SpaceBetween>
      </Container>

      {isJobDetailsModalVisible && selectedJob && (
        <Modal
          visible={isJobDetailsModalVisible}
          onDismiss={() => setIsJobDetailsModalVisible(false)}
          header={`Job Details - ${selectedJob.id}`}
          size="large"
          footer={
            <Box float="right">
              <Button onClick={() => setIsJobDetailsModalVisible(false)}>Close</Button>
            </Box>
          }
        >
          <SpaceBetween size="l">
            <ColumnLayout columns={2}>
              <Container header={<Header variant="h3">Job Information</Header>}>
                <SpaceBetween size="s">
                  <FormField label="Customer">
                    <Box>{selectedJob.customer}</Box>
                  </FormField>
                  <FormField label="Customer ID">
                    <Box>{selectedJob.customerId}</Box>
                  </FormField>
                  <FormField label="Location">
                    <Box>{selectedJob.location}</Box>
                  </FormField>
                  <FormField label="Job Type">
                    <Box>{getJobTypeIndicator(selectedJob.type)}</Box>
                  </FormField>
                  <FormField label="Scheduled Date">
                    <Box>{selectedJob.scheduledDate}</Box>
                  </FormField>
                  <FormField label="Status">
                    <Box>{getStatusIndicator(selectedJob.status)}</Box>
                  </FormField>
                  <FormField label="Description">
                    <Box>{selectedJob.description || 'No description provided'}</Box>
                  </FormField>
                </SpaceBetween>
              </Container>
              
              <Container header={<Header variant="h3">HVAC System Information</Header>}>
                <SpaceBetween size="s">
                  <FormField label="HVAC Model">
                    {selectedJob.hvacModel && selectedJob.hvacModel !== 'Unknown' ? (
                      <Box>{selectedJob.hvacModel}</Box>
                    ) : (
                      <Box>
                        <StatusIndicator type="warning">Unknown</StatusIndicator>
                        <Box variant="p" color="text-status-warning" padding={{ top: 'xs' }}>
                          HVAC model information is missing or not recognized. Documentation and parts compatibility may be limited.
                        </Box>
                      </Box>
                    )}
                  </FormField>
                  <FormField label="Required Skills">
                    <Box>{selectedJob.requiredSkills?.join(', ') || 'None specified'}</Box>
                  </FormField>
                </SpaceBetween>
              </Container>
            </ColumnLayout>

            <Container header={<Header variant="h3">Technical Documentation</Header>}>
              <Tabs
                tabs={[
                  {
                    label: "System Specifications",
                    id: "specs",
                    content: (
                      <SpaceBetween size="l">
                        {selectedJob.hvacModel && mockHvacDocumentation[selectedJob.hvacModel] ? (
                          <ColumnLayout columns={2}>
                            <div>
                              <Box variant="h4">Technical Specifications</Box>
                              <Box variant="p">{mockHvacDocumentation[selectedJob.hvacModel].specifications}</Box>
                            </div>
                            <div>
                              <Box variant="h4">Maintenance Guidelines</Box>
                              <Box variant="p">{mockHvacDocumentation[selectedJob.hvacModel].maintenanceGuidelines}</Box>
                            </div>
                          </ColumnLayout>
                        ) : (
                          <Box variant="p">
                            {selectedJob.hvacModel ? 
                              `Documentation not available for model: ${selectedJob.hvacModel}. Please check the model number or contact technical support.` : 
                              'No HVAC model specified for this job. Please update the job details with the correct model information.'}
                          </Box>
                        )}
                      </SpaceBetween>
                    )
                  },
                  {
                    label: "Troubleshooting",
                    id: "troubleshooting",
                    content: (
                      <SpaceBetween size="l">
                        {selectedJob.hvacModel && mockHvacDocumentation[selectedJob.hvacModel] ? (
                          mockHvacDocumentation[selectedJob.hvacModel].troubleshooting.map((item, index) => (
                            <ExpandableSection key={index} header={item.issue}>
                              <Box variant="p">{item.solution}</Box>
                            </ExpandableSection>
                          ))
                        ) : (
                          <Box variant="p">
                            {selectedJob.hvacModel ? 
                              `Troubleshooting guide not available for model: ${selectedJob.hvacModel}. Please check the model number or contact technical support.` : 
                              'No HVAC model specified for this job. Please update the job details with the correct model information.'}
                          </Box>
                        )}
                      </SpaceBetween>
                    )
                  },
                  {
                    label: "Required Parts",
                    id: "parts",
                    content: (
                      <SpaceBetween size="l">
                        {loadingParts ? (
                          <Spinner />
                        ) : compatibleParts && compatibleParts.length > 0 ? (
                          <Table
                            columnDefinitions={[
                              {
                                id: 'partNumber',
                                header: 'Part Number',
                                cell: item => item.partNumber
                              },
                              {
                                id: 'name',
                                header: 'Name',
                                cell: item => item.name
                              },
                              {
                                id: 'description',
                                header: 'Description',
                                cell: item => item.description
                              },
                              {
                                id: 'inventory',
                                header: 'In Stock',
                                cell: item => item.inventory > 0 ? 
                                  <StatusIndicator type="success">{item.inventory} available</StatusIndicator> : 
                                  <StatusIndicator type="error">Out of stock</StatusIndicator>
                              },
                              {
                                id: 'category',
                                header: 'Category',
                                cell: item => item.category
                              },
                              {
                                id: 'price',
                                header: 'Price',
                                cell: item => `$${item.price.toFixed(2)}`
                              }
                            ]}
                            items={compatibleParts}
                            variant="embedded"
                            trackBy="partNumber"
                          />
                        ) : (
                          <Box variant="p">No compatible parts found for this HVAC model.</Box>
                        )}
                      </SpaceBetween>
                    )
                  },
                  {
                    label: "Debug Info",
                    id: "debug",
                    content: (
                      <SpaceBetween size="l">
                        <Box variant="h4">Job Information</Box>
                        <Box variant="p">HVAC Model: {selectedJob.hvacModel || 'Not specified'}</Box>
                        <Box variant="p">Available Documentation Models: {Object.keys(mockHvacDocumentation).join(', ')}</Box>
                        <Box variant="p">Documentation Available: {selectedJob.hvacModel && mockHvacDocumentation[selectedJob.hvacModel] ? 'Yes' : 'No'}</Box>
                        
                        <Box variant="h4">Compatible Parts</Box>
                        <Box variant="p">Loading Parts: {loadingParts ? 'Yes' : 'No'}</Box>
                        <Box variant="p">Number of Compatible Parts: {compatibleParts ? compatibleParts.length : 0}</Box>
                      </SpaceBetween>
                    )
                  }
                ]}
              />
            </Container>
          </SpaceBetween>
        </Modal>
      )}

      {isCompleteJobModalVisible && selectedJob && (
        <Modal
          visible={isCompleteJobModalVisible}
          onDismiss={() => setIsCompleteJobModalVisible(false)}
          header="Complete Job"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setIsCompleteJobModalVisible(false)}>Cancel</Button>
                <Button 
                  variant="primary" 
                  onClick={handleConfirmCompletion}
                  disabled={!completionNotes || partsUsed.length === 0}
                >
                  Mark as Completed
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="l">
            <FormField
              label="Job ID"
              description="Job being completed"
            >
              <Box>{selectedJob.id} - {selectedJob.customer}</Box>
            </FormField>
            
            <FormField
              label="Parts Used"
              description="Select all parts used for this job"
              constraintText="Required"
            >
              <SpaceBetween size="s">
                {/* Simple parts selection without complex components */}
                <Table
                  columnDefinitions={[
                    {
                      id: 'partNumber',
                      header: 'Part Number',
                      cell: item => item.partNumber
                    },
                    {
                      id: 'name',
                      header: 'Name',
                      cell: item => item.name
                    },
                    {
                      id: 'inventory',
                      header: 'In Stock',
                      cell: item => item.inventory > 0 ? 
                        <StatusIndicator type="success">{item.inventory} available</StatusIndicator> : 
                        <StatusIndicator type="error">Out of stock</StatusIndicator>
                    },
                    {
                      id: 'price',
                      header: 'Price',
                      cell: item => `$${(item.unitPrice || item.price || 0).toFixed(2)}`
                    },
                    {
                      id: 'actions',
                      header: 'Actions',
                      cell: item => (
                        <Button
                          disabled={item.inventory <= 0 || partsUsed.some(p => p.value === item.partNumber)}
                          onClick={() => {
                            setPartsUsed([...partsUsed, {
                              label: `${item.name} (${item.partNumber})`,
                              value: item.partNumber
                            }]);
                          }}
                        >
                          {partsUsed.some(p => p.value === item.partNumber) ? 'Selected' : 'Select'}
                        </Button>
                      )
                    }
                  ]}
                  items={compatibleParts || []}
                  loading={loadingParts}
                  loadingText="Loading compatible parts..."
                  empty={
                    <Box textAlign="center" color="inherit">
                      <b>No compatible parts</b>
                      <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                        No compatible parts found for this HVAC model.
                      </Box>
                    </Box>
                  }
                  header={<Header>Compatible Parts</Header>}
                />
                
                {partsUsed.length > 0 && (
                  <>
                    <Box variant="h5">Selected Parts:</Box>
                    <Table
                      columnDefinitions={[
                        {
                          id: 'partNumber',
                          header: 'Part Number',
                          cell: item => item.value
                        },
                        {
                          id: 'name',
                          header: 'Name',
                          cell: item => item.label.split(' (')[0]
                        },
                        {
                          id: 'quantity',
                          header: 'Quantity',
                          cell: () => '1'
                        },
                        {
                          id: 'actions',
                          header: 'Actions',
                          cell: item => (
                            <Button
                              variant="link"
                              onClick={() => {
                                setPartsUsed(partsUsed.filter(p => p.value !== item.value));
                              }}
                            >
                              Remove
                            </Button>
                          )
                        }
                      ]}
                      items={partsUsed}
                      header={<Header>Selected Parts</Header>}
                    />
                  </>
                )}
              </SpaceBetween>
            </FormField>
            
            <FormField
              label="Completion Notes"
              description="Provide detailed notes about the work performed"
              constraintText="Required"
            >
              <Textarea
                value={completionNotes}
                onChange={({ detail }) => setCompletionNotes(detail.value)}
                placeholder="Describe the work performed, issues found, and resolution..."
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}
    </SpaceBetween>
  );
}

export default Technician;
