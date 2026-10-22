#!/usr/bin/env node
/**
 * Seed FSM DynamoDB tables using the same mock data that the
 * CloudFormation custom resource (lambda/dataPopulation.js) would write.
 *
 * We require() that file for its data. The handler only runs under
 * CFN custom-resource events, so loading the module has no side effects.
 */
const AWS = require('aws-sdk');
const path = require('path');

const REGION = process.env.AWS_REGION || 'us-east-1';
const ENV = process.env.FSM_ENV || 'prod';

AWS.config.update({ region: REGION });
const ddb = new AWS.DynamoDB.DocumentClient();

// Pull mock data out of dataPopulation.js by temporarily neutering its handler export
const dpPath = path.resolve(__dirname, '..', 'lambda', 'dataPopulation.js');
const fs = require('fs');
let src = fs.readFileSync(dpPath, 'utf8');
// Strip the cfn-response require so we don't need that dep at seed time
src = src.replace(/const response = require\('\.\/cfn-response'\);/, 'const response = { SUCCESS:"",FAILED:"",send: async()=>{} };');
const m = new (require('module').Module)('dp');
m.filename = dpPath;
m.paths = require('module').Module._nodeModulePaths(path.dirname(dpPath));
m._compile(src, dpPath);
const dp = m.exports;

// The mock arrays aren't exported, so eval the module source to extract them.
// Easier: re-parse by evaling expressions we know exist.
const ctx = {};
const wrapped = `${src}\n;module.exports.__data = { mockCustomers, mockJobs, mockTechnicians, mockInvoices, mockHvacDocumentation, mockParts };`;
const m2 = new (require('module').Module)('dp2');
m2.filename = dpPath;
m2.paths = require('module').Module._nodeModulePaths(path.dirname(dpPath));
m2._compile(wrapped, dpPath);
const data = m2.exports.__data;

async function writeItems(tableName, items) {
  const batchSize = 25;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await ddb.batchWrite({
      RequestItems: {
        [tableName]: batch.map(Item => ({ PutRequest: { Item } }))
      }
    }).promise();
    console.log(`  wrote ${Math.min(i + batchSize, items.length)}/${items.length}`);
  }
}

(async () => {
  console.log(`Seeding FSM tables (env=${ENV}, region=${REGION})`);

  console.log(`FSM-Customers-${ENV}`);
  await writeItems(`FSM-Customers-${ENV}`, data.mockCustomers);

  console.log(`FSM-Jobs-${ENV}`);
  await writeItems(`FSM-Jobs-${ENV}`, data.mockJobs);

  console.log(`FSM-Technicians-${ENV}`);
  await writeItems(`FSM-Technicians-${ENV}`, data.mockTechnicians);

  console.log(`FSM-Invoices-${ENV}`);
  await writeItems(`FSM-Invoices-${ENV}`, data.mockInvoices);

  console.log(`FSM-Documentation-${ENV}`);
  const docItems = Object.entries(data.mockHvacDocumentation).map(([model, v]) => ({ model, ...v }));
  await writeItems(`FSM-Documentation-${ENV}`, docItems);

  console.log(`FSM-Parts-${ENV}`);
  await writeItems(`FSM-Parts-${ENV}`, data.mockParts);

  // SimulatorConfig — init like deploy-stack.sh does
  console.log(`FSM-SimulatorConfig-${ENV}`);
  await ddb.put({
    TableName: `FSM-SimulatorConfig-${ENV}`,
    Item: { id: 'hvac-simulator-config', enabled: true, lastUpdated: new Date().toISOString() }
  }).promise();

  console.log('done.');
})().catch(err => { console.error(err); process.exit(1); });
