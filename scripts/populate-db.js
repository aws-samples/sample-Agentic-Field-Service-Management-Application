const AWS = require('aws-sdk');
const { mockCustomers, mockJobs, mockTechnicians, mockHvacMetrics, mockHvacDocumentation, mockInvoices } = require('../src/data/mockData');

// Configure AWS SDK
AWS.config.update({ region: 'us-west-2' });
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table names
const CUSTOMERS_TABLE = 'FSM-Customers';
const JOBS_TABLE = 'FSM-Jobs';
const TECHNICIANS_TABLE = 'FSM-Technicians';
const INVOICES_TABLE = 'FSM-Invoices';
const METRICS_TABLE = 'FSM-Metrics';
const DOCUMENTATION_TABLE = 'FSM-Documentation';

// Helper function to write items to DynamoDB
async function writeItems(tableName, items) {
  console.log(`Writing ${items.length} items to ${tableName}...`);
  
  const writePromises = items.map(item => {
    const params = {
      TableName: tableName,
      Item: item
    };
    
    return dynamoDB.put(params).promise();
  });
  
  try {
    await Promise.all(writePromises);
    console.log(`Successfully wrote ${items.length} items to ${tableName}`);
  } catch (error) {
    console.error(`Error writing to ${tableName}:`, error);
  }
}

// Populate customers table
async function populateCustomers() {
  await writeItems(CUSTOMERS_TABLE, mockCustomers);
}

// Populate jobs table
async function populateJobs() {
  await writeItems(JOBS_TABLE, mockJobs);
}

// Populate technicians table
async function populateTechnicians() {
  await writeItems(TECHNICIANS_TABLE, mockTechnicians);
}

// Populate invoices table
async function populateInvoices() {
  await writeItems(INVOICES_TABLE, mockInvoices);
}

// Populate metrics table
async function populateMetrics() {
  const metricsItems = [];
  
  // Convert metrics object to array of items
  for (const customerId in mockHvacMetrics) {
    if (customerId !== 'default') {
      metricsItems.push({
        customerId,
        ...mockHvacMetrics[customerId]
      });
    }
  }
  
  // Add default metrics for all customers
  mockCustomers.forEach(customer => {
    if (!mockHvacMetrics[customer.id]) {
      metricsItems.push({
        customerId: customer.id,
        ...mockHvacMetrics.default
      });
    }
  });
  
  await writeItems(METRICS_TABLE, metricsItems);
}

// Populate documentation table
async function populateDocumentation() {
  const docItems = [];
  
  // Convert documentation object to array of items
  for (const model in mockHvacDocumentation) {
    docItems.push({
      model,
      ...mockHvacDocumentation[model]
    });
  }
  
  await writeItems(DOCUMENTATION_TABLE, docItems);
}

// Main function to populate all tables
async function populateAllTables() {
  try {
    await populateCustomers();
    await populateJobs();
    await populateTechnicians();
    await populateInvoices();
    await populateMetrics();
    await populateDocumentation();
    
    console.log('All tables populated successfully!');
  } catch (error) {
    console.error('Error populating tables:', error);
  }
}

// Run the script
populateAllTables();
