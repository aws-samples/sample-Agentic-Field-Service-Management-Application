#!/usr/bin/env python3
import boto3
import json
import time
import os

def _required_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"{name} must be set (no live resource identifiers are committed to this repository)")
    return value


def test_hvac_agent():
    """Test the HVAC monitoring agent with proper error handling"""
    
    client = boto3.client('bedrock-agentcore', region_name=_required_env('AWS_REGION'))
    
    # HVAC agent ARN
    agent_arn = _required_env("FSM_HVAC_MONITORING_RUNTIME_ARN")
    
    # Test payload using the agent's own analyze_system_metrics tool
    test_payload = {
        "prompt": "Please analyze_system_metrics for customer CUST001 and check for any anomalies"
    }
    
    print("🧪 Testing HVAC Monitoring Agent...")
    print(f"Agent ARN: {agent_arn}")
    print(f"Payload: {json.dumps(test_payload, indent=2)}")
    
    try:
        print("\n📡 Invoking agent...")
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_arn,
            qualifier="DEFAULT",
            payload=json.dumps(test_payload)
        )
        
        print("✅ Response received!")
        print(f"Content Type: {response.get('contentType', 'N/A')}")
        
        # Handle different response types
        if "text/event-stream" in response.get("contentType", ""):
            print("📄 Processing event stream...")
            content = []
            for line in response["response"].iter_lines(chunk_size=1):
                if line:
                    line = line.decode("utf-8")
                    if line.startswith("data: "):
                        line = line[6:]
                        content.append(line)
                        print(f"Stream: {line}")
            
            if content:
                print(f"\n📋 Full Response: {' '.join(content)}")
        else:
            print("📄 Processing standard response...")
            events = []
            for event in response.get("response", []):
                event_data = event.decode("utf-8")
                events.append(event_data)
                print(f"Event: {event_data}")
            
            if events:
                try:
                    result = json.loads(events[0])
                    print(f"\n📋 Parsed Response: {json.dumps(result, indent=2)}")
                except json.JSONDecodeError:
                    print(f"\n📋 Raw Response: {events[0]}")
    
    except client.exceptions.ValidationException as e:
        print(f"❌ Validation Error: {e}")
        print("💡 Check if the agent ARN is correct and the agent is deployed")
    
    except client.exceptions.ResourceNotFoundException as e:
        print(f"❌ Resource Not Found: {e}")
        print("💡 The agent runtime may not exist or may be in a different region")
    
    except client.exceptions.ThrottlingException as e:
        print(f"❌ Throttling Error: {e}")
        print("💡 Too many requests, wait a moment and try again")
    
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        print(f"Error Type: {type(e).__name__}")
        
        # Check if it's a 400 error with more details
        if hasattr(e, 'response'):
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_message = e.response.get('Error', {}).get('Message', 'No message')
            print(f"AWS Error Code: {error_code}")
            print(f"AWS Error Message: {error_message}")

def check_agent_status():
    """Check the agent runtime status"""
    print("\n🔍 Checking agent status...")
    
    try:
        client = boto3.client('bedrock-agentcore-control', region_name='us-east-1')
        
        # List all runtimes to find our agent
        response = client.list_agent_runtimes()
        
        hvac_agents = [
            runtime for runtime in response.get('agentRuntimes', [])
            if 'hvac_monitoring' in runtime.get('name', '').lower()
        ]
        
        if hvac_agents:
            for agent in hvac_agents:
                print(f"📊 Agent: {agent.get('name', 'Unknown')}")
                print(f"   Status: {agent.get('status', 'Unknown')}")
                print(f"   ARN: {agent.get('agentRuntimeArn', 'Unknown')}")
        else:
            print("❌ No HVAC monitoring agents found")
            
    except Exception as e:
        print(f"❌ Error checking agent status: {e}")

if __name__ == "__main__":
    check_agent_status()
    test_hvac_agent()
