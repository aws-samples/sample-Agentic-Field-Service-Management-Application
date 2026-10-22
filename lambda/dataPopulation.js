const AWS = require('aws-sdk');
const response = require('./cfn-response');

// Mock data
const mockCustomers = [
  {
    id: 'cust-001',
    name: 'Acme Corporation',
    location: 'New York, NY',
    coordinates: [40.7128, -74.0060],
    hvacModel: 'Carrier Infinity 98',
    lastService: '2025-06-15',
    status: 'Healthy'
  },
  {
    id: 'cust-002',
    name: 'TechSolutions Inc',
    location: 'San Francisco, CA',
    coordinates: [37.7749, -122.4194],
    hvacModel: 'Trane XL18i',
    lastService: '2025-05-22',
    status: 'Warning'
  },
  {
    id: 'cust-003',
    name: 'Global Enterprises',
    location: 'Chicago, IL',
    coordinates: [41.8781, -87.6298],
    hvacModel: 'Lennox XC25',
    lastService: '2025-06-01',
    status: 'Critical'
  },
  {
    id: 'cust-004',
    name: 'City Hospital',
    location: 'Boston, MA',
    coordinates: [42.3601, -71.0589],
    hvacModel: 'Rheem Prestige RA20',
    lastService: '2025-06-10',
    status: 'Maintenance Required'
  },
  {
    id: 'cust-005',
    name: 'Downtown Hotel',
    location: 'Miami, FL',
    coordinates: [25.7617, -80.1918],
    hvacModel: 'Carrier Infinity 98',
    lastService: '2025-05-15',
    status: 'Healthy'
  },
  {
    id: 'cust-006',
    name: 'Tech Park Office',
    location: 'Austin, TX',
    coordinates: [30.2672, -97.7431],
    hvacModel: 'Trane XL18i',
    lastService: '2025-06-05',
    status: 'Warning'
  }
];

const mockJobs = [
  {
    id: 'job-001',
    customer: 'Acme Corporation',
    customerId: 'cust-001',
    location: 'New York, NY',
    coordinates: [40.7128, -74.0060],
    type: 'Routine Maintenance',
    scheduledDate: '2025-07-10',
    status: 'Pending',
    assignedTechnician: null,
    requiredSkills: ['HVAC Certification', 'Carrier Systems'],
    hvacModel: 'Carrier Infinity 98'
  },
  {
    id: 'job-002',
    customer: 'TechSolutions Inc',
    customerId: 'cust-002',
    location: 'San Francisco, CA',
    coordinates: [37.7749, -122.4194],
    type: 'Emergency Repair',
    scheduledDate: '2025-07-05',
    status: 'Urgent',
    assignedTechnician: 'Mike Johnson',
    requiredSkills: ['HVAC Certification', 'Trane Systems', 'Refrigerant Handling'],
    hvacModel: 'Trane XL18i'
  },
  {
    id: 'job-003',
    customer: 'Global Enterprises',
    customerId: 'cust-003',
    location: 'Chicago, IL',
    coordinates: [41.8781, -87.6298],
    type: 'Emergency Repair',
    scheduledDate: '2025-07-04',
    status: 'In Progress',
    assignedTechnician: 'Sarah Williams',
    requiredSkills: ['HVAC Certification', 'Lennox Systems', 'Electrical Troubleshooting'],
    hvacModel: 'Lennox XC25'
  },
  {
    id: 'job-004',
    customer: 'City Hospital',
    customerId: 'cust-004',
    location: 'Boston, MA',
    coordinates: [42.3601, -71.0589],
    type: 'Routine Maintenance',
    scheduledDate: '2025-07-15',
    status: 'Pending',
    assignedTechnician: null,
    requiredSkills: ['HVAC Certification', 'Commercial Systems', 'Rheem Systems'],
    hvacModel: 'Rheem Prestige RA20'
  },
  {
    id: 'job-005',
    customer: 'Downtown Hotel',
    customerId: 'cust-005',
    location: 'Miami, FL',
    coordinates: [25.7617, -80.1918],
    type: 'Routine Maintenance',
    scheduledDate: '2025-07-20',
    status: 'Pending',
    assignedTechnician: null,
    requiredSkills: ['HVAC Certification', 'Carrier Systems', 'Commercial Systems'],
    hvacModel: 'Carrier Infinity 98'
  },
  {
    id: 'job-006',
    customer: 'Tech Park Office',
    customerId: 'cust-006',
    location: 'Austin, TX',
    coordinates: [30.2672, -97.7431],
    type: 'Emergency Repair',
    scheduledDate: '2025-07-06',
    status: 'Completed',
    assignedTechnician: 'John Smith',
    requiredSkills: ['HVAC Certification', 'Trane Systems'],
    hvacModel: 'Trane XL18i'
  }
];

const mockTechnicians = [
  {
    id: 'tech-001',
    name: 'John Smith',
    status: 'Available',
    skills: ['HVAC Certification', 'Carrier Systems', 'Trane Systems', 'Electrical Troubleshooting'],
    currentLocation: 'New York, NY',
    coordinates: [40.7282, -73.9942],
    currentJob: null
  },
  {
    id: 'tech-002',
    name: 'Mike Johnson',
    status: 'On Job',
    skills: ['HVAC Certification', 'Trane Systems', 'Lennox Systems', 'Refrigerant Handling'],
    currentLocation: 'San Francisco, CA',
    coordinates: [37.7833, -122.4167],
    currentJob: 'job-002'
  },
  {
    id: 'tech-003',
    name: 'Sarah Williams',
    status: 'On Job',
    skills: ['HVAC Certification', 'Lennox Systems', 'Electrical Troubleshooting', 'Commercial Systems'],
    currentLocation: 'Chicago, IL',
    coordinates: [41.8825, -87.6310],
    currentJob: 'job-003'
  },
  {
    id: 'tech-004',
    name: 'David Lee',
    status: 'Available',
    skills: ['HVAC Certification', 'Rheem Systems', 'Carrier Systems'],
    currentLocation: 'Boston, MA',
    coordinates: [42.3559, -71.0617],
    currentJob: null
  },
  {
    id: 'tech-005',
    name: 'Lisa Chen',
    status: 'Off Duty',
    skills: ['HVAC Certification', 'Carrier Systems', 'Commercial Systems'],
    currentLocation: 'Miami, FL',
    coordinates: [25.7651, -80.1936],
    currentJob: null
  }
];

const mockInvoices = [
  {
    id: 'inv-001',
    customerId: 'cust-001',
    jobId: 'job-001',
    date: '2025-06-15',
    amount: 250.00,
    status: 'Paid',
    items: [
      { description: 'Routine Maintenance', amount: 150.00 },
      { description: 'Filter Replacement', amount: 50.00 },
      { description: 'System Inspection', amount: 50.00 }
    ]
  },
  {
    id: 'inv-002',
    customerId: 'cust-002',
    jobId: 'job-002',
    date: '2025-05-22',
    amount: 450.00,
    status: 'Unpaid',
    items: [
      { description: 'Emergency Repair', amount: 300.00 },
      { description: 'Refrigerant Recharge', amount: 100.00 },
      { description: 'Parts Replacement', amount: 50.00 }
    ]
  },
  {
    id: 'inv-003',
    customerId: 'cust-003',
    jobId: 'job-003',
    date: '2025-06-01',
    amount: 550.00,
    status: 'Pending',
    items: [
      { description: 'Emergency Repair', amount: 300.00 },
      { description: 'Electrical Troubleshooting', amount: 150.00 },
      { description: 'Parts Replacement', amount: 100.00 }
    ]
  },
  {
    id: 'inv-004',
    customerId: 'cust-004',
    jobId: 'job-004',
    date: '2025-06-10',
    amount: 350.00,
    status: 'Paid',
    items: [
      { description: 'Routine Maintenance', amount: 200.00 },
      { description: 'Filter Replacement', amount: 50.00 },
      { description: 'System Inspection', amount: 100.00 }
    ]
  },
  {
    id: 'inv-005',
    customerId: 'cust-005',
    jobId: 'job-005',
    date: '2025-05-15',
    amount: 300.00,
    status: 'Paid',
    items: [
      { description: 'Routine Maintenance', amount: 150.00 },
      { description: 'Filter Replacement', amount: 50.00 },
      { description: 'System Inspection', amount: 100.00 }
    ]
  },
  {
    id: 'inv-006',
    customerId: 'cust-006',
    jobId: 'job-006',
    date: '2025-06-05',
    amount: 400.00,
    status: 'Unpaid',
    items: [
      { description: 'Emergency Repair', amount: 250.00 },
      { description: 'Parts Replacement', amount: 150.00 }
    ]
  }
];

const mockHvacDocumentation = {
  'Carrier Infinity 98': {
    specifications: 'The Carrier Infinity 98 is a high-efficiency gas furnace with up to 98.5% AFUE. It features Greenspeed® intelligence that precisely adapts performance to match household needs for comfort and efficiency. The unit operates with variable-speed blower and modulating gas valve technology.',
    maintenanceGuidelines: 'Recommended maintenance includes quarterly filter changes, annual professional inspection, cleaning of the blower assembly, inspection of the heat exchanger, and verification of proper gas pressure and electrical connections.',
    troubleshooting: [
      {
        issue: 'System not heating',
        solution: 'Check thermostat settings, verify power to the unit, inspect filter for blockage, check gas supply, and inspect igniter and flame sensor.'
      },
      {
        issue: 'Unusual noises',
        solution: 'Inspect blower wheel for debris, check for loose panels, verify proper mounting of the blower motor, and inspect for worn bearings.'
      },
      {
        issue: 'Short cycling',
        solution: 'Check thermostat placement, inspect filter for blockage, verify proper gas pressure, and check for proper airflow throughout the system.'
      }
    ],
    commonParts: [
      {
        partNumber: 'CAR-F001',
        name: 'Air Filter',
        description: 'MERV 13 Air Filter for Infinity Series',
        inStock: true
      },
      {
        partNumber: 'CAR-I002',
        name: 'Igniter Assembly',
        description: 'Hot Surface Igniter for Infinity 98',
        inStock: true
      },
      {
        partNumber: 'CAR-S003',
        name: 'Flame Sensor',
        description: 'Flame Sensing Rod for Infinity Series',
        inStock: true
      }
    ]
  },
  'Trane XL18i': {
    specifications: 'The Trane XL18i is a high-efficiency air conditioner with up to 18 SEER. It features a Climatuff® compressor and Spine Fin™ outdoor coil for reliable cooling performance. The unit operates with a multi-stage cooling system for precise temperature control.',
    maintenanceGuidelines: 'Recommended maintenance includes quarterly filter changes, annual professional inspection, cleaning of the condenser coil, checking refrigerant levels, and verification of proper electrical connections.',
    troubleshooting: [
      {
        issue: 'System not cooling',
        solution: 'Check thermostat settings, verify power to the unit, inspect filter for blockage, check refrigerant levels, and inspect condenser coil for debris.'
      },
      {
        issue: 'Unusual noises',
        solution: 'Inspect fan blades for debris, check for loose panels, verify proper mounting of the compressor, and inspect for worn bearings.'
      },
      {
        issue: 'Short cycling',
        solution: 'Check thermostat placement, inspect filter for blockage, verify proper refrigerant charge, and check for proper airflow throughout the system.'
      }
    ],
    commonParts: [
      {
        partNumber: 'TRA-F001',
        name: 'Air Filter',
        description: 'MERV 11 Air Filter for XL Series',
        inStock: true
      },
      {
        partNumber: 'TRA-C002',
        name: 'Capacitor',
        description: 'Run Capacitor for XL18i',
        inStock: true
      },
      {
        partNumber: 'TRA-R003',
        name: 'Refrigerant',
        description: 'R-410A Refrigerant',
        inStock: true
      }
    ]
  },
  'Lennox XC25': {
    specifications: 'The Lennox XC25 is a high-efficiency air conditioner with up to 26 SEER. It features a variable-speed compressor and precision-engineered scroll compressor for quiet and efficient cooling. The unit operates with a variable-capacity cooling system for precise temperature control.',
    maintenanceGuidelines: 'Recommended maintenance includes quarterly filter changes, annual professional inspection, cleaning of the condenser coil, checking refrigerant levels, and verification of proper electrical connections.',
    troubleshooting: [
      {
        issue: 'System not cooling',
        solution: 'Check thermostat settings, verify power to the unit, inspect filter for blockage, check refrigerant levels, and inspect condenser coil for debris.'
      },
      {
        issue: 'Unusual noises',
        solution: 'Inspect fan blades for debris, check for loose panels, verify proper mounting of the compressor, and inspect for worn bearings.'
      },
      {
        issue: 'Short cycling',
        solution: 'Check thermostat placement, inspect filter for blockage, verify proper refrigerant charge, and check for proper airflow throughout the system.'
      }
    ],
    commonParts: [
      {
        partNumber: 'LEN-F001',
        name: 'Air Filter',
        description: 'MERV 16 Air Filter for XC Series',
        inStock: true
      },
      {
        partNumber: 'LEN-C002',
        name: 'Control Board',
        description: 'iComfort Control Board for XC25',
        inStock: false
      },
      {
        partNumber: 'LEN-S003',
        name: 'Sensor',
        description: 'Temperature Sensor for XC Series',
        inStock: true
      }
    ]
  },
  'Rheem Prestige RA20': {
    specifications: 'The Rheem Prestige RA20 is a high-efficiency air conditioner with up to 20 SEER. It features a scroll compressor and composite base pan for quiet and efficient cooling. The unit operates with a two-stage cooling system for precise temperature control.',
    maintenanceGuidelines: 'Recommended maintenance includes quarterly filter changes, annual professional inspection, cleaning of the condenser coil, checking refrigerant levels, and verification of proper electrical connections.',
    troubleshooting: [
      {
        issue: 'System not cooling',
        solution: 'Check thermostat settings, verify power to the unit, inspect filter for blockage, check refrigerant levels, and inspect condenser coil for debris.'
      },
      {
        issue: 'Unusual noises',
        solution: 'Inspect fan blades for debris, check for loose panels, verify proper mounting of the compressor, and inspect for worn bearings.'
      },
      {
        issue: 'Short cycling',
        solution: 'Check thermostat placement, inspect filter for blockage, verify proper refrigerant charge, and check for proper airflow throughout the system.'
      }
    ],
    commonParts: [
      {
        partNumber: 'RHE-F001',
        name: 'Air Filter',
        description: 'MERV 13 Air Filter for Prestige Series',
        inStock: true
      },
      {
        partNumber: 'RHE-C002',
        name: 'Capacitor',
        description: 'Run Capacitor for RA20',
        inStock: true
      },
      {
        partNumber: 'RHE-V003',
        name: 'Valve',
        description: 'Expansion Valve for RA Series',
        inStock: false
      }
    ]
  }
};

const mockParts = [
  {
    partNumber: 'CAR-F001',
    name: 'Air Filter',
    description: 'MERV 13 Air Filter for Infinity Series',
    category: 'Filters',
    price: 29.99,
    inventory: 45,
    manufacturer: 'Carrier',
    fitment: ['Carrier Infinity 98']
  },
  {
    partNumber: 'CAR-I002',
    name: 'Igniter Assembly',
    description: 'Hot Surface Igniter for Infinity 98',
    category: 'Ignition Components',
    price: 89.99,
    inventory: 12,
    manufacturer: 'Carrier',
    fitment: ['Carrier Infinity 98']
  },
  {
    partNumber: 'CAR-S003',
    name: 'Flame Sensor',
    description: 'Flame Sensing Rod for Infinity Series',
    category: 'Sensors',
    price: 49.99,
    inventory: 18,
    manufacturer: 'Carrier',
    fitment: ['Carrier Infinity 98']
  },
  {
    partNumber: 'TRA-F001',
    name: 'Air Filter',
    description: 'MERV 11 Air Filter for XL Series',
    category: 'Filters',
    price: 24.99,
    inventory: 38,
    manufacturer: 'Trane',
    fitment: ['Trane XL18i']
  },
  {
    partNumber: 'TRA-C002',
    name: 'Capacitor',
    description: 'Run Capacitor for XL18i',
    category: 'Electrical Components',
    price: 39.99,
    inventory: 15,
    manufacturer: 'Trane',
    fitment: ['Trane XL18i']
  },
  {
    partNumber: 'TRA-R003',
    name: 'Refrigerant',
    description: 'R-410A Refrigerant',
    category: 'Refrigerants',
    price: 79.99,
    inventory: 8,
    manufacturer: 'Generic',
    fitment: ['Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20']
  },
  {
    partNumber: 'LEN-F001',
    name: 'Air Filter',
    description: 'MERV 16 Air Filter for XC Series',
    category: 'Filters',
    price: 34.99,
    inventory: 22,
    manufacturer: 'Lennox',
    fitment: ['Lennox XC25']
  },
  {
    partNumber: 'LEN-C002',
    name: 'Control Board',
    description: 'iComfort Control Board for XC25',
    category: 'Electrical Components',
    price: 199.99,
    inventory: 0,
    manufacturer: 'Lennox',
    fitment: ['Lennox XC25']
  },
  {
    partNumber: 'LEN-S003',
    name: 'Sensor',
    description: 'Temperature Sensor for XC Series',
    category: 'Sensors',
    price: 29.99,
    inventory: 14,
    manufacturer: 'Lennox',
    fitment: ['Lennox XC25']
  },
  {
    partNumber: 'RHE-F001',
    name: 'Air Filter',
    description: 'MERV 13 Air Filter for Prestige Series',
    category: 'Filters',
    price: 27.99,
    inventory: 31,
    manufacturer: 'Rheem',
    fitment: ['Rheem Prestige RA20']
  },
  {
    partNumber: 'RHE-C002',
    name: 'Capacitor',
    description: 'Run Capacitor for RA20',
    category: 'Electrical Components',
    price: 42.99,
    inventory: 9,
    manufacturer: 'Rheem',
    fitment: ['Rheem Prestige RA20']
  },
  {
    partNumber: 'RHE-V003',
    name: 'Valve',
    description: 'Expansion Valve for RA Series',
    category: 'Valves',
    price: 69.99,
    inventory: 0,
    manufacturer: 'Rheem',
    fitment: ['Rheem Prestige RA20']
  },
  {
    partNumber: 'GEN-T001',
    name: 'Thermostat',
    description: 'Smart Thermostat with WiFi',
    category: 'Controls',
    price: 149.99,
    inventory: 25,
    manufacturer: 'Generic',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20']
  },
  {
    partNumber: 'GEN-R001',
    name: 'Refrigerant Line Set',
    description: '3/8" x 3/4" x 25ft Copper Line Set',
    category: 'Installation Materials',
    price: 89.99,
    inventory: 17,
    manufacturer: 'Generic',
    fitment: ['Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20']
  },
  {
    partNumber: 'GEN-V001',
    name: 'Condensate Pump',
    description: 'Condensate Removal Pump',
    category: 'Pumps',
    price: 59.99,
    inventory: 11,
    manufacturer: 'Generic',
    fitment: ['Carrier Infinity 98', 'Trane XL18i', 'Lennox XC25', 'Rheem Prestige RA20']
  }
];

// Helper function to write items to DynamoDB
async function writeItems(tableName, items) {
  console.log(`Writing ${items.length} items to ${tableName}...`);
  
  const dynamoDB = new AWS.DynamoDB.DocumentClient();
  const batchSize = 25; // DynamoDB batch write limit
  
  // Split items into batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const params = {
      RequestItems: {
        [tableName]: batch.map(item => ({
          PutRequest: {
            Item: item
          }
        }))
      }
    };
    
    try {
      await dynamoDB.batchWrite(params).promise();
      console.log(`Successfully wrote batch ${i / batchSize + 1} to ${tableName}`);
    } catch (error) {
      console.error(`Error writing batch to ${tableName}:`, error);
      throw error;
    }
  }
  
  console.log(`Successfully wrote all items to ${tableName}`);
}

// Main handler function
exports.handler = async (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Get environment variables
    const environment = event.ResourceProperties.Environment || 'dev';
    const customersTable = process.env.CUSTOMERS_TABLE || `FSM-Customers-${environment}`;
    const jobsTable = process.env.JOBS_TABLE || `FSM-Jobs-${environment}`;
    const techniciansTable = process.env.TECHNICIANS_TABLE || `FSM-Technicians-${environment}`;
    const invoicesTable = process.env.INVOICES_TABLE || `FSM-Invoices-${environment}`;
    const metricsTable = process.env.METRICS_TABLE || `FSM-Metrics-${environment}`;
    const documentationTable = process.env.DOCUMENTATION_TABLE || `FSM-Documentation-${environment}`;
    const partsTable = process.env.PARTS_TABLE || `FSM-Parts-${environment}`;
    
    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      // Populate customers table
      await writeItems(customersTable, mockCustomers);
      
      // Populate jobs table
      await writeItems(jobsTable, mockJobs);
      
      // Populate technicians table
      await writeItems(techniciansTable, mockTechnicians);
      
      // Populate invoices table
      await writeItems(invoicesTable, mockInvoices);
      
      // Populate documentation table
      const docItems = [];
      for (const model in mockHvacDocumentation) {
        docItems.push({
          model,
          ...mockHvacDocumentation[model]
        });
      }
      await writeItems(documentationTable, docItems);
      
      // Populate parts table
      await writeItems(partsTable, mockParts);
      
      // Send success response
      await response.send(event, context, response.SUCCESS, {
        Message: 'Data population completed successfully'
      });
    } else if (event.RequestType === 'Delete') {
      // Nothing to do on delete
      await response.send(event, context, response.SUCCESS, {
        Message: 'Nothing to do on delete'
      });
    }
  } catch (error) {
    console.error('Error:', error);
    await response.send(event, context, response.FAILED, {
      Message: `Error: ${error.message}`
    });
  }
};
