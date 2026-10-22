// Unit tests for the WebSocket $connect authorizer.
// Run with: node --test lambda/websocketAuthorizer.test.js
// aws-jwt-verify is replaced by a stub so the tests need no network or install.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

let verifyImpl;
let createArgs;
const stub = {
  CognitoJwtVerifier: {
    create(args) {
      createArgs = args;
      return { verify: (token) => verifyImpl(token) };
    }
  }
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'aws-jwt-verify') return stub;
  return originalLoad.call(this, request, ...rest);
};

process.env.USER_POOL_ID = 'us-east-1_example';
process.env.USER_POOL_CLIENT_ID = 'exampleclientid';
const { handler } = require('./websocketAuthorizer');

const methodArn = 'arn:aws:execute-api:us-east-1:000000000000:abc123/prod/$connect';

test('verifier is created for ID tokens of the configured pool and client', () => {
  assert.deepStrictEqual(createArgs, {
    userPoolId: 'us-east-1_example',
    tokenUse: 'id',
    clientId: 'exampleclientid'
  });
});

test('valid token returns an Allow policy scoped to the method ARN', async () => {
  verifyImpl = async (t) => {
    assert.strictEqual(t, 'good-token');
    return { sub: 'user-1', email: 'a@example.com' };
  };
  const res = await handler({ queryStringParameters: { token: 'good-token' }, methodArn });
  assert.strictEqual(res.principalId, 'user-1');
  assert.deepStrictEqual(res.policyDocument.Statement, [
    { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: methodArn }
  ]);
  assert.deepStrictEqual(res.context, { sub: 'user-1', email: 'a@example.com' });
});

test('missing token is rejected without calling the verifier', async () => {
  verifyImpl = async () => { throw new Error('should not be called'); };
  await assert.rejects(handler({ methodArn }), /Unauthorized/);
  await assert.rejects(handler({ queryStringParameters: {}, methodArn }), /Unauthorized/);
});

test('expired, forged or wrong-client tokens are rejected', async () => {
  for (const name of ['JwtExpiredError', 'JwtInvalidSignatureError', 'JwtInvalidClaimError']) {
    verifyImpl = async () => { const e = new Error('bad'); e.name = name; throw e; };
    await assert.rejects(
      handler({ queryStringParameters: { token: 'bad-token' }, methodArn }),
      /Unauthorized/
    );
  }
});
