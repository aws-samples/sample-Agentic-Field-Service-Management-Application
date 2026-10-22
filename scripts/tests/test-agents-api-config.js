#!/usr/bin/env node
const assert = require('assert');

process.env.AWS_REGION = 'us-east-1';
delete process.env.AGENT_RUNTIME_ARNS;
const handlerModule = require('../../lambda/agentsApiHandler');

const keys = ['orchestrator', 'monitoring', 'inventory', 'scheduling', 'communication', 'authentication', 'billing', 'documentation'];
const valid = Object.fromEntries(keys.map((key, index) => [
  key,
  `arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/fsm_${key}_${index}`
]));

assert.strictEqual(handlerModule.loadAgentRuntimeArns().error, 'AGENT_RUNTIME_ARNS is not configured');
assert.strictEqual(handlerModule.loadAgentRuntimeArns(JSON.stringify(valid)).error, null);
assert.match(handlerModule.loadAgentRuntimeArns('{}').error, /keys must be exactly/);
const duplicate = { ...valid, billing: valid.orchestrator };
assert.match(handlerModule.loadAgentRuntimeArns(JSON.stringify(duplicate)).error, /must be unique/);
assert.match(handlerModule.loadAgentRuntimeArns(JSON.stringify(valid), 'eu-west-1').error, /invalid runtime ARN/);
assert.strictEqual(handlerModule.isAgentReportedFailure('Email not sent: Gateway unavailable'), true);
assert.strictEqual(handlerModule.isAgentReportedFailure('Error sending comprehensive notification: failed'), true);
assert.strictEqual(handlerModule.isAgentReportedFailure('Notification delivered successfully'), false);

(async () => {
  const response = await handlerModule.handler({ httpMethod: 'POST', path: '/agents/chat', body: '{}' });
  assert.strictEqual(response.statusCode, 503);
  assert.deepStrictEqual(JSON.parse(response.body), { error: 'Agent runtimes are not configured' });
  const options = await handlerModule.handler({ httpMethod: 'OPTIONS' });
  assert.strictEqual(options.statusCode, 200);
  console.log('PASS: Agent runtime configuration is validated and missing configuration returns 503');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
