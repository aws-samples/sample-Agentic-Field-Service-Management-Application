// Mock data for the Field Service Management application

// Mock Customers
export const mockCustomers = [
  {
    id: 'cust-001',
    name: 'Acme Corporation',
    location: 'New York, NY',
    coordinates: [40.7128, -74.0060], // [latitude, longitude]
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
    lastService: '2025-04-30',
    status: 'Warning'
  },
  {
    id: 'cust-007',
    name: 'Sunset Apartments',
    location: 'Seattle, WA',
    coordinates: [47.6062, -122.3321],
    hvacModel: 'Lennox XC25',
    lastService: '2025-05-05',
    status: 'Healthy'
  }
];

// Mock HVAC Metrics
export const mockHvacMetrics = {
  'cust-001': {
    currentTemperature: 72,
    refrigerantLevel: 85,
    fanSpeed: 950,
    systemEfficiency: 92,
    temperatureHistory: [73, 72, 72, 71, 72, 73, 74, 73, 72, 72, 71, 72],
    energyConsumption: [45, 42, 47, 44, 43, 46, 45],
    maintenanceDistribution: {
      filter: 40,
      refrigerant: 20,
      electrical: 15,
      mechanical: 25
    },
    installationDate: '2023-03-15',
    warrantyStatus: true,
    maintenanceRecommendations: [
      { priority: 'Low', description: 'Replace air filter within next 30 days' },
      { priority: 'Medium', description: 'Check refrigerant levels at next service' }
    ],
    maintenanceHistory: [
      { 
        date: '2025-06-15', 
        type: 'Routine Maintenance', 
        technician: 'John Smith',
        description: 'Annual maintenance check. Replaced air filter and cleaned condenser coil.',
        parts: ['Air Filter', 'Cleaning Solution']
      },
      { 
        date: '2024-12-10', 
        type: 'Emergency Repair', 
        technician: 'Sarah Williams',
        description: 'Fixed refrigerant leak and recharged system.',
        parts: ['Copper Tubing', 'Refrigerant R-410A']
      },
      { 
        date: '2024-06-20', 
        type: 'Routine Maintenance', 
        technician: 'John Smith',
        description: 'Annual maintenance check. System operating normally.',
        parts: ['Air Filter']
      },
      { 
        date: '2023-09-05', 
        type: 'Emergency Repair', 
        technician: 'Mike Johnson',
        description: 'Replaced faulty capacitor and checked electrical connections.',
        parts: ['Dual Run Capacitor 45/5 MFD']
      }
    ]
  },
  'cust-002': {
    currentTemperature: 76,
    refrigerantLevel: 65,
    fanSpeed: 1100,
    systemEfficiency: 78,
    temperatureHistory: [75, 76, 77, 76, 75, 76, 77, 78, 77, 76, 76, 75],
    energyConsumption: [52, 54, 53, 55, 56, 54, 53],
    maintenanceDistribution: {
      filter: 30,
      refrigerant: 40,
      electrical: 10,
      mechanical: 20
    },
    installationDate: '2022-07-22',
    warrantyStatus: true,
    maintenanceRecommendations: [
      { priority: 'High', description: 'Refrigerant recharge needed' },
      { priority: 'Medium', description: 'Clean condenser coils' }
    ],
    maintenanceHistory: [
      { 
        date: '2025-05-22', 
        type: 'Emergency Repair', 
        technician: 'Mike Johnson',
        description: 'Diagnosed refrigerant leak. Temporary fix applied, needs follow-up.',
        parts: ['Leak Sealant', 'Refrigerant R-410A']
      },
      { 
        date: '2024-11-15', 
        type: 'Routine Maintenance', 
        technician: 'David Lee',
        description: 'Semi-annual maintenance. Cleaned coils and checked electrical connections.',
        parts: ['Air Filter', 'Cleaning Solution']
      },
      { 
        date: '2024-05-10', 
        type: 'Routine Maintenance', 
        technician: 'Sarah Williams',
        description: 'Semi-annual maintenance. Replaced air filter.',
        parts: ['Air Filter']
      },
      { 
        date: '2023-08-30', 
        type: 'Emergency Repair', 
        technician: 'John Smith',
        description: 'Repaired damaged fan blade and balanced fan.',
        parts: ['Fan Blade Assembly']
      }
    ]
  },
  'cust-003': {
    currentTemperature: 80,
    refrigerantLevel: 45,
    fanSpeed: 850,
    systemEfficiency: 65,
    temperatureHistory: [78, 79, 80, 81, 80, 79, 80, 81, 82, 81, 80, 80],
    energyConsumption: [65, 67, 68, 70, 69, 68, 67],
    maintenanceDistribution: {
      filter: 15,
      refrigerant: 45,
      electrical: 25,
      mechanical: 15
    },
    installationDate: '2021-05-10',
    warrantyStatus: false,
    maintenanceRecommendations: [
      { priority: 'High', description: 'Compressor showing signs of failure' },
      { priority: 'High', description: 'Refrigerant leak detected' },
      { priority: 'Medium', description: 'Replace air filter immediately' }
    ]
  },
  'default': {
    currentTemperature: 74,
    refrigerantLevel: 80,
    fanSpeed: 1000,
    systemEfficiency: 85,
    temperatureHistory: [74, 73, 74, 75, 74, 73, 74, 75, 76, 75, 74, 74],
    energyConsumption: [50, 48, 52, 49, 51, 50, 48],
    maintenanceDistribution: {
      filter: 35,
      refrigerant: 25,
      electrical: 15,
      mechanical: 25
    },
    installationDate: '2022-10-01',
    warrantyStatus: true,
    maintenanceRecommendations: [
      { priority: 'Low', description: 'Schedule routine maintenance' }
    ]
  }
};

// Mock Service Jobs
export const mockJobs = [
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

// Mock Technicians
export const mockTechnicians = [
  {
    id: 'tech-001',
    name: 'John Smith',
    status: 'Available',
    currentLocation: 'New York, NY',
    coordinates: [40.7282, -73.9942], // Slightly different from customer to show proximity
    skills: ['HVAC Certification', 'Carrier Systems', 'Trane Systems', 'Electrical Troubleshooting'],
    currentJob: null
  },
  {
    id: 'tech-002',
    name: 'Mike Johnson',
    status: 'On Job',
    currentLocation: 'San Francisco, CA',
    coordinates: [37.7833, -122.4167],
    skills: ['HVAC Certification', 'Trane Systems', 'Lennox Systems', 'Refrigerant Handling'],
    currentJob: 'job-002'
  },
  {
    id: 'tech-003',
    name: 'Sarah Williams',
    status: 'On Job',
    currentLocation: 'Chicago, IL',
    coordinates: [41.8825, -87.6310],
    skills: ['HVAC Certification', 'Lennox Systems', 'Electrical Troubleshooting', 'Commercial Systems'],
    currentJob: 'job-003'
  },
  {
    id: 'tech-004',
    name: 'David Lee',
    status: 'Available',
    currentLocation: 'Boston, MA',
    coordinates: [42.3559, -71.0617],
    skills: ['HVAC Certification', 'Rheem Systems', 'Carrier Systems'],
    currentJob: null
  },
  {
    id: 'tech-005',
    name: 'Lisa Chen',
    status: 'Off Duty',
    currentLocation: 'Miami, FL',
    coordinates: [25.7651, -80.1936],
    skills: ['HVAC Certification', 'Carrier Systems', 'Commercial Systems'],
    currentJob: null
  }
];

// Mock Technician Jobs (for the technician view)
export const mockTechnicianJobs = [
  {
    id: 'job-001',
    customer: 'Acme Corporation',
    customerId: 'cust-001',
    location: '123 Main St, New York, NY',
    type: 'Routine Maintenance',
    scheduledDate: '2025-07-10',
    status: 'Pending',
    description: 'Annual maintenance check for HVAC system',
    hvacModel: 'Carrier Infinity 98',
    hvacSerialNumber: 'CAR-98765432',
    installationDate: '2023-03-15',
    lastServiceDate: '2024-07-10',
    warrantyActive: true
  },
  {
    id: 'job-007',
    customer: 'Riverfront Condos',
    customerId: 'cust-007',
    location: '456 River Rd, New York, NY',
    type: 'Emergency Repair',
    scheduledDate: '2025-07-05',
    status: 'In Progress',
    description: 'AC not cooling, possible refrigerant leak',
    hvacModel: 'Trane XL18i',
    hvacSerialNumber: 'TRN-12345678',
    installationDate: '2022-05-20',
    lastServiceDate: '2024-12-15',
    warrantyActive: true
  },
  {
    id: 'job-008',
    customer: 'Eastside Mall',
    customerId: 'cust-003',
    location: '789 East Ave, New York, NY',
    type: 'Routine Maintenance',
    scheduledDate: '2025-07-12',
    status: 'Pending',
    description: 'Quarterly maintenance for commercial HVAC system',
    hvacModel: 'Lennox XC25',
    hvacSerialNumber: 'LEN-87654321',
    installationDate: '2021-11-05',
    lastServiceDate: '2025-04-05',
    warrantyActive: true
  },
  {
    id: 'job-009',
    customer: 'Westview Office',
    customerId: 'cust-006',
    location: '101 West Blvd, New York, NY',
    type: 'Emergency Repair',
    scheduledDate: '2025-07-03',
    status: 'Completed',
    description: 'Heating system failure, electrical issue',
    hvacModel: 'Rheem Prestige RA20',
    hvacSerialNumber: 'RHM-23456789',
    installationDate: '2020-09-15',
    lastServiceDate: '2025-01-20',
    warrantyActive: false
  }
];

// Mock HVAC Documentation
export const mockHvacDocumentation = {
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
      },
      {
        partNumber: 'CAR-B004',
        name: 'Blower Motor',
        description: 'Variable Speed ECM Blower Motor',
        inStock: false
      }
    ]
  },
  'Trane XL18i': {
    specifications: 'The Trane XL18i is a high-efficiency air conditioner with up to 18 SEER rating. It features a Climatuff® compressor and Spine Fin™ outdoor coil for reliable cooling performance. The unit operates with a two-stage cooling system for improved comfort and efficiency.',
    maintenanceGuidelines: 'Recommended maintenance includes monthly filter changes during peak season, annual professional inspection, cleaning of the condenser coil, checking refrigerant levels, and inspection of electrical components.',
    troubleshooting: [
      {
        issue: 'System not cooling',
        solution: 'Check thermostat settings, verify power to the unit, inspect filter for blockage, check refrigerant levels, and inspect condenser coil for debris.'
      },
      {
        issue: 'Ice formation on coils',
        solution: 'Check airflow, verify refrigerant levels, inspect blower operation, and check for dirty evaporator coil.'
      },
      {
        issue: 'Compressor not running',
        solution: 'Check power supply, inspect capacitor, verify contactor operation, and check for compressor overload.'
      }
    ],
    commonParts: [
      {
        partNumber: 'TRN-F001',
        name: 'Air Filter',
        description: 'MERV 11 Air Filter for XL Series',
        inStock: true
      },
      {
        partNumber: 'TRN-C002',
        name: 'Run Capacitor',
        description: '45/5 MFD 440V Dual Run Capacitor',
        inStock: true
      },
      {
        partNumber: 'TRN-R003',
        name: 'Refrigerant R-410A',
        description: '25lb Cylinder of R-410A Refrigerant',
        inStock: true
      },
      {
        partNumber: 'TRN-T004',
        name: 'Contactor',
        description: '2-Pole 40 Amp Contactor',
        inStock: false
      }
    ]
  },
  'Lennox XC25': {
    specifications: 'The Lennox XC25 is a premium air conditioner with up to 26 SEER rating. It features a variable-capacity compressor that can adjust output in increments of 1% for precise comfort and maximum efficiency. The unit includes the iComfort® technology for smart control.',
    maintenanceGuidelines: 'Recommended maintenance includes monthly filter changes, bi-annual professional inspection, cleaning of the condenser coil, checking refrigerant levels, inspection of electrical components, and verification of proper communication with the thermostat.',
    troubleshooting: [
      {
        issue: 'Communication errors',
        solution: 'Check wiring connections, verify thermostat compatibility, inspect control board, and reset system power.'
      },
      {
        issue: 'Reduced cooling capacity',
        solution: 'Check refrigerant levels, inspect for airflow restrictions, clean condenser coil, and verify compressor operation.'
      },
      {
        issue: 'Unusual system noise',
        solution: 'Inspect fan blade for damage, check mounting hardware, verify compressor sound blanket is in place, and inspect for refrigerant line vibration.'
      }
    ],
    commonParts: [
      {
        partNumber: 'LEN-F001',
        name: 'Air Filter',
        description: 'PureAir™ Carbon Filter',
        inStock: true
      },
      {
        partNumber: 'LEN-C002',
        name: 'Control Board',
        description: 'iComfort® Compatible Control Board',
        inStock: false
      },
      {
        partNumber: 'LEN-S003',
        name: 'Pressure Switch',
        description: 'High-Pressure Safety Switch',
        inStock: true
      },
      {
        partNumber: 'LEN-V004',
        name: 'Expansion Valve',
        description: 'Thermal Expansion Valve',
        inStock: true
      }
    ]
  },
  'Rheem Prestige RA20': {
    specifications: 'The Rheem Prestige RA20 is a high-efficiency air conditioner with up to 20 SEER rating. It features a scroll compressor with modern sound dampening technology and composite base pan for quiet operation. The unit includes EcoNet® Smart Monitoring System capability.',
    maintenanceGuidelines: 'Recommended maintenance includes quarterly filter changes, annual professional inspection, cleaning of the condenser coil, checking refrigerant levels, inspection of electrical components, and lubrication of moving parts where applicable.',
    troubleshooting: [
      {
        issue: 'System short cycling',
        solution: 'Check thermostat placement, inspect filter for blockage, verify refrigerant charge, and check for proper sizing of the unit.'
      },
      {
        issue: 'Water leakage',
        solution: 'Inspect condensate drain for clogs, check drain pan for cracks, verify proper slope of drain line, and check for frozen evaporator coil.'
      },
      {
        issue: 'Fan motor failure',
        solution: 'Check capacitor, verify power supply, inspect bearings, and test motor windings.'
      }
    ],
    commonParts: [
      {
        partNumber: 'RHM-F001',
        name: 'Air Filter',
        description: 'Standard Replacement Filter',
        inStock: true
      },
      {
        partNumber: 'RHM-M002',
        name: 'Fan Motor',
        description: 'Condenser Fan Motor',
        inStock: true
      },
      {
        partNumber: 'RHM-C003',
        name: 'Capacitor',
        description: '35/5 MFD 440V Dual Run Capacitor',
        inStock: false
      },
      {
        partNumber: 'RHM-R004',
        name: 'Relay',
        description: 'Compressor Start Relay',
        inStock: true
      }
    ]
  }
};

// Mock Invoices
export const mockInvoices = [
  {
    id: 'inv-001',
    invoiceNumber: 'INV-2025-001',
    customerId: 'cust-001',
    customer: 'Acme Corporation',
    address: '123 Main St, New York, NY 10001',
    date: '2025-06-15',
    dueDate: '2025-07-15',
    amount: 450.00,
    status: 'Pending',
    items: [
      {
        description: 'Routine HVAC Maintenance',
        quantity: 1,
        unitPrice: 350.00
      },
      {
        description: 'Air Filter Replacement',
        quantity: 2,
        unitPrice: 50.00
      }
    ],
    notes: 'Annual maintenance service completed.'
  },
  {
    id: 'inv-002',
    invoiceNumber: 'INV-2025-002',
    customerId: 'cust-002',
    customer: 'TechSolutions Inc',
    address: '456 Tech Ave, San Francisco, CA 94105',
    date: '2025-05-22',
    dueDate: '2025-06-22',
    amount: 1250.00,
    status: 'Overdue',
    items: [
      {
        description: 'Emergency Repair - Compressor Replacement',
        quantity: 1,
        unitPrice: 950.00
      },
      {
        description: 'Refrigerant Recharge',
        quantity: 1,
        unitPrice: 300.00
      }
    ],
    notes: 'Emergency repair completed after hours.'
  },
  {
    id: 'inv-003',
    invoiceNumber: 'INV-2025-003',
    customerId: 'cust-003',
    customer: 'Global Enterprises',
    address: '789 Business Pkwy, Chicago, IL 60601',
    date: '2025-06-01',
    dueDate: '2025-07-01',
    amount: 2100.00,
    status: 'Paid',
    items: [
      {
        description: 'Major System Repair',
        quantity: 1,
        unitPrice: 1500.00
      },
      {
        description: 'Replacement Parts',
        quantity: 1,
        unitPrice: 450.00
      },
      {
        description: 'System Diagnostic',
        quantity: 1,
        unitPrice: 150.00
      }
    ],
    notes: 'Payment received via bank transfer.'
  },
  {
    id: 'inv-004',
    invoiceNumber: 'INV-2025-004',
    customerId: 'cust-004',
    customer: 'City Hospital',
    address: '101 Health Blvd, Boston, MA 02115',
    date: '2025-06-10',
    dueDate: '2025-07-10',
    amount: 850.00,
    status: 'Pending',
    items: [
      {
        description: 'Quarterly Maintenance - Multiple Units',
        quantity: 5,
        unitPrice: 150.00
      },
      {
        description: 'Filter Replacement Kit',
        quantity: 5,
        unitPrice: 20.00
      }
    ],
    notes: 'Maintenance performed on all 5 units in the east wing.'
  },
  {
    id: 'inv-005',
    invoiceNumber: 'INV-2025-005',
    customerId: 'cust-005',
    customer: 'Downtown Hotel',
    address: '202 Hospitality Way, Miami, FL 33132',
    date: '2025-05-15',
    dueDate: '2025-06-15',
    amount: 1750.00,
    status: 'Overdue',
    items: [
      {
        description: 'Commercial System Maintenance',
        quantity: 1,
        unitPrice: 1200.00
      },
      {
        description: 'Ductwork Cleaning',
        quantity: 1,
        unitPrice: 550.00
      }
    ],
    notes: 'Second notice sent on 2025-06-25.'
  },
  {
    id: 'inv-006',
    invoiceNumber: 'INV-2025-006',
    customerId: 'cust-006',
    customer: 'Tech Park Office',
    address: '303 Innovation Dr, Austin, TX 78759',
    date: '2025-04-30',
    dueDate: '2025-05-30',
    amount: 575.00,
    status: 'Paid',
    items: [
      {
        description: 'Emergency Service Call',
        quantity: 1,
        unitPrice: 250.00
      },
      {
        description: 'Thermostat Replacement',
        quantity: 1,
        unitPrice: 325.00
      }
    ],
    notes: 'Payment received via credit card.'
  },
  {
    id: 'inv-007',
    invoiceNumber: 'INV-2025-007',
    customerId: 'cust-007',
    customer: 'Sunset Apartments',
    address: '404 Sunset Blvd, Seattle, WA 98109',
    date: '2025-05-05',
    dueDate: '2025-06-05',
    amount: 3200.00,
    status: 'Paid',
    items: [
      {
        description: 'Multi-Unit Maintenance (8 Units)',
        quantity: 8,
        unitPrice: 350.00
      },
      {
        description: 'Common Area System Repair',
        quantity: 1,
        unitPrice: 400.00
      }
    ],
    notes: 'Annual contract maintenance.'
  }
];
