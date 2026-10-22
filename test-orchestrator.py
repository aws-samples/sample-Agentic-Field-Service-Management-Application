#!/usr/bin/env python3
import boto3
import json
import os

def _required_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"{name} must be set (no live resource identifiers are committed to this repository)")
    return value


def test_orchestrator_agent():
    """Test if Orchestrator Agent automatically picks HVAC monitoring for health check"""
    
    client = boto3.client('bedrock-agentcore', region_name=_required_env('AWS_REGION'))
    
    # Orchestrator agent ARN
    agent_arn = _required_env("FSM_ORCHESTRATOR_RUNTIME_ARN")
    
    # Test payload - ask for HVAC health without specifying which agent to use
    test_payload = {
        "prompt": "What is the health status of the HVAC system for customer CUST001?"
    }
    
    print("🎭 Testing Orchestrator Agent - HVAC Health Check...")
    print(f"Payload: {json.dumps(test_payload, indent=2)}")
    
    try:
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_arn,
            qualifier="DEFAULT",
            payload=json.dumps(test_payload)
        )
        
        print("✅ Response received!")
        
        # Process response
        events = []
        for event in response.get("response", []):
            event_data = event.decode("utf-8")
            events.append(event_data)
        
        if events:
            result = json.loads(events[0])
            print(f"\n📋 Orchestrator Response:\n{result}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_orchestrator_agent()
