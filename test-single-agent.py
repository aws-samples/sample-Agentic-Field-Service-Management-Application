#!/usr/bin/env python3
from bedrock_agentcore_starter_toolkit import Runtime
import boto3

# Test deploying just the orchestrator agent
agentcore_runtime = Runtime()

response = agentcore_runtime.configure(
    entrypoint="agents/orchestrator_agent.py",
    auto_create_execution_role=True,
    auto_create_ecr=True,
    requirements_file="agents/requirements.txt",
    region="us-east-1",
    agent_name="test_orchestrator"
)

print(f"Configuration: {response}")

launch_result = agentcore_runtime.launch()
print(f"Launch result: {launch_result}")
