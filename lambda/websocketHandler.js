const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// The WebSocket management endpoint is injected by CloudFormation as
// WEBSOCKET_ENDPOINT (wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>).
// It is never guessed from naming conventions.
function resolveManagementEndpoint() {
  const configured = (process.env.WEBSOCKET_ENDPOINT || '').trim();
  if (!/^wss:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com(\.cn)?\/[A-Za-z0-9_-]+$/.test(configured)) {
    return null;
  }
  return configured.replace(/^wss:\/\//, 'https://');
}

let apiGatewayManagementApi = null;
function managementClient() {
  if (apiGatewayManagementApi) return apiGatewayManagementApi;
  const endpoint = resolveManagementEndpoint();
  if (!endpoint) {
    throw new Error('WEBSOCKET_ENDPOINT is not configured; refusing to broadcast');
  }
  apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({ endpoint });
  return apiGatewayManagementApi;
}

// WebSocket connections table
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

// Handle WebSocket connect
exports.handleConnect = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    
    const params = {
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        timestamp: Date.now(),
        subscriptions: [] // Initially not subscribed to any topics
      }
    };
    
    await dynamoDB.put(params).promise();
    
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Error handling WebSocket connect:', error);
    return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(error) };
  }
};

// Handle WebSocket disconnect
exports.handleDisconnect = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    
    const params = {
      TableName: CONNECTIONS_TABLE,
      Key: {
        connectionId
      }
    };
    
    await dynamoDB.delete(params).promise();
    
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Error handling WebSocket disconnect:', error);
    return { statusCode: 500, body: 'Failed to disconnect: ' + JSON.stringify(error) };
  }
};

// Handle WebSocket messages
exports.handleMessage = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body);
    const { action } = body;
    
    switch (action) {
      case 'subscribe':
        return await handleSubscribe(connectionId, body);
      case 'unsubscribe':
        return await handleUnsubscribe(connectionId, body);
      default:
        return { statusCode: 400, body: 'Unknown action' };
    }
  } catch (error) {
    console.error('Error handling WebSocket message:', error);
    return { statusCode: 500, body: 'Error processing message: ' + JSON.stringify(error) };
  }
};

// Handle subscribe action
const handleSubscribe = async (connectionId, body) => {
  try {
    const { topics } = body;
    
    if (!Array.isArray(topics)) {
      return { statusCode: 400, body: 'Topics must be an array' };
    }
    
    // Get current subscriptions
    const getParams = {
      TableName: CONNECTIONS_TABLE,
      Key: {
        connectionId
      }
    };
    
    const result = await dynamoDB.get(getParams).promise();
    
    if (!result.Item) {
      return { statusCode: 404, body: 'Connection not found' };
    }
    
    // Add new topics to subscriptions (avoid duplicates)
    const currentSubscriptions = result.Item.subscriptions || [];
    const newSubscriptions = [...new Set([...currentSubscriptions, ...topics])];
    
    // Update subscriptions
    const updateParams = {
      TableName: CONNECTIONS_TABLE,
      Key: {
        connectionId
      },
      UpdateExpression: 'SET subscriptions = :subs',
      ExpressionAttributeValues: {
        ':subs': newSubscriptions
      }
    };
    
    await dynamoDB.update(updateParams).promise();
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: 'Subscribed to topics', 
        topics: newSubscriptions 
      }) 
    };
  } catch (error) {
    console.error('Error handling subscribe:', error);
    return { statusCode: 500, body: 'Error subscribing: ' + JSON.stringify(error) };
  }
};

// Handle unsubscribe action
const handleUnsubscribe = async (connectionId, body) => {
  try {
    const { topics } = body;
    
    if (!Array.isArray(topics)) {
      return { statusCode: 400, body: 'Topics must be an array' };
    }
    
    // Get current subscriptions
    const getParams = {
      TableName: CONNECTIONS_TABLE,
      Key: {
        connectionId
      }
    };
    
    const result = await dynamoDB.get(getParams).promise();
    
    if (!result.Item) {
      return { statusCode: 404, body: 'Connection not found' };
    }
    
    // Remove topics from subscriptions
    const currentSubscriptions = result.Item.subscriptions || [];
    const newSubscriptions = currentSubscriptions.filter(topic => !topics.includes(topic));
    
    // Update subscriptions
    const updateParams = {
      TableName: CONNECTIONS_TABLE,
      Key: {
        connectionId
      },
      UpdateExpression: 'SET subscriptions = :subs',
      ExpressionAttributeValues: {
        ':subs': newSubscriptions
      }
    };
    
    await dynamoDB.update(updateParams).promise();
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: 'Unsubscribed from topics', 
        topics: newSubscriptions 
      }) 
    };
  } catch (error) {
    console.error('Error handling unsubscribe:', error);
    return { statusCode: 500, body: 'Error unsubscribing: ' + JSON.stringify(error) };
  }
};

// Broadcast message to subscribed connections
exports.broadcastToSubscribers = async (topic, data) => {
  try {
    // Get all connections subscribed to this topic
    const scanParams = {
      TableName: CONNECTIONS_TABLE,
      FilterExpression: 'contains(subscriptions, :topic)',
      ExpressionAttributeValues: {
        ':topic': topic
      }
    };
    
    const connections = await dynamoDB.scan(scanParams).promise();
    
    if (!connections.Items || connections.Items.length === 0) {
      console.log(`No connections subscribed to topic: ${topic}`);
      return;
    }
    
    const message = JSON.stringify({
      type: 'update',
      topic,
      data,
      timestamp: new Date().toISOString()
    });
    
    // Send message to all subscribed connections
    const sendPromises = connections.Items.map(async (connection) => {
      try {
        await managementClient().postToConnection({
          ConnectionId: connection.connectionId,
          Data: message
        }).promise();
      } catch (error) {
        if (error.statusCode === 410) {
          // Connection is stale, remove it
          await dynamoDB.delete({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: connection.connectionId }
          }).promise();
        } else {
          console.error(`Error sending to connection ${connection.connectionId}:`, error);
        }
      }
    });
    
    await Promise.all(sendPromises);
    console.log(`Broadcasted to ${connections.Items.length} connections for topic: ${topic}`);
  } catch (error) {
    console.error('Error broadcasting message:', error);
  }
};
