const AWS = require('aws-sdk');
const { resolveAllowedOrigin } = require('./wrapper/cors-wrapper');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const PARTS_TABLE = process.env.PARTS_TABLE || 'FSM-Parts-prod';

// Function to get all parts from DynamoDB
exports.getAllParts = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Scan the parts table
    const params = {
      TableName: PARTS_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    console.log('DynamoDB scan result:', JSON.stringify(result, null, 2));
    
    // Return the parts with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error fetching parts from DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error fetching parts', error: error.message })
    };
  }
};

// Function to get a part by part number from DynamoDB
exports.getPartByNumber = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Get the part number from the path parameters
    const partNumber = event.pathParameters.partNumber;
    
    // Query the FSM-Parts table
    const params = {
      TableName: PARTS_TABLE,
      Key: {
        partNumber: partNumber
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    console.log('DynamoDB get result:', JSON.stringify(result, null, 2));
    
    // Check if the part exists
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({ message: 'Part not found' })
      };
    }
    
    // Return the part with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error fetching part from DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error fetching part', error: error.message })
    };
  }
};

// Function to get parts by HVAC model from DynamoDB
exports.getPartsByHvacModel = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Get the HVAC model from the path parameters
    const hvacModel = event.pathParameters.id;
    
    // Scan the FSM-Parts table with a filter for the HVAC model
    const params = {
      TableName: PARTS_TABLE,
      FilterExpression: 'contains(fitment, :hvacModel)',
      ExpressionAttributeValues: {
        ':hvacModel': hvacModel
      }
    };
    
    const result = await dynamoDB.scan(params).promise();
    console.log('DynamoDB scan result:', JSON.stringify(result, null, 2));
    
    // Return the parts with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error fetching parts from DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error fetching parts', error: error.message })
    };
  }
};

// Function to update part inventory in DynamoDB
exports.updatePartInventory = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    const { partNumber, quantityUsed } = requestBody;
    
    // Validate input
    if (!partNumber || !quantityUsed || quantityUsed <= 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ message: 'Invalid input. Part number and quantity used (> 0) are required.' })
      };
    }
    
    // Get the current inventory
    const getParams = {
      TableName: PARTS_TABLE,
      Key: {
        partNumber: partNumber
      }
    };
    
    const getResult = await dynamoDB.get(getParams).promise();
    
    // Check if the part exists
    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ message: 'Part not found' })
      };
    }
    
    // Check if there's enough inventory
    const currentInventory = getResult.Item.inventory;
    if (currentInventory < quantityUsed) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ 
          message: 'Insufficient inventory', 
          currentInventory, 
          quantityRequested: quantityUsed 
        })
      };
    }
    
    // Update the inventory
    const newInventory = currentInventory - quantityUsed;
    const updateParams = {
      TableName: PARTS_TABLE,
      Key: {
        partNumber: partNumber
      },
      UpdateExpression: 'SET inventory = :newInventory',
      ExpressionAttributeValues: {
        ':newInventory': newInventory
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await dynamoDB.update(updateParams).promise();
    console.log('DynamoDB update result:', JSON.stringify(updateResult, null, 2));
    
    // Return the updated part with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        message: 'Inventory updated successfully',
        part: updateResult.Attributes,
        quantityUsed,
        previousInventory: currentInventory,
        newInventory
      })
    };
  } catch (error) {
    console.error('Error updating part inventory in DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error updating part inventory', error: error.message })
    };
  }
};

// Function to get reorderable parts (low inventory)
exports.getReorderableParts = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({})
    };
  }
  
  try {
    // Get the threshold from query parameters or use default
    const threshold = event.queryStringParameters && event.queryStringParameters.threshold 
      ? parseInt(event.queryStringParameters.threshold) 
      : 10;
    
    // Scan the parts table
    const params = {
      TableName: PARTS_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    console.log('DynamoDB scan result:', JSON.stringify(result, null, 2));
    
    // Filter parts with low inventory
    const reorderableParts = result.Items.filter(part => part.inventory <= threshold);
    
    // Return the reorderable parts with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(reorderableParts)
    };
  } catch (error) {
    console.error('Error fetching reorderable parts:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error fetching reorderable parts', error: error.message })
    };
  }
};

// Function to reorder parts
exports.reorderParts = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({})
    };
  }
  
  try {
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    const { partNumber, quantity } = requestBody;
    
    // Validate input
    if (!partNumber || !quantity || quantity <= 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ message: 'Invalid input. Part number and quantity (> 0) are required.' })
      };
    }
    
    // Get the current part information
    const getParams = {
      TableName: PARTS_TABLE,
      Key: {
        partNumber: partNumber
      }
    };
    
    const getResult = await dynamoDB.get(getParams).promise();
    
    // Check if the part exists
    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({ message: 'Part not found' })
      };
    }
    
    // Update the inventory by adding the reordered quantity
    const currentInventory = getResult.Item.inventory;
    const newInventory = currentInventory + quantity;
    
    const updateParams = {
      TableName: PARTS_TABLE,
      Key: {
        partNumber: partNumber
      },
      UpdateExpression: 'SET inventory = :newInventory',
      ExpressionAttributeValues: {
        ':newInventory': newInventory
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await dynamoDB.update(updateParams).promise();
    console.log('DynamoDB update result:', JSON.stringify(updateResult, null, 2));
    
    // Return the updated part with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({
        message: 'Parts reordered successfully',
        part: updateResult.Attributes,
        quantityReordered: quantity,
        previousInventory: currentInventory,
        newInventory
      })
    };
  } catch (error) {
    console.error('Error reordering parts:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error reordering parts', error: error.message })
    };
  }
};
