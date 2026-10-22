import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  Table,
  SpaceBetween,
  TextFilter,
  Pagination,
  StatusIndicator,
  Button,
  Box,
  ColumnLayout,
  Tabs,
  BarChart,
  PieChart,
  Cards,
  CollectionPreferences,
  Modal,
  FormField,
  Alert,
  Spinner
} from '@cloudscape-design/components';
import { invoiceService, customerService } from '../services/dataService';
import { debugInvoiceService, debugCustomerService } from '../services/debugApiService';
import { API_CONFIG } from '../config/api-config';

function Billing() {
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeTab, setActiveTab] = useState('invoices');
  const [viewType, setViewType] = useState('table');
  const [isInvoiceModalVisible, setIsInvoiceModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [invoicesData, customersData] = await Promise.all([
          debugInvoiceService.getAll(),
          debugCustomerService.getAll()
        ]);
        setInvoices(invoicesData);
        setCustomers(customersData);
        setError(null);
      } catch (err) {
        console.error('Error fetching billing data:', err);
        setError('Failed to load billing data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const invoicesUnsubscribe = debugInvoiceService.subscribeToUpdates((updatedInvoice) => {
      setInvoices(prevInvoices => {
        const index = prevInvoices.findIndex(invoice => invoice.id === updatedInvoice.id);
        if (index >= 0) {
          const newInvoices = [...prevInvoices];
          newInvoices[index] = updatedInvoice;
          return newInvoices;
        }
        return [...prevInvoices, updatedInvoice];
      });
    });
    return () => { invoicesUnsubscribe(); };
  }, []);

  const invoicesByCustomer = invoices.reduce((acc, invoice) => {
    if (!acc[invoice.customerId]) acc[invoice.customerId] = [];
    acc[invoice.customerId].push(invoice);
    return acc;
  }, {});

  const outstandingByCustomer = Object.keys(invoicesByCustomer).map(customerId => {
    const customerInvoices = invoicesByCustomer[customerId];
    const customer = customers.find(c => c.id === customerId) || { name: 'Unknown' };
    const totalAmount = customerInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paidAmount = customerInvoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0);
    return {
      customerId,
      customerName: customer.name,
      totalAmount,
      paidAmount,
      outstandingAmount: totalAmount - paidAmount,
      invoiceCount: customerInvoices.length,
      overdueCount: customerInvoices.filter(inv => inv.status === 'Overdue').length
    };
  });

  const filteredInvoices = invoices.filter(
    invoice =>
      invoice.customer?.toLowerCase().includes(filterText.toLowerCase()) ||
      invoice.invoiceNumber?.toLowerCase().includes(filterText.toLowerCase()) ||
      invoice.status?.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceModalVisible(true);
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'Paid':    return <StatusIndicator type="success">Paid</StatusIndicator>;
      case 'Pending': return <StatusIndicator type="pending">Pending</StatusIndicator>;
      case 'Unpaid':  return <StatusIndicator type="pending">Unpaid</StatusIndicator>;
      case 'Overdue': return <StatusIndicator type="error">Overdue</StatusIndicator>;
      default:        return <StatusIndicator type="stopped">Unknown</StatusIndicator>;
    }
  };

  // Collect all distinct statuses from real data
  const statusCounts = invoices.reduce((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {});

  const STATUS_COLORS = { Paid: '#1d8102', Pending: '#8d6605', Unpaid: '#0972d3', Overdue: '#d91515' };

  const billingStatusData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ title: status, value: count, color: STATUS_COLORS[status] }));

  const outstandingAmountData = {
    series: [{
      title: 'Outstanding Amount', type: 'bar',
      data: outstandingByCustomer
        .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
        .slice(0, 5)
        .map(item => ({ x: item.customerName, y: item.outstandingAmount }))
    }]
  };

  if (loading) {
    return (
      <Container header={<Header variant="h1" description="Manage invoices and billing information">Billing Dashboard</Header>}>
        <Box textAlign="center" padding="l">
          <Spinner size="large" />
          <Box variant="p">Loading billing data...</Box>
        </Box>
      </Container>
    );
  }

  // Invoice modal renderer
  const renderInvoiceModal = () => {
    if (!isInvoiceModalVisible || !selectedInvoice) return null;
    const customer = customers.find(c => c.id === selectedInvoice.customerId);
    const customerName = customer ? customer.name : selectedInvoice.customerId;
    const subtotal = selectedInvoice.amount || 0;
    const tax = subtotal * 0.07;
    const total = subtotal + tax;
    const isPaid = selectedInvoice.status === 'Paid';
    const isOverdue = selectedInvoice.status === 'Overdue';
    const statusColor  = isPaid ? '#1d8102' : isOverdue ? '#d91515' : '#8d6605';
    const statusBg     = isPaid ? '#f2f8f0' : isOverdue ? '#fff5f5' : '#fffbf0';
    const statusBorder = isPaid ? '#c6e6c0' : isOverdue ? '#f5c6c6' : '#f5e0a0';

    return (
      <Modal
        visible={isInvoiceModalVisible}
        onDismiss={() => setIsInvoiceModalVisible(false)}
        header="Invoice"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setIsInvoiceModalVisible(false)}>Close</Button>
              <Button variant="primary" onClick={() => window.print()}>Print Invoice</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: '#0f1b2d', padding: '8px 0' }}>

          {/* Company header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '24px', borderBottom: '2px solid #0972d3' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0972d3', letterSpacing: '-0.5px' }}>FSM Services</div>
              <div style={{ fontSize: '0.85rem', color: '#5f6b7a', marginTop: '4px' }}>Field Service Management</div>
              <div style={{ fontSize: '0.8rem', color: '#5f6b7a', marginTop: '2px' }}>support@fsmservices.com</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f1b2d' }}>INVOICE</div>
              <div style={{ fontSize: '1rem', color: '#5f6b7a', marginTop: '4px' }}>{selectedInvoice.id?.toUpperCase()}</div>
              <div style={{
                display: 'inline-block', marginTop: '8px',
                padding: '4px 12px', borderRadius: '12px',
                fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em',
                color: statusColor, backgroundColor: statusBg, border: `1px solid ${statusBorder}`
              }}>
                {selectedInvoice.status}
              </div>
            </div>
          </div>

          {/* Bill To + Invoice Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5f6b7a', marginBottom: '8px' }}>Bill To</div>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f1b2d' }}>{customerName}</div>
              {selectedInvoice.address && <div style={{ fontSize: '0.85rem', color: '#5f6b7a', marginTop: '4px' }}>{selectedInvoice.address}</div>}
              {selectedInvoice.jobId && <div style={{ fontSize: '0.8rem', color: '#8d99a8', marginTop: '6px' }}>Job Ref: {selectedInvoice.jobId}</div>}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5f6b7a', marginBottom: '8px' }}>Invoice Details</div>
              {[
                { label: 'Invoice Date',  value: selectedInvoice.date || '—' },
                { label: 'Due Date',      value: selectedInvoice.dueDate || 'Net 30' },
                { label: 'Payment Terms', value: 'Net 30 days' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#5f6b7a' }}>{label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f1b2d' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', backgroundColor: '#0972d3', borderRadius: '6px 6px 0 0', padding: '10px 16px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff' }}>Description</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', textAlign: 'right' }}>Amount</span>
            </div>
            {(selectedInvoice.items || []).map((item, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                padding: '12px 16px',
                backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8f9fa',
                borderLeft: '1px solid #e9ebed', borderRight: '1px solid #e9ebed', borderBottom: '1px solid #e9ebed',
              }}>
                <span style={{ fontSize: '0.9rem', color: '#0f1b2d' }}>{item.description}</span>
                <span style={{ fontSize: '0.9rem', color: '#0f1b2d', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${(item.amount || 0).toFixed(2)}</span>
              </div>
            ))}
            {(!selectedInvoice.items || selectedInvoice.items.length === 0) && (
              <div style={{ padding: '16px', textAlign: 'center', color: '#8d99a8', fontSize: '0.85rem', border: '1px solid #e9ebed', borderTop: 'none' }}>
                No line items
              </div>
            )}
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
            <div style={{ width: '260px' }}>
              {[
                { label: 'Subtotal', value: `$${subtotal.toFixed(2)}` },
                { label: 'Tax (7%)', value: `$${tax.toFixed(2)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e9ebed' }}>
                  <span style={{ fontSize: '0.875rem', color: '#5f6b7a' }}>{label}</span>
                  <span style={{ fontSize: '0.875rem', color: '#0f1b2d', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: '4px' }}>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: '#0f1b2d' }}>Total Due</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0972d3', fontVariantNumeric: 'tabular-nums' }}>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div style={{ padding: '14px 16px', backgroundColor: '#f8f9fa', borderRadius: '6px', borderLeft: '3px solid #0972d3' }}>
            <div style={{ fontSize: '0.8rem', color: '#5f6b7a' }}>
              <strong style={{ color: '#0f1b2d' }}>Note: </strong>
              {selectedInvoice.notes || 'Payment is due within 30 days of invoice date. Please include the invoice number with your payment. Thank you for your business.'}
            </div>
          </div>

        </div>
      </Modal>
    );
  };

  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h1" description="Manage invoices and billing information">Billing Dashboard</Header>}>
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>{error}</Alert>
        )}
        <Tabs
          activeTabId={activeTab}
          onChange={({ detail }) => setActiveTab(detail.activeTabId)}
          tabs={[
            {
              label: "Invoices",
              id: "invoices",
              content: (
                <SpaceBetween size="l">
                  <CollectionPreferences
                    title="View preferences"
                    confirmLabel="Confirm"
                    cancelLabel="Cancel"
                    preferences={{ viewType }}
                    onConfirm={({ detail }) => setViewType(detail.viewType)}
                    pageSizePreference={{
                      title: "Page size",
                      options: [
                        { value: 10, label: "10 invoices" },
                        { value: 20, label: "20 invoices" },
                        { value: 50, label: "50 invoices" }
                      ]
                    }}
                    viewPreference={{
                      title: "View",
                      options: [
                        { value: "table", label: "Table" },
                        { value: "cards", label: "Cards" }
                      ]
                    }}
                  />
                  {viewType === 'table' ? (
                    <Table
                      columnDefinitions={[
                        { id: 'invoiceNumber', header: 'Invoice #', cell: item => item.id, sortingField: 'id' },
                        { id: 'customer', header: 'Customer', cell: item => { const c = customers.find(c => c.id === item.customerId); return c ? c.name : item.customerId; } },
                        { id: 'date', header: 'Date', cell: item => item.date },
                        { id: 'amount', header: 'Amount', cell: item => `$${item.amount.toFixed(2)}` },
                        { id: 'status', header: 'Status', cell: item => getStatusIndicator(item.status) },
                        { id: 'dueDate', header: 'Due Date', cell: item => item.dueDate },
                        { id: 'actions', header: 'Actions', cell: item => <Button onClick={() => handleViewInvoice(item)}>View Invoice</Button> }
                      ]}
                      items={filteredInvoices}
                      selectionType="single"
                      onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
                      selectedItems={selectedItems}
                      filter={<TextFilter filteringText={filterText} filteringPlaceholder="Find invoices" filteringAriaLabel="Filter invoices" onChange={({ detail }) => setFilterText(detail.filteringText)} />}
                      pagination={<Pagination currentPageIndex={currentPage} onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)} pagesCount={Math.ceil(filteredInvoices.length / 10)} />}
                      empty={<Box textAlign="center" color="inherit"><b>No invoices</b><Box padding={{ bottom: "s" }} variant="p" color="inherit">No invoices to display.</Box></Box>}
                    />
                  ) : (
                    <Cards
                      cardDefinition={{
                        header: item => item.id,
                        sections: [
                          { id: 'customer', header: 'Customer', content: item => { const c = customers.find(c => c.id === item.customerId); return c ? c.name : item.customerId; } },
                          { id: 'details', header: 'Details', content: item => (
                            <SpaceBetween size="s">
                              <div>Date: {item.date}</div>
                              <div>Due Date: {item.dueDate}</div>
                              <div>Amount: ${item.amount.toFixed(2)}</div>
                              <div>Status: {getStatusIndicator(item.status)}</div>
                            </SpaceBetween>
                          )}
                        ],
                        footer: item => <Button onClick={() => handleViewInvoice(item)}>View Invoice</Button>
                      }}
                      cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }]}
                      items={filteredInvoices}
                      filter={<TextFilter filteringText={filterText} filteringPlaceholder="Find invoices" filteringAriaLabel="Filter invoices" onChange={({ detail }) => setFilterText(detail.filteringText)} />}
                      pagination={<Pagination currentPageIndex={currentPage} onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)} pagesCount={Math.ceil(filteredInvoices.length / 10)} />}
                    />
                  )}
                </SpaceBetween>
              )
            },
            {
              label: "Customer Balances",
              id: "balances",
              content: (() => {
                const totalOutstanding = outstandingByCustomer.reduce((s, c) => s + c.outstandingAmount, 0);
                const totalPaid = outstandingByCustomer.reduce((s, c) => s + c.paidAmount, 0);
                const overdueCustomers = outstandingByCustomer.filter(c => c.overdueCount > 0).length;
                const sorted = [...outstandingByCustomer].sort((a, b) => b.outstandingAmount - a.outstandingAmount);
                return (
                  <SpaceBetween size="l">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      {[
                        { label: 'Total Outstanding',    value: '$' + totalOutstanding.toFixed(2), color: '#d91515', bg: '#fff5f5', border: '#f5c6c6' },
                        { label: 'Total Collected',      value: '$' + totalPaid.toFixed(2),        color: '#1d8102', bg: '#f2f8f0', border: '#c6e6c0' },
                        { label: 'Customers w/ Overdue', value: overdueCustomers,                  color: '#8d6605', bg: '#fffbf0', border: '#f5e0a0' },
                      ].map(({ label, value, color, bg, border }) => (
                        <div key={label} style={{ padding: '20px', borderRadius: '8px', backgroundColor: bg, border: '1px solid ' + border }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5f6b7a', marginBottom: '8px' }}>{label}</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '800', color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                      {sorted.map(item => {
                        const paidPct = item.totalAmount > 0 ? Math.round((item.paidAmount / item.totalAmount) * 100) : 0;
                        const hasOverdue = item.overdueCount > 0;
                        const isFullyPaid = item.outstandingAmount <= 0;
                        return (
                          <div key={item.customerId} style={{ border: '1px solid ' + (hasOverdue ? '#f5c6c6' : '#d5dbdb'), borderRadius: '8px', padding: '20px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                              <div>
                                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f1b2d' }}>{item.customerName}</div>
                                <div style={{ fontSize: '0.8rem', color: '#8d99a8', marginTop: '2px' }}>{item.invoiceCount} invoice{item.invoiceCount !== 1 ? 's' : ''}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {isFullyPaid && <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', color: '#1d8102', backgroundColor: '#f2f8f0', border: '1px solid #c6e6c0' }}>Paid</span>}
                                {hasOverdue && <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700', color: '#d91515', backgroundColor: '#fff5f5', border: '1px solid #f5c6c6' }}>{item.overdueCount} Overdue</span>}
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                              {[
                                { label: 'Total Billed', value: '$' + item.totalAmount.toFixed(2),       color: '#0f1b2d' },
                                { label: 'Collected',    value: '$' + item.paidAmount.toFixed(2),        color: '#1d8102' },
                                { label: 'Outstanding',  value: '$' + item.outstandingAmount.toFixed(2), color: item.outstandingAmount > 0 ? '#d91515' : '#1d8102' },
                              ].map(({ label, value, color }) => (
                                <div key={label}>
                                  <div style={{ fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8d99a8', marginBottom: '2px' }}>{label}</div>
                                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                                </div>
                              ))}
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#5f6b7a' }}>Collection rate</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: paidPct === 100 ? '#1d8102' : '#0972d3' }}>{paidPct}%</span>
                              </div>
                              <div style={{ height: '6px', backgroundColor: '#f2f3f3', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: paidPct + '%', backgroundColor: paidPct === 100 ? '#1d8102' : hasOverdue ? '#d91515' : '#0972d3', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {outstandingByCustomer.length === 0 && (
                      <Box textAlign="center" color="inherit">
                        <b>No customer balances</b>
                        <Box padding={{ bottom: "s" }} variant="p" color="inherit">No customer balance data to display.</Box>
                      </Box>
                    )}
                  </SpaceBetween>
                );
              })()
            },
            {
              label: "Billing Overview",
              id: "overview",
              content: (
                <ColumnLayout columns={2}>
                  <Container header={<Header variant="h3">Invoice Status</Header>}>
                    <PieChart
                      data={billingStatusData}
                      hideFilter
                      height={300}
                      segmentDescription={(datum) => datum.value + ' invoice' + (datum.value !== 1 ? 's' : '')}
                      detailPopoverContent={(datum) => [
                        { key: 'Count', value: datum.value },
                        { key: 'Percentage', value: Math.round((datum.value / invoices.length) * 100) + '%' }
                      ]}
                      i18nStrings={{ detailsValue: 'Count', detailsPercentage: 'Percentage', chartAriaRoleDescription: 'pie chart' }}
                      empty={<Box textAlign="center" color="inherit">No invoice data</Box>}
                      noMatch={<Box textAlign="center" color="inherit">No matching data</Box>}
                    />
                  </Container>
                  <Container header={<Header variant="h3">Top Outstanding Balances</Header>}>
                    <BarChart series={outstandingAmountData.series} hideFilter height={300} xTitle="Customer" yTitle="Amount ($)" i18nStrings={{ xTickFormatter: value => value.length > 10 ? `${value.substring(0, 10)}...` : value }} />
                  </Container>
                </ColumnLayout>
              )
            }
          ]}
        />
      </Container>

      {renderInvoiceModal()}
    </SpaceBetween>
  );
}

export default Billing;
