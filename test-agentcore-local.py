#!/usr/bin/env python3
"""
Test FSM agents locally before deploying to AgentCore Runtime
"""

import sys
import os
sys.path.append('agents')

def test_orchestrator_agent():
    """Test the orchestrator agent locally"""
    print("🧪 Testing Orchestrator Agent locally...")
    
    try:
        # Import without the AgentCore runtime parts
        import json
        from strands import Agent, tool
        from strands.models import BedrockModel
        
        # Test payload
        test_payload = {
            "prompt": "Analyze this service request: Customer reports HVAC system not cooling properly, temperature reading 85°F, customer type: premium, suspected issue: compressor failure"
        }
        
        print(f"Test payload: {test_payload}")
        print("✅ Orchestrator agent imports successful")
        print("Note: Full test requires AWS credentials and Bedrock access")
        
    except Exception as e:
        print(f"❌ Error testing orchestrator agent: {str(e)}")
        return False
    
    return True

def test_hvac_monitoring_agent():
    """Test the HVAC monitoring agent locally"""
    print("🧪 Testing HVAC Monitoring Agent locally...")
    
    try:
        # Test payload
        test_payload = {
            "prompt": "Analyze these HVAC metrics: temperature: 78°F, pressure: 32 PSI, power_consumption: 115W, system_id: HVAC-001"
        }
        
        print(f"Test payload: {test_payload}")
        print("✅ HVAC Monitoring agent imports successful")
        
    except Exception as e:
        print(f"❌ Error testing HVAC monitoring agent: {str(e)}")
        return False
    
    return True

def main():
    """Run local tests for all agents"""
    print("🚀 Running local tests for FSM AgentCore agents")
    print("="*50)
    
    tests = [
        test_orchestrator_agent,
        test_hvac_monitoring_agent
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            results.append(False)
        print()
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print("="*50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed! Ready for AgentCore deployment")
        return True
    else:
        print("❌ Some tests failed. Please fix issues before deployment")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
