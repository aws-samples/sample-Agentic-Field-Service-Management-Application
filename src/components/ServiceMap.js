import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, SpaceBetween, StatusIndicator, Button } from '@cloudscape-design/components';

// Fix for default marker icons in React-Leaflet
// This is needed because the default icons reference assets that might not be available
const fixLeafletIcon = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
};

// Custom icons for different marker types
const createCustomIcon = (iconUrl, size = [25, 41]) => {
  return L.icon({
    iconUrl,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
  });
};

const ServiceMap = ({ jobs, technicians, onAssignTechnician }) => {
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [mapCenter, setMapCenter] = useState([39.8283, -98.5795]); // Center of US
  const [mapZoom, setMapZoom] = useState(4);

  useEffect(() => {
    fixLeafletIcon();
    
    // Log props to help debug
    console.log('ServiceMap jobs:', jobs);
    console.log('ServiceMap technicians:', technicians);
    
    // Check if jobs and technicians have coordinates
    const validJobs = jobs && jobs.length > 0 && jobs.some(job => job.coordinates && job.coordinates.length === 2);
    const validTechs = technicians && technicians.length > 0 && technicians.some(tech => tech.coordinates && tech.coordinates.length === 2);
    
    console.log('Valid jobs with coordinates:', validJobs);
    console.log('Valid technicians with coordinates:', validTechs);
    
    // If we have valid jobs or technicians, adjust the map center
    if (validJobs) {
      // Find the first job with valid coordinates
      const firstValidJob = jobs.find(job => job.coordinates && job.coordinates.length === 2);
      if (firstValidJob) {
        setMapCenter(firstValidJob.coordinates);
        setMapZoom(6);
      }
    } else if (validTechs) {
      // Find the first technician with valid coordinates
      const firstValidTech = technicians.find(tech => tech.coordinates && tech.coordinates.length === 2);
      if (firstValidTech) {
        setMapCenter(firstValidTech.coordinates);
        setMapZoom(6);
      }
    }
  }, [jobs, technicians]);

  // Create custom icons for different job statuses and technicians
  const jobIcons = {
    Pending: createCustomIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png'),
    'In Progress': createCustomIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png'),
    Urgent: createCustomIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'),
    Completed: createCustomIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png')
  };

  const technicianIcons = {
    Available: createCustomIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'),
    'On Job': createCustomIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png'),
    'Off Duty': createCustomIcon('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png')
  };

  // Calculate the nearest available technician for a job
  const findNearestTechnician = (job) => {
    if (!job || !job.coordinates || !technicians || technicians.length === 0) return null;
    
    const availableTechs = technicians.filter(tech => 
      tech.status === 'Available' && 
      tech.coordinates && 
      tech.coordinates.length === 2
    );
    
    if (availableTechs.length === 0) return null;
    
    // Calculate distances
    const techsWithDistance = availableTechs.map(tech => {
      // Simple Euclidean distance for demo purposes
      // In a real app, you'd use a routing service for actual travel distance/time
      const distance = Math.sqrt(
        Math.pow(tech.coordinates[0] - job.coordinates[0], 2) + 
        Math.pow(tech.coordinates[1] - job.coordinates[1], 2)
      );
      return { ...tech, distance };
    });
    
    // Sort by distance
    techsWithDistance.sort((a, b) => a.distance - b.distance);
    return techsWithDistance[0];
  };

  // Get status indicator component based on status string
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
      case 'Available':
        return <StatusIndicator type="success">Available</StatusIndicator>;
      case 'On Job':
        return <StatusIndicator type="in-progress">On Job</StatusIndicator>;
      case 'Off Duty':
        return <StatusIndicator type="stopped">Off Duty</StatusIndicator>;
      default:
        return <StatusIndicator type="stopped">Unknown</StatusIndicator>;
    }
  };

  // Draw a line between selected job and technician
  const renderConnectionLine = () => {
    if (selectedJob && selectedTechnician && 
        selectedJob.coordinates && selectedJob.coordinates.length === 2 &&
        selectedTechnician.coordinates && selectedTechnician.coordinates.length === 2) {
      return (
        <Polyline 
          positions={[selectedJob.coordinates, selectedTechnician.coordinates]}
          color="#0972d3"
          weight={3}
          dashArray="5, 10"
        />
      );
    }
    return null;
  };

  // Filter out jobs and technicians without valid coordinates
  const validJobs = jobs && jobs.filter(job => job.coordinates && job.coordinates.length === 2);
  const validTechnicians = technicians && technicians.filter(tech => tech.coordinates && tech.coordinates.length === 2);

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Render job markers */}
        {validJobs && validJobs.map(job => (
          <Marker 
            key={job.id} 
            position={job.coordinates}
            icon={jobIcons[job.status] || jobIcons.Pending}
            eventHandlers={{
              click: () => {
                setSelectedJob(job);
                // If a technician is already selected, keep it selected
                if (!selectedTechnician) {
                  const nearest = findNearestTechnician(job);
                  if (nearest) setSelectedTechnician(nearest);
                }
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
              {job.customer}
            </Tooltip>
            <Popup>
              <SpaceBetween size="s">
                <Box variant="h4">{job.customer}</Box>
                <Box>Location: {job.location}</Box>
                <Box>Job Type: {job.type}</Box>
                <Box>Status: {getStatusIndicator(job.status)}</Box>
                <Box>Scheduled: {job.scheduledDate}</Box>
                <Box>
                  Technician: {job.assignedTechnician || 'Unassigned'}
                </Box>
                {job.status === 'Pending' && (
                  <Button 
                    onClick={() => onAssignTechnician(job)}
                    fullWidth
                  >
                    Assign Technician
                  </Button>
                )}
              </SpaceBetween>
            </Popup>
          </Marker>
        ))}
        
        {/* Render technician markers */}
        {validTechnicians && validTechnicians.map(tech => (
          <Marker 
            key={tech.id} 
            position={tech.coordinates}
            icon={technicianIcons[tech.status] || technicianIcons.Available}
            eventHandlers={{
              click: () => {
                setSelectedTechnician(tech);
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
              {tech.name}
            </Tooltip>
            <Popup>
              <SpaceBetween size="s">
                <Box variant="h4">{tech.name}</Box>
                <Box>Status: {getStatusIndicator(tech.status)}</Box>
                <Box>Location: {tech.currentLocation}</Box>
                <Box>Skills: {tech.skills.join(', ')}</Box>
                <Box>
                  Current Job: {tech.currentJob || 'None'}
                </Box>
                {selectedJob && tech.status === 'Available' && (
                  <Button 
                    onClick={() => onAssignTechnician(selectedJob, tech)}
                    fullWidth
                  >
                    Assign to Selected Job
                  </Button>
                )}
              </SpaceBetween>
            </Popup>
          </Marker>
        ))}
        
        {/* Render connection line between selected job and technician */}
        {renderConnectionLine()}
      </MapContainer>
    </div>
  );
};

export default ServiceMap;
