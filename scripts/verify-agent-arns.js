#!/usr/bin/env node
/** Validate the atomic AgentCore deployment result used by CloudFormation. */

const fs = require('fs');

const REQUIRED_KEYS = [
  'orchestrator', 'monitoring', 'inventory', 'scheduling',
  'communication', 'authentication', 'billing', 'documentation'
];
const REQUIRED_NAMES = [
  'fsm_orchestrator_agent',
  'fsm_hvac_monitoring_agent',
  'fsm_parts_inventory_agent',
  'fsm_technician_scheduling_agent',
  'fsm_customer_communication_agent',
  'fsm_customer_authentication_agent',
  'fsm_billing_invoicing_agent',
  'fsm_technical_documentation_agent'
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const compact = args.includes('--compact');
const filePath = args.find(arg => !arg.startsWith('--'));
if (!filePath) fail('usage: verify-agent-arns.js <deployment-results.json> [--compact]');

let result;
try {
  result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (error) {
  fail(`could not read ${filePath}: ${error.message}`);
}

if (result.schemaVersion !== 1) fail('unsupported or missing schemaVersion');
if (!/^\d{12}$/.test(result.accountId || '')) fail('invalid accountId');
if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(result.region || '')) fail('invalid region');
if (!['dev', 'test', 'prod'].includes(result.environment)) fail('invalid environment');
if (!result.runtimes || typeof result.runtimes !== 'object' || Array.isArray(result.runtimes)) fail('runtimes must be an object');
if (!result.agentRuntimeArns || typeof result.agentRuntimeArns !== 'object' || Array.isArray(result.agentRuntimeArns)) fail('agentRuntimeArns must be an object');

const names = Object.keys(result.runtimes).sort();
if (JSON.stringify(names) !== JSON.stringify([...REQUIRED_NAMES].sort())) fail('deployment result must contain exactly the eight FSM runtimes');
const keys = Object.keys(result.agentRuntimeArns).sort();
if (JSON.stringify(keys) !== JSON.stringify([...REQUIRED_KEYS].sort())) fail('agentRuntimeArns must contain exactly the eight semantic keys');

const arnPattern = new RegExp(`^arn:(aws|aws-cn|aws-us-gov):bedrock-agentcore:${result.region}:${result.accountId}:runtime/[A-Za-z0-9_-]+$`);
const seen = new Set();
for (const name of REQUIRED_NAMES) {
  const runtime = result.runtimes[name];
  const expectedRuntimeName = `${name}_${result.environment}`;
  if (!runtime || runtime.agentRuntimeName !== expectedRuntimeName) fail(`invalid runtime record for ${expectedRuntimeName}`);
  if (runtime.status !== 'READY') fail(`${name} is not READY (status=${runtime.status})`);
  if (!REQUIRED_KEYS.includes(runtime.key)) fail(`${name} has an invalid semantic key`);
  if (!arnPattern.test(runtime.agentRuntimeArn || '')) fail(`${name} has an invalid runtime ARN`);
  if (result.agentRuntimeArns[runtime.key] !== runtime.agentRuntimeArn) fail(`${name} does not match agentRuntimeArns.${runtime.key}`);
  if (seen.has(runtime.agentRuntimeArn)) fail(`duplicate runtime ARN: ${runtime.agentRuntimeArn}`);
  seen.add(runtime.agentRuntimeArn);
}

if (compact) {
  process.stdout.write(JSON.stringify(result.agentRuntimeArns));
} else {
  console.log(`PASS: validated ${seen.size} READY FSM AgentCore runtimes for ${result.accountId}/${result.region}/${result.environment}`);
}
