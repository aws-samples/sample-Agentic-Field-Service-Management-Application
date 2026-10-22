/**
 * Lambda function to invoke FSM agents via Bedrock AgentCore Runtime
 * Each workflow step calls the specific agent responsible for that step.
 */

const https = require('https');
const { resolveAllowedOrigin } = require('./wrapper/cors-wrapper');
const { randomUUID } = require('crypto');
const AWS = require('aws-sdk');

const REQUIRED_AGENT_KEYS = [
  'orchestrator',
  'monitoring',
  'inventory',
  'scheduling',
  'communication',
  'authentication',
  'billing',
  'documentation'
];

function loadAgentRuntimeArns(rawValue = process.env.AGENT_RUNTIME_ARNS, region = process.env.AWS_REGION || 'us-east-1') {
  if (!rawValue) return { arns: {}, error: 'AGENT_RUNTIME_ARNS is not configured' };
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('value must be a JSON object');
    }
    const keys = Object.keys(parsed).sort();
    const expected = [...REQUIRED_AGENT_KEYS].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(`keys must be exactly: ${REQUIRED_AGENT_KEYS.join(', ')}`);
    }
    const pattern = new RegExp(`^arn:(aws|aws-cn|aws-us-gov):bedrock-agentcore:${region}:\\d{12}:runtime/[A-Za-z0-9_-]+$`);
    for (const [key, arn] of Object.entries(parsed)) {
      if (typeof arn !== 'string' || !pattern.test(arn)) throw new Error(`invalid runtime ARN for ${key}`);
    }
    if (new Set(Object.values(parsed)).size !== REQUIRED_AGENT_KEYS.length) {
      throw new Error('runtime ARNs must be unique');
    }
    return { arns: Object.freeze({ ...parsed }), error: null };
  } catch (error) {
    return { arns: {}, error: `AGENT_RUNTIME_ARNS is invalid: ${error.message}` };
  }
}

const { arns: AGENT_ARNS, error: AGENT_CONFIG_ERROR } = loadAgentRuntimeArns();

// Agent ID suffix extracted from ARN (used to build log group name)
const agentLogGroups = Object.fromEntries(
  Object.entries(AGENT_ARNS).map(([key, arn]) => {
    const agentId = arn.split('/').pop();
    return [key, `/aws/bedrock-agentcore/runtimes/${agentId}-DEFAULT`];
  })
);

// Step definitions: which agent handles each step and what prompt to send it
const WORKFLOW_STEPS = {
  service_call: [
    {
      step: 'Customer Authentication',
      agent: 'Customer Authentication Agent',
      agentKey: 'authentication',
      prompt: 'A service call has been initiated. Please authenticate the customer and verify their identity and service contract. Explain what you are checking and why.'
    },
    {
      step: 'System Analysis',
      agent: 'HVAC Monitoring Agent',
      agentKey: 'monitoring',
      prompt: 'A service call has been initiated. Please analyze the HVAC system status, identify any anomalies or failure indicators, and determine the urgency of the issue. Explain your findings.'
    },
    {
      step: 'Parts Availability Check',
      agent: 'Parts Inventory Agent',
      agentKey: 'inventory',
      prompt: 'A service call requires parts. Please check the current inventory for common HVAC repair parts (filters, capacitors, refrigerant, belts), identify what is available and what may need to be ordered. Explain your assessment.'
    },
    {
      step: 'Technician Scheduling',
      agent: 'Technician Scheduling Agent',
      agentKey: 'scheduling',
      prompt: 'A service call needs a technician. Please assess available technicians, their skills and current locations, and determine the optimal assignment for this HVAC service call. Explain your scheduling decision.'
    },
    {
      step: 'Customer Notification',
      agent: 'Customer Communication Agent',
      agentKey: 'communication',
      prompt: 'A technician has been scheduled for a service call. Please prepare and send a customer notification with the appointment details, technician information, and what to expect. Explain what you are communicating and why.'
    },
    {
      step: 'Documentation Preparation',
      agent: 'Technical Documentation Agent',
      agentKey: 'documentation',
      prompt: 'A service call is scheduled. Please retrieve the relevant technical documentation, safety protocols, and service procedures for the HVAC system. Explain what documentation is needed and why.'
    }
  ],
  maintenance_completion: [
    {
      step: 'System Status Update',
      agent: 'HVAC Monitoring Agent',
      agentKey: 'monitoring',
      prompt: 'Maintenance has been completed on an HVAC system. Please update the system status, record the maintenance performed, and note any observations about system health post-maintenance. Explain your assessment.'
    },
    {
      step: 'Inventory Update',
      agent: 'Parts Inventory Agent',
      agentKey: 'inventory',
      prompt: 'Maintenance has been completed. Please update the parts inventory to reflect the parts used during the service, check if reorder thresholds have been reached, and flag any items that need restocking. Explain your inventory decisions.'
    },
    {
      step: 'Invoice Generation',
      agent: 'Billing & Invoicing Agent',
      agentKey: 'billing',
      prompt: 'Maintenance has been completed. Please calculate the total service cost including labor, parts used, and any applicable fees, then generate a professional invoice for the customer. Explain your cost breakdown.'
    },
    {
      step: 'Customer Notification',
      agent: 'Customer Communication Agent',
      agentKey: 'communication',
      prompt: 'Maintenance has been completed and an invoice has been generated. Please send the customer a completion notification with a summary of work performed, the invoice, and any follow-up recommendations. Explain what you are communicating.'
    }
  ]
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': resolveAllowedOrigin(),
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

const respond = (statusCode, body) => ({ statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) });

async function invokeAgentCore(agentArn, prompt) {
  const region = process.env.AWS_REGION || 'us-east-1';
  const path = `/runtimes/${encodeURIComponent(agentArn)}/invocations`;
  const bodyStr = JSON.stringify({ prompt });
  const runtimeSessionId = randomUUID();

  const request = new AWS.HttpRequest(new AWS.Endpoint(`https://bedrock-agentcore.${region}.amazonaws.com${path}`), region);
  request.method = 'POST';
  request.headers['Content-Type'] = 'application/json';
  request.headers['Accept'] = 'application/json';
  request.headers['X-Amzn-Bedrock-AgentCore-Runtime-Session-Id'] = runtimeSessionId;
  request.headers['host'] = `bedrock-agentcore.${region}.amazonaws.com`;
  request.body = bodyStr;

  const signer = new AWS.Signers.V4(request, 'bedrock-agentcore');
  signer.addAuthorization(AWS.config.credentials, new Date());

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `bedrock-agentcore.${region}.amazonaws.com`,
      path, method: 'POST', headers: request.headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        body: data,
        runtimeSessionId: res.headers['x-amzn-bedrock-agentcore-runtime-session-id'] || null,
        requestId: res.headers['x-amzn-requestid'] || null,
      }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function extractText(rawBody) {
  try {
    const parsed = JSON.parse(rawBody);
    // AgentCore may return a plain JSON-encoded string ("...text...") — after
    // JSON.parse this is already a string, so return it directly.
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object') {
      return parsed.response || parsed.output || parsed.text || rawBody;
    }
    return rawBody;
  } catch { return rawBody; }
}

function isAgentReportedFailure(text) {
  return typeof text === 'string' && /^(?:error\b|email not sent:|unable to\b)/i.test(text.trim());
}

/**
 * Fetch OTel trace events from CloudWatch for a specific session
 * Returns structured trace: { traceId, spans: [{type, content}] }
 */
async function fetchAgentTrace(agentKey, sessionId, callStartMs) {
  if (!sessionId) return null;
  const logs = new AWS.CloudWatchLogs({ region: process.env.AWS_REGION || 'us-east-1' });
  const logGroup = agentLogGroups[agentKey];
  if (!logGroup) return null;

  try {
    // Wait for CloudWatch to flush
    await new Promise(r => setTimeout(r, 4000));

    // Use the call start time as the window start (minus 10s buffer)
    const windowStart = (callStartMs || Date.now()) - 10000;

    const result = await logs.getLogEvents({
      logGroupName: logGroup,
      logStreamName: 'otel-rt-logs',
      limit: 100,
      startTime: windowStart,
      // Note: do NOT set startFromHead when using startTime
    }).promise();

    const spans = [];
    let traceId = null;
    let invocationDurationMs = null;

    for (const event of result.events || []) {
      try {
        const parsed = JSON.parse(event.message);
        const attrs = parsed.attributes || {};
        const scope = (parsed.scope || {}).name || '';
        const ts = parsed.timeUnixNano ? Math.floor(parsed.timeUnixNano / 1e6) : event.timestamp;

        // Only include events for this session (or bedrock_agentcore.app which has no session.id)
        const isForSession = attrs['session.id'] === sessionId;
        const isAppLog = scope === 'bedrock_agentcore.app';

        if (!isForSession && !isAppLog) continue;

        if (!traceId && parsed.traceId) traceId = parsed.traceId;

        const body = parsed.body || {};

        // Extract invocation duration from app log
        if (isAppLog && typeof body === 'string') {
          const match = body.match(/(\d+\.?\d*)s\)/);
          if (match) invocationDurationMs = Math.round(parseFloat(match[1]) * 1000);
        }

        if (!isForSession) continue;

        // Build span from strands.telemetry.tracer (LLM call with input/output)
        if (scope === 'strands.telemetry.tracer') {
          const span = { traceId: parsed.traceId, spanId: parsed.spanId, timestamp: ts };

          if (body.input && body.output) {
            span.type = 'llm_call';
            span.input = (body.input.messages || []).map(m => {
              const c = m.content;
              if (c && c.content) { try { return { role: m.role, text: JSON.parse(c.content).map(x => x.text || '').join('') }; } catch { return { role: m.role, text: c.content }; } }
              return { role: m.role, text: typeof c === 'string' ? c : JSON.stringify(c) };
            });
            span.output = (body.output.messages || []).map(m => {
              const c = m.content;
              if (c && c.message) { try { const p = JSON.parse(c.message); if (Array.isArray(p)) return { role: 'assistant', text: p.map(x => x.text || '').join(''), finish_reason: c.finish_reason }; } catch {} return { role: 'assistant', text: c.message, finish_reason: c.finish_reason }; }
              return { role: 'assistant', text: typeof c === 'string' ? c : JSON.stringify(c) };
            });
          } else if (body.input) {
            span.type = 'llm_input';
            span.input = (body.input.messages || []).map(m => {
              const c = m.content;
              if (c && c.content) { try { return { role: m.role, text: JSON.parse(c.content).map(x => x.text || '').join('') }; } catch { return { role: m.role, text: c.content }; } }
              return { role: m.role, text: typeof c === 'string' ? c : JSON.stringify(c) };
            });
          } else if (body.output) {
            span.type = 'llm_response';
            span.output = (body.output.messages || []).map(m => {
              const c = m.content;
              if (c && c.message) { try { const p = JSON.parse(c.message); if (Array.isArray(p)) return { role: 'assistant', text: p.map(x => x.text || '').join(''), finish_reason: c.finish_reason }; } catch {} return { role: 'assistant', text: c.message, finish_reason: c.finish_reason }; }
              return { role: 'assistant', text: typeof c === 'string' ? c : JSON.stringify(c) };
            });
          }
          if (span.type) spans.push(span);
        }

        // Extract Bedrock API call info from botocore instrumentation
        if (scope === 'opentelemetry.instrumentation.botocore.bedrock-runtime') {
          const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
          if (body.message !== undefined && body.finish_reason) {
            // This is a completion chunk — skip
          } else if (body.content && !spans.find(s => s.type === 'bedrock_api' && s.spanId === parsed.spanId)) {
            spans.push({
              type: 'bedrock_api',
              traceId: parsed.traceId,
              spanId: parsed.spanId,
              timestamp: ts,
              model: attrs['gen_ai.request.model'] || attrs['gen_ai.system'] || 'bedrock',
              inputTokens: attrs['gen_ai.usage.input_tokens'],
              outputTokens: attrs['gen_ai.usage.output_tokens'],
            });
          }
        }

        // Tool use
        if (body.tool_use) {
          spans.push({ type: 'tool_call', traceId: parsed.traceId, spanId: parsed.spanId, timestamp: ts, toolName: body.tool_use.name, toolInput: body.tool_use.input });
        }
        if (body.tool_result) {
          spans.push({ type: 'tool_result', traceId: parsed.traceId, spanId: parsed.spanId, timestamp: ts, toolResult: body.tool_result });
        }
      } catch { /* skip malformed */ }
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    const observabilityUrl = traceId
      ? `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#/gen-ai-observability/traces/${traceId}`
      : null;

    return spans.length > 0 ? { traceId, sessionId, spans, invocationDurationMs, observabilityUrl } : null;
  } catch (err) {
    console.error(`fetchAgentTrace error for ${agentKey} session ${sessionId}:`, err.message, err.code);
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (AGENT_CONFIG_ERROR) {
    console.error(AGENT_CONFIG_ERROR);
    return respond(503, { error: 'Agent runtimes are not configured' });
  }
  if (event.path === '/agents/workflow' || event.resource === '/agents/workflow') return handleWorkflow(event);
  if (event.path === '/agents/chat' || event.path?.endsWith('/agents/chat')) return handleChat(event);
  // /agents/trace/{agentKey}/{sessionId}
  if (event.path && event.path.includes('/agents/trace/')) return handleTrace(event);
  return handleAgent(event);
};

/**
 * Interactive chat with the orchestrator. The orchestrator is instructed to
 * fulfill the user's request using its tools (which route to specialist agents)
 * and emit structured data blocks (tables, charts) for rich rendering.
 *
 * Request body: { prompt, history? }
 *   - prompt: latest user message
 *   - history: optional array of {role, text} for context
 *
 * Response: { response, agentKey: 'orchestrator', sessionId }
 */
async function handleChat(event) {
  const body = JSON.parse(event.body || '{}');
  const userPrompt = body.prompt || body.message;
  const history = Array.isArray(body.history) ? body.history : [];
  if (!userPrompt) return respond(400, { error: 'Missing prompt' });

  // Build a conversation-style prompt: include short history for context
  const historyText = history.slice(-6).map(h =>
    `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`
  ).join('\n\n');

  // System-style instructions nested in the prompt (AgentCore Runtime takes a
  // single prompt per call). We tell the orchestrator how to format responses
  // so the UI can render tables and charts.
  const FORMAT_INSTRUCTIONS = `You are the FSM Assistant, an internal reporting tool for a Field Service Management platform that manages HVAC maintenance operations. You have access to specialist agents (HVAC monitoring, parts inventory, technician scheduling, customer communication, billing & invoicing, technical documentation, customer authentication) that read and act on real DynamoDB data.

Your output is a **report**, not a conversation. Write as if you are producing a short internal briefing for an operations manager. Do not greet the user, do not ask follow-up questions, do not use filler like "I'd be happy to…" — just deliver the report.

Hard rules:
1. ALWAYS call the appropriate specialist tools to fetch real data before writing the report. NEVER fabricate invoice IDs, customer names, amounts, parts numbers, or dates. If the data is missing or the tool returns an error, state that plainly in the report.
2. Format the report with Markdown:
   - Use ## section headings
   - Use **bold** for key figures and names
   - Use bullet points for lists
   - Keep prose minimal — prefer tables and numbers
3. When the data is tabular (lists of invoices, parts, jobs, technicians, customers) or comparative (amounts, counts, inventory levels), emit structured data blocks so the UI can render them. Use this exact format inline:

\`\`\`fsm-table
{"title": "Short title", "columns": ["Col1","Col2"], "rows": [["v","v"],["v","v"]]}
\`\`\`

\`\`\`fsm-chart
{"title": "Short title", "type": "bar", "xLabel": "Category", "yLabel": "Value", "data": [{"label":"A","value":12},{"label":"B","value":7}]}
\`\`\`

Data-block rules:
- JSON must be valid.
- Emit a table whenever there are 3+ items with multiple attributes.
- Emit a chart only when a visual comparison adds value (inventory levels, invoice totals by status, parts usage). Do not force one.
- Multiple tables/charts per report are fine.

4. Do NOT include a "Next Steps" section. Do NOT include a closing "let me know if you need anything else." Recommendations are welcome only when they're directly supported by the data you just pulled — keep them short and concrete.

${historyText ? `Prior conversation (for context only, do not greet):\n${historyText}\n\n` : ''}User's request: ${userPrompt}`;

  try {
    const callStartMs = Date.now();
    const result = await invokeAgentCore(AGENT_ARNS.orchestrator, FORMAT_INSTRUCTIONS);
    if (result.statusCode >= 400) {
      return respond(result.statusCode, { error: 'Orchestrator error', details: result.body });
    }
    return respond(200, {
      response: extractText(result.body),
      agentKey: 'orchestrator',
      sessionId: result.runtimeSessionId,
      callStartMs,
    });
  } catch (err) {
    console.error('handleChat error:', err);
    return respond(500, { error: err.message });
  }
}

async function handleTrace(event) {
  // Path: /agents/trace/{agentKey}/{sessionId}
  const parts = event.path.split('/');
  const agentKey = parts[parts.length - 2];
  const sessionId = parts[parts.length - 1];

  if (!agentKey || !sessionId || !agentLogGroups[agentKey]) {
    return respond(400, { error: `Invalid agentKey or sessionId` });
  }

  try {
    const trace = await fetchAgentTrace(agentKey, sessionId, Date.now() - 300000); // last 5 min
    return respond(200, { agentKey, sessionId, trace });
  } catch (err) {
    return respond(500, { error: err.message });
  }
}

async function handleAgent(event) {
  const agentType = event.pathParameters?.agent;
  if (!agentType || !AGENT_ARNS[agentType]) return respond(400, { error: `Invalid agent type: ${agentType}` });
  const { prompt } = JSON.parse(event.body || '{}');
  if (!prompt) return respond(400, { error: 'Missing prompt' });
  try {
    const result = await invokeAgentCore(AGENT_ARNS[agentType], prompt);
    if (result.statusCode >= 400) return respond(result.statusCode, { error: 'Agent invocation failed' });
    return respond(200, { agentType, response: extractText(result.body) });
  } catch (error) {
    return respond(500, { error: error.message });
  }
}

async function handleWorkflow(event) {
  const { workflowType, customerId, jobId } = JSON.parse(event.body || '{}');
  if (!workflowType) return respond(400, { error: 'Missing workflowType' });

  const stepDefs = WORKFLOW_STEPS[workflowType];
  if (!stepDefs) return respond(400, { error: `Unknown workflowType: ${workflowType}` });

  console.log(`Starting ${workflowType} workflow — calling ${stepDefs.length} agents sequentially`);

  // First get orchestrator summary
  let orchestratorResponse = '';
  try {
    const orchPrompt = workflowType === 'service_call'
      ? `You are the FSM Orchestrator. A service_call workflow has been triggered${customerId ? ` for customer ${customerId}` : ''}${jobId ? `, job ${jobId}` : ''}. Briefly summarize what this workflow will accomplish and why each step matters.`
      : `You are the FSM Orchestrator. A maintenance_completion workflow has been triggered${jobId ? ` for job ${jobId}` : ''}. Briefly summarize what this workflow will accomplish and why each step matters.`;
    const orchResult = await invokeAgentCore(AGENT_ARNS.orchestrator, orchPrompt);
    if (orchResult.statusCode < 400) orchestratorResponse = extractText(orchResult.body);
  } catch (e) {
    console.warn('Orchestrator summary failed:', e.message);
    orchestratorResponse = `${workflowType} workflow initiated and coordinated by the Orchestrator Agent.`;
  }

  // Call each agent in parallel for their step
  const stepPromises = stepDefs.map(async (def) => {
    const startTime = new Date().toISOString();
    let reasoning = '';
    let status = 'success';
    let stepSessionId = null;

    try {
      console.log(`Calling ${def.agentKey} agent for step: ${def.step}`);
      const result = await invokeAgentCore(AGENT_ARNS[def.agentKey], def.prompt);
      stepSessionId = result.runtimeSessionId || null;

      if (result.statusCode >= 400) {
        reasoning = `Agent returned error ${result.statusCode}`;
        status = 'error';
      } else {
        reasoning = extractText(result.body);
        if (isAgentReportedFailure(reasoning)) status = 'error';
      }
    } catch (err) {
      console.error(`Error calling ${def.agentKey}:`, err.message);
      reasoning = `Unable to reach ${def.agent}: ${err.message}`;
      status = 'error';
    }

    return {
      step: def.step,
      agent: def.agent,
      agentKey: def.agentKey,
      reasoning,
      status,
      sessionId: stepSessionId,
      startTime,
      endTime: new Date().toISOString(),
    };
  });

  // Run orchestrator summary + all agent steps in parallel
  const [steps] = await Promise.all([
    Promise.all(stepPromises)
  ]);

  return respond(200, {
    workflowType,
    status: steps.every(s => s.status === 'success') ? 'completed' : 'partial',
    orchestratorResponse,
    steps
  });
}

exports.optionsHandler = async () => respond(200, {});
exports.loadAgentRuntimeArns = loadAgentRuntimeArns;
exports.isAgentReportedFailure = isAgentReportedFailure;
// v1775259000
