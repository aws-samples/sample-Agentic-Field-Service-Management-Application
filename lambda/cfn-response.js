// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

exports.SUCCESS = 'SUCCESS';
exports.FAILED = 'FAILED';

exports.send = function(event, context, responseStatus, responseData, physicalResourceId, noEcho) {
  return new Promise((resolve, reject) => {
    const responseBody = JSON.stringify({
      Status: responseStatus,
      Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
      PhysicalResourceId: physicalResourceId || context.logStreamName,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      NoEcho: noEcho || false,
      Data: responseData
    });

    console.log('Response body:\n', responseBody);

    // CloudFormation waits for this callback
    if (event.ResponseURL) {
      const https = require('https');
      const url = require('url');

      const parsedUrl = url.parse(event.ResponseURL);
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'PUT',
        headers: {
          'content-type': '',
          'content-length': responseBody.length
        }
      };

      const request = https.request(options, (response) => {
        console.log(`Status code: ${response.statusCode}`);
        console.log(`Status message: ${response.statusMessage}`);
        resolve();
      });

      request.on('error', (error) => {
        console.log(`Send CFN response failed: ${error}`);
        reject(error);
      });

      request.write(responseBody);
      request.end();
    } else {
      // For local testing
      console.log('No ResponseURL found. This is expected for local testing.');
      resolve();
    }
  });
};
