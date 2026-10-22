#!/usr/bin/env python3
"""
Test script for Customer Communication Agent with SNS integration
"""

import json
import sys
import os

# Add the agents directory to the path
sys.path.append('./agents')

from customer_communication_agent import customer_comm_agent

def test_customer_notification():
    """Test sending customer notification with HVAC status and scheduled maintenance"""
    
    print("🧪 Testing Customer Communication Agent...")
    print("=" * 60)
    
    # Test scenarios
    test_cases = [
        {
            "name": "HVAC Status Update with Scheduled Maintenance",
            "prompt": """Send an email notification to customer CUST-001 about their HVAC system status. 
            Include current system metrics and any upcoming scheduled maintenance. 
            Use a professional tone and include all relevant details."""
        },
        {
            "name": "System Alert with Maintenance Recommendation", 
            "prompt": """Customer CUST-002 has an HVAC system showing high temperature readings. 
            Send them an email alert about the issue and include information about any scheduled maintenance 
            that might address this problem."""
        },
        {
            "name": "Routine Maintenance Reminder",
            "prompt": """Send a routine maintenance reminder email to customer CUST-003. 
            Include their current system status and list all upcoming scheduled maintenance appointments."""
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🔍 Test Case {i}: {test_case['name']}")
        print("-" * 40)
        print(f"Prompt: {test_case['prompt']}")
        print("\n📤 Agent Response:")
        
        try:
            # Call the agent
            response = customer_comm_agent.agent(test_case['prompt'])
            
            # Extract the response content
            if hasattr(response, 'message') and 'content' in response.message:
                content = response.message['content'][0]['text']
                print(content)
            else:
                print(str(response))
                
        except Exception as e:
            print(f"❌ Error: {e}")
        
        print("\n" + "=" * 60)

def test_individual_tools():
    """Test individual tools of the customer communication agent"""
    
    print("\n🔧 Testing Individual Tools...")
    print("=" * 60)
    
    customer_id = "CUST-001"
    
    # Test get_customer_info
    print(f"\n📋 Testing get_customer_info for {customer_id}:")
    try:
        result = customer_comm_agent.get_customer_info(customer_id)
        print(json.dumps(json.loads(result), indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test get_hvac_status
    print(f"\n🌡️ Testing get_hvac_status for {customer_id}:")
    try:
        result = customer_comm_agent.get_hvac_status(customer_id)
        print(json.dumps(json.loads(result), indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test get_scheduled_maintenance
    print(f"\n🔧 Testing get_scheduled_maintenance for {customer_id}:")
    try:
        result = customer_comm_agent.get_scheduled_maintenance(customer_id)
        print(json.dumps(json.loads(result), indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test send_email_notification
    print(f"\n📧 Testing send_email_notification:")
    try:
        result = customer_comm_agent.send_email_notification(
            customer_email="test@example.com",
            subject="HVAC System Status Update",
            message="Your HVAC system is operating normally. Scheduled maintenance: Sept 15, 2025."
        )
        print(result)
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Main test function"""
    print("🚀 Customer Communication Agent Test Suite")
    print("=" * 60)
    
    # Check if agent is properly initialized
    if not customer_comm_agent:
        print("❌ Failed to initialize customer communication agent")
        sys.exit(1)
    
    print("✅ Customer Communication Agent initialized successfully")
    print(f"🔧 Available tools: {len(customer_comm_agent.gateway_tools) + 4}")  # 4 local tools + gateway tools
    
    # Run tests
    test_individual_tools()
    test_customer_notification()
    
    print("\n🎉 Test suite completed!")
    print("\n📝 Notes:")
    print("- The agent uses Gateway tools when available")
    print("- Falls back to simulated data when Gateway is unavailable")
    print("- SNS integration requires proper Gateway target setup")
    print("- Run scripts/setup-sns-gateway-target.py to enable SNS")

if __name__ == "__main__":
    main()
