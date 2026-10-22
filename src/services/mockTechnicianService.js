import { v4 as uuidv4 } from 'uuid';

// Mock technician data
const mockTechnicians = [
  {
    id: 'tech-001',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '555-123-4567',
    skills: ['HVAC Installation', 'Refrigerant Handling', 'Electrical'],
    certifications: ['EPA 608', 'NATE'],
    availability: 'Available',
    location: {
      lat: 37.7749,
      lng: -122.4194
    }
  },
  {
    id: 'tech-002',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '555-234-5678',
    skills: ['Preventive Maintenance', 'Diagnostics', 'Controls'],
    certifications: ['HVAC Excellence', 'NATE'],
    availability: 'On Job',
    location: {
      lat: 37.7833,
      lng: -122.4167
    }
  },
  {
    id: 'tech-003',
    name: 'Mike Wilson',
    email: 'mike.wilson@example.com',
    phone: '555-345-6789',
    skills: ['Commercial HVAC', 'Chillers', 'Boilers'],
    certifications: ['EPA 608', 'HVAC Excellence'],
    availability: 'Available',
    location: {
      lat: 37.7694,
      lng: -122.4862
    }
  },
  {
    id: 'tech-004',
    name: 'Lisa Chen',
    email: 'lisa.chen@example.com',
    phone: '555-456-7890',
    skills: ['Residential HVAC', 'Ductwork', 'Indoor Air Quality'],
    certifications: ['NATE', 'BPI'],
    availability: 'Off Duty',
    location: {
      lat: 37.8044,
      lng: -122.2711
    }
  },
  {
    id: 'tech-005',
    name: 'David Rodriguez',
    email: 'david.rodriguez@example.com',
    phone: '555-567-8901',
    skills: ['Heat Pumps', 'Mini-Splits', 'Zoning Systems'],
    certifications: ['EPA 608', 'NATE'],
    availability: 'Available',
    location: {
      lat: 37.7272,
      lng: -122.4230
    }
  }
];

// Mock jobs data
const mockJobs = [
  {
    id: 'job-001',
    customerId: 'cust-001',
    customerName: 'Acme Corporation',
    address: '123 Main St, San Francisco, CA',
    scheduledDate: '2025-07-12',
    scheduledTime: '09:00 AM',
    status: 'Scheduled',
    priority: 'High',
    type: 'Repair',
    description: 'AC not cooling properly',
    assignedTechnician: 'tech-001',
    hvacModel: 'Carrier Infinity 24ANB1',
    estimatedDuration: 2
  },
  {
    id: 'job-002',
    customerId: 'cust-002',
    customerName: 'XYZ Industries',
    address: '456 Oak Ave, San Francisco, CA',
    scheduledDate: '2025-07-12',
    scheduledTime: '01:00 PM',
    status: 'In Progress',
    priority: 'Medium',
    type: 'Maintenance',
    description: 'Annual system check',
    assignedTechnician: 'tech-002',
    hvacModel: 'Trane XL18i',
    estimatedDuration: 1.5
  },
  {
    id: 'job-003',
    customerId: 'cust-003',
    customerName: 'Bay Area Tech',
    address: '789 Pine St, San Francisco, CA',
    scheduledDate: '2025-07-13',
    scheduledTime: '10:00 AM',
    status: 'Scheduled',
    priority: 'Low',
    type: 'Installation',
    description: 'New system installation',
    assignedTechnician: 'tech-003',
    hvacModel: 'Lennox XC25',
    estimatedDuration: 4
  },
  {
    id: 'job-004',
    customerId: 'cust-004',
    customerName: 'Golden Gate Properties',
    address: '101 Market St, San Francisco, CA',
    scheduledDate: '2025-07-13',
    scheduledTime: '02:00 PM',
    status: 'Scheduled',
    priority: 'High',
    type: 'Emergency',
    description: 'No heat, possible gas leak',
    assignedTechnician: 'tech-001',
    hvacModel: 'Rheem Prestige Series',
    estimatedDuration: 2
  },
  {
    id: 'job-005',
    customerId: 'cust-005',
    customerName: 'Pacific Heights Condos',
    address: '222 California St, San Francisco, CA',
    scheduledDate: '2025-07-14',
    scheduledTime: '09:00 AM',
    status: 'Scheduled',
    priority: 'Medium',
    type: 'Maintenance',
    description: 'Filter replacement and system check',
    assignedTechnician: 'tech-005',
    hvacModel: 'Goodman GSXC18',
    estimatedDuration: 1
  }
];

// Mock parts data
const mockParts = [
  {
    partNumber: 'AC-FILTER-001',
    name: 'HEPA Air Filter',
    description: 'High-efficiency particulate air filter',
    category: 'Filters',
    manufacturer: 'FilterPro',
    unitPrice: 45.99,
    inventory: 23,
    stockMinimum: 10,
    stockMaximum: 50,
    compatibleModels: ['Carrier Infinity', 'Trane XL', 'Lennox Signature']
  },
  {
    partNumber: 'AC-COMP-002',
    name: 'AC Compressor',
    description: '2.5-ton capacity compressor',
    category: 'Compressors',
    manufacturer: 'CoolTech',
    unitPrice: 389.99,
    inventory: 5,
    stockMinimum: 3,
    stockMaximum: 10,
    compatibleModels: ['Carrier Infinity 24ANB1', 'Trane XL18i']
  },
  {
    partNumber: 'HTR-CTRL-003',
    name: 'Heating Control Board',
    description: 'Digital control board for gas furnaces',
    category: 'Controls',
    manufacturer: 'ThermoControl',
    unitPrice: 129.50,
    inventory: 8,
    stockMinimum: 5,
    stockMaximum: 15,
    compatibleModels: ['Rheem Prestige', 'Goodman GMVC']
  },
  {
    partNumber: 'FAN-MTR-004',
    name: 'Fan Motor',
    description: '1/3 HP blower motor',
    category: 'Motors',
    manufacturer: 'MotorWorks',
    unitPrice: 87.75,
    inventory: 12,
    stockMinimum: 8,
    stockMaximum: 20,
    compatibleModels: ['Carrier', 'Trane', 'Lennox', 'Rheem', 'Goodman']
  },
  {
    partNumber: 'REFR-VAL-005',
    name: 'Refrigerant Valve',
    description: 'Thermal expansion valve',
    category: 'Valves',
    manufacturer: 'CoolFlow',
    unitPrice: 52.25,
    inventory: 15,
    stockMinimum: 10,
    stockMaximum: 30,
    compatibleModels: ['Carrier Infinity', 'Trane XL', 'Lennox XC']
  }
];

// Mock technician service
export const mockTechnicianService = {
  // Get all technicians
  getAll: async () => {
    console.log('Mock - Fetching all technicians');
    return Promise.resolve([...mockTechnicians]);
  },
  
  // Get technician by ID
  getById: async (id) => {
    console.log(`Mock - Fetching technician ${id}`);
    const technician = mockTechnicians.find(tech => tech.id === id);
    
    if (!technician) {
      throw new Error(`Technician with ID ${id} not found`);
    }
    
    return Promise.resolve({ ...technician });
  },
  
  // Update technician
  update: async (technician) => {
    console.log(`Mock - Updating technician ${technician.id}`);
    const index = mockTechnicians.findIndex(tech => tech.id === technician.id);
    
    if (index === -1) {
      throw new Error(`Technician with ID ${technician.id} not found`);
    }
    
    mockTechnicians[index] = { ...mockTechnicians[index], ...technician };
    return Promise.resolve({ ...mockTechnicians[index] });
  }
};

// Mock job service
export const mockJobService = {
  // Get all jobs
  getAll: async () => {
    console.log('Mock - Fetching all jobs');
    return Promise.resolve([...mockJobs]);
  },
  
  // Get job by ID
  getById: async (id) => {
    console.log(`Mock - Fetching job ${id}`);
    const job = mockJobs.find(j => j.id === id);
    
    if (!job) {
      throw new Error(`Job with ID ${id} not found`);
    }
    
    return Promise.resolve({ ...job });
  },
  
  // Update job
  update: async (job) => {
    console.log(`Mock - Updating job ${job.id}`);
    const index = mockJobs.findIndex(j => j.id === job.id);
    
    if (index === -1) {
      throw new Error(`Job with ID ${job.id} not found`);
    }
    
    mockJobs[index] = { ...mockJobs[index], ...job };
    return Promise.resolve({ ...mockJobs[index] });
  },
  
  // Assign technician to job
  assignTechnician: async (jobId, technicianId) => {
    console.log(`Mock - Assigning technician ${technicianId} to job ${jobId}`);
    const jobIndex = mockJobs.findIndex(job => job.id === jobId);
    
    if (jobIndex === -1) {
      throw new Error(`Job with ID ${jobId} not found`);
    }
    
    mockJobs[jobIndex].assignedTechnician = technicianId;
    return Promise.resolve({ ...mockJobs[jobIndex] });
  },
  
  // Complete job
  completeJob: async (jobId, completionDetails) => {
    console.log(`Mock - Completing job ${jobId}`);
    const jobIndex = mockJobs.findIndex(job => job.id === jobId);
    
    if (jobIndex === -1) {
      throw new Error(`Job with ID ${jobId} not found`);
    }
    
    mockJobs[jobIndex] = {
      ...mockJobs[jobIndex],
      status: 'Completed',
      completionDate: new Date().toISOString().split('T')[0],
      completionNotes: completionDetails.notes,
      partsUsed: completionDetails.partsUsed
    };
    
    return Promise.resolve({ ...mockJobs[jobIndex] });
  }
};

// Mock parts service
export const mockPartsService = {
  // Get all parts
  getAll: async () => {
    console.log('Mock - Fetching all parts');
    return Promise.resolve([...mockParts]);
  },
  
  // Get part by part number
  getByPartNumber: async (partNumber) => {
    console.log(`Mock - Fetching part ${partNumber}`);
    const part = mockParts.find(p => p.partNumber === partNumber);
    
    if (!part) {
      throw new Error(`Part with number ${partNumber} not found`);
    }
    
    return Promise.resolve({ ...part });
  },
  
  // Get parts by HVAC model
  getByHvacModel: async (hvacModel) => {
    console.log(`Mock - Fetching parts for HVAC model ${hvacModel}`);
    const compatibleParts = mockParts.filter(part => 
      part.compatibleModels.some(model => 
        hvacModel.includes(model) || model.includes(hvacModel)
      )
    );
    
    return Promise.resolve([...compatibleParts]);
  },
  
  // Update inventory
  updateInventory: async (partNumber, quantityUsed) => {
    console.log(`Mock - Updating inventory for part ${partNumber}`);
    const partIndex = mockParts.findIndex(p => p.partNumber === partNumber);
    
    if (partIndex === -1) {
      throw new Error(`Part with number ${partNumber} not found`);
    }
    
    mockParts[partIndex].inventory -= quantityUsed;
    return Promise.resolve({ ...mockParts[partIndex] });
  },
  
  // Get parts needing reorder
  getPartsNeedingReorder: async () => {
    console.log('Mock - Fetching parts needing reorder');
    const reorderParts = mockParts.filter(part => part.inventory <= part.stockMinimum);
    
    return Promise.resolve(reorderParts.map(part => ({
      ...part,
      reorderQuantity: part.stockMaximum - part.inventory,
      totalCost: (part.stockMaximum - part.inventory) * part.unitPrice
    })));
  }
};

export default {
  mockTechnicianService,
  mockJobService,
  mockPartsService
};
