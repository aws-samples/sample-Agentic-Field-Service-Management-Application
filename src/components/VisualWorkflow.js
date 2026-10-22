import React from 'react';
import { Box, StatusIndicator } from '@cloudscape-design/components';

// Visual representation of a workflow with connected steps
const VisualWorkflow = ({ workflow }) => {
  if (!workflow || !workflow.steps || workflow.steps.length === 0) {
    return <div>No workflow steps available</div>;
  }

  // Status indicator component
  const getStatusIndicator = (status) => {
    switch (status) {
      case 'processing':
        return <StatusIndicator type="in-progress">Processing</StatusIndicator>;
      case 'success':
        return <StatusIndicator type="success">Success</StatusIndicator>;
      case 'error':
        return <StatusIndicator type="error">Error</StatusIndicator>;
      default:
        return <StatusIndicator type="pending">Pending</StatusIndicator>;
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="visual-workflow">
      <style>
        {`
          .visual-workflow {
            padding: 20px;
            overflow-x: auto;
          }
          .workflow-container {
            display: flex;
            flex-direction: column;
            gap: 30px;
            position: relative;
            padding: 10px 0;
          }
          .workflow-step {
            display: flex;
            align-items: center;
            position: relative;
          }
          .step-connector {
            position: absolute;
            left: 25px;
            top: -30px;
            height: 30px;
            width: 2px;
            background-color: #d5dbdb;
            z-index: 1;
          }
          .step-node {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background-color: #f2f3f3;
            border: 2px solid #d5dbdb;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            z-index: 2;
            position: relative;
          }
          .step-node.success {
            border-color: #1d8102;
            background-color: #f2f8f0;
          }
          .step-node.processing {
            border-color: #0972d3;
            background-color: #f1f8ff;
            animation: pulse 2s infinite;
          }
          .step-node.error {
            border-color: #d91515;
            background-color: #fdf3f3;
          }
          .step-content {
            margin-left: 20px;
            flex: 1;
            padding: 15px;
            border: 1px solid #d5dbdb;
            border-radius: 8px;
            background-color: #ffffff;
          }
          .step-title {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .step-agent {
            color: #5f6b7a;
            margin-bottom: 10px;
          }
          .step-times {
            display: flex;
            justify-content: space-between;
            font-size: 0.9em;
            color: #5f6b7a;
          }
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(9, 114, 211, 0.4);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(9, 114, 211, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(9, 114, 211, 0);
            }
          }
        `}
      </style>
      <Box variant="h3">Workflow: {workflow.id} - {workflow.type}</Box>
      <div className="workflow-container">
        {workflow.steps.map((step, index) => (
          <div className="workflow-step" key={index}>
            {index > 0 && <div className="step-connector"></div>}
            <div className={`step-node ${step.status.toLowerCase()}`}>
              {index + 1}
            </div>
            <div className="step-content">
              <div className="step-title">{step.step}</div>
              <div className="step-agent">{step.agent}</div>
              <div className="step-status">
                {getStatusIndicator(step.status.toLowerCase())}
              </div>
              <div className="step-times">
                <div>Start: {formatDate(step.startTime)}</div>
                <div>End: {formatDate(step.endTime)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VisualWorkflow;
