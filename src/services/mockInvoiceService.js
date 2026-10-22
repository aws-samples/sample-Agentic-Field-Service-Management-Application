import { v4 as uuidv4 } from 'uuid';

// Mock invoice data
const mockInvoices = [
  {
    id: 'inv-001',
    customerId: 'cust-001',
    customerName: 'Acme Corporation',
    jobId: 'job-001',
    date: '2025-06-15',
    dueDate: '2025-07-15',
    amount: 450.75,
    status: 'Paid',
    paymentDate: '2025-06-20',
    paymentMethod: 'Credit Card',
    items: [
      { description: 'Labor - AC Repair', quantity: 2, unitPrice: 125, total: 250 },
      { description: 'HEPA Air Filter', quantity: 1, unitPrice: 45.99, total: 45.99 },
      { description: 'Refrigerant Recharge', quantity: 1, unitPrice: 120, total: 120 },
      { description: 'Service Fee', quantity: 1, unitPrice: 34.76, total: 34.76 }
    ]
  },
  {
    id: 'inv-002',
    customerId: 'cust-002',
    customerName: 'XYZ Industries',
    jobId: 'job-002',
    date: '2025-06-18',
    dueDate: '2025-07-18',
    amount: 325.50,
    status: 'Pending',
    items: [
      { description: 'Labor - Annual Maintenance', quantity: 1.5, unitPrice: 125, total: 187.50 },
      { description: 'HEPA Air Filter', quantity: 1, unitPrice: 45.99, total: 45.99 },
      { description: 'Lubricant', quantity: 1, unitPrice: 25, total: 25 },
      { description: 'Cleaning Solution', quantity: 1, unitPrice: 32.25, total: 32.25 },
      { description: 'Service Fee', quantity: 1, unitPrice: 34.76, total: 34.76 }
    ]
  },
  {
    id: 'inv-003',
    customerId: 'cust-003',
    customerName: 'Bay Area Tech',
    jobId: 'job-003',
    date: '2025-06-20',
    dueDate: '2025-07-20',
    amount: 2750.25,
    status: 'Overdue',
    items: [
      { description: 'Labor - System Installation', quantity: 4, unitPrice: 125, total: 500 },
      { description: 'Lennox XC25 Unit', quantity: 1, unitPrice: 1950, total: 1950 },
      { description: 'Ductwork Modifications', quantity: 1, unitPrice: 175, total: 175 },
      { description: 'Installation Materials', quantity: 1, unitPrice: 90.49, total: 90.49 },
      { description: 'Service Fee', quantity: 1, unitPrice: 34.76, total: 34.76 }
    ]
  },
  {
    id: 'inv-004',
    customerId: 'cust-004',
    customerName: 'Golden Gate Properties',
    jobId: 'job-004',
    date: '2025-06-22',
    dueDate: '2025-07-22',
    amount: 575.25,
    status: 'Pending',
    items: [
      { description: 'Labor - Emergency Repair', quantity: 2, unitPrice: 175, total: 350 },
      { description: 'Gas Valve', quantity: 1, unitPrice: 125.50, total: 125.50 },
      { description: 'Pipe Fittings', quantity: 1, unitPrice: 45, total: 45 },
      { description: 'Leak Detection', quantity: 1, unitPrice: 19.99, total: 19.99 },
      { description: 'Service Fee', quantity: 1, unitPrice: 34.76, total: 34.76 }
    ]
  },
  {
    id: 'inv-005',
    customerId: 'cust-005',
    customerName: 'Pacific Heights Condos',
    jobId: 'job-005',
    date: '2025-06-25',
    dueDate: '2025-07-25',
    amount: 205.75,
    status: 'Paid',
    paymentDate: '2025-06-30',
    paymentMethod: 'Bank Transfer',
    items: [
      { description: 'Labor - Filter Replacement', quantity: 1, unitPrice: 125, total: 125 },
      { description: 'HEPA Air Filter', quantity: 1, unitPrice: 45.99, total: 45.99 },
      { description: 'Service Fee', quantity: 1, unitPrice: 34.76, total: 34.76 }
    ]
  }
];

// Listeners for invoice updates
const listeners = [];

// Mock invoice service
export const mockInvoiceService = {
  // Get all invoices
  getAll: async () => {
    console.log('Mock - Fetching all invoices');
    return Promise.resolve([...mockInvoices]);
  },
  
  // Get invoice by ID
  getById: async (id) => {
    console.log(`Mock - Fetching invoice ${id}`);
    const invoice = mockInvoices.find(inv => inv.id === id);
    
    if (!invoice) {
      throw new Error(`Invoice with ID ${id} not found`);
    }
    
    return Promise.resolve({ ...invoice });
  },
  
  // Get invoices by customer ID
  getByCustomerId: async (customerId) => {
    console.log(`Mock - Fetching invoices for customer ${customerId}`);
    const customerInvoices = mockInvoices.filter(inv => inv.customerId === customerId);
    return Promise.resolve([...customerInvoices]);
  },
  
  // Create new invoice
  createInvoice: async (invoiceData) => {
    console.log('Mock - Creating new invoice');
    const newInvoice = {
      id: `inv-${uuidv4().substring(0, 8)}`,
      date: new Date().toISOString().split('T')[0],
      ...invoiceData
    };
    
    mockInvoices.push(newInvoice);
    
    // Notify listeners
    listeners.forEach(callback => callback(newInvoice));
    
    return Promise.resolve({ ...newInvoice });
  },
  
  // Update invoice
  updateInvoice: async (invoice) => {
    console.log(`Mock - Updating invoice ${invoice.id}`);
    const index = mockInvoices.findIndex(inv => inv.id === invoice.id);
    
    if (index === -1) {
      throw new Error(`Invoice with ID ${invoice.id} not found`);
    }
    
    mockInvoices[index] = { ...mockInvoices[index], ...invoice };
    
    // Notify listeners
    listeners.forEach(callback => callback(mockInvoices[index]));
    
    return Promise.resolve({ ...mockInvoices[index] });
  },
  
  // Mark invoice as paid
  markAsPaid: async (id, paymentMethod) => {
    console.log(`Mock - Marking invoice ${id} as paid`);
    const index = mockInvoices.findIndex(inv => inv.id === id);
    
    if (index === -1) {
      throw new Error(`Invoice with ID ${id} not found`);
    }
    
    mockInvoices[index] = {
      ...mockInvoices[index],
      status: 'Paid',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod
    };
    
    // Notify listeners
    listeners.forEach(callback => callback(mockInvoices[index]));
    
    return Promise.resolve({ ...mockInvoices[index] });
  },
  
  // Subscribe to invoice updates
  subscribeToUpdates: (callback) => {
    console.log('Mock - Subscribing to invoice updates');
    listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }
};

export default mockInvoiceService;
