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

// Function to get all customers
async function getCustomers() {
  const command = new ScanCommand({
    TableName: 'FSM-Customers'
  });
  
  const response = await docClient.send(command);
  return response.Items;
}

// Function to get all jobs
async function getJobs() {
  const command = new ScanCommand({
    TableName: 'FSM-Jobs'
  });
  
  const response = await docClient.send(command);
  return response.Items;
}

// Function to update a job with customer ID
async function updateJobWithCustomerId(jobId, customerId) {
  const command = new UpdateCommand({
    TableName: 'FSM-Jobs',
    Key: { id: jobId },
    UpdateExpression: 'SET customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': customerId
    },
    ReturnValues: 'UPDATED_NEW'
  });
  
  return await docClient.send(command);
}

// Main function
async function main() {
  try {
    console.log('Fetching customers and jobs...');
    
    // Get all customers and jobs
    const customers = await getCustomers();
    const jobs = await getJobs();
    
    console.log(`Found ${customers.length} customers and ${jobs.length} jobs`);
    
    // Create a map of customer names to customer IDs
    const customerMap = {};
    customers.forEach(customer => {
      customerMap[customer.name] = customer.id;
    });
    
    console.log('Customer map:', customerMap);
    
    // Update each job with the corresponding customer ID
    for (const job of jobs) {
      const customerName = job.customer;
      const customerId = customerMap[customerName];
      
      if (customerId) {
        console.log(`Updating job ${job.id} for customer "${customerName}" with ID ${customerId}`);
        await updateJobWithCustomerId(job.id, customerId);
      } else {
        console.warn(`Warning: No customer ID found for customer "${customerName}" in job ${job.id}`);
      }
    }
    
    console.log('All jobs updated successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main();
