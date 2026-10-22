import { v4 as uuidv4 } from 'uuid';

// Mock service history data
let serviceHistoryData = [
  {
    id: '1',
    customerId: 'cust-001',
    date: '2025-06-15',
    type: 'Filter Replacement',
    technician: 'John Smith',
    notes: 'Replaced HEPA filter and cleaned air ducts'
  },
  {
    id: '2',
    customerId: 'cust-001',
    date: '2025-05-02',
    type: 'Annual Maintenance',
    technician: 'Sarah Johnson',
    notes: 'Performed full system check, refrigerant levels optimal'
  },
  {
    id: '3',
    customerId: 'cust-002',
    date: '2025-06-20',
    type: 'Repair',
    technician: 'Mike Wilson',
    notes: 'Fixed compressor issue, replaced faulty valve'
  },
  {
    id: '4',
    customerId: 'cust-003',
    date: '2025-06-10',
    type: 'Filter Replacement',
    technician: 'John Smith',
    notes: 'Replaced filter and cleaned coils'
  },
  {
    id: '5',
    customerId: 'cust-004',
    date: '2025-06-05',
    type: 'Emergency Repair',
    technician: 'Lisa Chen',
    notes: 'Fixed refrigerant leak, recharged system'
  },
  {
    id: '6',
    customerId: 'cust-005',
    date: '2025-06-18',
    type: 'Annual Maintenance',
    technician: 'Sarah Johnson',
    notes: 'Full system check, all parameters normal'
  }
];

// Listeners for service history updates
const listeners = [];

// Service history service
const serviceHistoryService = {
  // Get all service history records
  getAll: async () => {
    return Promise.resolve([...serviceHistoryData]);
  },
  
  // Get service history for a specific customer
  getByCustomerId: async (customerId) => {
    return Promise.resolve(
      serviceHistoryData.filter(record => record.customerId === customerId)
    );
  },
  
  // Add a new service history record
  addRecord: async (record) => {
    const newRecord = {
      id: uuidv4(),
      ...record,
      date: record.date || new Date().toISOString().split('T')[0]
    };
    
    serviceHistoryData.push(newRecord);
    
    // Notify listeners
    listeners.forEach(callback => callback(newRecord));
    
    return Promise.resolve(newRecord);
  },
  
  // Update an existing service history record
  updateRecord: async (record) => {
    const index = serviceHistoryData.findIndex(r => r.id === record.id);
    
    if (index === -1) {
      throw new Error(`Service history record with ID ${record.id} not found`);
    }
    
    serviceHistoryData[index] = { ...serviceHistoryData[index], ...record };
    
    // Notify listeners
    listeners.forEach(callback => callback(serviceHistoryData[index]));
    
    return Promise.resolve(serviceHistoryData[index]);
  },
  
  // Delete a service history record
  deleteRecord: async (id) => {
    const index = serviceHistoryData.findIndex(r => r.id === id);
    
    if (index === -1) {
      throw new Error(`Service history record with ID ${id} not found`);
    }
    
    const deletedRecord = serviceHistoryData[index];
    serviceHistoryData = serviceHistoryData.filter(r => r.id !== id);
    
    // Notify listeners
    listeners.forEach(callback => callback({ ...deletedRecord, deleted: true }));
    
    return Promise.resolve({ success: true });
  },
  
  // Subscribe to service history updates
  subscribeToUpdates: (callback) => {
    listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }
};

export default serviceHistoryService;
