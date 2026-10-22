#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  BatchWriteCommand 
} = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: 'us-west-2' });
const docClient = DynamoDBDocumentClient.from(client);

// Mock data for industrial HVAC parts
const mockParts = [
  {
    partNumber: 'CP-001',
    name: 'Scroll Compressor',
    description: 'High-efficiency scroll compressor for commercial HVAC systems',
    inventory: 12,
    category: 'Compressor',
    price: 1250.00,
    manufacturer: 'Copeland',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25'],
    specifications: {
      capacity: '5 Ton',
      refrigerantType: 'R-410A',
      voltage: '208-230V',
      phase: 'Single'
    },
    location: 'Warehouse A, Shelf 3',
    lastRestocked: '2025-06-15'
  },
  {
    partNumber: 'CP-002',
    name: 'Reciprocating Compressor',
    description: 'Heavy-duty reciprocating compressor for industrial applications',
    inventory: 8,
    category: 'Compressor',
    price: 1850.00,
    manufacturer: 'Tecumseh',
    fitment: ['Trane XL18i', 'Rheem Prestige RA20'],
    specifications: {
      capacity: '7.5 Ton',
      refrigerantType: 'R-410A',
      voltage: '460V',
      phase: 'Three'
    },
    location: 'Warehouse A, Shelf 4',
    lastRestocked: '2025-06-10'
  },
  {
    partNumber: 'CP-003',
    name: 'Rotary Compressor',
    description: 'Compact rotary compressor for light commercial applications',
    inventory: 15,
    category: 'Compressor',
    price: 950.00,
    manufacturer: 'Danfoss',
    fitment: ['Carrier Infinity 98', 'Lennox XC25'],
    specifications: {
      capacity: '3 Ton',
      refrigerantType: 'R-410A',
      voltage: '208-230V',
      phase: 'Single'
    },
    location: 'Warehouse A, Shelf 2',
    lastRestocked: '2025-06-20'
  },
  {
    partNumber: 'CN-001',
    name: 'Condenser Fan Motor',
    description: 'High-efficiency condenser fan motor for commercial units',
    inventory: 24,
    category: 'Motor',
    price: 325.00,
    manufacturer: 'US Motors',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20'],
    specifications: {
      horsepower: '1/3 HP',
      rpm: '1075',
      voltage: '208-230V',
      enclosure: 'Totally Enclosed'
    },
    location: 'Warehouse B, Shelf 1',
    lastRestocked: '2025-06-25'
  },
  {
    partNumber: 'CN-002',
    name: 'Condenser Coil',
    description: 'Copper tube aluminum fin condenser coil',
    inventory: 6,
    category: 'Coil',
    price: 875.00,
    manufacturer: 'Heatcraft',
    fitment: ['Carrier Infinity 98', 'Trane XL18i'],
    specifications: {
      material: 'Copper/Aluminum',
      size: '36" x 72"',
      tonnage: '10 Ton'
    },
    location: 'Warehouse C, Shelf 5',
    lastRestocked: '2025-05-30'
  },
  {
    partNumber: 'EV-001',
    name: 'Evaporator Coil',
    description: 'A-frame evaporator coil for commercial systems',
    inventory: 9,
    category: 'Coil',
    price: 750.00,
    manufacturer: 'Heatcraft',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25'],
    specifications: {
      material: 'Copper/Aluminum',
      size: '24" x 30"',
      tonnage: '5 Ton'
    },
    location: 'Warehouse C, Shelf 4',
    lastRestocked: '2025-06-05'
  },
  {
    partNumber: 'BL-001',
    name: 'Blower Motor',
    description: 'Variable speed blower motor for commercial air handlers',
    inventory: 18,
    category: 'Motor',
    price: 425.00,
    manufacturer: 'Emerson',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20'],
    specifications: {
      horsepower: '1/2 HP',
      rpm: 'Variable',
      voltage: '208-230V',
      enclosure: 'Open'
    },
    location: 'Warehouse B, Shelf 2',
    lastRestocked: '2025-06-18'
  },
  {
    partNumber: 'CT-001',
    name: 'Contactor',
    description: '3-pole contactor for commercial HVAC systems',
    inventory: 35,
    category: 'Electrical',
    price: 85.00,
    manufacturer: 'Siemens',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20'],
    specifications: {
      poles: '3',
      amperage: '40A',
      voltage: '24V Coil'
    },
    location: 'Warehouse D, Shelf 1',
    lastRestocked: '2025-07-01'
  },
  {
    partNumber: 'CP-004',
    name: 'Capacitor',
    description: 'Dual run capacitor for commercial HVAC applications',
    inventory: 42,
    category: 'Electrical',
    price: 45.00,
    manufacturer: 'Packard',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20'],
    specifications: {
      microfarad: '45/5 MFD',
      voltage: '440V'
    },
    location: 'Warehouse D, Shelf 2',
    lastRestocked: '2025-07-01'
  },
  {
    partNumber: 'TH-001',
    name: 'Commercial Thermostat',
    description: 'Programmable commercial thermostat with BACnet integration',
    inventory: 15,
    category: 'Controls',
    price: 325.00,
    manufacturer: 'Honeywell',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20'],
    specifications: {
      type: 'Programmable',
      stages: 'Multi-stage',
      connectivity: 'BACnet, WiFi'
    },
    location: 'Warehouse D, Shelf 3',
    lastRestocked: '2025-06-28'
  },
  {
    partNumber: 'VL-001',
    name: 'Expansion Valve',
    description: 'Thermostatic expansion valve for commercial refrigeration',
    inventory: 22,
    category: 'Valves',
    price: 125.00,
    manufacturer: 'Danfoss',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25'],
    specifications: {
      refrigerantType: 'R-410A',
      tonnage: '5 Ton'
    },
    location: 'Warehouse B, Shelf 5',
    lastRestocked: '2025-06-15'
  },
  {
    partNumber: 'FL-001',
    name: 'Air Filter (MERV 13)',
    description: 'High-efficiency MERV 13 air filter for commercial systems',
    inventory: 65,
    category: 'Filters',
    price: 35.00,
    manufacturer: 'Filtrete',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20'],
    specifications: {
      rating: 'MERV 13',
      size: '24" x 24" x 2"'
    },
    location: 'Warehouse E, Shelf 1',
    lastRestocked: '2025-07-02'
  },
  {
    partNumber: 'RF-001',
    name: 'R-410A Refrigerant (25lb)',
    description: 'R-410A refrigerant cylinder for commercial HVAC systems',
    inventory: 18,
    category: 'Refrigerant',
    price: 275.00,
    manufacturer: 'Chemours',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20'],
    specifications: {
      type: 'R-410A',
      size: '25lb Cylinder'
    },
    location: 'Warehouse F, Shelf 1',
    lastRestocked: '2025-06-10'
  },
  {
    partNumber: 'SW-001',
    name: 'Pressure Switch',
    description: 'High/low pressure switch for commercial systems',
    inventory: 28,
    category: 'Controls',
    price: 65.00,
    manufacturer: 'Johnson Controls',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20'],
    specifications: {
      type: 'Dual Pressure',
      range: '50-450 PSI'
    },
    location: 'Warehouse D, Shelf 4',
    lastRestocked: '2025-06-22'
  },
  {
    partNumber: 'IG-001',
    name: 'Ignitor',
    description: 'Hot surface ignitor for commercial furnaces',
    inventory: 32,
    category: 'Heating',
    price: 85.00,
    manufacturer: 'Norton',
    fitment: ['Carrier Infinity 98', 'Trane XL18i'],
    specifications: {
      type: 'Hot Surface',
      voltage: '120V'
    },
    location: 'Warehouse E, Shelf 3',
    lastRestocked: '2025-05-25'
  }
];

// Function to batch write items to DynamoDB
async function batchWriteItems(items) {
  // Split items into chunks of 25 (DynamoDB batch write limit)
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }
  
  // Process each chunk
  for (const chunk of chunks) {
    const params = {
      RequestItems: {
        'FSM-Parts': chunk.map(item => ({
          PutRequest: {
            Item: item
          }
        }))
      }
    };
    
    try {
      const result = await docClient.send(new BatchWriteCommand(params));
      console.log('Batch write successful:', result);
    } catch (error) {
      console.error('Error in batch write:', error);
      throw error;
    }
  }
}

// Main function
async function main() {
  try {
    console.log(`Populating FSM-Parts table with ${mockParts.length} items...`);
    await batchWriteItems(mockParts);
    console.log('Successfully populated FSM-Parts table!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Wait for the table to be created before populating it
setTimeout(() => {
  main();
}, 10000); // Wait 10 seconds for the table to be created
