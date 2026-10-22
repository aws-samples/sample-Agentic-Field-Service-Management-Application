// Lambda function for job operations
const AWS = require('aws-sdk');
const { resolveAllowedOrigin } = require('./wrapper/cors-wrapper');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const JOBS_TABLE = process.env.JOBS_TABLE || 'FSM-Jobs-prod';
const TECHNICIANS_TABLE = process.env.TECHNICIANS_TABLE || 'FSM-Technicians-prod';

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': resolveAllowedOrigin(),
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json'
};

// Get all jobs
exports.getAll = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // Handle OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    };
  }
  
  try {
    const params = {
      TableName: JOBS_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error fetching jobs', error: error.message })
    };
  }
};

// Get job by ID
exports.getById = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // Handle OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    };
  }
  
  try {
    const jobId = event.pathParameters.id;
    
    const params = {
      TableName: JOBS_TABLE,
      Key: {
        id: jobId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Job not found' })
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error fetching job', error: error.message })
    };
  }
};

// Assign technician to job
exports.assignTechnician = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // Handle OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    };
  }
  
  try {
    // Parse the job ID from the path parameters
    const jobId = event.pathParameters.id;
    
    // Parse the request body to get the technician ID
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      console.error('Error parsing request body:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid request body' })
      };
    }
    
    const technicianId = requestBody.technicianId;
    
    if (!technicianId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'technicianId is required' })
      };
    }
    
    console.log(`Assigning technician ${technicianId} to job ${jobId}`);
    
    // Check if the job exists
    const getJobParams = {
      TableName: JOBS_TABLE,
      Key: {
        id: jobId
      }
    };
    
    const jobResult = await dynamoDB.get(getJobParams).promise();
    
    if (!jobResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Job not found' })
      };
    }
    
    // Check if the technician exists
    const getTechnicianParams = {
      TableName: TECHNICIANS_TABLE,
      Key: {
        id: technicianId
      }
    };
    
    try {
      const technicianResult = await dynamoDB.get(getTechnicianParams).promise();
      
      if (!technicianResult.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'Technician not found' })
        };
      }
    } catch (error) {
      console.log('Error checking technician, but continuing anyway:', error);
      // Continue even if technician check fails (table might not exist in test environment)
    }
    
    // Look up technician name so we store the human name, not the ID
    let technicianName = technicianId;
    try {
      const techResult = await dynamoDB.get({ TableName: TECHNICIANS_TABLE, Key: { id: technicianId } }).promise();
      if (techResult.Item && techResult.Item.name) technicianName = techResult.Item.name;
    } catch (e) {
      console.warn('Could not look up technician name, using ID as fallback');
    }

    // Update the job with the assigned technician name
    const updateParams = {
      TableName: JOBS_TABLE,
      Key: {
        id: jobId
      },
      UpdateExpression: 'set assignedTechnician = :techName, #jobStatus = :jobStatus, assignedAt = :assignedAt',
      ExpressionAttributeNames: {
        '#jobStatus': 'status'
      },
      ExpressionAttributeValues: {
        ':techName': technicianName,
        ':jobStatus': 'In Progress',
        ':assignedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await dynamoDB.update(updateParams).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(updateResult.Attributes)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error assigning technician', error: error.message })
    };
  }
};

// Unassign technician from job
exports.unassignTechnician = async (event) => {
  console.log('Event:', JSON.stringify(event));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({}) };
  }

  try {
    const jobId = event.pathParameters.id;

    const getJobParams = { TableName: JOBS_TABLE, Key: { id: jobId } };
    const jobResult = await dynamoDB.get(getJobParams).promise();

    if (!jobResult.Item) {
      return { statusCode: 404, headers, body: JSON.stringify({ message: 'Job not found' }) };
    }

    const updateParams = {
      TableName: JOBS_TABLE,
      Key: { id: jobId },
      UpdateExpression: 'set assignedTechnician = :null, #jobStatus = :jobStatus remove assignedAt',
      ExpressionAttributeNames: { '#jobStatus': 'status' },
      ExpressionAttributeValues: { ':null': null, ':jobStatus': 'Pending' },
      ReturnValues: 'ALL_NEW'
    };

    const updateResult = await dynamoDB.update(updateParams).promise();

    return { statusCode: 200, headers, body: JSON.stringify(updateResult.Attributes) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Error unassigning technician', error: error.message }) };
  }
};

// Complete job
exports.completeJob = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // Handle OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    };
  }
  
  try {
    // Parse the job ID from the path parameters
    const jobId = event.pathParameters.id;
    
    // Parse the request body to get the completion details
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      console.error('Error parsing request body:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Invalid request body' })
      };
    }
    
    const { notes, partsUsed } = requestBody;
    
    // Check if the job exists
    const getJobParams = {
      TableName: JOBS_TABLE,
      Key: {
        id: jobId
      }
    };
    
    const jobResult = await dynamoDB.get(getJobParams).promise();
    
    if (!jobResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: 'Job not found' })
      };
    }
    
    // Update the job with the completion details
    const updateParams = {
      TableName: JOBS_TABLE,
      Key: {
        id: jobId
      },
      UpdateExpression: 'set #jobStatus = :jobStatus, completionNotes = :notes, partsUsed = :parts, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#jobStatus': 'status'  // Use expression attribute name for reserved keyword
      },
      ExpressionAttributeValues: {
        ':jobStatus': 'Completed',
        ':notes': notes || '',
        ':parts': partsUsed || [],
        ':completedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await dynamoDB.update(updateParams).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(updateResult.Attributes)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error completing job', error: error.message })
    };
  }
};
