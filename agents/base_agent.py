"""
Base Service Agent - Common functionality for all FSM agents
"""
import json
import boto3
from typing import Dict, Any, List
from datetime import datetime

class BaseServiceAgent:
    """Base class for all FSM service agents"""
    
    def __init__(self, agent_id: str, name: str, description: str):
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.created_at = datetime.now().isoformat()
        self.activity_log = []
        
    def log_activity(self, action: str, data: Dict[str, Any]):
        """Log agent activity"""
        self.activity_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "data": data
        })
        
    def save_agent_state(self, state_data: Dict[str, Any]):
        """Save agent state (placeholder for persistence)"""
        pass
        
    def get_agent_capabilities(self) -> List[str]:
        """Return list of agent capabilities"""
        return []
        
    def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming requests - to be implemented by subclasses"""
        return {"status": "not_implemented"}
