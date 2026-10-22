from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

model_id = "us.anthropic.claude-sonnet-4-6"
model = BedrockModel(model_id=model_id)

@tool
def retrieve_manual(equipment_type: str) -> str:
    """Retrieve technical manual for equipment"""
    return f"Technical manual retrieved for: {equipment_type}"

@tool
def generate_safety_protocol(procedure_type: str) -> str:
    """Generate safety protocol for specific procedure"""
    return f"Safety protocol generated for: {procedure_type}"

agent = Agent(
    model=model,
    tools=[retrieve_manual, generate_safety_protocol],
    system_prompt="You are the Technical Documentation Agent responsible for providing technical manuals and safety protocols."
)

@app.entrypoint
def technical_documentation_agent_handler(payload):
    user_input = payload.get("prompt", payload.get("request", ""))
    response = agent(user_input)
    return response.message['content'][0]['text']

if __name__ == "__main__":
    app.run()
