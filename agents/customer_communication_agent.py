import json

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent, tool
from strands.models import BedrockModel

from agents.gateway_client import create_optional_gateway_client

app = BedrockAgentCoreApp()

class CustomerCommunicationAgent:
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
                self.get_customer_info,
                self.get_scheduled_maintenance,
                self.send_comprehensive_notification,
                self.send_email_notification,
                self.get_hvac_status
            ] + self.gateway_tools,
            system_prompt="""You are the Customer Communication Agent responsible for sending email notifications to customers about their HVAC system status and scheduled maintenance.

Your role is to:
1. Get customer information and contact details
2. Retrieve HVAC system status and any issues
3. Get scheduled maintenance information
4. Send comprehensive email notifications using SNS

When sending notifications, use send_comprehensive_notification which automatically:
- Gathers customer info, HVAC status, and scheduled maintenance
- Creates professional email templates
- Sends via SNS through the Gateway

Available notification types:
- "status_update" (default): Regular system status with maintenance info
- "alert": System issue alerts with recommended actions
- "maintenance_reminder": Upcoming maintenance reminders

Use the Gateway SNS tools to send actual email notifications."""
        )

    @tool
    def get_customer_info(self, customer_id: str) -> str:
        """Get customer information including email address"""
        try:
            if self.mcp_client:
                try:
                    with self.mcp_client:
                        result = self.mcp_client.call_tool_sync(
                            tool_use_id=f"customer-{customer_id}",
                            name="CustomerTarget___get_customer_tool",
                            arguments={"customerId": customer_id}
                        )
                        
                        if result and 'content' in result:
                            return result['content'][0]['text']
                            
                except Exception as e:
                    print(f"Gateway call failed: {e}")
            
            # Fallback data
            return json.dumps({
                "customerId": customer_id,
                "name": "Sample Customer",
                "email": "customer@example.com",
                "phone": "555-0123",
                "address": "123 Main St, City, State"
            })
        except Exception as e:
            return f"Error getting customer info: {str(e)}"

    @tool
    def get_scheduled_maintenance(self, customer_id: str) -> str:
        """Get scheduled maintenance for a customer"""
        try:
            if self.mcp_client:
                try:
                    with self.mcp_client:
                        result = self.mcp_client.call_tool_sync(
                            tool_use_id=f"jobs-{customer_id}",
                            name="JobsTarget___get_jobs_tool",
                            arguments={"customerId": customer_id, "status": "scheduled"}
                        )
                        
                        if result and 'content' in result:
                            return result['content'][0]['text']
                            
                except Exception as e:
                    print(f"Gateway call failed: {e}")
            
            # Fallback data
            return json.dumps([
                {
                    "jobId": "job-001",
                    "type": "Routine Maintenance",
                    "scheduledDate": "2025-09-15",
                    "description": "Annual HVAC system inspection and filter replacement",
                    "technician": "John Smith"
                },
                {
                    "jobId": "job-002", 
                    "type": "Filter Replacement",
                    "scheduledDate": "2025-10-01",
                    "description": "Replace air filters and check system efficiency",
                    "technician": "Jane Doe"
                }
            ])
        except Exception as e:
            return f"Error getting scheduled maintenance: {str(e)}"

    @tool
    def get_hvac_status(self, customer_id: str) -> str:
        """Get current HVAC system status"""
        try:
            if self.mcp_client:
                try:
                    with self.mcp_client:
                        result = self.mcp_client.call_tool_sync(
                            tool_use_id=f"metrics-{customer_id}",
                            name="MetricsTarget___get_metrics_tool",
                            arguments={"customerId": customer_id}
                        )
                        
                        if result and 'content' in result:
                            return result['content'][0]['text']
                            
                except Exception as e:
                    print(f"Gateway call failed: {e}")
            
            # Fallback data
            return json.dumps({
                "customerId": customer_id,
                "temperature": 72,
                "pressure": 30,
                "humidity": 45,
                "powerConsumption": 95,
                "status": "normal",
                "lastUpdated": "2025-09-10T13:30:00Z"
            })
        except Exception as e:
            return f"Error getting HVAC status: {str(e)}"

    @tool
    def send_comprehensive_notification(self, customer_id: str, notification_type: str = "status_update") -> str:
        """Send comprehensive email notification with HVAC status and scheduled maintenance"""
        try:
            # Get customer information
            customer_info_str = self.get_customer_info(customer_id)
            customer_info = json.loads(customer_info_str)
            
            # Get HVAC status
            hvac_status_str = self.get_hvac_status(customer_id)
            hvac_status = json.loads(hvac_status_str)
            
            # Get scheduled maintenance
            maintenance_str = self.get_scheduled_maintenance(customer_id)
            scheduled_maintenance = json.loads(maintenance_str)
            
            # Import email templates
            from email_templates import create_hvac_status_email, create_alert_email, create_maintenance_reminder_email
            
            # Create appropriate email based on type
            if notification_type == "alert":
                alert_details = {
                    "type": "High Temperature Alert",
                    "severity": "medium",
                    "description": f"System temperature is {hvac_status.get('temperature', 'N/A')}°F, above normal range",
                    "timestamp": hvac_status.get('lastUpdated', 'Recently'),
                    "recommended_action": "Schedule service inspection to check cooling system"
                }
                subject, message = create_alert_email(customer_info, alert_details, scheduled_maintenance)
            elif notification_type == "maintenance_reminder":
                subject, message = create_maintenance_reminder_email(customer_info, scheduled_maintenance)
            else:
                subject, message = create_hvac_status_email(customer_info, hvac_status, scheduled_maintenance)
            
            # Send email using SNS
            return self.send_email_notification(customer_info.get('email', 'customer@example.com'), subject, message)
            
        except Exception as e:
            return f"Error sending comprehensive notification: {str(e)}"

    @tool
    def send_email_notification(self, customer_email: str, subject: str, message: str, topic_arn: str = None) -> str:
        """Send email notification using SNS through Gateway"""
        try:
            if self.mcp_client:
                try:
                    with self.mcp_client:
                        # Use SNS Publish through Gateway
                        sns_message = {
                            "Message": message,
                            "Subject": subject
                        }
                        
                        if topic_arn:
                            sns_message["TopicArn"] = topic_arn
                        
                        result = self.mcp_client.call_tool_sync(
                            tool_use_id=f"sns-publish-{customer_email}",
                            name="SNSTarget___Publish",
                            arguments=sns_message
                        )
                        
                        if result and 'content' in result:
                            return f"Email sent successfully: {result['content'][0]['text']}"
                            
                except Exception as e:
                    print(f"SNS Gateway call failed: {e}")
            
            # Gateway integration is optional, but without its SNS target no
            # notification is delivered. Never report a simulated send as success.
            return (
                "Email not sent: AgentCore Gateway SNS integration is not configured "
                "or unavailable"
            )
            
        except Exception as e:
            return f"Error sending email: {str(e)}"

# Initialize the agent
customer_comm_agent = CustomerCommunicationAgent()

@app.entrypoint
def customer_communication_agent_handler(payload):
    """
    AgentCore Runtime entrypoint for the Customer Communication Agent
    """
    user_input = payload.get("prompt", payload.get("request", ""))
    print(f"Customer Communication Agent received: {user_input}")
    
    response = customer_comm_agent.agent(user_input)
    return response.message['content'][0]['text']

if __name__ == "__main__":
    app.run()
