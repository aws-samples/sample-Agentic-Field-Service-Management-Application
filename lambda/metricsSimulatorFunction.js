const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const { broadcastToSubscribers } = require('./websocketHandler');

// Configuration
const METRICS_TABLE = process.env.METRICS_TABLE;
const CUSTOMER_TABLE = process.env.CUSTOMER_TABLE;
const { resolveAllowedOrigin } = require('./wrapper/cors-wrapper');
const CLOUDFRONT_URL = resolveAllowedOrigin();
//const SIMULATOR_CONFIG_TABLE = 'fsm-simulator-config';
const CONFIG_ID = 'hvac-simulator-config';
const SIMULATOR_CONFIG_TABLE = process.env.SIMULATOR_CONFIG_TABLE;

// HVAC metrics to simulate
const HVAC_METRICS = [
  'temperature',
  'humidity',
  'airflow',
  'pressure',
  'energyUsage',
  'filterStatus'
];

// Generate random metrics for a customer
const generateRandomMetrics = (customerId) => {
  const timestamp = new Date().toISOString();
  
  // Generate random values for each metric
  const temperature = (68 + Math.random() * 10).toFixed(1); // 68-78°F
  const humidity = (30 + Math.random() * 30).toFixed(1); // 30-60%
  const airflow = (200 + Math.random() * 300).toFixed(0); // 200-500 CFM
  const pressure = (14 + Math.random() * 2).toFixed(2); // 14-16 PSI
  const energyUsage = (2 + Math.random() * 3).toFixed(2); // 2-5 kWh
  
  // Filter status degrades over time (simulate with random value)
  const filterStatus = Math.max(0, 100 - Math.floor(Math.random() * 5)).toFixed(0); // 0-100%
  
  return {
    customerId,
    timestamp,
    metrics: {
      temperature,
      humidity,
      airflow,
      pressure,
      energyUsage,
      filterStatus
    }
  };
};

// Check if simulator is enabled
const isSimulatorEnabled = async () => {
  try {
    const params = {
      TableName: SIMULATOR_CONFIG_TABLE,
      Key: {
        id: CONFIG_ID
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    return result.Item && result.Item.enabled === true;
  } catch (error) {
    console.error('Error checking simulator status:', error);
    return false;
  }
};

// Get all customers
const getCustomers = async () => {
  try {
    const params = {
      TableName: CUSTOMER_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
};

// Update metrics for a customer
const updateCustomerMetrics = async (metrics) => {
  try {
    const params = {
      TableName: METRICS_TABLE,
      Item: metrics
    };
    
    await dynamoDB.put(params).promise();
    console.log(`Updated metrics for customer ${metrics.customerId}`);
    return true;
  } catch (error) {
    console.error(`Error updating metrics for customer ${metrics.customerId}:`, error);
    return false;
  }
};

// Main Lambda handler
exports.handler = async (event) => {
  console.log('HVAC Metric Simulator triggered');
  
  // Check if simulator is enabled
  const enabled = await isSimulatorEnabled();
  if (!enabled) {
    console.log('Simulator is disabled. Exiting.');
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': CLOUDFRONT_URL,
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
      },
      body: JSON.stringify({ message: 'Simulator is disabled' })
    };
  }
  
  // Get all customers
  const customers = await getCustomers();
  if (customers.length === 0) {
    console.log('No customers found. Exiting.');
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Origin': CLOUDFRONT_URL,
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
      },
      body: JSON.stringify({ message: 'No customers found' })
    };
  }
  
  console.log(`Found ${customers.length} customers. Generating metrics...`);
  
  // Generate and update metrics for each customer
  const updatePromises = customers.map(async (customer) => {
    const metrics = generateRandomMetrics(customer.id);
    const success = await updateCustomerMetrics(metrics);
    
    // Broadcast update to WebSocket subscribers
    if (success) {
      await broadcastToSubscribers('metrics', {
        customerId: customer.id,
        metrics: metrics.metrics,
        timestamp: metrics.timestamp
      });
    }
    
    return success;
  });
  
  // Wait for all updates to complete
  await Promise.all(updatePromises);
  
  console.log('Metrics generation complete');
  
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Origin': CLOUDFRONT_URL,
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    },
    body: JSON.stringify({ 
      message: `Updated metrics for ${customers.length} customers`,
      timestamp: new Date().toISOString()
    })
  };
};
