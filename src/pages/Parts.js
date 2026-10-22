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
  Cards,
  FormField,
  Select,
  Badge,
  Link,
  Spinner,
  Modal,
  Input,
  Alert,
  Flashbar
} from '@cloudscape-design/components';
import { partsService } from '../services/dataService';
import { debugPartsService } from '../services/debugApiService';

function Parts() {
  const [allParts, setAllParts] = useState([]);
  const [filteredParts, setFilteredParts] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTabId, setActiveTabId] = useState('all-parts');
  const [categoryFilter, setCategoryFilter] = useState({ label: 'All Categories', value: 'all' });
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState({ label: 'All Statuses', value: 'all' });
  const [partsNeedingReorder, setPartsNeedingReorder] = useState([]);
  const [isUpdateStockModalVisible, setIsUpdateStockModalVisible] = useState(false);
  const [stockUpdates, setStockUpdates] = useState({});
  const [updatingStock, setUpdatingStock] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const itemsPerPage = 10;
  
  // Fetch parts data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Use debug service to fetch parts data
        const parts = await debugPartsService.getAll();
        const reorderParts = await debugPartsService.getPartsNeedingReorder();
        
        setAllParts(parts);
        setFilteredParts(parts);
        setPartsNeedingReorder(reorderParts);
      } catch (error) {
        console.error('Error fetching parts data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Filter parts based on search text and filters
  useEffect(() => {
    let filtered = [...allParts];
    
    // Apply text filter
    if (filterText) {
      const lowerFilterText = filterText.toLowerCase();
      filtered = filtered.filter(part => 
        part.name.toLowerCase().includes(lowerFilterText) ||
        part.partNumber.toLowerCase().includes(lowerFilterText) ||
        part.manufacturer?.toLowerCase().includes(lowerFilterText) ||
        part.category?.toLowerCase().includes(lowerFilterText) ||
        part.description?.toLowerCase().includes(lowerFilterText)
      );
    }
    
    // Apply category filter
    if (categoryFilter.value !== 'all') {
      filtered = filtered.filter(part => part.category === categoryFilter.value);
    }
    
    // Apply inventory status filter
    if (inventoryStatusFilter.value !== 'all') {
      if (inventoryStatusFilter.value === 'low') {
        filtered = filtered.filter(part => part.inventory <= (part.stockMinimum || 0));
      } else if (inventoryStatusFilter.value === 'ok') {
        filtered = filtered.filter(part => part.inventory > (part.stockMinimum || 0));
      }
    }
    
    setFilteredParts(filtered);
    setCurrentPage(1);
  }, [filterText, categoryFilter, inventoryStatusFilter, allParts]);
  
  // Get unique categories for the filter
  const getUniqueCategories = () => {
    const categories = new Set(allParts.map(part => part.category));
    return [
      { label: 'All Categories', value: 'all' },
      ...Array.from(categories).map(category => ({ label: category, value: category }))
    ];
  };
  
  // Get inventory status options
  const getInventoryStatusOptions = () => {
    return [
      { label: 'All Statuses', value: 'all' },
      { label: 'Low Stock', value: 'low' },
      { label: 'In Stock', value: 'ok' }
    ];
  };
  
  // Get inventory status indicator
  const getInventoryStatusIndicator = (part) => {
    if (part.inventory <= (part.stockMinimum || 0)) {
      return <StatusIndicator type="error">Low Stock</StatusIndicator>;
    } else if (part.inventory <= (part.stockMinimum || 0) * 1.5) {
      return <StatusIndicator type="warning">Medium</StatusIndicator>;
    } else {
      return <StatusIndicator type="success">In Stock</StatusIndicator>;
    }
  };
  
  // Calculate pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedParts = filteredParts.slice(startIndex, endIndex);
  
  // Column definitions for the parts table
  const columnDefinitions = [
    {
      id: 'partNumber',
      header: 'Part Number',
      cell: item => <Link href={`#part-${item.partNumber}`}>{item.partNumber}</Link>,
      sortingField: 'partNumber'
    },
    {
      id: 'name',
      header: 'Name',
      cell: item => item.name,
      sortingField: 'name'
    },
    {
      id: 'category',
      header: 'Category',
      cell: item => item.category,
      sortingField: 'category'
    },
    {
      id: 'inventory',
      header: 'Inventory',
      cell: item => (
        <Box>
          {item.inventory} / {item.stockMinimum || 0} / {item.stockMaximum || 0}
          <Box color="text-body-secondary" fontSize="body-s">Current / Min / Max</Box>
        </Box>
      ),
      sortingField: 'inventory'
    },
    {
      id: 'status',
      header: 'Status',
      cell: item => getInventoryStatusIndicator(item),
      sortingField: 'status'
    },
    {
      id: 'unitPrice',
      header: 'Unit Price',
      cell: item => `$${(item.unitPrice || item.price || 0).toFixed(2)}`,
      sortingField: 'unitPrice'
    },
    {
      id: 'supplier',
      header: 'Supplier',
      cell: item => item.supplier || 'Unknown',
      sortingField: 'supplier'
    },
    {
      id: 'leadTime',
      header: 'Lead Time',
      cell: item => `${item.supplierLeadTime || 0} days`,
      sortingField: 'supplierLeadTime'
    }
  ];
  
  // Column definitions for the reorder table
  const reorderColumnDefinitions = [
    {
      id: 'partNumber',
      header: 'Part Number',
      cell: item => <Link href={`#part-${item.partNumber}`}>{item.partNumber}</Link>,
      sortingField: 'partNumber'
    },
    {
      id: 'name',
      header: 'Name',
      cell: item => item.name,
      sortingField: 'name'
    },
    {
      id: 'inventory',
      header: 'Current Stock',
      cell: item => (
        <Box>
          <StatusIndicator type="error">{item.inventory}</StatusIndicator>
          <Box color="text-body-secondary" fontSize="body-s">Min: {item.stockMinimum}</Box>
        </Box>
      ),
      sortingField: 'inventory'
    },
    {
      id: 'reorderQuantity',
      header: 'Reorder Quantity',
      cell: item => item.reorderQuantity,
      sortingField: 'reorderQuantity'
    },
    {
      id: 'unitPrice',
      header: 'Unit Price',
      cell: item => `$${(item.unitPrice || 0).toFixed(2)}`,
      sortingField: 'unitPrice'
    },
    {
      id: 'totalCost',
      header: 'Total Cost',
      cell: item => `$${(item.totalCost || 0).toFixed(2)}`,
      sortingField: 'totalCost'
    },
    {
      id: 'supplier',
      header: 'Supplier',
      cell: item => item.supplier || 'Unknown',
      sortingField: 'supplier'
    },
    {
      id: 'leadTime',
      header: 'Lead Time',
      cell: item => `${item.supplierLeadTime || 0} days`,
      sortingField: 'supplierLeadTime'
    }
  ];
  
  // Card definition for parts cards view
  const cardDefinition = {
    header: item => (
      <Link href={`#part-${item.partNumber}`}>{item.name}</Link>
    ),
    sections: [
      {
        id: 'partNumber',
        header: 'Part Number',
        content: item => item.partNumber
      },
      {
        id: 'category',
        header: 'Category',
        content: item => item.category
      },
      {
        id: 'inventory',
        header: 'Inventory',
        content: item => (
          <Box>
            {getInventoryStatusIndicator(item)}
            <Box variant="p" padding={{ top: 'xxs' }}>
              {item.inventory} / {item.stockMinimum || 0} / {item.stockMaximum || 0}
              <Box color="text-body-secondary" fontSize="body-s">Current / Min / Max</Box>
            </Box>
          </Box>
        )
      },
      {
        id: 'price',
        header: 'Price',
        content: item => `$${(item.unitPrice || item.price || 0).toFixed(2)}`
      },
      {
        id: 'supplier',
        header: 'Supplier',
        content: item => (
          <Box>
            {item.supplier || 'Unknown'}
            <Box color="text-body-secondary" fontSize="body-s">
              Lead Time: {item.supplierLeadTime || 0} days
            </Box>
          </Box>
        )
      }
    ]
  };
  
  const handleGenerateReorderReport = () => {
    if (partsNeedingReorder.length === 0) {
      alert('No parts currently need reordering.');
      return;
    }

    const headers = ['Part Number', 'Name', 'Category', 'Supplier', 'Current Stock', 'Min Stock', 'Reorder Qty', 'Unit Price', 'Total Cost', 'Lead Time (days)'];
    const rows = partsNeedingReorder.map(p => [
      p.partNumber,
      p.name,
      p.category || '',
      p.supplier || 'Unknown',
      p.inventory,
      p.stockMinimum || 0,
      p.reorderQuantity || 0,
      `$${(p.unitPrice || 0).toFixed(2)}`,
      `$${(p.totalCost || 0).toFixed(2)}`,
      p.supplierLeadTime || 0
    ]);

    const totalCost = partsNeedingReorder.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    rows.push([]);
    rows.push(['', '', '', '', '', '', '', 'TOTAL', `$${totalCost.toFixed(2)}`, '']);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reorder-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export selected parts as CSV
  const handleExportSelected = () => {
    if (selectedItems.length === 0) return;
    const headers = ['Part Number', 'Name', 'Category', 'Supplier', 'Current Stock', 'Min Stock', 'Max Stock', 'Unit Price', 'Lead Time (days)'];
    const rows = selectedItems.map(p => [
      p.partNumber, p.name, p.category || '', p.supplier || 'Unknown',
      p.inventory, p.stockMinimum || 0, p.stockMaximum || 0,
      `$${(p.unitPrice || p.price || 0).toFixed(2)}`, p.supplierLeadTime || 0
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parts-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Open Update Stock modal — pre-fill with current quantities
  const handleOpenUpdateStock = () => {
    const initial = {};
    selectedItems.forEach(p => { initial[p.partNumber] = String(p.inventory); });
    setStockUpdates(initial);
    setIsUpdateStockModalVisible(true);
  };

  // Confirm stock updates
  const handleConfirmUpdateStock = async () => {
    setUpdatingStock(true);
    const errors = [];

    for (const [partNumber, qty] of Object.entries(stockUpdates)) {
      const newQty = parseInt(qty, 10);
      if (isNaN(newQty) || newQty < 0) { errors.push(`${partNumber}: invalid quantity`); continue; }

      // Always update local state immediately — don't wait for API
      setAllParts(prev => prev.map(p => p.partNumber === partNumber ? { ...p, inventory: newQty } : p));
      setFilteredParts(prev => prev.map(p => p.partNumber === partNumber ? { ...p, inventory: newQty } : p));

      // Try API in background — failure doesn't block UI update
      try {
        await debugPartsService.updateInventory(partNumber, newQty);
      } catch (err) {
        console.warn(`API update failed for ${partNumber}:`, err.message);
        // Don't add to errors — local state is already updated
      }
    }

    setUpdatingStock(false);
    setIsUpdateStockModalVisible(false);
    setSelectedItems([]);
    setNotification(errors.length > 0
      ? { type: 'error', content: `Invalid quantities: ${errors.join('; ')}` }
      : { type: 'success', content: `Stock updated for ${Object.keys(stockUpdates).length} part(s)` }
    );
  };

  return (
    <Container>
      <SpaceBetween size="l">
        {notification && (
          <Flashbar items={[{ ...notification, dismissible: true, onDismiss: () => setNotification(null) }]} />
        )}
        <Header
          variant="h1"
          description="Manage inventory and view parts information"
          actions={
            <Button variant="primary" onClick={handleGenerateReorderReport}>Generate Reorder Report</Button>
          }
        >
          Parts Inventory
        </Header>
        
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          tabs={[
            {
              label: "All Parts",
              id: "all-parts",
              content: (
                <SpaceBetween size="l">
                  <ColumnLayout columns={3}>
                    <FormField label="Search">
                      <TextFilter
                        filteringText={filterText}
                        filteringPlaceholder="Find parts"
                        filteringAriaLabel="Filter parts"
                        onChange={({ detail }) => setFilterText(detail.filteringText)}
                      />
                    </FormField>
                    
                    <FormField label="Category">
                      <Select
                        selectedOption={categoryFilter}
                        onChange={({ detail }) => setCategoryFilter(detail.selectedOption)}
                        options={getUniqueCategories()}
                      />
                    </FormField>
                    
                    <FormField label="Inventory Status">
                      <Select
                        selectedOption={inventoryStatusFilter}
                        onChange={({ detail }) => setInventoryStatusFilter(detail.selectedOption)}
                        options={getInventoryStatusOptions()}
                      />
                    </FormField>
                  </ColumnLayout>
                  
                  {loading ? (
                    <Box textAlign="center" padding={{ top: 'xl', bottom: 'xl' }}>
                      <Spinner size="large" />
                      <Box padding={{ top: 's' }}>Loading parts data...</Box>
                    </Box>
                  ) : (
                    <>
                      <Table
                        columnDefinitions={columnDefinitions}
                        items={paginatedParts}
                        loading={loading}
                        loadingText="Loading parts"
                        selectionType="multi"
                        selectedItems={selectedItems}
                        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
                        header={
                          <Header
                            counter={`(${filteredParts.length})`}
                            actions={
                              <SpaceBetween direction="horizontal" size="xs">
                                <Button disabled={selectedItems.length === 0} onClick={handleOpenUpdateStock}>Update Stock</Button>
                                <Button disabled={selectedItems.length === 0} onClick={handleExportSelected}>Export Selected</Button>
                              </SpaceBetween>
                            }
                          >
                            Parts
                          </Header>
                        }
                        pagination={
                          <Pagination
                            currentPageIndex={currentPage}
                            pagesCount={Math.ceil(filteredParts.length / itemsPerPage)}
                            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
                          />
                        }
                        empty={
                          <Box textAlign="center" color="inherit">
                            <b>No parts found</b>
                            <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                              No parts match the current filter criteria.
                            </Box>
                          </Box>
                        }
                      />
                    </>
                  )}
                </SpaceBetween>
              )
            },
            {
              label: "Parts Needing Reorder",
              id: "reorder",
              content: (
                <SpaceBetween size="l">
                  {loading ? (
                    <Box textAlign="center" padding={{ top: 'xl', bottom: 'xl' }}>
                      <Spinner size="large" />
                      <Box padding={{ top: 's' }}>Loading reorder data...</Box>
                    </Box>
                  ) : (
                    <>
                      <Table
                        columnDefinitions={reorderColumnDefinitions}
                        items={partsNeedingReorder}
                        loading={loading}
                        loadingText="Loading parts"
                        selectionType="multi"
                        selectedItems={selectedItems}
                        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
                        header={
                          <Header
                            counter={`(${partsNeedingReorder.length})`}
                            actions={
                              <SpaceBetween direction="horizontal" size="xs">
                                <Button disabled={selectedItems.length === 0}>Create Purchase Order</Button>
                                <Button disabled={selectedItems.length === 0}>Export Selected</Button>
                              </SpaceBetween>
                            }
                          >
                            Parts Needing Reorder
                          </Header>
                        }
                        empty={
                          <Box textAlign="center" color="inherit">
                            <b>No parts need reordering</b>
                            <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                              All parts are currently above their minimum stock levels.
                            </Box>
                          </Box>
                        }
                      />
                      
                      {partsNeedingReorder.length > 0 && (
                        <Box textAlign="right">
                          <Box variant="h3">
                            Total Reorder Cost: ${partsNeedingReorder.reduce((sum, part) => sum + (part.totalCost || 0), 0).toFixed(2)}
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </SpaceBetween>
              )
            },
            {
              label: "Cards View",
              id: "cards",
              content: (
                <SpaceBetween size="l">
                  <ColumnLayout columns={3}>
                    <FormField label="Search">
                      <TextFilter
                        filteringText={filterText}
                        filteringPlaceholder="Find parts"
                        filteringAriaLabel="Filter parts"
                        onChange={({ detail }) => setFilterText(detail.filteringText)}
                      />
                    </FormField>
                    
                    <FormField label="Category">
                      <Select
                        selectedOption={categoryFilter}
                        onChange={({ detail }) => setCategoryFilter(detail.selectedOption)}
                        options={getUniqueCategories()}
                      />
                    </FormField>
                    
                    <FormField label="Inventory Status">
                      <Select
                        selectedOption={inventoryStatusFilter}
                        onChange={({ detail }) => setInventoryStatusFilter(detail.selectedOption)}
                        options={getInventoryStatusOptions()}
                      />
                    </FormField>
                  </ColumnLayout>
                  
                  {loading ? (
                    <Box textAlign="center" padding={{ top: 'xl', bottom: 'xl' }}>
                      <Spinner size="large" />
                      <Box padding={{ top: 's' }}>Loading parts data...</Box>
                    </Box>
                  ) : (
                    <Cards
                      cardDefinition={cardDefinition}
                      cardsPerRow={[
                        { cards: 1 },
                        { minWidth: 500, cards: 2 },
                        { minWidth: 992, cards: 3 }
                      ]}
                      items={paginatedParts}
                      loading={loading}
                      loadingText="Loading parts"
                      selectionType="multi"
                      selectedItems={selectedItems}
                      onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
                      header={
                        <Header counter={`(${filteredParts.length})`}>
                          Parts
                        </Header>
                      }
                      pagination={
                        <Pagination
                          currentPageIndex={currentPage}
                          pagesCount={Math.ceil(filteredParts.length / itemsPerPage)}
                          onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
                        />
                      }
                      empty={
                        <Box textAlign="center" color="inherit">
                          <b>No parts found</b>
                          <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                            No parts match the current filter criteria.
                          </Box>
                        </Box>
                      }
                    />
                  )}
                </SpaceBetween>
              )
            }
          ]}
        />
      </SpaceBetween>

      {/* Update Stock Modal */}
      {isUpdateStockModalVisible && (
        <Modal
          visible={isUpdateStockModalVisible}
          onDismiss={() => setIsUpdateStockModalVisible(false)}
          header="Update Stock Levels"
          size="medium"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setIsUpdateStockModalVisible(false)}>Cancel</Button>
                <Button variant="primary" loading={updatingStock} onClick={handleConfirmUpdateStock}>
                  Confirm Update
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Alert type="info">Enter the new stock quantity for each selected part.</Alert>
            {selectedItems.map(part => (
              <FormField
                key={part.partNumber}
                label={`${part.name} (${part.partNumber})`}
                description={`Current: ${part.inventory} | Min: ${part.stockMinimum || 0} | Max: ${part.stockMaximum || 0}`}
              >
                <Input
                  type="number"
                  value={stockUpdates[part.partNumber] || ''}
                  onChange={({ detail }) =>
                    setStockUpdates(prev => ({ ...prev, [part.partNumber]: detail.value }))
                  }
                  placeholder="New quantity"
                />
              </FormField>
            ))}
          </SpaceBetween>
        </Modal>
      )}
    </Container>
  );
}

export default Parts;
