const AWS = require('aws-sdk');
const { corsHeaders: buildCorsHeaders } = require('./wrapper/cors-wrapper');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Configuration
const SIMULATOR_CONFIG_TABLE = process.env.SIMULATOR_CONFIG_TABLE;
const CONFIG_ID = 'hvac-simulator-config';

// CORS headers for all responses
const corsHeaders = buildCorsHeaders('GET,POST,DELETE,OPTIONS');

// Get simulator status
const getSimulatorStatus = async () => {
  try {
    const params = {
      TableName: SIMULATOR_CONFIG_TABLE,
      Key: {
        id: CONFIG_ID
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    return result.Item || { id: CONFIG_ID, enabled: false };
  } catch (error) {
    console.error('Error getting simulator status:', error);
    return { id: CONFIG_ID, enabled: false, error: error.message };
  }
};

// Update simulator status
const updateSimulatorStatus = async (enabled) => {
  try {
    const params = {
      TableName: SIMULATOR_CONFIG_TABLE,
      Item: {
        id: CONFIG_ID,
        enabled,
        lastUpdated: new Date().toISOString()
      }
    };
    
    await dynamoDB.put(params).promise();
    return { id: CONFIG_ID, enabled, success: true };
  } catch (error) {
    console.error('Error updating simulator status:', error);
    return { id: CONFIG_ID, enabled, success: false, error: error.message };
  }
};

// Main Lambda handler
exports.handler = async (event) => {
  console.log('Simulator Control function invoked with event:', JSON.stringify(event));
  
  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({})
    };
  }

  //const action = event.action || 'status';
  const action = event.httpMethod || 'GET';
  let response;
  
  switch (action) {
    case 'POST':
      response = await updateSimulatorStatus(true);
      break;
    case 'DELETE':
      response = await updateSimulatorStatus(false);
      break;
    case 'GET':
    default:
      response = await getSimulatorStatus();
      break;
  }
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(response)
  };
};
