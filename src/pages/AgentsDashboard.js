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
  Badge,
  Toggle
} from '@cloudscape-design/components';
import { getApiConfig } from '../config/api-config';
import { getAuthHeaders } from '../utils/auth-headers';
import VisualWorkflow from '../components/VisualWorkflow';
import WorkflowCard from '../components/WorkflowCard';
import AgentChat from '../components/AgentChat';

const API_CONFIG = getApiConfig();

// Agent status mapping
const AGENT_STATUS = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error'
};

// Agent status indicator component
const AgentStatusIndicator = ({ status }) => {
  switch (status) {
    case AGENT_STATUS.PROCESSING:
      return <StatusIndicator type="in-progress">Processing</StatusIndicator>;
    case AGENT_STATUS.SUCCESS:
      return <StatusIndicator type="success">Success</StatusIndicator>;
    case AGENT_STATUS.ERROR:
      return <StatusIndicator type="error">Error</StatusIndicator>;
    default:
      return <StatusIndicator type="pending">Idle</StatusIndicator>;
  }
};

// Agent card component
const AgentCard = ({ agent, onViewDetails }) => {
  return (
    <Box
      padding="l"
      borderRadius="default"
      variant="outlined"
    >
      <SpaceBetween size="m">
        <Header
          variant="h3"
          description={agent.description}
        >
          {agent.name}
        </Header>
        <AgentStatusIndicator status={agent.status} />
        <div>
          <Box variant="awsui-key-label">Active Workflows</Box>
          <div>{agent.activeWorkflows}</div>
        </div>
        <div>
          <Box variant="awsui-key-label">Last Activity</Box>
          <div>{agent.lastActivity}</div>
        </div>
        <Button onClick={() => onViewDetails(agent)}>View Details</Button>
      </SpaceBetween>
    </Box>
  );
};

// Workflow table component - Simplified version
const WorkflowTable = ({ workflows, onViewWorkflow }) => {
  const [viewMode, setViewMode] = useState('visual'); // 'visual' or 'table'
  
  console.log('WorkflowTable rendering with workflows:', workflows);
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Header variant="h2">Agent Workflows</Header>
        <Toggle
          onChange={({ detail }) => setViewMode(detail.checked ? 'visual' : 'table')}
          checked={viewMode === 'visual'}
        >
          Visual View
        </Toggle>
      </div>
      
      {viewMode === 'visual' ? (
        <div>
          {workflows.map(workflow => (
            <WorkflowCard 
              key={workflow.id}
              workflow={workflow}
              onViewWorkflow={onViewWorkflow}
            />
          ))}
        </div>
      ) : (
        <Table
          columnDefinitions={[
            {
              id: 'id',
              header: 'Workflow ID',
              cell: item => item.id,
              sortingField: 'id',
            },
            {
              id: 'type',
              header: 'Type',
              cell: item => item.type,
              sortingField: 'type',
            },
            {
              id: 'status',
              header: 'Status',
              cell: item => <AgentStatusIndicator status={item.status} />,
              sortingField: 'status',
            },
            {
              id: 'startTime',
              header: 'Start Time',
              cell: item => new Date(item.startTime).toLocaleString(),
              sortingField: 'startTime',
            },
            {
              id: 'endTime',
              header: 'End Time',
              cell: item => item.endTime ? new Date(item.endTime).toLocaleString() : '-',
              sortingField: 'endTime',
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <Button onClick={() => onViewWorkflow(item)}>View Details</Button>
              ),
            },
          ]}
          items={workflows}
          trackBy="id"
          selectionType="single"
        />
      )}
    </div>
  );
};

// Agent details modal component
const AgentDetailsModal = ({ agent, visible, onDismiss }) => {
  if (!agent) return null;
  
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={agent.name}
      size="large"
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Status</Box>
            <AgentStatusIndicator status={agent.status} />
          </div>
          <div>
            <Box variant="awsui-key-label">Type</Box>
            <div>{agent.type}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Description</Box>
            <div>{agent.description}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Active Workflows</Box>
            <div>{agent.activeWorkflows}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Last Activity</Box>
            <div>{agent.lastActivity}</div>
          </div>
        </ColumnLayout>
        
        <Header variant="h3">Recent Actions</Header>
        <Table
          columnDefinitions={[
            {
              id: 'action',
              header: 'Action',
              cell: item => item.action,
            },
            {
              id: 'timestamp',
              header: 'Timestamp',
              cell: item => new Date(item.timestamp).toLocaleString(),
            },
            {
              id: 'status',
              header: 'Status',
              cell: item => <AgentStatusIndicator status={item.status} />,
            },
          ]}
          items={agent.recentActions || []}
          trackBy="timestamp"
        />
      </SpaceBetween>
    </Modal>
  );
};

// Workflow details modal component
// Inline markdown renderer used in modal
const renderMarkdown = (text) => {
  if (!text) return null;
  // Unescape literal \n sequences that come from JSON-encoded strings
  const normalized = text.replace(/\\n/g, '\n').replace(/\\t/g, '  ');
  return normalized.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} style={{ height: '4px' }} />;
    const isBullet = /^[-*•]\s/.test(trimmed);
    const content = isBullet ? trimmed.replace(/^[-*•]\s/, '') : trimmed;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={j}>{part.slice(2, -2)}</strong>
        : part
    );
    if (isBullet) return (
      <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '3px', fontSize: '0.85rem', lineHeight: '1.5' }}>
        <span style={{ color: '#0972d3', flexShrink: 0 }}>•</span><span>{parts}</span>
      </div>
    );
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) return (
      <div key={i} style={{ fontWeight: '700', fontSize: '0.875rem', marginTop: '8px', marginBottom: '3px' }}>{trimmed.slice(2, -2)}</div>
    );
    return <div key={i} style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>{parts}</div>;
  });
};

// Trace loading skeleton animation
const TraceLoadingSkeleton = () => (
  <div style={{ backgroundColor: '#0a0f1e', padding: '14px 16px', borderRadius: '0 0 8px 8px' }}>
    <style>{`
      @keyframes shimmer {
        0% { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .trace-skeleton {
        background: linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%);
        background-size: 400px 100%;
        animation: shimmer 1.4s infinite;
        border-radius: 4px;
      }
    `}</style>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
      <div className="trace-skeleton" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
      <div className="trace-skeleton" style={{ width: '120px', height: '12px' }} />
      <div className="trace-skeleton" style={{ width: '60px', height: '12px', marginLeft: 'auto' }} />
    </div>
    {[1, 2, 3].map(i => (
      <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="trace-skeleton" style={{ width: '10px', height: '10px', borderRadius: '50%' }} />
          {i < 3 && <div className="trace-skeleton" style={{ width: '2px', height: '40px', margin: '3px 0' }} />}
        </div>
        <div style={{ flex: 1 }}>
          <div className="trace-skeleton" style={{ width: '80px', height: '10px', marginBottom: '6px' }} />
          <div className="trace-skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }} />
        </div>
      </div>
    ))}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
      <div className="trace-skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
      <div className="trace-skeleton" style={{ width: '200px', height: '10px' }} />
    </div>
  </div>
);

const WorkflowDetailsModal = ({ workflow, visible, onDismiss }) => {
  const [collapsedTraces, setCollapsedTraces] = useState({});

  const toggleTrace = (stepIdx) => {
    setCollapsedTraces(prev => ({ ...prev, [stepIdx]: !prev[stepIdx] }));
  };
  if (!workflow) return null;

  const TYPE_LABELS = { service_call: 'Service Call', maintenance_completion: 'Maintenance Completion', system_alert: 'System Alert' };
  const statusColor  = { success: '#1d8102', processing: '#0972d3', error: '#d91515', idle: '#8d99a8' };
  const statusBg     = { success: '#f2f8f0', processing: '#f0f6ff', error: '#fff5f5', idle: '#f8f8f8' };
  const statusBorder = { success: '#c6e6c0', processing: '#b8d5f5', error: '#f5c6c6', idle: '#e0e0e0' };
  const statusIcon   = { success: '✓', processing: '●', error: '✕', idle: '○' };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={`Workflow: ${workflow.id}`}
      size="large"
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={3} variant="text-grid">
          <div><Box variant="awsui-key-label">Type</Box><div>{TYPE_LABELS[workflow.type] || workflow.type}</div></div>
          <div><Box variant="awsui-key-label">Status</Box><AgentStatusIndicator status={workflow.status} /></div>
          <div><Box variant="awsui-key-label">Initiated By</Box><div>{workflow.initiatedBy}</div></div>
          <div><Box variant="awsui-key-label">Start Time</Box><div>{new Date(workflow.startTime).toLocaleString()}</div></div>
          <div><Box variant="awsui-key-label">End Time</Box><div>{workflow.endTime ? new Date(workflow.endTime).toLocaleString() : '—'}</div></div>
        </ColumnLayout>

        {/* AgentCore observability link — only shown when no inline traces available */}
        {workflow.initiatedBy && workflow.initiatedBy.includes('AgentCore') && !(workflow.steps || []).some(s => s.trace) && (
          <div style={{ padding: '10px 14px', backgroundColor: '#f0f6ff', borderRadius: '6px', border: '1px solid #b8d5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#0f1b2d' }}>View full agent traces and metrics in AWS Console</span>
            <a href="https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#gen-ai-observability/agent-core" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#0972d3', textDecoration: 'none', fontWeight: '600' }}>
              Open AgentCore Observability →
            </a>
          </div>
        )}

        <div>
          <Header variant="h3">Agent Steps & Reasoning</Header>
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(workflow.steps || []).map((step, i) => {
              const s = (step.status || 'idle').toLowerCase();
              const color  = statusColor[s]  || statusColor.idle;
              const bg     = statusBg[s]     || statusBg.idle;
              const border = statusBorder[s] || statusBorder.idle;
              const icon   = statusIcon[s]   || '○';
              return (
                <div key={i} style={{ border: `1px solid ${border}`, borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: bg, borderBottom: step.reasoning ? `1px solid ${border}` : 'none' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700', flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f1b2d' }}>{step.step}</div>
                      <div style={{ fontSize: '0.78rem', color: '#5f6b7a' }}>{step.agent}</div>
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color }}>{s}</div>
                  </div>
                  {step.reasoning && (
                    <div style={{ padding: '12px 14px', backgroundColor: '#ffffff' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5f6b7a', marginBottom: '6px' }}>Agent Reasoning</div>
                      <div style={{ color: '#0f1b2d' }}>{renderMarkdown(step.reasoning)}</div>
                    </div>
                  )}

                  {/* AgentCore Trace Timeline — collapsible */}
                  {(step.trace || step.sessionId) && (() => {
                    const isLoading = step.sessionId && !step.trace;
                    const isCollapsed = collapsedTraces[i] !== false; // default collapsed
                    const hasTrace = step.trace && step.trace.spans && step.trace.spans.length > 0;

                    return (
                      <div style={{ borderTop: `1px solid ${border}` }}>
                        {/* Toggle header */}
                        <div
                          onClick={() => toggleTrace(i)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 14px', backgroundColor: '#0d1117', cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isLoading ? '#fbbf24' : '#60a5fa', boxShadow: isLoading ? '0 0 6px #fbbf24' : '0 0 6px #60a5fa' }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isLoading ? '#fbbf24' : '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {isLoading ? 'Loading AgentCore Trace…' : 'AgentCore Trace'}
                            </span>
                            {hasTrace && step.trace.invocationDurationMs && (
                              <span style={{ fontSize: '0.65rem', color: '#6b7280', fontFamily: 'monospace', backgroundColor: '#1f2937', padding: '1px 6px', borderRadius: '3px' }}>
                                {step.trace.invocationDurationMs}ms
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#4b5563' }}>{isCollapsed ? '▶ Show' : '▼ Hide'}</span>
                        </div>

                        {/* Content */}
                        {!isCollapsed && (
                          isLoading ? <TraceLoadingSkeleton /> : hasTrace ? (() => {
                    const spanMeta = {
                      llm_call:    { label: 'LLM Call',      icon: '🤖', color: '#60a5fa', dot: '#3b82f6' },
                      llm_input:   { label: 'LLM Input',     icon: '→',  color: '#60a5fa', dot: '#3b82f6' },
                      llm_response:{ label: 'LLM Response',  icon: '💬', color: '#34d399', dot: '#10b981' },
                      bedrock_api: { label: 'Bedrock API',   icon: '⚡', color: '#a78bfa', dot: '#8b5cf6' },
                      tool_call:   { label: 'Tool Call',     icon: '⚙',  color: '#fbbf24', dot: '#f59e0b' },
                      tool_result: { label: 'Tool Result',   icon: '✓',  color: '#c084fc', dot: '#a855f7' },
                    };

                    // Compute timing data
                    const sortedSpans = [...step.trace.spans].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    const t0 = sortedSpans[0]?.timestamp || 0;
                    const tEnd = sortedSpans[sortedSpans.length - 1]?.timestamp || t0;
                    const totalMs = step.trace.invocationDurationMs || Math.max(tEnd - t0, 1);
                    const hasTiming = t0 > 0;

                    return (
                      <div style={{ backgroundColor: '#0a0f1e', borderTop: `1px solid ${border}`, padding: '14px 16px' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#60a5fa', boxShadow: '0 0 6px #60a5fa' }} />
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AgentCore Trace</span>
                            <span style={{ fontSize: '0.65rem', color: '#374151', fontFamily: 'monospace', backgroundColor: '#1f2937', padding: '1px 6px', borderRadius: '3px' }}>
                              {step.trace.spans.length} spans
                            </span>
                          </div>
                          {hasTiming && <span style={{ fontSize: '0.65rem', color: '#6b7280', fontFamily: 'monospace' }}>{totalMs}ms total</span>}
                          {step.trace.observabilityUrl && (
                            <a href={step.trace.observabilityUrl} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: '0.68rem', color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
                              View in CloudWatch ↗
                            </a>
                          )}
                        </div>

                        {/* Gantt timing chart */}
                        {hasTiming && (
                          <div style={{ marginBottom: '16px', padding: '10px 12px', backgroundColor: '#111827', borderRadius: '6px', border: '1px solid #1f2937' }}>
                            <div style={{ fontSize: '0.62rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Span Timeline</div>
                            {/* Time axis labels */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.58rem', color: '#374151', fontFamily: 'monospace' }}>0ms</span>
                              <span style={{ fontSize: '0.58rem', color: '#374151', fontFamily: 'monospace' }}>{Math.round(totalMs / 2)}ms</span>
                              <span style={{ fontSize: '0.58rem', color: '#374151', fontFamily: 'monospace' }}>{totalMs}ms</span>
                            </div>
                            {/* Track background grid */}
                            <div style={{ position: 'relative', marginBottom: '4px' }}>
                              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', backgroundColor: '#1f2937' }} />
                            </div>
                            {/* Span bars */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {sortedSpans.map((span, si) => {
                                const sm = spanMeta[span.type] || spanMeta.llm_call;
                                const offsetPct = totalMs > 0 ? ((span.timestamp - t0) / totalMs) * 100 : 0;
                                // Estimate duration: time to next span or 10% of total
                                const nextTs = sortedSpans[si + 1]?.timestamp;
                                const durMs = nextTs ? nextTs - span.timestamp : Math.max(totalMs * 0.1, 20);
                                const widthPct = Math.max((durMs / totalMs) * 100, 3);
                                return (
                                  <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {/* Label */}
                                    <div style={{ width: '80px', flexShrink: 0, fontSize: '0.6rem', color: sm.color, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {sm.icon} {sm.label}
                                    </div>
                                    {/* Bar track */}
                                    <div style={{ flex: 1, height: '14px', backgroundColor: '#1f2937', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                                      {/* Grid line at 50% */}
                                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', backgroundColor: '#374151' }} />
                                      {/* Span bar */}
                                      <div style={{
                                        position: 'absolute',
                                        left: `${offsetPct}%`,
                                        width: `${Math.min(widthPct, 100 - offsetPct)}%`,
                                        height: '100%',
                                        backgroundColor: sm.dot,
                                        borderRadius: '2px',
                                        opacity: 0.85,
                                      }} />
                                    </div>
                                    {/* Duration label */}
                                    <div style={{ width: '36px', flexShrink: 0, fontSize: '0.58rem', color: '#6b7280', fontFamily: 'monospace', textAlign: 'right' }}>
                                      {durMs < 1000 ? `${Math.round(durMs)}ms` : `${(durMs/1000).toFixed(1)}s`}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Timeline */}
                        <div style={{ display: 'flex', gap: '0' }}>
                          {/* Left spine */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '12px', flexShrink: 0 }}>
                            {step.trace.spans.map((span, si) => {
                              const sm = spanMeta[span.type] || spanMeta.llm_call;
                              const isLast = si === step.trace.spans.length - 1;
                              return (
                                <div key={si} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  {/* Dot */}
                                  <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    backgroundColor: sm.dot,
                                    boxShadow: `0 0 8px ${sm.dot}80`,
                                    border: `2px solid ${sm.dot}`,
                                    flexShrink: 0, zIndex: 1,
                                  }} />
                                  {/* Connector line */}
                                  {!isLast && (
                                    <div style={{ width: '2px', flex: 1, minHeight: '20px', backgroundColor: '#1f2937', margin: '2px 0' }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Span cards */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {step.trace.spans.map((span, si) => {
                              const sm = spanMeta[span.type] || spanMeta.llm_call;
                              return (
                                <div key={si} style={{
                                  border: `1px solid ${sm.dot}30`,
                                  borderLeft: `3px solid ${sm.dot}`,
                                  borderRadius: '0 6px 6px 0',
                                  backgroundColor: '#111827',
                                  overflow: 'hidden',
                                }}>
                                  {/* Span header */}
                                  <div style={{ padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${sm.dot}20` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '0.7rem' }}>{sm.icon}</span>
                                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: sm.color, letterSpacing: '0.04em' }}>{sm.label}</span>
                                    </div>
                                    {span.spanId && (
                                      <span style={{ fontSize: '0.6rem', color: '#374151', fontFamily: 'monospace', backgroundColor: '#1f2937', padding: '1px 5px', borderRadius: '3px' }}>
                                        {span.spanId.slice(0, 8)}
                                      </span>
                                    )}
                                  </div>

                                  {/* Input messages */}
                                  {span.input && span.input.map((msg, mi) => (
                                    <div key={mi} style={{ padding: '6px 10px', borderBottom: `1px solid #1f2937` }}>
                                      <div style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{msg.role}</div>
                                      <pre style={{ margin: 0, fontSize: '0.73rem', color: '#9ca3af', fontFamily: 'monospace', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '90px', overflowY: 'auto', backgroundColor: 'transparent' }}>
                                        {(msg.text || '').replace(/\\n/g, '\n').replace(/\n/g, '\n')}
                                      </pre>
                                    </div>
                                  ))}

                                  {/* Output messages */}
                                  {span.output && span.output.map((msg, mi) => (
                                    <div key={mi} style={{ padding: '6px 10px' }}>
                                      <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{msg.role}</span>
                                        {msg.finish_reason && <span style={{ color: '#374151' }}>{msg.finish_reason}</span>}
                                      </div>
                                      <pre style={{ margin: 0, fontSize: '0.73rem', color: '#d1fae5', fontFamily: 'monospace', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '120px', overflowY: 'auto', backgroundColor: 'transparent' }}>
                                        {(msg.text || '').replace(/\\n/g, '\n').replace(/\n/g, '\n')}
                                      </pre>
                                    </div>
                                  ))}

                                  {/* Tool call */}
                                  {span.type === 'tool_call' && (
                                    <div style={{ padding: '6px 10px' }}>
                                      <div style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: '700', marginBottom: '3px' }}>TOOL: {span.toolName}</div>
                                      <pre style={{ margin: 0, fontSize: '0.73rem', color: '#fef3c7', fontFamily: 'monospace', lineHeight: '1.4', whiteSpace: 'pre-wrap', maxHeight: '80px', overflowY: 'auto', backgroundColor: 'transparent' }}>
                                        {JSON.stringify(span.toolInput, null, 2)}
                                      </pre>
                                    </div>
                                  )}

                                  {/* Tool result */}
                                  {span.type === 'tool_result' && (
                                    <div style={{ padding: '6px 10px' }}>
                                      <pre style={{ margin: 0, fontSize: '0.73rem', color: '#e9d5ff', fontFamily: 'monospace', lineHeight: '1.4', whiteSpace: 'pre-wrap', maxHeight: '80px', overflowY: 'auto', backgroundColor: 'transparent' }}>
                                        {JSON.stringify(span.toolResult, null, 2)}
                                      </pre>
                                    </div>
                                  )}

                                  {/* Bedrock API call */}
                                  {span.type === 'bedrock_api' && (
                                    <div style={{ padding: '6px 10px' }}>
                                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                        {span.model && <div><span style={{ fontSize: '0.6rem', color: '#6b7280' }}>MODEL </span><span style={{ fontSize: '0.73rem', color: '#c4b5fd', fontFamily: 'monospace' }}>{span.model}</span></div>}
                                        {span.inputTokens && <div><span style={{ fontSize: '0.6rem', color: '#6b7280' }}>IN </span><span style={{ fontSize: '0.73rem', color: '#a78bfa', fontFamily: 'monospace' }}>{span.inputTokens} tokens</span></div>}
                                        {span.outputTokens && <div><span style={{ fontSize: '0.6rem', color: '#6b7280' }}>OUT </span><span style={{ fontSize: '0.73rem', color: '#a78bfa', fontFamily: 'monospace' }}>{span.outputTokens} tokens</span></div>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Trace ID footer */}
                        {step.trace.traceId && (
                          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1f2937', fontSize: '0.62rem', color: '#374151', fontFamily: 'monospace', display: 'flex', gap: '6px' }}>
                            <span style={{ color: '#4b5563' }}>trace_id:</span>
                            <span>{step.trace.traceId}</span>
                          </div>
                        )}
                      </div>
                    );
                  })() : null
                        )}
                      </div>
                    );
                  })()}

                </div>
              );
            })}
          </div>
        </div>

        {workflow.orchestratorResponse && (
          <div>
            <Header variant="h3">Orchestrator Full Response</Header>
            <div style={{ marginTop: '8px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '6px', borderLeft: '3px solid #0972d3', maxHeight: '280px', overflowY: 'auto' }}>
              {renderMarkdown(workflow.orchestratorResponse)}
            </div>
          </div>
        )}

        {workflow.error && <Alert type="error">{workflow.error}</Alert>}
      </SpaceBetween>
    </Modal>
  );
};

// Main component
const STORAGE_KEY = 'fsm_triggered_workflows';

const loadPersistedWorkflows = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const persistWorkflows = (workflows) => {
  try {
    // Only persist user-triggered workflows (not the base mock ones)
    const triggered = workflows.filter(w => w.initiatedBy === 'User');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(triggered));
  } catch {}
};

const AgentsDashboard = () => {
  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false);
  const [activeTabId, setActiveTabId] = useState('chat');

  // Mock data for development - replace with actual API calls in production
  const mockAgents = [
    {
      id: 'orchestrator',
      name: 'Orchestrator Agent',
      type: 'orchestrator',
      description: 'Coordinates workflow between all other agents',
      status: AGENT_STATUS.IDLE,
      activeWorkflows: 0,
      lastActivity: new Date().toLocaleString(),
      recentActions: [
        { action: 'coordinate_multi_agent_workflow', timestamp: new Date().toISOString(), status: AGENT_STATUS.SUCCESS },
        { action: 'route_request', timestamp: new Date(Date.now() - 3600000).toISOString(), status: AGENT_STATUS.SUCCESS }
      ]
    },
    {
      id: 'hvac-monitoring',
      name: 'HVAC Monitoring Agent',
      type: 'monitoring',
      description: 'Monitors HVAC systems and detects anomalies',
      status: AGENT_STATUS.IDLE,
      activeWorkflows: 0,
      lastActivity: new Date(Date.now() - 1800000).toLocaleString(),
      recentActions: [
        { action: 'analyze_system_data', timestamp: new Date(Date.now() - 1800000).toISOString(), status: AGENT_STATUS.SUCCESS },
        { action: 'predict_failures', timestamp: new Date(Date.now() - 86400000).toISOString(), status: AGENT_STATUS.SUCCESS }
      ]
    },
    {
      id: 'parts-inventory',
      name: 'Parts Inventory Agent',
      type: 'inventory',
      description: 'Manages inventory levels and reordering',
      status: AGENT_STATUS.IDLE,
      activeWorkflows: 0,
      lastActivity: new Date(Date.now() - 7200000).toLocaleString(),
      recentActions: [
        { action: 'check_parts_availability', timestamp: new Date(Date.now() - 7200000).toISOString(), status: AGENT_STATUS.SUCCESS },
        { action: 'reorder_parts', timestamp: new Date(Date.now() - 172800000).toISOString(), status: AGENT_STATUS.SUCCESS }
      ]
    },
    {
      id: 'technician-scheduling',
      name: 'Technician Scheduling Agent',
      type: 'scheduling',
      description: 'Optimizes technician assignments',
      status: AGENT_STATUS.PROCESSING,
      activeWorkflows: 1,
      lastActivity: new Date(Date.now() - 1560000).toLocaleString(),
      recentActions: [
        { action: 'schedule_technician', timestamp: new Date(Date.now() - 1560000).toISOString(), status: AGENT_STATUS.PROCESSING },
        { action: 'optimize_routes', timestamp: new Date(Date.now() - 259200000).toISOString(), status: AGENT_STATUS.SUCCESS }
      ]
    },
    {
      id: 'customer-communication',
      name: 'Customer Communication Agent',
      type: 'communication',
      description: 'Handles automated notifications and communications with customers',
      status: AGENT_STATUS.IDLE,
      activeWorkflows: 0,
      lastActivity: new Date(Date.now() - 42960000).toLocaleString(),
      recentActions: [
        { action: 'send_notification', timestamp: new Date(Date.now() - 42960000).toISOString(), status: AGENT_STATUS.SUCCESS },
        { action: 'generate_report', timestamp: new Date(Date.now() - 129600000).toISOString(), status: AGENT_STATUS.SUCCESS }
      ]
    },
    {
      id: 'customer-authentication',
      name: 'Customer Authentication Agent',
      type: 'authentication',
      description: 'Verifies customer identity and manages access control',
      status: AGENT_STATUS.IDLE,
      activeWorkflows: 0,
      lastActivity: new Date(Date.now() - 86340000).toLocaleString(),
      recentActions: [
        { action: 'verify_identity', timestamp: new Date(Date.now() - 86340000).toISOString(), status: AGENT_STATUS.SUCCESS },
        { action: 'manage_access', timestamp: new Date(Date.now() - 172800000).toISOString(), status: AGENT_STATUS.SUCCESS }
      ]
    },
    {
      id: 'billing-invoicing',
      name: 'Billing & Invoicing Agent',
      type: 'billing',
      description: 'Generates invoices, calculates costs, and processes payments',
      status: AGENT_STATUS.IDLE,
      activeWorkflows: 0,
      lastActivity: new Date(Date.now() - 43020000).toLocaleString(),
      recentActions: [
        { action: 'generate_invoice', timestamp: new Date(Date.now() - 43020000).toISOString(), status: AGENT_STATUS.SUCCESS },
        { action: 'process_payment', timestamp: new Date(Date.now() - 129600000).toISOString(), status: AGENT_STATUS.SUCCESS }
      ]
    },
    {
      id: 'technical-documentation',
      name: 'Technical Documentation Agent',
      type: 'documentation',
      description: 'Creates and retrieves technical documentation and safety protocols',
      status: AGENT_STATUS.IDLE,
      activeWorkflows: 0,
      lastActivity: new Date(Date.now() - 82800000).toLocaleString(),
      recentActions: [
        { action: 'create_documentation', timestamp: new Date(Date.now() - 82800000).toISOString(), status: AGENT_STATUS.SUCCESS },
        { action: 'retrieve_safety_protocol', timestamp: new Date(Date.now() - 172800000).toISOString(), status: AGENT_STATUS.SUCCESS }
      ]
    }
  ];

  const mockWorkflows = [
    {
      id: 'wf-001',
      type: 'service_call',
      status: AGENT_STATUS.SUCCESS,
      startTime: new Date(Date.now() - 86400000).toISOString(),
      endTime: new Date(Date.now() - 82800000).toISOString(),
      initiatedBy: 'System',
      steps: [
        { step: 'Customer Authentication', agent: 'Customer Authentication Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 86340000).toISOString() },
        { step: 'System Analysis', agent: 'HVAC Monitoring Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 86340000).toISOString(), endTime: new Date(Date.now() - 86280000).toISOString() },
        { step: 'Parts Availability Check', agent: 'Parts Inventory Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 86280000).toISOString(), endTime: new Date(Date.now() - 86220000).toISOString() },
        { step: 'Technician Scheduling', agent: 'Technician Scheduling Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 86220000).toISOString(), endTime: new Date(Date.now() - 86160000).toISOString() },
        { step: 'Customer Notification', agent: 'Customer Communication Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 86160000).toISOString(), endTime: new Date(Date.now() - 86100000).toISOString() },
        { step: 'Documentation Preparation', agent: 'Technical Documentation Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 86100000).toISOString(), endTime: new Date(Date.now() - 82800000).toISOString() }
      ]
    },
    {
      id: 'wf-002',
      type: 'maintenance_completion',
      status: AGENT_STATUS.SUCCESS,
      startTime: new Date(Date.now() - 43200000).toISOString(),
      endTime: new Date(Date.now() - 39600000).toISOString(),
      initiatedBy: 'Technician',
      steps: [
        { step: 'System Status Update', agent: 'HVAC Monitoring Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 43200000).toISOString(), endTime: new Date(Date.now() - 43140000).toISOString() },
        { step: 'Inventory Update', agent: 'Parts Inventory Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 43140000).toISOString(), endTime: new Date(Date.now() - 43080000).toISOString() },
        { step: 'Invoice Generation', agent: 'Billing & Invoicing Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 43080000).toISOString(), endTime: new Date(Date.now() - 43020000).toISOString() },
        { step: 'Customer Notification', agent: 'Customer Communication Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 43020000).toISOString(), endTime: new Date(Date.now() - 42960000).toISOString() }
      ]
    },
    {
      id: 'wf-003',
      type: 'system_alert',
      status: AGENT_STATUS.SUCCESS,
      startTime: new Date(Date.now() - 1800000).toISOString(),
      endTime: new Date(Date.now() - 1440000).toISOString(),
      initiatedBy: 'HVAC Monitoring Agent',
      steps: [
        { step: 'Anomaly Detection', agent: 'HVAC Monitoring Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 1800000).toISOString(), endTime: new Date(Date.now() - 1740000).toISOString() },
        { step: 'Customer Authentication', agent: 'Customer Authentication Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 1740000).toISOString(), endTime: new Date(Date.now() - 1680000).toISOString() },
        { step: 'Customer Notification', agent: 'Customer Communication Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 1680000).toISOString(), endTime: new Date(Date.now() - 1620000).toISOString() },
        { step: 'Parts Availability Check', agent: 'Parts Inventory Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 1620000).toISOString(), endTime: new Date(Date.now() - 1560000).toISOString() },
        { step: 'Technician Scheduling', agent: 'Technician Scheduling Agent', status: AGENT_STATUS.SUCCESS, startTime: new Date(Date.now() - 1560000).toISOString(), endTime: new Date(Date.now() - 1440000).toISOString() }
      ]
    }
  ];

  // Fetch agents and workflows data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Merge mock base workflows with any user-triggered ones from localStorage
        const persisted = loadPersistedWorkflows();
        const merged = [...persisted, ...mockWorkflows];
        setAgents(mockAgents);
        setWorkflows(merged);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching agents data:', err);
        setError('Failed to load agents data. Please try again later.');
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleViewAgentDetails = (agent) => {
    setSelectedAgent(agent);
    setShowAgentDetails(true);
  };
  
  const handleViewWorkflowDetails = (workflow) => {
    setSelectedWorkflow(workflow);
    setShowWorkflowDetails(true);
  };
  
  const handleTriggerWorkflow = async (workflowType) => {
    try {
      setTriggering(true);
      setError(null);

      const now = Date.now();
      const workflowId = `wf-${String(now).slice(-6)}`;

      // Show a "pending" workflow immediately so the user sees something
      const pendingSteps = (workflowType === 'service_call' ? [
        { step: 'Customer Authentication',   agent: 'Customer Authentication Agent' },
        { step: 'System Analysis',           agent: 'HVAC Monitoring Agent' },
        { step: 'Parts Availability Check',  agent: 'Parts Inventory Agent' },
        { step: 'Technician Scheduling',     agent: 'Technician Scheduling Agent' },
        { step: 'Customer Notification',     agent: 'Customer Communication Agent' },
        { step: 'Documentation Preparation', agent: 'Technical Documentation Agent' },
      ] : [
        { step: 'System Status Update',  agent: 'HVAC Monitoring Agent' },
        { step: 'Inventory Update',      agent: 'Parts Inventory Agent' },
        { step: 'Invoice Generation',    agent: 'Billing & Invoicing Agent' },
        { step: 'Customer Notification', agent: 'Customer Communication Agent' },
      ]).map((s, i) => ({
        ...s,
        status: i === 0 ? AGENT_STATUS.PROCESSING : AGENT_STATUS.IDLE,
        startTime: i === 0 ? new Date(now).toISOString() : null,
        endTime: null,
        reasoning: null,
      }));

      const pendingWorkflow = {
        id: workflowId,
        type: workflowType,
        status: AGENT_STATUS.PROCESSING,
        startTime: new Date(now).toISOString(),
        endTime: null,
        initiatedBy: 'User (AgentCore)',
        steps: pendingSteps,
      };

      setWorkflows(prev => {
        const updated = [pendingWorkflow, ...prev];
        persistWorkflows(updated);
        return updated;
      });
      setAgents(prev => prev.map(a =>
        a.id === 'orchestrator'
          ? { ...a, status: AGENT_STATUS.PROCESSING, activeWorkflows: a.activeWorkflows + 1 }
          : a
      ));

      // Call the real AgentCore orchestrator via API Gateway
      const response = await fetch(
        `${API_CONFIG.apiEndpoint}/agents/workflow`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ workflowType }),
        }
      );

      const data = await response.json();
      console.log('AgentCore workflow response:', data);

      const endTime = new Date().toISOString();

      if (!response.ok || data.error) {
        setWorkflows(prev => {
          const updated = prev.map(wf => wf.id !== workflowId ? wf : {
            ...wf, status: AGENT_STATUS.ERROR, endTime,
            error: data.error || 'Orchestrator returned an error',
            steps: wf.steps.map(s => ({ ...s, status: AGENT_STATUS.ERROR, endTime })),
          });
          persistWorkflows(updated);
          return updated;
        });
      } else {
        // Update workflow with real steps + reasoning
        const realSteps = (data.steps || pendingSteps).map(s => ({
          ...s, status: AGENT_STATUS.SUCCESS, endTime,
        }));

        setWorkflows(prev => {
          const updated = prev.map(wf => wf.id !== workflowId ? wf : {
            ...wf, status: AGENT_STATUS.SUCCESS, endTime,
            orchestratorResponse: data.orchestratorResponse,
            steps: realSteps,
          });
          persistWorkflows(updated);
          return updated;
        });

        // Fetch traces for each step in the background (non-blocking)
        const stepsWithSessions = (data.steps || []).filter(s => s.sessionId && s.agentKey);
        if (stepsWithSessions.length > 0) {
          setTimeout(async () => {
            const traceResults = await Promise.all(
              stepsWithSessions.map(async (s) => {
                try {
                  const tr = await fetch(
                    `${API_CONFIG.apiEndpoint}/agents/trace/${s.agentKey}/${s.sessionId}`,
                    { headers: getAuthHeaders() }
                  );
                  const td = await tr.json();
                  return { step: s.step, trace: td.trace };
                } catch { return { step: s.step, trace: null }; }
              })
            );

            setWorkflows(prev => {
              const updated = prev.map(wf => {
                if (wf.id !== workflowId) return wf;
                const updatedSteps = wf.steps.map(step => {
                  const tr = traceResults.find(r => r.step === step.step);
                  return tr && tr.trace ? { ...step, trace: tr.trace } : step;
                });
                return { ...wf, steps: updatedSteps };
              });
              persistWorkflows(updated);
              return updated;
            });
          }, 5000); // wait 5s for CloudWatch to flush before fetching traces
        }
      }

      setAgents(prev => prev.map(a =>
        a.id === 'orchestrator'
          ? { ...a, status: AGENT_STATUS.IDLE, activeWorkflows: Math.max(0, a.activeWorkflows - 1) }
          : a
      ));
      setTriggering(false);
    } catch (err) {
      console.error('Error triggering workflow:', err);
      setError(`Failed to trigger workflow: ${err.message}`);
      setTriggering(false);
    }
  };

  return (
    <Container>
      {console.log('AgentsDashboard render - agents:', agents, 'workflows:', workflows, 'loading:', loading, 'error:', error)}
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description="Monitor AI agent workflows and status"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                loading={triggering}
                onClick={() => { handleTriggerWorkflow('service_call'); setActiveTabId('workflows'); }}
              >
                Trigger Service Call
              </Button>
              <Button
                loading={triggering}
                onClick={() => { handleTriggerWorkflow('maintenance_completion'); setActiveTabId('workflows'); }}
              >
                Trigger Maintenance Completion
              </Button>
            </SpaceBetween>
          }
        >
          AI Agents Dashboard
        </Header>
        
        {error && <Alert type="error">{error}</Alert>}
        
        {loading ? (
          <StatusIndicator type="loading">Loading agents data...</StatusIndicator>
        ) : (
          <Tabs
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
            tabs={[
              {
                id: 'chat',
                label: 'Ask Assistant',
                content: <AgentChat />,
              },
              {
                id: 'agents',
                label: 'Agents',
                content: (
                  <SpaceBetween size="l">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                      {agents.map(agent => (
                        <AgentCard 
                          key={agent.id} 
                          agent={agent} 
                          onViewDetails={handleViewAgentDetails} 
                        />
                      ))}
                    </div>
                  </SpaceBetween>
                ),
              },
              {
                id: 'workflows',
                label: 'Workflows',
                content: (
                  <WorkflowTable 
                    workflows={workflows} 
                    onViewWorkflow={handleViewWorkflowDetails} 
                  />
                ),
              },
            ]}
          />
        )}
      </SpaceBetween>
      
      <AgentDetailsModal
        agent={selectedAgent}
        visible={showAgentDetails}
        onDismiss={() => setShowAgentDetails(false)}
      />
      
      <WorkflowDetailsModal
        workflow={selectedWorkflow}
        visible={showWorkflowDetails}
        onDismiss={() => setShowWorkflowDetails(false)}
      />
    </Container>
  );
};

export default AgentsDashboard;
