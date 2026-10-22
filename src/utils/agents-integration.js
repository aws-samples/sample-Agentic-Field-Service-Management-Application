/**
 * Integration with FSM Bedrock Agents
 * This file provides functions to interact with the FSM Bedrock agents
 */

// import { API } from 'aws-amplify';
import axios from 'axios';
import { getApiConfig } from '../config/api-config';
import { getAuthHeaders } from './auth-headers';

const apiConfig = getApiConfig();

/**
 * Invoke the Orchestrator agent to coordinate a workflow
 * @param {string} workflowType - Type of workflow to coordinate
 * @param {object} workflowData - Data needed for the workflow
 * @returns {Promise} - Promise with the workflow results
 */
export const coordinateWorkflow = async (workflowType, workflowData) => {
  try {
    const response = await axios.post(`${apiConfig.apiEndpoint}/agents/orchestrator`, {
      action: 'coordinate_multi_agent_workflow',
      parameters: {
        workflow_type: workflowType,
        workflow_data: workflowData
      }
    }, {
      headers: getAuthHeaders()
    });
    
    return response.data;
  } catch (error) {
    console.error('Error coordinating workflow:', error);
    throw error;
  }
};

/**
 * Route a request to the appropriate agent through the Orchestrator
 * @param {string} requestType - Type of request (monitoring, inventory, scheduling, etc.)
 * @param {object} requestData - Data associated with the request
 * @returns {Promise} - Promise with the agent response
 */
export const routeAgentRequest = async (requestType, requestData) => {
  try {
    const response = await axios.post(`${apiConfig.apiEndpoint}/agents/orchestrator`, {
      action: 'route_request',
      parameters: {
        request_type: requestType,
        request_data: requestData
      }
    }, {
      headers: getAuthHeaders()
    });
    
    return response.data;
  } catch (error) {
    console.error('Error routing agent request:', error);
    throw error;
  }
};

/**
 * Get system status from the HVAC Monitoring agent
 * @param {string} systemId - ID of the HVAC system
 * @returns {Promise} - Promise with the system status
 */
export const getSystemStatus = async (systemId) => {
  return routeAgentRequest('monitoring', {
    action: 'get_system_status',
    system_id: systemId
  });
};

/**
 * Check parts availability from the Parts Inventory agent
 * @param {Array} parts - List of parts to check
 * @returns {Promise} - Promise with the parts availability
 */
export const checkPartsAvailability = async (parts) => {
  return routeAgentRequest('inventory', {
    action: 'check_parts_availability',
    parts: parts
  });
};

/**
 * Schedule a service call using the Technician Scheduling agent
 * @param {string} customerId - ID of the customer
 * @param {string} systemId - ID of the HVAC system
 * @param {Array} requiredParts - List of required parts
 * @param {string} urgency - Urgency level of the service call
 * @param {string} preferredDate - Preferred date for the job (ISO format)
 * @returns {Promise} - Promise with the scheduled appointment
 */
export const scheduleServiceCall = async (customerId, systemId, requiredParts, urgency, preferredDate) => {
  return routeAgentRequest('scheduling', {
    action: 'schedule_service_call',
    customer_id: customerId,
    system_id: systemId,
    required_parts: requiredParts,
    urgency: urgency,
    preferred_date: preferredDate
  });
};

/**
 * Generate an invoice using the Billing & Invoicing agent
 * @param {string} customerId - ID of the customer
 * @param {object} serviceDetails - Details of the service provided
 * @param {Array} partsUsed - List of parts used with quantities
 * @param {number} laborHours - Number of labor hours
 * @returns {Promise} - Promise with the generated invoice
 */
export const generateInvoice = async (customerId, serviceDetails, partsUsed, laborHours) => {
  return routeAgentRequest('billing', {
    action: 'generate_invoice',
    customer_id: customerId,
    service_details: serviceDetails,
    parts_used: partsUsed,
    labor_hours: laborHours
  });
};

/**
 * Prepare service documents using the Technical Documentation agent
 * @param {string} systemId - ID of the HVAC system
 * @param {string} issueType - Type of issue to address
 * @returns {Promise} - Promise with the service documents
 */
export const prepareServiceDocuments = async (systemId, issueType) => {
  return routeAgentRequest('documentation', {
    action: 'prepare_service_documents',
    system_id: systemId,
    issue_type: issueType
  });
};

/**
 * Verify a customer using the Customer Authentication agent
 * NOTE: the agent's verification tool is a STUB that performs no identity check (threat T10).
 * @param {string} customerId - ID of the customer to verify
 * @param {object} verificationData - Data used for verification (optional)
 * @returns {Promise} - Promise with the verification result
 */
export const verifyCustomer = async (customerId, verificationData) => {
  return routeAgentRequest('auth', {
    action: 'verify_customer', // wire field kept unchanged; not the Python tool name
    customer_id: customerId,
    verification_data: verificationData
  });
};

/**
 * Send a notification to a customer using the Customer Communication agent
 * @param {string} customerId - ID of the customer
 * @param {string} notificationType - Type of notification (email, sms, app)
 * @param {string} subject - Subject of the notification
 * @param {string} message - Message content
 * @returns {Promise} - Promise with the notification result
 */
export const sendCustomerNotification = async (customerId, notificationType, subject, message) => {
  return routeAgentRequest('customer_comm', {
    action: 'send_notification',
    customer_id: customerId,
    notification_type: notificationType,
    subject: subject,
    message: message
  });
};

/**
 * Initiate a service call workflow
 * @param {string} customerId - ID of the customer
 * @param {string} systemId - ID of the HVAC system
 * @returns {Promise} - Promise with the workflow results
 */
export const initiateServiceCallWorkflow = async (customerId, systemId) => {
  return coordinateWorkflow('service_call', {
    customer_id: customerId,
    system_id: systemId
  });
};

/**
 * Complete a maintenance workflow
 * @param {string} customerId - ID of the customer
 * @param {string} systemId - ID of the HVAC system
 * @param {string} technicianId - ID of the technician
 * @param {string} appointmentId - ID of the appointment
 * @param {Array} partsUsed - List of parts used
 * @param {object} serviceDetails - Details of the service performed
 * @param {number} laborHours - Number of labor hours
 * @returns {Promise} - Promise with the workflow results
 */
export const completeMaintenanceWorkflow = async (customerId, systemId, technicianId, appointmentId, partsUsed, serviceDetails, laborHours) => {
  return coordinateWorkflow('maintenance_completion', {
    customer_id: customerId,
    system_id: systemId,
    technician_id: technicianId,
    appointment_id: appointmentId,
    parts_used: partsUsed,
    service_details: serviceDetails,
    labor_hours: laborHours
  });
};

export default {
  coordinateWorkflow,
  routeAgentRequest,
  getSystemStatus,
  checkPartsAvailability,
  scheduleServiceCall,
  generateInvoice,
  prepareServiceDocuments,
  verifyCustomer,
  sendCustomerNotification,
  initiateServiceCallWorkflow,
  completeMaintenanceWorkflow
};
