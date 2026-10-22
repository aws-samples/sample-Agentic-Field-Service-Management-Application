from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

model_id = "us.anthropic.claude-sonnet-4-6"
model = BedrockModel(model_id=model_id)

# STUB (threat T10): this tool does NOT authenticate anyone and always succeeds.
# Replace it with a real lookup (e.g. against the Customers DynamoDB table)
# before any production use.
@tool
def verify_customer_stub(customer_data: str) -> str:
    """STUB: does NOT verify customer identity; always succeeds. Replace with a real lookup before production use."""
    return f"UNVERIFIED (stub, no identity check performed): {customer_data}"

# STUB (threat T10): this tool does NOT look up any service contract and always succeeds.
# Replace it with a real lookup before any production use.
@tool
def check_service_contract_stub(contract_data: str) -> str:
    """STUB: does NOT check any service contract; always succeeds. Replace with a real lookup before production use."""
    return f"UNCHECKED (stub, no contract lookup performed): {contract_data}"

agent = Agent(
    model=model,
    tools=[verify_customer_stub, check_service_contract_stub],
    system_prompt="You are the Customer Authentication Agent responsible for verifying customer identity and service contract status."
)

@app.entrypoint
def customer_authentication_agent_handler(payload):
    user_input = payload.get("prompt", payload.get("request", ""))
    response = agent(user_input)
    return response.message['content'][0]['text']

if __name__ == "__main__":
    app.run()
