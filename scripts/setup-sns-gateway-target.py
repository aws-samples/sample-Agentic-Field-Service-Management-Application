#!/usr/bin/env python3
"""
Script to set up SNS Gateway target for customer communication agent
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

def upload_sns_smithy_spec(s3_client, bucket_name, account_id, region):
    """Upload SNS Smithy specification to S3"""
    file_path = '../smithy-specs/sns-apis.json'
    object_key = 'sns-apis.json'
    
    try:
        # Create bucket if it doesn't exist
        try:
            if region == "us-east-1":
                s3_client.create_bucket(Bucket=bucket_name)
            else:
                s3_client.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': region}
                )
        except Exception as e:
            print(f"Bucket may already exist: {e}")
        
        # Upload the Smithy spec
        with open(file_path, 'rb') as file_data:
            s3_client.put_object(Bucket=bucket_name, Key=object_key, Body=file_data)
        
        smithy_s3_uri = f's3://{bucket_name}/{object_key}'
        print(f'✅ Uploaded SNS Smithy spec: {smithy_s3_uri}')
        return smithy_s3_uri
        
    except Exception as e:
        print(f'❌ Error uploading SNS Smithy spec: {e}')
        return None

def create_sns_gateway_target(gateway_client, gateway_id, smithy_s3_uri):
    """Create SNS Gateway target"""
    
    # Smithy target configuration
    smithy_target_config = {
        "mcp": {
            "smithyModel": {
                "s3": {
                    "uri": smithy_s3_uri
                }
            }
        }
    }
    
    # IAM credentials provider configuration
    credential_config = {
        "credentialProviderType": "GATEWAY_IAM_ROLE"
    }
    
    target_name = 'SNSTarget'
    
    try:
        response = gateway_client.create_gateway_target(
            gatewayIdentifier=gateway_id,
            name=target_name,
            description='SNS Target for customer email notifications',
            targetConfiguration=smithy_target_config,
            credentialProviderConfigurations=[credential_config]
        )
        
        print(f"✅ Created SNS Gateway target: {target_name}")
        print(f"Response metadata: {response['ResponseMetadata']}")
        return response
        
    except Exception as e:
        print(f"❌ Error creating SNS Gateway target: {e}")
        return None

def main():
    """Main function"""
    print("🚀 Setting up SNS Gateway target for customer communication...")
    
    # Load configuration
    gateway_config = load_gateway_config()
    if not gateway_config:
        sys.exit(1)
    
    gateway_id = gateway_config['gateway_id']
    region = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
    
    # Initialize AWS clients
    session = boto3.session.Session()
    s3_client = session.client('s3')
    sts_client = session.client('sts')
    gateway_client = boto3.client('bedrock-agentcore-control', region_name=region)
    
    # Get account ID
    account_id = sts_client.get_caller_identity()["Account"]
    bucket_name = f'agentcore-gateway-{account_id}-{region}'
    
    print(f"📋 Gateway ID: {gateway_id}")
    print(f"📋 Region: {region}")
    print(f"📋 S3 Bucket: {bucket_name}")
    
    # Upload SNS Smithy specification
    smithy_s3_uri = upload_sns_smithy_spec(s3_client, bucket_name, account_id, region)
    if not smithy_s3_uri:
        sys.exit(1)
    
    # Create SNS Gateway target
    result = create_sns_gateway_target(gateway_client, gateway_id, smithy_s3_uri)
    if not result:
        sys.exit(1)
    
    print("✅ SNS Gateway target setup completed successfully!")
    print("\n📧 The customer communication agent can now send email notifications using:")
    print("   - SNSTarget___Publish tool through the Gateway")
    print("   - Real SNS integration for email delivery")

if __name__ == "__main__":
    main()
