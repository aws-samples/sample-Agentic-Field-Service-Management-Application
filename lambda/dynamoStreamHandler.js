const { broadcastToSubscribers } = require('./websocketHandler');

exports.handler = async (event) => {
  console.log('DynamoDB Stream event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    try {
      const { eventName, dynamodb } = record;
      
      // Only process INSERT and MODIFY events
      if (eventName === 'INSERT' || eventName === 'MODIFY') {
        const tableName = record.eventSourceARN.split('/')[1];
        
        // Handle different table updates
        switch (true) {
          case tableName.includes('Metrics'):
            await handleMetricsUpdate(record);
            break;
          case tableName.includes('Jobs'):
            await handleJobsUpdate(record);
            break;
          case tableName.includes('Customers'):
            await handleCustomersUpdate(record);
            break;
          default:
            console.log(`Unhandled table: ${tableName}`);
        }
      }
    } catch (error) {
      console.error('Error processing stream record:', error);
    }
  }
  
  return { statusCode: 200 };
};

// Handle metrics table updates
async function handleMetricsUpdate(record) {
  const newImage = record.dynamodb.NewImage;
  
  if (newImage) {
    const customerId = newImage.customerId?.S;
    const timestamp = newImage.timestamp?.S;
    const metrics = newImage.metrics?.M;
    
    if (customerId && metrics) {
      // Convert DynamoDB format to regular object
      const metricsData = {
        temperature: metrics.temperature?.S,
        humidity: metrics.humidity?.S,
        energyUsage: metrics.energyUsage?.S,
        filterStatus: metrics.filterStatus?.S,
        pressure: metrics.pressure?.S,
        airflow: metrics.airflow?.S
      };
      
      await broadcastToSubscribers('metrics', {
        customerId,
        metrics: metricsData,
        timestamp
      });
    }
  }
}

// Handle jobs table updates
async function handleJobsUpdate(record) {
  const newImage = record.dynamodb.NewImage;
  
  if (newImage) {
    const jobData = {
      id: newImage.id?.S,
      customerId: newImage.customerId?.S,
      status: newImage.status?.S,
      assignedTechnician: newImage.assignedTechnician?.S
    };
    
    await broadcastToSubscribers('jobs', jobData);
  }
}

// Handle customers table updates
async function handleCustomersUpdate(record) {
  const newImage = record.dynamodb.NewImage;
  
  if (newImage) {
    const customerData = {
      id: newImage.id?.S,
      name: newImage.name?.S,
      status: newImage.status?.S
    };
    
    await broadcastToSubscribers('customers', customerData);
  }
}
