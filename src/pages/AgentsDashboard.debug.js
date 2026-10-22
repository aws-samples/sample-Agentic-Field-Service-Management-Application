import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Tabs,
  Table,
  Box,
  ColumnLayout,
  StatusIndicator,
  Button,
  Modal,
  Alert,
  Badge
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';

// Debug version of the WorkflowTable component
const WorkflowTable = ({ workflows, onViewWorkflow }) => {
  console.log('WorkflowTable rendering with workflows:', workflows);
  
  // Always call hooks at the top level
  const { items, collectionProps, paginationProps } = useCollection(
    workflows,
    {
      pagination: { pageSize: 10 }
    }
  );

  console.log('useCollection returned:', { items, collectionProps, paginationProps });

  try {
    return (
      <div>
        <h2>Agent Workflows</h2>
        <p>Total workflows: {workflows.length}</p>
        <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map(item => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.type}</td>
                <td>{item.status}</td>
                <td>{new Date(item.startTime).toLocaleString()}</td>
                <td>{item.endTime ? new Date(item.endTime).toLocaleString() : '-'}</td>
                <td>
                  <button onClick={() => onViewWorkflow(item)}>View Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } catch (error) {
    console.error('Error in WorkflowTable:', error);
    return (
      <div>
        <h2>Error in WorkflowTable</h2>
        <pre>{error.toString()}</pre>
        <pre>{error.stack}</pre>
      </div>
    );
  }
};

// Debug version of the AgentsDashboard component
const AgentsDashboardDebug = () => {
  const [activeTabId, setActiveTabId] = useState('agents');
  const [error, setError] = useState(null);
  
  // Minimal mock data for testing
  const mockWorkflows = [
    {
      id: 'wf-001',
      type: 'service_call',
      status: 'SUCCESS',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      initiatedBy: 'System',
      steps: []
    }
  ];

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description="Debug version of AI agents dashboard"
        >
          AI Agents Dashboard (Debug)
        </Header>
        
        {error && <Alert type="error">{error}</Alert>}
        
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          tabs={[
            {
              id: 'agents',
              label: 'Agents',
              content: (
                <div>
                  <h2>Agents Tab Content</h2>
                  <p>This is a placeholder for the agents tab content.</p>
                </div>
              ),
            },
            {
              id: 'workflows',
              label: 'Workflows',
              content: (
                <div>
                  <h3>Workflows Tab Content</h3>
                  <p>Testing WorkflowTable component:</p>
                  <WorkflowTable 
                    workflows={mockWorkflows} 
                    onViewWorkflow={(workflow) => console.log('View workflow:', workflow)} 
                  />
                </div>
              ),
            },
          ]}
        />
      </SpaceBetween>
    </Container>
  );
};

export default AgentsDashboardDebug;
