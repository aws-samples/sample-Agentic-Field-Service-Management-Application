const AWS = require('aws-sdk');
const { resolveAllowedOrigin } = require('./wrapper/cors-wrapper');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const INVOICES_TABLE = process.env.INVOICES_TABLE || 'FSM-Invoices-prod';

// Function to get all invoices from DynamoDB
exports.getAllInvoices = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Scan the invoices table
    const params = {
      TableName: INVOICES_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    console.log('DynamoDB scan result:', JSON.stringify(result, null, 2));
    
    // Return the invoices with CORS headers
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
    console.error('Error fetching invoices from DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error fetching invoices', error: error.message })
    };
  }
};

// Function to get invoices by customer ID from DynamoDB
exports.getInvoicesByCustomerId = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Get the customer ID from the path parameters
    const customerId = event.pathParameters.customerId;
    
    // Query the FSM-Invoices table using a scan with filter
    const params = {
      TableName: INVOICES_TABLE,
      FilterExpression: 'customerId = :customerId',
      ExpressionAttributeValues: {
        ':customerId': customerId
      }
    };
    
    const result = await dynamoDB.scan(params).promise();
    console.log('DynamoDB scan result:', JSON.stringify(result, null, 2));
    
    // Return the invoices with CORS headers
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
    console.error('Error fetching invoices from DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error fetching invoices', error: error.message })
    };
  }
};

// Function to get an invoice by ID from DynamoDB
exports.getInvoiceById = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Get the invoice ID from the path parameters
    const invoiceId = event.pathParameters.id;
    
    // Query the FSM-Invoices table
    const params = {
      TableName: INVOICES_TABLE,
      Key: {
        id: invoiceId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    console.log('DynamoDB get result:', JSON.stringify(result, null, 2));
    
    // Check if the invoice exists
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({ message: 'Invoice not found' })
      };
    }
    
    // Return the invoice with CORS headers
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
    console.error('Error fetching invoice from DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error fetching invoice', error: error.message })
    };
  }
};

// Function to create a new invoice in DynamoDB
exports.createInvoice = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    
    // Generate a new invoice ID if not provided
    if (!requestBody.id) {
      const timestamp = new Date().getTime();
      requestBody.id = `inv-${timestamp}`;
    }
    
    // Generate an invoice number if not provided
    if (!requestBody.invoiceNumber) {
      const currentYear = new Date().getFullYear();
      const invoiceCount = Math.floor(Math.random() * 1000) + 1; // This should be replaced with a proper sequence
      requestBody.invoiceNumber = `INV-${currentYear}-${invoiceCount.toString().padStart(3, '0')}`;
    }
    
    // Put the invoice in DynamoDB
    const params = {
      TableName: INVOICES_TABLE,
      Item: requestBody
    };
    
    await dynamoDB.put(params).promise();
    console.log('Invoice created successfully:', requestBody);
    
    // Return the created invoice with CORS headers
    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify(requestBody)
    };
  } catch (error) {
    console.error('Error creating invoice in DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error creating invoice', error: error.message })
    };
  }
};

// Function to update an invoice in DynamoDB
exports.updateInvoice = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Get the invoice ID from the path parameters
    const invoiceId = event.pathParameters.id;
    
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    
    // Create update expression and attribute values
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    // Process each field in the request body
    Object.keys(requestBody).forEach(key => {
      // Skip the ID field as it's the primary key
      if (key !== 'id') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = requestBody[key];
      }
    });
    
    // If there are no fields to update, return an error
    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'PUT,OPTIONS'
        },
        body: JSON.stringify({ message: 'No fields to update' })
      };
    }
    
    // Create the update expression
    const updateExpression = 'SET ' + updateExpressions.join(', ');
    
    // Update the invoice in DynamoDB
    const params = {
      TableName: INVOICES_TABLE,
      Key: {
        id: invoiceId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(params).promise();
    console.log('DynamoDB update result:', JSON.stringify(result, null, 2));
    
    // Return the updated invoice with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'PUT,OPTIONS'
      },
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error('Error updating invoice in DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'PUT,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error updating invoice', error: error.message })
    };
  }
};

// Function to delete an invoice from DynamoDB
exports.deleteInvoice = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Get the invoice ID from the path parameters
    const invoiceId = event.pathParameters.id;
    
    // Delete the invoice from DynamoDB
    const params = {
      TableName: INVOICES_TABLE,
      Key: {
        id: invoiceId
      },
      ReturnValues: 'ALL_OLD'
    };
    
    const result = await dynamoDB.delete(params).promise();
    console.log('DynamoDB delete result:', JSON.stringify(result, null, 2));
    
    // Check if the invoice existed
    if (!result.Attributes) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': resolveAllowedOrigin(),
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'DELETE,OPTIONS'
        },
        body: JSON.stringify({ message: 'Invoice not found' })
      };
    }
    
    // Return success with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'DELETE,OPTIONS'
      },
      body: JSON.stringify({ message: 'Invoice deleted successfully', deletedInvoice: result.Attributes })
    };
  } catch (error) {
    console.error('Error deleting invoice from DynamoDB:', error);
    
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': resolveAllowedOrigin(),
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'DELETE,OPTIONS'
      },
      body: JSON.stringify({ message: 'Error deleting invoice', error: error.message })
    };
  }
};
