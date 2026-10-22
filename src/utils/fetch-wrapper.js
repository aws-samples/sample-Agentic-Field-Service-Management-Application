import { API_CONFIG } from '../config/api-config';
import { getAuthHeaders } from './auth-headers';

// Store the original fetch function
const originalFetch = window.fetch;

// Override the fetch function to add the Cognito ID token
window.fetch = function(url, options = {}) {
  // Only add the token for API Gateway requests
  if (API_CONFIG.apiEndpoint && typeof url === 'string' && url.includes(API_CONFIG.apiEndpoint.replace('https://', ''))) {
    const newOptions = {
      ...options,
      headers: {
        ...options.headers,
        ...getAuthHeaders()
      }
    };
    
    return originalFetch(url, newOptions);
  }
  
  // Use the original fetch for other requests
  return originalFetch(url, options);
};

export default window.fetch;
