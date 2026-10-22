"""
FSM Orchestrator Agent.

This agent is the primary entrypoint for the interactive "Ask Assistant" chat.
It has DIRECT read-only access to all FSM DynamoDB tables so it can answer
questions about invoices, jobs, customers, technicians, parts, and metrics
without round-tripping through other agents (which was causing
"data unavailable" responses).

For mutating or email actions, it can still delegate to specialist agents,
but the core data lookups are handled here directly.
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

_dynamodb = boto3.resource("dynamodb", region_name=REGION)
_customers = _dynamodb.Table(os.environ["FSM_CUSTOMERS_TABLE"])
_jobs = _dynamodb.Table(os.environ["FSM_JOBS_TABLE"])
_technicians = _dynamodb.Table(os.environ["FSM_TECHNICIANS_TABLE"])
_invoices = _dynamodb.Table(os.environ["FSM_INVOICES_TABLE"])
_parts = _dynamodb.Table(os.environ["FSM_PARTS_TABLE"])
_metrics = _dynamodb.Table(os.environ["FSM_METRICS_TABLE"])


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


def _get(table, pk_name, pk_value, table_label):
    try:
        resp = table.get_item(Key={pk_name: pk_value})
    except ClientError as e:
        return json.dumps({"error": f"{table_label} lookup failed: {str(e)}"})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"{table_label} {pk_value} not found"})
    return json.dumps(_jsonable(item))


def _scan(table, filter_expr=None, projection=None, attr_names=None, table_label=""):
    items = []
    kwargs = {}
    if filter_expr is not None:
        kwargs["FilterExpression"] = filter_expr
    if projection:
        kwargs["ProjectionExpression"] = projection
    if attr_names:
        kwargs["ExpressionAttributeNames"] = attr_names
    try:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        while "LastEvaluatedKey" in resp:
            kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
            resp = table.scan(**kwargs)
            items.extend(resp.get("Items", []))
    except ClientError as e:
        return json.dumps({"error": f"{table_label} scan failed: {str(e)}"})
    return json.dumps(_jsonable(items))


# ---------------------- Invoices ----------------------

@tool
def get_invoice(invoice_id: str) -> str:
    """Fetch a single invoice by its ID (e.g. 'inv-005'). Returns full record
    including amount, date, status, line items, customerId, and jobId."""
    return _get(_invoices, "id", invoice_id, "Invoice")


@tool
def list_invoices(status: Optional[str] = None, customer_id: Optional[str] = None) -> str:
    """List invoices, optionally filtered by status ('Paid'|'Unpaid'|'Overdue')
    and/or customer_id. Returns a JSON array with id, customerId, jobId,
    amount, date, status."""
    exprs = []
    if status:
        exprs.append(Attr("status").eq(status))
    if customer_id:
        exprs.append(Attr("customerId").eq(customer_id))
    filter_expr = exprs[0] if exprs else None
    for f in exprs[1:]:
        filter_expr = filter_expr & f
    return _scan(
        _invoices,
        filter_expr=filter_expr,
        projection="id, customerId, jobId, amount, #d, #s",
        attr_names={"#d": "date", "#s": "status"},
        table_label="Invoices",
    )


# ---------------------- Jobs ----------------------

@tool
def get_job(job_id: str) -> str:
    """Fetch a single job by ID (e.g. 'job-001'). Returns all job details
    including status, customer, assignedTechnician, type, scheduledDate,
    hvacModel, location, and requiredSkills."""
    return _get(_jobs, "id", job_id, "Job")


@tool
def list_jobs(status: Optional[str] = None, customer_id: Optional[str] = None, technician_id: Optional[str] = None) -> str:
    """List jobs, optionally filtered by status ('Pending'|'Scheduled'|
    'In Progress'|'Completed'), customer_id, or assigned technician_id.
    Returns a JSON array of job summaries."""
    exprs = []
    if status:
        exprs.append(Attr("status").eq(status))
    if customer_id:
        exprs.append(Attr("customerId").eq(customer_id))
    if technician_id:
        exprs.append(Attr("assignedTechnician").eq(technician_id))
    filter_expr = exprs[0] if exprs else None
    for f in exprs[1:]:
        filter_expr = filter_expr & f
    return _scan(
        _jobs,
        filter_expr=filter_expr,
        projection="id, customerId, customer, #t, #s, assignedTechnician, scheduledDate, hvacModel, #loc",
        attr_names={"#t": "type", "#s": "status", "#loc": "location"},
        table_label="Jobs",
    )


@tool
def get_job_status(job_id: str) -> str:
    """Quick status check for a single job. Returns {id, status,
    assignedTechnician, scheduledDate} or an error."""
    try:
        resp = _jobs.get_item(
            Key={"id": job_id},
            ProjectionExpression="id, #s, assignedTechnician, scheduledDate, #t, customer",
            ExpressionAttributeNames={"#s": "status", "#t": "type"},
        )
    except ClientError as e:
        return json.dumps({"error": str(e)})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"Job {job_id} not found"})
    return json.dumps(_jsonable(item))


# ---------------------- Technicians ----------------------

@tool
def get_technician(technician_id: str) -> str:
    """Fetch a technician's full profile by ID (e.g. 'tech-001')."""
    return _get(_technicians, "id", technician_id, "Technician")


@tool
def list_technicians(status: Optional[str] = None) -> str:
    """List technicians, optionally filtered by status (e.g. 'Available',
    'Busy', 'Off Duty'). Returns JSON array with id, name, skills,
    currentLocation, and status."""
    filter_expr = Attr("status").eq(status) if status else None
    return _scan(_technicians, filter_expr=filter_expr, table_label="Technicians")


# ---------------------- Customers ----------------------

@tool
def get_customer(customer_id: str) -> str:
    """Fetch a customer's full record by ID (e.g. 'cust-001')."""
    return _get(_customers, "id", customer_id, "Customer")


@tool
def list_customers() -> str:
    """List all customers. Returns id, name, location, systemStatus,
    contactInfo."""
    return _scan(
        _customers,
        projection="id, #n, #loc, systemStatus, contactInfo, hvacModel",
        attr_names={"#n": "name", "#loc": "location"},
        table_label="Customers",
    )


# ---------------------- Parts ----------------------

@tool
def get_part(part_number: str) -> str:
    """Fetch a part by partNumber (e.g. 'CAR-I002')."""
    return _get(_parts, "partNumber", part_number, "Part")


@tool
def list_parts(category: Optional[str] = None, low_stock_only: bool = False, threshold: int = 10) -> str:
    """List parts. If low_stock_only=True, filters to parts with inventory
    at or below `threshold` (default 10). Optionally filter by category.
    Returns JSON array of part summaries."""
    exprs = []
    if category:
        exprs.append(Attr("category").eq(category))
    if low_stock_only:
        exprs.append(Attr("inventory").lte(int(threshold)))
    filter_expr = exprs[0] if exprs else None
    for f in exprs[1:]:
        filter_expr = filter_expr & f
    return _scan(
        _parts,
        filter_expr=filter_expr,
        projection="partNumber, #n, category, inventory, price, manufacturer",
        attr_names={"#n": "name"},
        table_label="Parts",
    )


# ---------------------- Metrics ----------------------

@tool
def get_latest_metrics(customer_id: str) -> str:
    """Get the most recent HVAC metrics reading for a customer. Returns
    temperature, pressure, humidity, powerConsumption, status, timestamp
    — or an error if no metrics exist for that customer."""
    try:
        resp = _metrics.scan(
            FilterExpression=Attr("customerId").eq(customer_id),
            Limit=50,
        )
        items = resp.get("Items", [])
        if not items:
            return json.dumps({"error": f"No metrics found for customer {customer_id}"})
        # Take the latest by timestamp
        latest = max(items, key=lambda x: str(x.get("timestamp", "")))
        return json.dumps(_jsonable(latest))
    except ClientError as e:
        return json.dumps({"error": str(e)})


# ---------------------- Actions (write) ----------------------

@tool
def assign_technician_to_job(job_id: str, technician_id: str) -> str:
    """Assign a technician to a job. Updates the job's assignedTechnician
    field and sets its status to 'Scheduled'. Returns the updated job
    record, or an error if the job or technician does not exist.

    IMPORTANT: Before calling this, verify the technician exists via
    get_technician and ideally that they are Available / have matching
    skills. Only call this when the user has explicitly asked for an
    assignment — do not auto-assign."""
    # First verify the technician exists — this avoids assigning ghost IDs
    try:
        tech_resp = _technicians.get_item(Key={"id": technician_id})
    except ClientError as e:
        return json.dumps({"error": f"Technician lookup failed: {str(e)}"})
    tech = tech_resp.get("Item")
    if not tech:
        return json.dumps({"error": f"Technician {technician_id} not found"})

    # Now perform the atomic job update (must exist)
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

    return json.dumps({
        "assigned": True,
        "job": _jsonable(resp["Attributes"]),
        "technician": {
            "id": tech.get("id"),
            "name": tech.get("name"),
        },
    })


@tool
def unassign_technician(job_id: str) -> str:
    """Remove the technician assignment from a job and revert its status
    to 'Pending'. Returns the updated job record or an error."""
    try:
        resp = _jobs.update_item(
            Key={"id": job_id},
            UpdateExpression="SET assignedTechnician = :null, #s = :status",
            ConditionExpression="attribute_exists(id)",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":null": None, ":status": "Pending"},
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "ConditionalCheckFailedException":
            return json.dumps({"error": f"Job {job_id} not found"})
        return json.dumps({"error": str(e)})
    return json.dumps({"unassigned": True, "job": _jsonable(resp["Attributes"])})


# ---------------------- Cross-cutting analysis helper ----------------------

@tool
def summarize_service_call(customer_id: str) -> str:
    """Aggregate everything needed to plan a service call for a customer:
    their profile, latest metrics, open jobs, and last invoice. Returns a
    single JSON object — cheaper than calling four separate tools."""
    out = {"customer_id": customer_id}
    try:
        cust = _customers.get_item(Key={"id": customer_id}).get("Item")
        out["customer"] = _jsonable(cust) if cust else {"error": "not found"}
    except ClientError as e:
        out["customer"] = {"error": str(e)}
    try:
        jobs_resp = _jobs.scan(FilterExpression=Attr("customerId").eq(customer_id))
        out["jobs"] = _jsonable(jobs_resp.get("Items", []))
    except ClientError as e:
        out["jobs"] = {"error": str(e)}
    try:
        inv_resp = _invoices.scan(FilterExpression=Attr("customerId").eq(customer_id))
        out["invoices"] = _jsonable(inv_resp.get("Items", []))
    except ClientError as e:
        out["invoices"] = {"error": str(e)}
    # Latest metrics
    try:
        m_resp = _metrics.scan(FilterExpression=Attr("customerId").eq(customer_id), Limit=20)
        items = m_resp.get("Items", [])
        if items:
            out["latest_metrics"] = _jsonable(max(items, key=lambda x: str(x.get("timestamp", ""))))
    except ClientError as e:
        out["latest_metrics"] = {"error": str(e)}
    return json.dumps(out)


# ---------------------- Agent ----------------------

model = BedrockModel(model_id="us.anthropic.claude-sonnet-4-6")

orchestrator_agent = Agent(
    model=model,
    tools=[
        # Invoices
        get_invoice, list_invoices,
        # Jobs
        get_job, list_jobs, get_job_status,
        # Technicians
        get_technician, list_technicians,
        # Customers
        get_customer, list_customers,
        # Parts
        get_part, list_parts,
        # Metrics
        get_latest_metrics,
        # Aggregate
        summarize_service_call,
        # Actions (write)
        assign_technician_to_job, unassign_technician,
    ],
    system_prompt=(
        "You are the FSM Orchestrator Agent. You have direct read/write "
        "access to the FSM DynamoDB tables (customers, jobs, technicians, "
        "invoices, parts, metrics) via your tools.\n\n"
        "CRITICAL RULES:\n"
        "1. Always call the tools to answer data questions. NEVER fabricate "
        "IDs, names, amounts, dates, statuses, or counts.\n"
        "2. When asked about a specific record (invoice inv-005, job job-001, "
        "customer cust-003, technician tech-002, part CAR-I002), call the "
        "corresponding get_* tool first.\n"
        "3. When asked to list or filter, use the list_* tools with the "
        "appropriate filter arguments.\n"
        "4. For end-to-end scenarios (service calls, maintenance planning), "
        "call summarize_service_call to get everything in one shot.\n"
        "5. If a tool returns {'error': ...}, report the error clearly — "
        "don't pretend the data doesn't exist.\n"
        "6. Reply concisely and factually. Cite IDs and exact values from "
        "the data. Prefer tables for multiple records.\n\n"
        "ASSIGNMENT RULES (write actions):\n"
        "7. To assign a technician to a job, use assign_technician_to_job. "
        "Before calling it: (a) confirm the job exists with get_job, "
        "(b) confirm the technician exists with get_technician, and (c) "
        "prefer technicians whose skills match the job's requiredSkills.\n"
        "8. If the user asks 'who should I assign for job-X?' without naming "
        "a technician, list the best candidates with list_technicians or "
        "find the matching available ones — do NOT auto-assign. Only call "
        "assign_technician_to_job when the user has explicitly picked a "
        "technician (by name or ID) or explicitly told you to assign the "
        "best match.\n"
        "9. After a successful assignment, confirm in the report: job ID, "
        "technician name + ID, and the new status ('Scheduled'). Offer to "
        "notify the customer only if asked.\n"
        "10. To remove an assignment, use unassign_technician — this reverts "
        "the job to 'Pending'."
    ),
)


@app.entrypoint
def orchestrator_agent_handler(payload):
    user_input = payload.get("prompt", payload.get("request", ""))
    print(f"Orchestrator received: {user_input[:200]}")
    response = orchestrator_agent(user_input)
    return response.message["content"][0]["text"]


if __name__ == "__main__":
    app.run()
