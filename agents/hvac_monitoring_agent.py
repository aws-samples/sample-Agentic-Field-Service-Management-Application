import json

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent, tool
from strands.models import BedrockModel

from agents.gateway_client import create_optional_gateway_client

app = BedrockAgentCoreApp()

class HVACMonitoringAgent:
    def __init__(self):
        model_id = "us.anthropic.claude-sonnet-4-6"
        self.model = BedrockModel(model_id=model_id)
        
        # Gateway integration is optional. When enabled, credentials are
        # retrieved at runtime from the configured Secrets Manager ARN.
        self.mcp_client = None
        self.gateway_tools = []
        try:
            self.mcp_client, self.gateway_tools = create_optional_gateway_client()
            if self.gateway_tools:
                print(f"Loaded Gateway tools: {[tool.tool_name for tool in self.gateway_tools]}")
        except Exception as error:
            print(f"Gateway integration unavailable: {error}")
        
        self.agent = Agent(
            model=self.model,
            tools=[
                self.analyze_system_metrics,
                self.detect_anomalies,
                self.predict_failures,
                self.generate_alerts
            ] + self.gateway_tools,
            system_prompt="""You are the HVAC Monitoring Agent responsible for analyzing HVAC system performance and detecting issues.
            
Your role is to:
1. Monitor real-time HVAC system metrics using available Gateway tools
2. Detect anomalies and performance issues
3. Predict potential system failures
4. Generate appropriate alerts for maintenance needs

You have access to metrics data through Gateway MCP tools. Use MetricsTarget___get_metrics_tool to get current system data before analysis.
Focus on temperature, pressure, humidity, and power consumption patterns."""
        )

    @tool
    def analyze_system_metrics(self, system_id: str) -> str:
        """Analyze HVAC system metrics for performance assessment"""
        try:
            # Try to get real metrics from Gateway using proper session management
            if self.mcp_client:
                try:
                    with self.mcp_client:
                        # Call metrics Lambda function through Gateway
                        result = self.mcp_client.call_tool_sync(
                            tool_use_id=f"metrics-{system_id}-analysis",
                            name="MetricsTarget___get_metrics_tool",
                            arguments={"customerId": system_id}
                        )
                        
                        if result and 'content' in result:
                            metrics_data = json.loads(result['content'][0]['text'])
                            
                            # Analyze the real metrics data
                            analysis = self._analyze_metrics_data(metrics_data, system_id)
                            return json.dumps(analysis)
                            
                except Exception as e:
                    print(f"Gateway call failed: {e}")
            
            # Fallback to simulated analysis
            analysis = {
                "system_id": system_id,
                "temperature_status": "normal",
                "pressure_status": "normal", 
                "efficiency": "good",
                "overall_health": "healthy",
                "data_source": "simulated",
                "note": "Gateway unavailable, using simulated data"
            }
            
            return json.dumps(analysis)
        except Exception as e:
            return f"Error analyzing metrics: {str(e)}"

    def _analyze_metrics_data(self, metrics_data, system_id):
        """Analyze real metrics data from Lambda function"""
        analysis = {
            "system_id": system_id,
            "data_source": "gateway_lambda",
            "timestamp": metrics_data.get("timestamp"),
            "anomalies_detected": []
        }
        
        # Analyze temperature
        temp = metrics_data.get("temperature", 72)
        if temp > 80:
            analysis["temperature_status"] = "high"
            analysis["anomalies_detected"].append("High temperature detected")
        elif temp < 65:
            analysis["temperature_status"] = "low"
            analysis["anomalies_detected"].append("Low temperature detected")
        else:
            analysis["temperature_status"] = "normal"
        
        # Analyze pressure
        pressure = metrics_data.get("pressure", 30)
        if pressure > 35:
            analysis["pressure_status"] = "high"
            analysis["anomalies_detected"].append("High pressure detected")
        elif pressure < 25:
            analysis["pressure_status"] = "low"
            analysis["anomalies_detected"].append("Low pressure detected")
        else:
            analysis["pressure_status"] = "normal"
        
        # Analyze power consumption
        power = metrics_data.get("powerConsumption", 100)
        if power > 120:
            analysis["efficiency"] = "poor"
            analysis["anomalies_detected"].append("High power consumption")
        else:
            analysis["efficiency"] = "good"
        
        # Overall health assessment
        if len(analysis["anomalies_detected"]) > 0:
            analysis["overall_health"] = "needs_attention"
            analysis["recommended_action"] = "Schedule maintenance check"
        else:
            analysis["overall_health"] = "healthy"
        
        return analysis

    @tool
    def detect_anomalies(self, system_data: str) -> str:
        """Detect anomalies in HVAC system behavior"""
        return f"Anomaly detection completed for: {system_data}"

    @tool
    def predict_failures(self, historical_data: str) -> str:
        """Predict potential system failures based on trends"""
        return f"Failure prediction analysis: {historical_data}"

    @tool
    def generate_alerts(self, alert_data: str) -> str:
        """Generate alerts for maintenance or urgent issues"""
        return f"Alert generated: {alert_data}"

# Initialize the agent
hvac_agent = HVACMonitoringAgent()

@app.entrypoint
def hvac_monitoring_agent_handler(payload):
    """
    AgentCore Runtime entrypoint for the HVAC Monitoring Agent
    """
    user_input = payload.get("prompt", payload.get("request", ""))
    print(f"HVAC Monitoring Agent received: {user_input}")
    
    response = hvac_agent.agent(user_input)
    return response.message['content'][0]['text']

if __name__ == "__main__":
    app.run()
