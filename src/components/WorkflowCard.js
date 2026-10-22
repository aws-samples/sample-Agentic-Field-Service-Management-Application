import React, { useState } from 'react';
import { Box, Button, StatusIndicator, SpaceBetween } from '@cloudscape-design/components';

const TYPE_LABELS = {
  service_call: 'Service Call',
  maintenance_completion: 'Maintenance Completion',
  system_alert: 'System Alert',
};

// Simple inline markdown renderer — handles **bold**, bullet lists, line breaks
const MarkdownText = ({ text }) => {
  if (!text) return null;
  const normalized = text.replace(/\\n/g, '\n').replace(/\\t/g, '  ');
  return (
    <div style={{ lineHeight: '1.6' }}>
      {normalized.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: '6px' }} />;

        // Bullet point
        const isBullet = /^[-*•]\s/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[-*•]\s/, '') : trimmed;

        // Parse **bold** inline
        const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
              <span style={{ color: '#0972d3', flexShrink: 0 }}>•</span>
              <span>{parts}</span>
            </div>
          );
        }
        // Heading-like lines (start with **)
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return <div key={i} style={{ fontWeight: '700', marginTop: '8px', marginBottom: '2px' }}>{trimmed.slice(2, -2)}</div>;
        }
        return <div key={i}>{parts}</div>;
      })}
    </div>
  );
};

const WorkflowCard = ({ workflow, onViewWorkflow }) => {
  const [expandedStep, setExpandedStep] = useState(null);

  const getStatusIndicator = (status) => {
    switch (status.toLowerCase()) {
      case 'processing': return <StatusIndicator type="in-progress">In Progress</StatusIndicator>;
      case 'success':    return <StatusIndicator type="success">Completed</StatusIndicator>;
      case 'error':      return <StatusIndicator type="error">Error</StatusIndicator>;
      default:           return <StatusIndicator type="pending">Pending</StatusIndicator>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const completedCount = (workflow.steps || []).filter(s => s.status.toLowerCase() === 'success').length;
  const totalSteps = (workflow.steps || []).length;
  const completionPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isComplete = completionPct === 100;
  const isProcessing = workflow.status.toLowerCase() === 'processing';

  const currentStep = (workflow.steps || []).find(s => s.status.toLowerCase() === 'processing')
    || (workflow.steps || []).slice(-1)[0];

  const typeLabel = TYPE_LABELS[workflow.type] || workflow.type;

  return (
    <div style={{
      border: '1px solid #d5dbdb',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '12px',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '1rem', color: '#0f1b2d', marginBottom: '2px' }}>{typeLabel}</div>
          <div style={{ fontSize: '0.8rem', color: '#5f6b7a' }}>{workflow.id}</div>
        </div>
        {getStatusIndicator(workflow.status)}
      </div>

      {/* Meta row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Started',      value: formatDate(workflow.startTime) },
          { label: 'Completed',    value: formatDate(workflow.endTime) },
          { label: 'Initiated By', value: workflow.initiatedBy },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '0.75rem', color: '#5f6b7a', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            <div style={{ fontSize: '0.875rem', color: '#0f1b2d' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar + step bubbles with reasoning */}
      {totalSteps > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#5f6b7a' }}>Progress</span>
            <span style={{ fontSize: '0.8rem', color: '#5f6b7a' }}>{completedCount}/{totalSteps} steps</span>
          </div>
          <div style={{ height: '6px', backgroundColor: '#f2f3f3', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${completionPct}%`,
              backgroundColor: isComplete ? '#1d8102' : '#0972d3',
              borderRadius: '3px', transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Step bubbles — click to expand reasoning */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
            {workflow.steps.map((step, i) => {
              const isDone = step.status.toLowerCase() === 'success';
              const isActive = step.status.toLowerCase() === 'processing';
              const isExpanded = expandedStep === i;
              const hasReasoning = !!step.reasoning;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%' }}>
                  <div
                    onClick={() => hasReasoning && setExpandedStep(isExpanded ? null : i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '0.75rem',
                      color: isDone ? '#1d8102' : isActive ? '#0972d3' : '#8d99a8',
                      backgroundColor: isDone ? '#f2f8f0' : isActive ? '#f0f6ff' : '#f8f8f8',
                      border: `1px solid ${isDone ? '#c6e6c0' : isActive ? '#b8d5f5' : '#e0e0e0'}`,
                      borderRadius: isExpanded ? '12px 12px 4px 4px' : '12px',
                      padding: '3px 10px',
                      whiteSpace: 'nowrap',
                      cursor: hasReasoning ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.65rem' }}>{isDone ? '✓' : isActive ? '●' : '○'}</span>
                    {step.step}
                    {hasReasoning && <span style={{ fontSize: '0.6rem', marginLeft: '2px', opacity: 0.7 }}>{isExpanded ? '▲' : '▼'}</span>}
                  </div>
                  {isExpanded && hasReasoning && (
                    <div style={{
                      fontSize: '0.75rem', color: '#0f1b2d', lineHeight: '1.5',
                      padding: '8px 10px',
                      backgroundColor: isDone ? '#f2f8f0' : '#f0f6ff',
                      border: `1px solid ${isDone ? '#c6e6c0' : '#b8d5f5'}`,
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      maxWidth: '320px',
                    }}>
                      <MarkdownText text={step.reasoning} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current/last step banner */}
      {currentStep && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: isProcessing ? '#f0f6ff' : '#f8f8f8',
          border: `1px solid ${isProcessing ? '#b8d5f5' : '#e0e0e0'}`,
          borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', color: '#0f1b2d',
        }}>
          <span style={{ color: '#5f6b7a', marginRight: '6px' }}>{isProcessing ? 'Current step:' : 'Last step:'}</span>
          <strong>{currentStep.step}</strong>
          <span style={{ color: '#5f6b7a' }}> · {currentStep.agent}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => onViewWorkflow(workflow)}>View Details</Button>
      </div>
    </div>
  );
};

export default WorkflowCard;
