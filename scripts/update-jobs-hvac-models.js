#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  ScanCommand,
  UpdateCommand 
} = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: 'us-west-2' });
const docClient = DynamoDBDocumentClient.from(client);

// Map of customer IDs to HVAC models
const customerHvacModels = {
  'cust-001': 'Carrier Infinity 98',
  'cust-002': 'Trane XL18i',
  'cust-003': 'Lennox XC25',
  'cust-004': 'Rheem Prestige RA20',
  'cust-005': 'Carrier Infinity 98',
  'cust-006': 'Trane XL18i',
  'cust-007': 'Lennox XC25'
};

// Function to update all jobs with HVAC model information
const updateJobsWithHvacModels = async () => {
  try {
    console.log('Scanning FSM-Jobs table...');
    
    // Scan the table to get all jobs
    const scanParams = {
      TableName: 'FSM-Jobs'
    };
    
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    console.log(`Found ${scanResult.Items.length} jobs to update.`);
    
    // Update each job with HVAC model information
    for (const job of scanResult.Items) {
      const jobId = job.id;
      const customerId = job.customerId;
      
      if (!customerId) {
        console.log(`Job ${jobId} has no customerId, skipping.`);
        continue;
      }
      
      const hvacModel = customerHvacModels[customerId];
      
      if (!hvacModel) {
        console.log(`No HVAC model found for customer ${customerId}, skipping job ${jobId}.`);
        continue;
      }
      
      const updateParams = {
        TableName: 'FSM-Jobs',
        Key: {
          id: jobId
        },
        UpdateExpression: 'SET hvacModel = :hvacModel',
        ExpressionAttributeValues: {
          ':hvacModel': hvacModel
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      const updateResult = await docClient.send(new UpdateCommand(updateParams));
      console.log(`Updated job ${jobId} with HVAC model ${hvacModel}: ${JSON.stringify(updateResult.Attributes)}`);
    }
    
    console.log('All jobs updated successfully!');
  } catch (error) {
    console.error('Error updating jobs:', error);
  }
};

// Run the update function
updateJobsWithHvacModels();
