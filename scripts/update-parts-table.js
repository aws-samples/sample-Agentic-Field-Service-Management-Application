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

// Function to generate a random lead time between 1-14 days
const getRandomLeadTime = () => {
  return Math.floor(Math.random() * 14) + 1;
};

// Function to generate a random supplier
const getRandomSupplier = () => {
  const suppliers = [
    'HVAC Supply Co.',
    'TechParts Inc.',
    'Industrial Components Ltd.',
    'Refrigeration Wholesale',
    'Climate Control Supply'
  ];
  return suppliers[Math.floor(Math.random() * suppliers.length)];
};

// Function to calculate stock minimum based on inventory
const calculateStockMinimum = (inventory) => {
  return Math.max(Math.floor(inventory * 0.2), 1); // 20% of current inventory or at least 1
};

// Function to calculate stock maximum based on inventory
const calculateStockMaximum = (inventory) => {
  return Math.floor(inventory * 2); // 200% of current inventory
};

// Function to update all parts with new fields
const updatePartsWithNewFields = async () => {
  try {
    console.log('Scanning FSM-Parts table...');
    
    // Scan the table to get all parts
    const scanParams = {
      TableName: 'FSM-Parts'
    };
    
    const scanResult = await docClient.send(new ScanCommand(scanParams));
    console.log(`Found ${scanResult.Items.length} parts to update.`);
    
    // Update each part with new fields
    for (const part of scanResult.Items) {
      const partNumber = part.partNumber;
      const inventory = part.inventory;
      const unitPrice = part.price; // Use existing price as unit price
      const stockMinimum = calculateStockMinimum(inventory);
      const stockMaximum = calculateStockMaximum(inventory);
      const supplierLeadTime = getRandomLeadTime();
      const supplier = getRandomSupplier();
      
      const updateParams = {
        TableName: 'FSM-Parts',
        Key: {
          partNumber: partNumber
        },
        UpdateExpression: 'SET unitPrice = :unitPrice, stockMinimum = :stockMinimum, stockMaximum = :stockMaximum, supplierLeadTime = :supplierLeadTime, supplier = :supplier',
        ExpressionAttributeValues: {
          ':unitPrice': unitPrice,
          ':stockMinimum': stockMinimum,
          ':stockMaximum': stockMaximum,
          ':supplierLeadTime': supplierLeadTime,
          ':supplier': supplier
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      const updateResult = await docClient.send(new UpdateCommand(updateParams));
      console.log(`Updated part ${partNumber}: ${JSON.stringify(updateResult.Attributes)}`);
    }
    
    console.log('All parts updated successfully!');
  } catch (error) {
    console.error('Error updating parts:', error);
  }
};

// Run the update function
updatePartsWithNewFields();
