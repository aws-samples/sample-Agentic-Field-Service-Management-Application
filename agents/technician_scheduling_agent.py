"""
FSM Technician Scheduling Agent.

Reads real technicians and jobs from DynamoDB and can assign/reassign
technicians to jobs. Uses narrow tools that return JSON strings.
"""

import json
import os
from decimal import Decimal
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

REGION = os.environ.get("AWS_REGION", "us-east-1")
TECHS_TABLE = os.environ["FSM_TECHNICIANS_TABLE"]
JOBS_TABLE = os.environ["FSM_JOBS_TABLE"]

_dynamodb = boto3.resource("dynamodb", region_name=REGION)
_techs = _dynamodb.Table(TECHS_TABLE)
_jobs = _dynamodb.Table(JOBS_TABLE)


def _jsonable(obj):
    if isinstance(obj, list):
        return [_jsonable(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    if isinstance(obj, set):
        return sorted(_jsonable(v) for v in obj)
    return obj


@tool
def get_technician(technician_id: str) -> str:
    """Fetch a technician by ID (e.g. 'tech-001'). Returns full profile
    including name, skills, currentLocation, status, and assignedJobs."""
    try:
        resp = _techs.get_item(Key={"id": technician_id})
    except ClientError as e:
        return json.dumps({"error": str(e)})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"Technician {technician_id} not found"})
    return json.dumps(_jsonable(item))


@tool
def list_technicians(status: Optional[str] = None) -> str:
    """List technicians, optionally filtered by status ('Available','Busy',
    'Off Duty'). Returns JSON array of technician summaries."""
    kwargs = {}
    if status:
        kwargs["FilterExpression"] = Attr("status").eq(status)
    items = []
    try:
        resp = _techs.scan(**kwargs)
        items.extend(resp.get("Items", []))
        while "LastEvaluatedKey" in resp:
            kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
            resp = _techs.scan(**kwargs)
            items.extend(resp.get("Items", []))
    except ClientError as e:
        return json.dumps({"error": str(e)})
    return json.dumps(_jsonable(items))


@tool
def find_available_technicians(required_skills_csv: str = "") -> str:
    """Find available technicians, optionally filtered by a comma-separated
    list of required skills (e.g. 'HVAC Certification,Carrier Systems').
    A technician matches if they hold ALL required skills."""
    required = [s.strip() for s in required_skills_csv.split(",") if s.strip()] if required_skills_csv else []
    try:
        resp = _techs.scan(FilterExpression=Attr("status").eq("Available"))
        items = resp.get("Items", [])
    except ClientError as e:
        return json.dumps({"error": str(e)})

    matches = []
    for tech in items:
        skills = tech.get("skills") or tech.get("specialties") or []
        if isinstance(skills, list) and all(r in skills for r in required):
            matches.append(tech)
    return json.dumps({"required_skills": required, "matches": _jsonable(matches)})


@tool
def get_job(job_id: str) -> str:
    """Fetch a job by ID (e.g. 'job-001'). Returns full job record."""
    try:
        resp = _jobs.get_item(Key={"id": job_id})
    except ClientError as e:
        return json.dumps({"error": str(e)})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"Job {job_id} not found"})
    return json.dumps(_jsonable(item))


@tool
def list_jobs_by_status(status: str) -> str:
    """List jobs matching the given status (e.g. 'Pending', 'Scheduled',
    'In Progress', 'Completed')."""
    try:
        resp = _jobs.scan(FilterExpression=Attr("status").eq(status))
        items = resp.get("Items", [])
        while "LastEvaluatedKey" in resp:
            resp = _jobs.scan(
                FilterExpression=Attr("status").eq(status),
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            items.extend(resp.get("Items", []))
    except ClientError as e:
        return json.dumps({"error": str(e)})
    return json.dumps(_jsonable(items))


@tool
def assign_technician_to_job(job_id: str, technician_id: str) -> str:
    """Assign a technician to a job. Updates the job's assignedTechnician
    and status fields. Returns the updated job record."""
    try:
        resp = _jobs.update_item(
            Key={"id": job_id},
            UpdateExpression="SET assignedTechnician = :tech, #s = :status",
            ConditionExpression="attribute_exists(id)",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":tech": technician_id, ":status": "Scheduled"},
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "ConditionalCheckFailedException":
            return json.dumps({"error": f"Job {job_id} not found"})
        return json.dumps({"error": str(e)})
    return json.dumps(_jsonable(resp["Attributes"]))


model = BedrockModel(model_id="us.anthropic.claude-sonnet-4-6")

agent = Agent(
    model=model,
    tools=[
        get_technician,
        list_technicians,
        find_available_technicians,
        get_job,
        list_jobs_by_status,
        assign_technician_to_job,
    ],
    system_prompt=(
        "You are the Technician Scheduling Agent for the FSM system. "
        "You have direct access to the FSM Technicians and Jobs "
        "DynamoDB tables. Always call tools to read real data — never "
        "fabricate technician names, IDs, availability, or skills. When "
        "asked to assign a technician, verify they are Available and have "
        "the required skills before calling assign_technician_to_job."
    ),
)


@app.entrypoint
def technician_scheduling_agent_handler(payload):
    user_input = payload.get("prompt", payload.get("request", ""))
    response = agent(user_input)
    return response.message["content"][0]["text"]


if __name__ == "__main__":
    app.run()
