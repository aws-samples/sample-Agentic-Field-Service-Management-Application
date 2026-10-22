import axios from 'axios';
import { API_CONFIG } from '../config/api-config';
import { getAuthHeaders, getIdToken, withWebSocketToken } from '../utils/auth-headers';

// API configuration
const API_ENDPOINT = API_CONFIG.apiEndpoint;
const WEBSOCKET_ENDPOINT = API_CONFIG.websocketEndpoint;

console.log('DataService initialized with:', { API_ENDPOINT });

// Configure axios defaults for API requests
const apiClient = axios.create({
  baseURL: API_ENDPOINT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add authentication token to requests
apiClient.interceptors.request.use(
  async (config) => {
    // Cognito ID token from directAuthService; the API rejects calls without it.
    Object.assign(config.headers, getAuthHeaders());
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// WebSocket connection for real-time updates
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const listeners = {
  customers: [],
  jobs: [],
  technicians: [],
  invoices: []
};

// Initialize WebSocket connection
const initWebSocket = () => {
  if (socket) return;
  // $connect rejects anonymous clients; wait until the user has signed in.
  // The next subscribeToUpdates call after sign-in (e.g. the next page mount) connects.
  if (!getIdToken()) return;

  // The $connect authorizer reads the Cognito ID token from ?token=.
  socket = new WebSocket(withWebSocketToken(WEBSOCKET_ENDPOINT));
  
  socket.onopen = () => {
    console.log('WebSocket connection established');
    reconnectAttempts = 0;
    
    // Subscribe to data change events
    socket.send(JSON.stringify({
      action: 'subscribe',
      topics: ['customers', 'jobs', 'technicians', 'invoices']
    }));
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const { topic, payload } = data;
      
      // Notify all listeners for this topic
      if (listeners[topic]) {
        listeners[topic].forEach(callback => callback(payload));
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };
  
  socket.onclose = () => {
    console.log('WebSocket connection closed');
    socket = null;
    
    // Attempt to reconnect with exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.pow(2, reconnectAttempts) * 1000;
      reconnectAttempts++;
      
      setTimeout(() => {
        initWebSocket();
      }, delay);
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
};

// Subscribe to real-time updates for a specific data type
const subscribeToUpdates = (dataType, callback) => {
  if (!listeners[dataType]) {
    listeners[dataType] = [];
  }
  
  listeners[dataType].push(callback);
  
  // Initialize WebSocket if not already connected
  initWebSocket();
  
  // Return unsubscribe function
  return () => {
    listeners[dataType] = listeners[dataType].filter(cb => cb !== callback);
  };
};

// Customer data services
export const customerService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/customers');
      return response.data;
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/customers/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching customer ${id}:`, error);
      throw error;
    }
  },
  
  update: async (customer) => {
    try {
      const response = await apiClient.put(`/customers/${customer.id}`, customer);
      return response.data;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },
  
  subscribeToUpdates: (callback) => {
    return subscribeToUpdates('customers', callback);
  }
};

// Job data services
export const jobService = {
  getAll: async () => {
    try {
      // Use the API to fetch from DynamoDB FSM-Jobs table
      const response = await apiClient.get('/jobs');
      
      // Process the data to ensure fields are properly mapped
      const processedData = response.data.map(job => {
        // Create a processed job object with standardized field names
        const processedJob = {
          ...job,
          // Map customerId field (handle different case variations)
          customerId: job.customerId || job.customer_id || job.CustomerID || job.customerId,
          
          // Map HVAC model field (handle different case variations)
          hvacModel: job.hvacModel || job.hvac_model || job.HVACModel || job.hvacmodel || job.model,
          
          // Map other common fields that might have different naming
          scheduledDate: job.scheduledDate || job.scheduled_date || job.date,
          assignedTechnician: job.assignedTechnician || job.assigned_technician || job.technician,
          requiredSkills: job.requiredSkills || job.required_skills || job.skills
        };
        
        // Log warning for missing important fields
        if (!processedJob.customerId) {
          console.warn(`Job ${job.id} is missing customerId`);
        }
        
        if (!processedJob.hvacModel) {
          console.warn(`Job ${job.id} is missing HVAC model`);
        }
        
        return processedJob;
      });
      
      console.log('Processed job data:', processedData);
      return processedData;
    } catch (error) {
      console.error('Error fetching jobs:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/jobs/${id}`);
      
      // Process the job to ensure fields are properly mapped
      const job = response.data;
      const processedJob = {
        ...job,
        // Map customerId field (handle different case variations)
        customerId: job.customerId || job.customer_id || job.CustomerID || job.customerId,
        
        // Map HVAC model field (handle different case variations)
        hvacModel: job.hvacModel || job.hvac_model || job.HVACModel || job.hvacmodel || job.model,
        
        // Map other common fields that might have different naming
        scheduledDate: job.scheduledDate || job.scheduled_date || job.date,
        assignedTechnician: job.assignedTechnician || job.assigned_technician || job.technician,
        requiredSkills: job.requiredSkills || job.required_skills || job.skills
      };
      
      return processedJob;
    } catch (error) {
      console.error(`Error fetching job ${id}:`, error);
      throw error;
    }
  },
  
  update: async (job) => {
    try {
      const response = await apiClient.put(`/jobs/${job.id}`, job);
      return response.data;
    } catch (error) {
      console.error('Error updating job:', error);
      throw error;
    }
  },
  
  assignTechnician: async (jobId, technicianId) => {
    try {
      console.log(`Assigning technician ${technicianId} to job ${jobId}`);
      const response = await apiClient.post(`/jobs/${jobId}/assign`, { technicianId });
      console.log('Assignment response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error assigning technician:', error);
      console.error('Error details:', error.response?.data || 'No response data');
      throw error;
    }
  },
  
  completeJob: async (jobId, completionDetails) => {
    try {
      const response = await apiClient.post(`/jobs/${jobId}/complete`, completionDetails);
      return response.data;
    } catch (error) {
      console.error('Error completing job:', error);
      throw error;
    }
  },
  
  subscribeToUpdates: (callback) => {
    return subscribeToUpdates('jobs', callback);
  }
};

// Technician data services
export const technicianService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/technicians');
      return response.data;
    } catch (error) {
      console.error('Error fetching technicians:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/technicians/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching technician ${id}:`, error);
      throw error;
    }
  },
  
  update: async (technician) => {
    try {
      const response = await apiClient.put(`/technicians/${technician.id}`, technician);
      return response.data;
    } catch (error) {
      console.error('Error updating technician:', error);
      throw error;
    }
  },
  
  subscribeToUpdates: (callback) => {
    return subscribeToUpdates('technicians', callback);
  }
};

// Invoice data services
export const invoiceService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/invoices');
      return response.data;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      const response = await apiClient.get(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching invoice ${id}:`, error);
      throw error;
    }
  },
  
  update: async (invoice) => {
    try {
      const response = await apiClient.put(`/invoices/${invoice.id}`, invoice);
      return response.data;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  },
  
  subscribeToUpdates: (callback) => {
    return subscribeToUpdates('invoices', callback);
  }
};

// Parts data services
export const partsService = {
  getAll: async () => {
    try {
      const response = await apiClient.get('/parts');
      return response.data;
    } catch (error) {
      console.error('Error fetching parts:', error);
      throw error;
    }
  },
  
  getByPartNumber: async (partNumber) => {
    try {
      const response = await apiClient.get(`/parts/${partNumber}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching part ${partNumber}:`, error);
      throw error;
    }
  },
  
  getByHvacModel: async (hvacModel) => {
    try {
      const response = await apiClient.get(`/parts/hvac-model/${hvacModel}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching parts for HVAC model ${hvacModel}:`, error);
      throw error;
    }
  },
  
  updateInventory: async (partNumber, quantityUsed) => {
    try {
      const response = await apiClient.post('/parts/inventory', { partNumber, quantityUsed });
      return response.data;
    } catch (error) {
      console.error('Error updating part inventory:', error);
      throw error;
    }
  },
  
  getInventoryStatus: async () => {
    try {
      const parts = await partsService.getAll();
      return parts.map(part => ({
        partNumber: part.partNumber,
        name: part.name,
        inventory: part.inventory,
        stockMinimum: part.stockMinimum || 0,
        stockMaximum: part.stockMaximum || 0,
        status: part.inventory <= (part.stockMinimum || 0) ? 'Low' : 'OK',
        supplier: part.supplier || 'Unknown',
        supplierLeadTime: part.supplierLeadTime || 0,
        unitPrice: part.unitPrice || part.price || 0
      }));
    } catch (error) {
      console.error('Error getting inventory status:', error);
      throw error;
    }
  },
  
  getPartsNeedingReorder: async () => {
    try {
      const parts = await partsService.getAll();
      return parts.filter(part => part.inventory <= (part.stockMinimum || 0))
        .map(part => ({
          partNumber: part.partNumber,
          name: part.name,
          inventory: part.inventory,
          stockMinimum: part.stockMinimum || 0,
          stockMaximum: part.stockMaximum || 0,
          reorderQuantity: (part.stockMaximum || 0) - part.inventory,
          supplier: part.supplier || 'Unknown',
          supplierLeadTime: part.supplierLeadTime || 0,
          unitPrice: part.unitPrice || part.price || 0,
          totalCost: ((part.stockMaximum || 0) - part.inventory) * (part.unitPrice || part.price || 0)
        }));
    } catch (error) {
      console.error('Error getting parts needing reorder:', error);
      throw error;
    }
  }
};

// HVAC metrics data services
export const metricsService = {
  getByCustomerId: async (customerId) => {
    try {
      const response = await apiClient.get(`/metrics/${customerId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching metrics for customer ${customerId}:`, error);
      throw error;
    }
  },
  
  subscribeToCustomerMetrics: (customerId, callback) => {
    // Create a specific subscription for this customer's metrics
    const topic = `metrics_${customerId}`;
    
    if (!listeners[topic]) {
      listeners[topic] = [];
    }
    
    listeners[topic].push(callback);
    
    // Initialize WebSocket if not already connected
    initWebSocket();
    
    // Subscribe to this specific customer's metrics
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'subscribe',
        topics: [topic]
      }));
    }
    
    // Return unsubscribe function
    return () => {
      listeners[topic] = listeners[topic].filter(cb => cb !== callback);
    };
  }
};

// Documentation data services
export const documentationService = {
  getByModel: async (hvacModel) => {
    try {
      const response = await apiClient.get(`/documentation/${encodeURIComponent(hvacModel)}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching documentation for model ${hvacModel}:`, error);
      throw error;
    }
  }
};
