import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Box,
  Button,
  Header,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  Textarea,
} from '@cloudscape-design/components';
import { getApiConfig } from '../config/api-config';
import { getAuthHeaders } from '../utils/auth-headers';

const API = getApiConfig();
const STORAGE_KEY = 'fsm_agent_chat_history';

/**
 * Parse the orchestrator's markdown-ish response into renderable segments.
 * Segments are one of:
 *   {type: 'text',  value: string}
 *   {type: 'table', value: {title, columns, rows}}
 *   {type: 'chart', value: {title, type, xLabel, yLabel, data}}
 */
function parseResponse(raw) {
  if (!raw) return [];
  // Normalize escaped newlines from some JSON wrappers
  const text = raw.replace(/\\n/g, '\n');

  const segments = [];
  const fenceRe = /```(fsm-table|fsm-chart)\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let m;
  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    try {
      const payload = JSON.parse(m[2].trim());
      segments.push({
        type: m[1] === 'fsm-table' ? 'table' : 'chart',
        value: payload,
      });
    } catch (e) {
      // If JSON parse fails, fall back to showing the raw fence as text
      segments.push({ type: 'text', value: m[0] });
    }
    lastIndex = fenceRe.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

/** Lightweight markdown renderer: headings, bold, bullets, paragraphs. */
function Markdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');

  const elements = [];
  let bulletBuffer = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} style={{ margin: '4px 0 8px 20px', padding: 0, color: '#16191f' }}>
        {bulletBuffer.map((b, i) => (
          <li key={i} style={{ marginBottom: '3px', lineHeight: '1.55', fontSize: '0.9rem', color: '#16191f' }}>
            {renderInline(b)}
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      elements.push(<div key={`sp-${i}`} style={{ height: '6px' }} />);
      return;
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      flushBullets();
      const level = trimmed.match(/^(#{1,3})\s/)[1].length;
      const content = trimmed.replace(/^#{1,3}\s+/, '');
      const size = level === 1 ? '1.1rem' : level === 2 ? '1rem' : '0.92rem';
      elements.push(
        <div
          key={`h-${i}`}
          style={{
            fontSize: size,
            fontWeight: 700,
            marginTop: '10px',
            marginBottom: '4px',
            color: '#0a0e14',
          }}
        >
          {renderInline(content)}
        </div>
      );
      return;
    }
    if (/^[-*•]\s/.test(trimmed)) {
      bulletBuffer.push(trimmed.replace(/^[-*•]\s+/, ''));
      return;
    }
    flushBullets();
    elements.push(
      <div key={`p-${i}`} style={{ margin: '2px 0', lineHeight: '1.6', fontSize: '0.9rem', color: '#16191f' }}>
        {renderInline(trimmed)}
      </div>
    );
  });
  flushBullets();
  return <div>{elements}</div>;
}

function renderInline(text) {
  // Support **bold** and `code`
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code
          key={key++}
          style={{
            background: '#eef2f7',
            padding: '1px 5px',
            borderRadius: '3px',
            fontSize: '0.82em',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function DataTable({ data }) {
  if (!data || !data.columns || !data.rows) return null;
  const columnDefinitions = data.columns.map((col, i) => ({
    id: `col-${i}`,
    header: col,
    cell: (item) => (item[i] !== undefined && item[i] !== null ? String(item[i]) : '—'),
  }));
  return (
    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
      {data.title && (
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#5f6b7a', marginBottom: '6px' }}>
          {data.title}
        </div>
      )}
      <Table
        columnDefinitions={columnDefinitions}
        items={data.rows}
        variant="embedded"
        trackBy={(_, i) => `r-${i}`}
      />
    </div>
  );
}

function DataChart({ data }) {
  if (!data || !Array.isArray(data.data) || data.data.length === 0) return null;
  const series = [
    {
      title: data.title || 'Value',
      type: 'bar',
      data: data.data.map((d) => ({ x: String(d.label), y: Number(d.value) || 0 })),
    },
  ];
  return (
    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
      <BarChart
        series={series}
        xDomain={data.data.map((d) => String(d.label))}
        xTitle={data.xLabel || ''}
        yTitle={data.yLabel || ''}
        height={220}
        hideFilter
        hideLegend
        ariaLabel={data.title || 'Chart'}
      />
    </div>
  );
}

function AssistantBubble({ raw, sessionId, trace, fetchingTrace }) {
  const [showTrace, setShowTrace] = useState(false);
  const segments = parseResponse(raw);

  const toolSpans = trace && trace.spans
    ? trace.spans.filter((s) => s.type === 'tool_call' || s.type === 'tool_result')
    : [];
  const toolCalls = toolSpans.filter((s) => s.type === 'tool_call');
  const hasTrace = Boolean(sessionId);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e9ebed',
        borderRadius: '10px 10px 10px 2px',
        padding: '14px 16px',
        maxWidth: '85%',
        color: '#16191f',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <Markdown key={i} text={seg.value} />;
        if (seg.type === 'table') return <DataTable key={i} data={seg.value} />;
        if (seg.type === 'chart') return <DataChart key={i} data={seg.value} />;
        return null;
      })}

      {hasTrace && (
        <div style={{ marginTop: '10px', borderTop: '1px solid #eef0f3', paddingTop: '8px' }}>
          <button
            onClick={() => setShowTrace((v) => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#414d5c',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            aria-expanded={showTrace}
          >
            <span style={{ fontFamily: 'monospace' }}>{showTrace ? '▾' : '▸'}</span>
            {fetchingTrace
              ? 'Loading thinking…'
              : toolCalls.length > 0
              ? `Thinking (${toolCalls.length} tool call${toolCalls.length === 1 ? '' : 's'})`
              : 'Thinking'}
          </button>

          {showTrace && (
            <div
              style={{
                marginTop: '8px',
                padding: '10px 12px',
                background: '#f7f8fa',
                border: '1px solid #eef0f3',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: '#232f3e',
              }}
            >
              {fetchingTrace ? (
                <div style={{ color: '#5f6b7a', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Spinner size="normal" />
                  <span>Fetching agent reasoning trace…</span>
                </div>
              ) : toolSpans.length === 0 ? (
                <div style={{ color: '#5f6b7a' }}>
                  No tool calls captured for this response.
                  {sessionId && (
                    <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '0.7rem', color: '#8d99a8' }}>
                      session: {sessionId.slice(0, 12)}…
                    </div>
                  )}
                </div>
              ) : (
                <ol style={{ margin: 0, paddingLeft: '18px' }}>
                  {toolSpans.map((span, i) => (
                    <li key={i} style={{ marginBottom: '6px', lineHeight: '1.4' }}>
                      {span.type === 'tool_call' ? (
                        <>
                          <strong style={{ color: '#0972d3' }}>{span.toolName}</strong>
                          {span.toolInput && Object.keys(span.toolInput).length > 0 && (
                            <code
                              style={{
                                display: 'inline-block',
                                marginLeft: '6px',
                                background: '#eef2f7',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                fontFamily: 'ui-monospace, Menlo, monospace',
                                fontSize: '0.72rem',
                                color: '#232f3e',
                              }}
                            >
                              {JSON.stringify(span.toolInput)}
                            </code>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#1d8102' }}>
                          ↳ returned
                          {(() => {
                            const r = span.toolResult;
                            if (!r) return '';
                            const text = typeof r === 'string' ? r : JSON.stringify(r);
                            return text.length > 140 ? ' ' + text.slice(0, 140) + '…' : ' ' + text;
                          })()}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div
      style={{
        background: '#0972d3',
        color: '#fff',
        borderRadius: '10px 10px 2px 10px',
        padding: '10px 14px',
        maxWidth: '78%',
        marginLeft: 'auto',
        lineHeight: '1.5',
        fontSize: '0.9rem',
        whiteSpace: 'pre-wrap',
      }}
    >
      {text}
    </div>
  );
}

const SUGGESTIONS = [
  'Show me parts inventory with low stock and recommend what to reorder',
  'Which technicians are currently available and what are their skills?',
  'Give me a report on open jobs and their priority',
  'Compare parts usage by category and show it as a chart',
  'A customer is reporting an HVAC compressor failure — walk through the steps',
];

export default function AgentChat() {
  const loadHistory = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch {}
    // Scroll to bottom on new message
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || sending) return;

    const userMsg = { role: 'user', text: trimmed, ts: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const resp = await fetch(`${API.apiEndpoint}/agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          prompt: trimmed,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);

      const assistantTs = Date.now();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.response || '(no response)',
          sessionId: data.sessionId,
          fetchingTrace: Boolean(data.sessionId),
          ts: assistantTs,
        },
      ]);

      // Fetch the trace in the background (CloudWatch needs ~4s to flush)
      if (data.sessionId) {
        setTimeout(async () => {
          try {
            const tr = await fetch(
              `${API.apiEndpoint}/agents/trace/orchestrator/${data.sessionId}`,
              { headers: getAuthHeaders() }
            );
            const td = await tr.json();
            setMessages((prev) =>
              prev.map((m) =>
                m.ts === assistantTs
                  ? { ...m, trace: td.trace || null, fetchingTrace: false }
                  : m
              )
            );
          } catch (err) {
            // Silently mark as done loading; no trace available
            setMessages((prev) =>
              prev.map((m) =>
                m.ts === assistantTs ? { ...m, fetchingTrace: false } : m
              )
            );
          }
        }, 5000);
      }
    } catch (err) {
      setError(err.message || 'Failed to reach the agent');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `_Sorry, I hit an error: ${err.message}_`, ts: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onEnter = (event) => {
    const detail = event.detail || {};
    // Enter without Shift submits; Shift+Enter (or IME composition) inserts newline
    if (detail.key === 'Enter' && !detail.shiftKey && !detail.isComposing) {
      if (event.preventDefault) event.preventDefault();
      send(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <SpaceBetween size="m">
      <Header
        variant="h2"
        description="Ask anything about your field service operations. The assistant uses the specialist agents to read live data and take actions on your behalf."
        actions={
          messages.length > 0 ? (
            <Button onClick={clearChat} variant="link">Clear chat</Button>
          ) : null
        }
      >
        Ask Assistant
      </Header>

      {messages.length === 0 && (
        <Box>
          <div style={{ fontSize: '0.88rem', color: '#5f6b7a', marginBottom: '10px' }}>
            Try one of these to get started:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                disabled={sending}
                style={{
                  textAlign: 'left',
                  padding: '10px 14px',
                  background: '#fff',
                  border: '1px solid #d5dbdb',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  color: '#0972d3',
                  cursor: 'pointer',
                  lineHeight: '1.3',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </Box>
      )}

      <div
        ref={scrollRef}
        style={{
          minHeight: '380px',
          maxHeight: '560px',
          overflowY: 'auto',
          padding: '18px',
          background: '#f7f8fa',
          border: '1px solid #e9ebed',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {messages.length === 0 && !sending && (
          <div style={{ textAlign: 'center', color: '#5f6b7a', fontSize: '0.85rem', padding: '40px 0' }}>
            Your conversation will appear here.
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <UserBubble key={i} text={m.text} />
          ) : (
            <AssistantBubble
              key={i}
              raw={m.text}
              sessionId={m.sessionId}
              trace={m.trace}
              fetchingTrace={m.fetchingTrace}
            />
          )
        )}
        {sending && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e9ebed',
              borderRadius: '10px 10px 10px 2px',
              padding: '12px 16px',
              maxWidth: '70%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <Spinner />
            <span style={{ fontSize: '0.85rem', color: '#414d5c' }}>
              Consulting the agents…
            </span>
          </div>
        )}
      </div>

      {error && <StatusIndicator type="warning">{error}</StatusIndicator>}

      <SpaceBetween size="xs">
        <Textarea
          value={input}
          onChange={({ detail }) => setInput(detail.value)}
          onKeyDown={onEnter}
          placeholder="Ask a question, request a report, or tell the assistant to take an action…"
          rows={3}
          disabled={sending}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#8d99a8' }}>
            Press <kbd style={{ background: '#eef2f7', padding: '1px 5px', borderRadius: '3px' }}>Enter</kbd> to send, <kbd style={{ background: '#eef2f7', padding: '1px 5px', borderRadius: '3px' }}>Shift+Enter</kbd> for newline
          </div>
          <Button variant="primary" onClick={() => send(input)} loading={sending} disabled={!input.trim()}>
            Send
          </Button>
        </div>
      </SpaceBetween>
    </SpaceBetween>
  );
}
