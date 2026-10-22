#!/bin/bash
# Script to package the data population Lambda function

set -e

# Configuration
REGION=${1:-us-east-1}
ENVIRONMENT=${2:-dev}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
LAMBDA_BUCKET="fsm-lambda-code-${ACCOUNT_ID}-${REGION}-${ENVIRONMENT}-cfn"

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAMBDA_DIR="${PROJECT_ROOT}/lambda"
TEMPLATES_DIR="${PROJECT_ROOT}"

echo "Packaging data population Lambda function..."
echo "Region: ${REGION}"
echo "Account ID: ${ACCOUNT_ID}"
echo "Lambda Code Bucket: ${LAMBDA_BUCKET}"
echo "Project Root: ${PROJECT_ROOT}"
echo "Lambda Directory: ${LAMBDA_DIR}"
echo "Templates Directory: ${TEMPLATES_DIR}"

# Create the bucket if it doesn't exist
# aws s3api head-bucket --bucket ${LAMBDA_BUCKET} 2>/dev/null || aws s3 mb s3://${LAMBDA_BUCKET} --region ${REGION}
# We'll let CloudFormation create the bucket

# Create a temporary directory for packaging
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: ${TEMP_DIR}"

# Create a directory for the function
mkdir -p ${TEMP_DIR}/dataPopulation

# Copy the handler files
cp ${LAMBDA_DIR}/dataPopulation.js ${TEMP_DIR}/dataPopulation/index.js
cp ${LAMBDA_DIR}/cfn-response.js ${TEMP_DIR}/dataPopulation/cfn-response.js

# Create package.json
cat > ${TEMP_DIR}/dataPopulation/package.json << EOF
{
  "name": "data-population",
  "version": "1.0.0",
  "description": "Lambda function to populate DynamoDB tables with sample data",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1.0"
  }
}
EOF

# Install dependencies
cd ${TEMP_DIR}/dataPopulation
npm install --production

# Create zip file
zip -r ${TEMP_DIR}/dataPopulation.zip ./*

# Upload to S3
aws s3 cp ${TEMP_DIR}/dataPopulation.zip s3://${LAMBDA_BUCKET}/lambda/dataPopulation.zip --region ${REGION}

echo "Packaged and uploaded data population Lambda function to s3://${LAMBDA_BUCKET}/lambda/dataPopulation.zip"

# Upload CloudFormation templates
echo "Uploading CloudFormation templates..."
aws s3 cp ${TEMPLATES_DIR}/fsm-dynamodb.yaml s3://${LAMBDA_BUCKET}/templates/fsm-dynamodb.yaml --region ${REGION}
aws s3 cp ${TEMPLATES_DIR}/fsm-lambda.yaml s3://${LAMBDA_BUCKET}/templates/fsm-lambda.yaml --region ${REGION}
aws s3 cp ${TEMPLATES_DIR}/fsm-api.yaml s3://${LAMBDA_BUCKET}/templates/fsm-api.yaml --region ${REGION}
aws s3 cp ${TEMPLATES_DIR}/fsm-data-population.yaml s3://${LAMBDA_BUCKET}/templates/fsm-data-population.yaml --region ${REGION}

echo "All templates uploaded successfully!"

# Clean up
rm -rf ${TEMP_DIR}
echo "Temporary directory removed"
