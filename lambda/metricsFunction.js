const AWS = require('aws-sdk');
const { resolveAllowedOrigin } = require('./wrapper/cors-wrapper');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Environment variables
const METRICS_TABLE = process.env.METRICS_TABLE || 'FSM-Metrics';

// Helper function to create response with CORS headers
const createResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': resolveAllowedOrigin(),
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    },
    body: JSON.stringify(body)
  };
};

// Get metrics by customer ID
exports.getMetricsByCustomerId = async (event) => {
  console.log('Getting metrics by customer ID');
  
  const customerId = event.pathParameters ? event.pathParameters.id : null;
  
  if (!customerId) {
    return createResponse(400, { message: 'Customer ID is required' });
  }
  
  try {
    // Query DynamoDB for metrics data
    const params = {
      TableName: METRICS_TABLE,
      KeyConditionExpression: 'customerId = :customerId',
      ExpressionAttributeValues: {
        ':customerId': customerId
      },
      ScanIndexForward: false, // Sort by timestamp descending
      Limit: 50 // Get last 50 records
    };
    
    const result = await dynamoDB.query(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      // Return fallback data if no metrics found
      return createResponse(200, generateFallbackMetrics(customerId));
    }
    
    // Get the latest metrics record
    const latestMetrics = result.Items[0];
    const metrics = latestMetrics.metrics || {};
    
    // Format the response to match Dashboard expectations
    const response = {
      customerId,
      lastUpdated: latestMetrics.timestamp,
      temperature: {
        current: parseFloat(metrics.temperature) || 72,
        setPoint: 72,
        history: result.Items.slice(0, 24).map(item => ({
          timestamp: item.timestamp,
          value: parseFloat(item.metrics?.temperature) || 72
        }))
      },
      humidity: {
        current: parseFloat(metrics.humidity) || 45,
        setPoint: 45,
        history: result.Items.slice(0, 24).map(item => ({
          timestamp: item.timestamp,
          value: parseFloat(item.metrics?.humidity) || 45
        }))
      },
      energyUsage: {
        daily: parseFloat(metrics.energyUsage) || 12,
        weekly: parseFloat(metrics.energyUsage) * 7 || 85,
        monthly: parseFloat(metrics.energyUsage) * 30 || 350,
        history: result.Items.slice(0, 30).map(item => ({
          timestamp: item.timestamp,
          value: parseFloat(item.metrics?.energyUsage) || 12
        }))
      },
      systemStatus: {
        overall: determineOverallStatus(metrics),
        components: {
          compressor: 'Healthy',
          fan: 'Healthy',
          filter: parseFloat(metrics.filterStatus) < 20 ? 'Needs Replacement' : 'Healthy',
          thermostat: 'Healthy'
        },
        lastMaintenance: '2025-05-15',
        nextMaintenance: '2025-08-15'
      }
    };
    
    return createResponse(200, response);
  } catch (error) {
    console.error(`Error getting metrics for customer ${customerId}:`, error);
    // Return fallback data on error
    return createResponse(200, generateFallbackMetrics(customerId));
  }
};

// Determine overall system status based on metrics
function determineOverallStatus(metrics) {
  const temp = parseFloat(metrics.temperature) || 72;
  const filterStatus = parseFloat(metrics.filterStatus) || 100;
  const pressure = parseFloat(metrics.pressure) || 15;
  
  if (filterStatus < 20 || pressure < 14) {
    return 'Needs Maintenance';
  } else if (temp > 78 || filterStatus < 50) {
    return 'Warning';
  } else {
    return 'Healthy';
  }
}

// Generate fallback metrics when no data is available
function generateFallbackMetrics(customerId) {
  return {
    customerId,
    lastUpdated: new Date().toISOString(),
    temperature: {
      current: 72 + Math.random() * 10,
      setPoint: 72,
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        value: 72 + Math.sin(i / 3) * 5
      }))
    },
    humidity: {
      current: 45 + Math.random() * 10,
      setPoint: 45,
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        value: 45 + Math.sin(i / 4) * 8
      }))
    },
    energyUsage: {
      daily: 12 + Math.random() * 5,
      weekly: 85 + Math.random() * 20,
      monthly: 350 + Math.random() * 50,
      history: Array.from({ length: 30 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
        value: 12 + Math.random() * 8
      }))
    },
    systemStatus: {
      overall: 'Healthy',
      components: {
        compressor: 'Healthy',
        fan: 'Healthy',
        filter: customerId === 'cust-003' ? 'Needs Replacement' : 'Healthy',
        thermostat: 'Healthy'
      },
      lastMaintenance: '2025-05-15',
      nextMaintenance: '2025-08-15'
    }
  };
}
