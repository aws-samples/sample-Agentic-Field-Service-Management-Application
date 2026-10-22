const AWS = require('aws-sdk');
const { withCors } = require('./wrapper/cors-wrapper');

// Initialize DynamoDB client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE || 'FSM-Customers-prod';

/**
 * Get all customers from DynamoDB
 */
const getAllCustomersHandler = async (event) => {
  console.log('getAllCustomersHandler: Event received', JSON.stringify(event));
  console.log('getAllCustomersHandler: Using table', CUSTOMERS_TABLE);
  
  try {
    const params = {
      TableName: CUSTOMERS_TABLE
    };
    
    console.log('getAllCustomersHandler: Scanning table with params', JSON.stringify(params));
    const result = await dynamoDB.scan(params).promise();
    console.log('getAllCustomersHandler: Scan result', JSON.stringify(result));
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error getting customers:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting customers', error: error.message })
    };
  }
};

/**
 * Get customer by ID from DynamoDB
 */
const getCustomerByIdHandler = async (event) => {
  console.log('getCustomerByIdHandler: Event received', JSON.stringify(event));
  
  try {
    const customerId = event.pathParameters.id;
    console.log('getCustomerByIdHandler: Looking up customer with ID', customerId);
    
    const params = {
      TableName: CUSTOMERS_TABLE,
      Key: {
        id: customerId
      }
    };
    
    console.log('getCustomerByIdHandler: Getting item with params', JSON.stringify(params));
    const result = await dynamoDB.get(params).promise();
    console.log('getCustomerByIdHandler: Get result', JSON.stringify(result));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Customer not found' })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error getting customer by ID:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting customer by ID', error: error.message })
    };
  }
};

/**
 * Update customer in DynamoDB
 */
const updateCustomerHandler = async (event) => {
  console.log('updateCustomerHandler: Event received', JSON.stringify(event));
  
  try {
    const customerId = event.pathParameters.id;
    const body = JSON.parse(event.body);
    console.log('updateCustomerHandler: Updating customer with ID', customerId);
    console.log('updateCustomerHandler: Update data', JSON.stringify(body));
    
    const params = {
      TableName: CUSTOMERS_TABLE,
      Key: {
        id: customerId
      },
      UpdateExpression: 'set #name = :name, address = :address, phone = :phone, email = :email, hvacSystemType = :hvacSystemType, lastServiceDate = :lastServiceDate, nextServiceDate = :nextServiceDate, status = :status',
      ExpressionAttributeNames: {
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':name': body.name,
        ':address': body.address,
        ':phone': body.phone,
        ':email': body.email,
        ':hvacSystemType': body.hvacSystemType,
        ':lastServiceDate': body.lastServiceDate,
        ':nextServiceDate': body.nextServiceDate,
        ':status': body.status
      },
      ReturnValues: 'ALL_NEW'
    };
    
    console.log('updateCustomerHandler: Updating item with params', JSON.stringify(params));
    const result = await dynamoDB.update(params).promise();
    console.log('updateCustomerHandler: Update result', JSON.stringify(result));
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error('Error updating customer:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error updating customer', error: error.message })
    };
  }
};

// Export handlers with CORS wrapper
exports.getAllCustomers = withCors(getAllCustomersHandler);
exports.getCustomerById = withCors(getCustomerByIdHandler);
exports.updateCustomer = withCors(updateCustomerHandler);
