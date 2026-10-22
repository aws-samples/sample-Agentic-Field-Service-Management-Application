import axios from 'axios';
import { API_CONFIG } from '../config/api-config';
import { getAuthHeaders } from '../utils/auth-headers';

// API configuration
const API_ENDPOINT = API_CONFIG.apiEndpoint;

console.log('Debug API Service initialized with:', { API_ENDPOINT });

// Create a debug axios instance that logs all requests and responses
const debugApiClient = axios.create({
  baseURL: API_ENDPOINT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request interceptor for debugging
debugApiClient.interceptors.request.use(
  config => {
    Object.assign(config.headers, getAuthHeaders());
    console.log('DEBUG API REQUEST:', {
      url: config.url,
      method: config.method,
      headers: {
        ...config.headers,
        Authorization: config.headers.Authorization ? '[redacted]' : undefined // never log the token
      },
      data: config.data
    });
    
    return config;
  },
  error => {
    console.error('DEBUG API REQUEST ERROR:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
debugApiClient.interceptors.response.use(
  response => {
    console.log('DEBUG API RESPONSE:', {
      status: response.status,
      headers: response.headers,
      data: response.data
    });
    return response;
  },
  error => {
    console.error('DEBUG API RESPONSE ERROR:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      } : 'No response',
      config: {
        url: error.config.url,
        method: error.config.method,
        headers: {
          ...error.config.headers,
          Authorization: error.config.headers.Authorization ? '[redacted]' : undefined // never log the token
        },
        data: error.config.data
      }
    });
    return Promise.reject(error);
  }
);

// Debug customer service
export const debugCustomerService = {
  getAll: async () => {
    try {
      console.log('Debug - Fetching all customers');
      const response = await debugApiClient.get('/customers');
      return response.data;
    } catch (error) {
      console.error('Debug - Error fetching customers:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      console.log(`Debug - Fetching customer ${id}`);
      const response = await debugApiClient.get(`/customers/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Debug - Error fetching customer ${id}:`, error);
      throw error;
    }
  }
};

// Debug job service
export const debugJobService = {
  getAll: async () => {
    try {
      console.log('Debug - Fetching all jobs');
      const response = await debugApiClient.get('/jobs');
      return response.data;
    } catch (error) {
      console.error('Debug - Error fetching jobs:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      console.log(`Debug - Fetching job ${id}`);
      const response = await debugApiClient.get(`/jobs/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Debug - Error fetching job ${id}:`, error);
      throw error;
    }
  },
  
  unassignTechnician: async (jobId) => {
    try {
      console.log(`Debug - Unassigning technician from job ${jobId}`);
      const response = await debugApiClient.post(`/jobs/${jobId}/unassign`);
      return response.data;
    } catch (error) {
      console.error(`Debug - Error unassigning technician from job:`, error);
      throw error;
    }
  },

  assignTechnician: async (jobId, technicianId) => {
    try {
      console.log(`Debug - Assigning technician ${technicianId} to job ${jobId}`);
      const response = await debugApiClient.post(`/jobs/${jobId}/assign`, { technicianId });
      return response.data;
    } catch (error) {
      console.error(`Debug - Error assigning technician to job:`, error);
      throw error;
    }
  },
  
  completeJob: async (jobId, completionDetails) => {
    try {
      console.log(`Debug - Completing job ${jobId}`);
      const response = await debugApiClient.post(`/jobs/${jobId}/complete`, completionDetails);
      return response.data;
    } catch (error) {
      console.error(`Debug - Error completing job:`, error);
      throw error;
    }
  }
};

// Debug technician service
export const debugTechnicianService = {
  getAll: async () => {
    try {
      console.log('Debug - Fetching all technicians');
      const response = await debugApiClient.get('/technicians');
      return response.data;
    } catch (error) {
      console.error('Debug - Error fetching technicians:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      console.log(`Debug - Fetching technician ${id}`);
      const response = await debugApiClient.get(`/technicians/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Debug - Error fetching technician ${id}:`, error);
      throw error;
    }
  }
};

// Debug parts service
export const debugPartsService = {
  getAll: async () => {
    try {
      console.log('Debug - Fetching all parts');
      const response = await debugApiClient.get('/parts');
      return response.data;
    } catch (error) {
      console.error('Debug - Error fetching parts:', error);
      throw error;
    }
  },
  
  getPartsNeedingReorder: async () => {
    try {
      console.log('Debug - Fetching parts needing reorder');
      const response = await debugApiClient.get('/parts/reorder');
      return response.data;
    } catch (error) {
      console.error('Debug - Error fetching parts needing reorder:', error);
      throw error;
    }
  },
  
  getByPartNumber: async (partNumber) => {
    try {
      console.log(`Debug - Fetching part ${partNumber}`);
      const response = await debugApiClient.get(`/parts/${partNumber}`);
      return response.data;
    } catch (error) {
      console.error(`Debug - Error fetching part ${partNumber}:`, error);
      throw error;
    }
  },

  updateInventory: async (partNumber, newQuantity) => {
    try {
      console.log(`Debug - Updating inventory for part ${partNumber} to ${newQuantity}`);
      const response = await debugApiClient.post('/parts/inventory', { partNumber, quantity: newQuantity });
      return response.data;
    } catch (error) {
      console.error(`Debug - Error updating inventory for part ${partNumber}:`, error);
      throw error;
    }
  }
};

// Debug invoice service
export const debugInvoiceService = {
  getAll: async () => {
    try {
      console.log('Debug - Fetching all invoices');
      const response = await debugApiClient.get('/invoices');
      return response.data;
    } catch (error) {
      console.error('Debug - Error fetching invoices:', error);
      throw error;
    }
  },
  
  getById: async (id) => {
    try {
      console.log(`Debug - Fetching invoice ${id}`);
      const response = await debugApiClient.get(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Debug - Error fetching invoice ${id}:`, error);
      throw error;
    }
  },
  
  subscribeToUpdates: (callback) => {
    // Mock subscription for testing
    console.log('Debug - Subscribing to invoice updates');
    return () => {
      console.log('Debug - Unsubscribing from invoice updates');
    };
  }
};

// Debug metrics service
export const debugMetricsService = {
  getByCustomerId: async (customerId) => {
    try {
      console.log(`Debug - Fetching modified metrics for customer ${customerId}`);
      
      // Use the API Gateway endpoint (Cognito ID token added by the interceptor)
      const response = await debugApiClient.get(`/metrics/${customerId}`);
      
      // If the API call fails, fall back to mock data
      if (!response || !response.data) {
        console.warn(`No data returned from metrics API for customer ${customerId}, using fallback data`);
        return generateMockMetrics(customerId);
      }
      
      return response.data;
    } catch (error) {
      console.error(`Debug - Error fetching metrics for customer ${customerId}:`, error);
      console.warn('Falling back to mock metrics data');
      return generateMockMetrics(customerId);
    }
  },
  
  subscribeToCustomerMetrics: (customerId, callback) => {
    console.log(`Debug - Subscribing to metrics updates for customer ${customerId}`);
    
    // Set up polling for real-time updates
    const intervalId = setInterval(async () => {
      try {
        const metrics = await debugMetricsService.getByCustomerId(customerId);
        callback(metrics);
      } catch (error) {
        console.error(`Error in metrics subscription for ${customerId}:`, error);
      }
    }, 30000); // Poll every 30 seconds
    
    // Return unsubscribe function
    return () => {
      console.log(`Debug - Unsubscribing from metrics updates for customer ${customerId}`);
      clearInterval(intervalId);
    };
  }
};

// Helper function to generate mock metrics data
function generateMockMetrics(customerId) {
  return {
    customerId,
    lastUpdated: new Date().toISOString(),
    temperature: {
      current: 72 + Math.random() * 10,
      setPoint: 72,
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        value: 72 + Math.sin(i / 3) * 5
      }))
    },
    humidity: {
      current: 45 + Math.random() * 10,
      setPoint: 45,
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        value: 45 + Math.sin(i / 4) * 8
      }))
    },
    energyUsage: {
      daily: 12 + Math.random() * 5,
      weekly: 85 + Math.random() * 20,
      monthly: 350 + Math.random() * 50,
      history: Array.from({ length: 30 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        value: 12 + Math.random() * 8
      }))
    },
    systemStatus: {
      overall: 'Healthy',
      components: {
        compressor: 'Healthy',
        fan: 'Healthy',
        filter: customerId === 'cust-003' ? 'Needs Replacement' : 'Healthy',
        thermostat: 'Healthy'
      },
      lastMaintenance: '2025-05-15',
      nextMaintenance: '2025-08-15'
    }
  };
}

// Export all debug services
export default {
  debugApiClient,
  debugCustomerService,
  debugJobService,
  debugTechnicianService,
  debugPartsService,
  debugMetricsService,
  debugInvoiceService
};
