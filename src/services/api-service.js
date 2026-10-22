import { API_CONFIG } from '../config/api-config';
import { getAuthHeaders } from '../utils/auth-headers';

/**
 * Service for making API requests with the signed-in user's Cognito ID token
 */
export const apiService = {
  /**
   * Make a GET request to the API
   * @param {string} endpoint - The API endpoint to call
   * @returns {Promise<any>} - The response data
   */
  get: async (endpoint) => {
    try {
      console.log('Making GET request to:', API_CONFIG.apiEndpoint + endpoint);
      const response = await fetch(`${API_CONFIG.apiEndpoint}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      
      if (!response.ok) {
        console.error('API request failed with status:', response.status);
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },
  
  /**
   * Make a POST request to the API
   * @param {string} endpoint - The API endpoint to call
   * @param {object} data - The data to send
   * @returns {Promise<any>} - The response data
   */
  post: async (endpoint, data) => {
    try {
      console.log('Making POST request to:', API_CONFIG.apiEndpoint + endpoint);
      console.log('Request data:', data);
      const response = await fetch(`${API_CONFIG.apiEndpoint}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        console.error('API request failed with status:', response.status);
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('API response data:', responseData);
      return responseData;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
};
