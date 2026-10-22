#!/usr/bin/env python3
"""
Direct test of Gateway SNS functionality
"""

import json
import os
import requests
import time

def load_gateway_config():
    """Load gateway configuration"""
    with open('agents/agentcore_gateway_config.json', 'r') as f:
        return json.load(f)

def get_access_token(config):
    """Get access token from Cognito"""
    token_url = f"https://{config['cognito_config']['domain_name']}.auth.us-east-1.amazoncognito.com/oauth2/token"
    
    response = requests.post(
        token_url,
        data=f"grant_type=client_credentials&client_id={config['cognito_config']['client_id']}&client_secret={config['cognito_config']['client_secret']}",
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    if response.status_code == 200:
        return response.json()['access_token']
    else:
        print(f"Failed to get token: {response.text}")
        return None

def test_sns_publish(gateway_url, token):
    """Test SNS Publish through Gateway"""
    
    # MCP request to call SNS Publish tool
    mcp_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "SNSTarget___Publish",
            "arguments": {
                "TopicArn": os.environ["FSM_TEST_SNS_TOPIC_ARN"],  # dedicated test topic; never a shared operational topic
                "Message": "Test email from FSM Customer Communication Agent - HVAC system status normal",
                "Subject": "HVAC System Test Notification"
            }
        }
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("🧪 Testing Gateway SNS Publish...")
    print(f"Gateway URL: {gateway_url}")
    print(f"Request: {json.dumps(mcp_request, indent=2)}")
    
    try:
        response = requests.post(gateway_url, json=mcp_request, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            if "result" in result and not result.get("result", {}).get("isError", False):
                print("✅ SNS Publish successful!")
            else:
                print(f"❌ SNS Publish failed: {result}")
        else:
            print(f"❌ SNS Publish failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")

def main():
    """Main test function"""
    print("🚀 Direct Gateway SNS Test")
    print("=" * 40)
    
    # Load config
    config = load_gateway_config()
    gateway_url = config['gateway_url']
    
    # Get access token
    print("🔑 Getting access token...")
    token = get_access_token(config)
    if not token:
        print("❌ Failed to get access token")
        return
    
    print("✅ Got access token")
    
    # Wait a moment to avoid rate limits
    print("⏳ Waiting 2 seconds...")
    time.sleep(2)
    
    # Test SNS
    test_sns_publish(gateway_url, token)

if __name__ == "__main__":
    main()
