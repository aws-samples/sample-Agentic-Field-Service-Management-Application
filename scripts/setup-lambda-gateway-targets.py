#!/usr/bin/env python3
"""
Script to set up Lambda Gateway targets for customer and jobs data
"""

import boto3
import json
import os
import sys

def load_gateway_config():
    """Load gateway configuration"""
    config_path = '../agents/agentcore_gateway_config.json'
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Gateway config file not found: {config_path}")
        return None

def get_lambda_function_arn(lambda_client, function_name):
    """Get Lambda function ARN"""
    try:
        response = lambda_client.get_function(FunctionName=function_name)
        return response['Configuration']['FunctionArn']
    except Exception as e:
        print(f"❌ Error getting Lambda function {function_name}: {e}")
        return None

def create_lambda_gateway_target(gateway_client, gateway_id, target_name, lambda_arn):
    """Create Lambda Gateway target"""
    
    # Tool schema for Lambda functions based on the notebook format
    if target_name == 'CustomerTarget':
        tool_schema = {
            "inlinePayload": [
                {
                    "name": "get_customer_tool",
                    "description": "Get customer information by ID",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "customerId": {
                                "type": "string",
                                "description": "The customer ID"
                            }
                        },
                        "required": ["customerId"]
                    }
                }
            ]
        }
    elif target_name == 'JobsTarget':
        tool_schema = {
            "inlinePayload": [
                {
                    "name": "get_jobs_tool", 
                    "description": "Get jobs information",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "customerId": {
                                "type": "string",
                                "description": "Filter jobs by customer ID"
                            },
                            "status": {
                                "type": "string", 
                                "description": "Filter jobs by status"
                            }
                        }
                    }
                }
            ]
        }
    
    # Lambda target configuration
    lambda_target_config = {
        "mcp": {
            "lambda": {
                "lambdaArn": lambda_arn,
                "toolSchema": tool_schema
            }
        }
    }
    
    # IAM credentials provider configuration
    credential_config = [
        {
            "credentialProviderType": "GATEWAY_IAM_ROLE"
        }
    ]
    
    try:
        response = gateway_client.create_gateway_target(
            gatewayIdentifier=gateway_id,
            name=target_name,
            description=f'Lambda Target for {target_name}',
            targetConfiguration=lambda_target_config,
            credentialProviderConfigurations=credential_config
        )
        
        print(f"✅ Created Lambda Gateway target: {target_name}")
        return response
        
    except Exception as e:
        print(f"❌ Error creating Lambda Gateway target {target_name}: {e}")
        return None

def main():
    """Main function"""
    print("🚀 Setting up Lambda Gateway targets...")
    
    # Load configuration
    gateway_config = load_gateway_config()
    if not gateway_config:
        sys.exit(1)
    
    gateway_id = gateway_config['gateway_id']
    region = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
    
    # Initialize AWS clients
    lambda_client = boto3.client('lambda', region_name=region)
    gateway_client = boto3.client('bedrock-agentcore-control', region_name=region)
    
    print(f"📋 Gateway ID: {gateway_id}")
    print(f"📋 Region: {region}")
    
    # Lambda functions to add as targets
    lambda_targets = [
        {
            'function_name': 'FSM-CustomerFunction-prod',
            'target_name': 'CustomerTarget'
        },
        {
            'function_name': 'FSM-JobsFunction-prod', 
            'target_name': 'JobsTarget'
        }
    ]
    
    success_count = 0
    
    for target in lambda_targets:
        print(f"\n📦 Setting up {target['target_name']}...")
        
        # Get Lambda function ARN
        lambda_arn = get_lambda_function_arn(lambda_client, target['function_name'])
        if not lambda_arn:
            continue
            
        print(f"📋 Lambda ARN: {lambda_arn}")
        
        # Create Gateway target
        result = create_lambda_gateway_target(
            gateway_client, 
            gateway_id, 
            target['target_name'], 
            lambda_arn
        )
        
        if result:
            success_count += 1
    
    print(f"\n✅ Successfully created {success_count}/{len(lambda_targets)} Lambda Gateway targets!")
    print("\n📧 The customer communication agent can now use:")
    print("   - CustomerTarget___get_customer_tool for customer data")
    print("   - JobsTarget___get_jobs_tool for jobs data")
    print("   - SNSTarget___Publish tool for email notifications")

if __name__ == "__main__":
    main()
