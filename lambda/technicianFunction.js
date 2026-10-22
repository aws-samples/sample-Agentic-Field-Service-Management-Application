const AWS = require('aws-sdk');
const { withCors } = require('./wrapper/cors-wrapper');

// Initialize DynamoDB client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const TECHNICIANS_TABLE = process.env.TECHNICIANS_TABLE;

/**
 * Get all technicians from DynamoDB
 */
const getAllTechniciansHandler = async (event) => {
  try {
    const params = {
      TableName: TECHNICIANS_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error getting technicians:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting technicians', error: error.message })
    };
  }
};

/**
 * Get technician by ID from DynamoDB
 */
const getTechnicianByIdHandler = async (event) => {
  try {
    const technicianId = event.pathParameters.id;
    
    const params = {
      TableName: TECHNICIANS_TABLE,
      Key: {
        id: technicianId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Technician not found' })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error getting technician by ID:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting technician by ID', error: error.message })
    };
  }
};

// Export handlers with CORS wrapper
exports.getAllTechnicians = withCors(getAllTechniciansHandler);
exports.getTechnicianById = withCors(getTechnicianByIdHandler);
