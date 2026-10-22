"""
FSM Billing & Invoicing Agent.

Reads real invoice, customer, and job data from DynamoDB. Tools return JSON
strings so the LLM can reason over them without inventing numbers.
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
INVOICES_TABLE = os.environ["FSM_INVOICES_TABLE"]
CUSTOMERS_TABLE = os.environ["FSM_CUSTOMERS_TABLE"]
JOBS_TABLE = os.environ["FSM_JOBS_TABLE"]

_dynamodb = boto3.resource("dynamodb", region_name=REGION)
_invoices = _dynamodb.Table(INVOICES_TABLE)
_customers = _dynamodb.Table(CUSTOMERS_TABLE)
_jobs = _dynamodb.Table(JOBS_TABLE)


def _jsonable(obj):
    """Convert DynamoDB Decimals / sets to JSON-safe primitives."""
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
def get_invoice(invoice_id: str) -> str:
    """Fetch a single invoice by its ID (primary key `id`, e.g. 'inv-005').

    Returns a JSON object with all invoice fields including amount, date,
    status, line items, customerId, and jobId, or an error if not found.
    """
    try:
        resp = _invoices.get_item(Key={"id": invoice_id})
    except ClientError as e:
        return json.dumps({"error": str(e)})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"Invoice {invoice_id} not found"})
    return json.dumps(_jsonable(item))


@tool
def list_invoices(status: Optional[str] = None, customer_id: Optional[str] = None) -> str:
    """List invoices, optionally filtered by status ('Paid' | 'Unpaid' | 'Overdue')
    and/or customer_id (e.g. 'cust-005'). Returns a JSON array of invoice
    summaries: {id, customerId, jobId, amount, date, status}.
    """
    scan_kwargs = {
        "ProjectionExpression": "id, customerId, jobId, amount, #d, #s",
        "ExpressionAttributeNames": {"#d": "date", "#s": "status"},
    }
    filter_exprs = []
    if status:
        filter_exprs.append(Attr("status").eq(status))
    if customer_id:
        filter_exprs.append(Attr("customerId").eq(customer_id))
    if filter_exprs:
        expr = filter_exprs[0]
        for f in filter_exprs[1:]:
            expr = expr & f
        scan_kwargs["FilterExpression"] = expr

    items = []
    try:
        resp = _invoices.scan(**scan_kwargs)
        items.extend(resp.get("Items", []))
        while "LastEvaluatedKey" in resp:
            scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
            resp = _invoices.scan(**scan_kwargs)
            items.extend(resp.get("Items", []))
    except ClientError as e:
        return json.dumps({"error": str(e)})

    return json.dumps(_jsonable(items))


@tool
def list_unpaid_invoices() -> str:
    """Return only invoices whose status is 'Unpaid'. Useful for collections
    and AR reports. Each entry includes id, customerId, jobId, amount, date.
    """
    return list_invoices(status="Unpaid")


@tool
def get_customer(customer_id: str) -> str:
    """Fetch a customer record by ID (e.g. 'cust-005'). Returns the full
    customer profile as JSON or an error if not found. Use this to put
    invoice information in context (customer name, address, contact)."""
    try:
        resp = _customers.get_item(Key={"id": customer_id})
    except ClientError as e:
        return json.dumps({"error": str(e)})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"Customer {customer_id} not found"})
    return json.dumps(_jsonable(item))


@tool
def get_job(job_id: str) -> str:
    """Fetch a job record by ID (e.g. 'job-005'). Returns job details
    including description, technician, parts used, labor hours, and status.
    Use this to explain what a given invoice covers."""
    try:
        resp = _jobs.get_item(Key={"id": job_id})
    except ClientError as e:
        return json.dumps({"error": str(e)})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"Job {job_id} not found"})
    return json.dumps(_jsonable(item))


@tool
def calculate_invoice_total(line_items_json: str, tax_rate: float = 0.0) -> str:
    """Sum a list of line items and apply an optional tax rate.

    line_items_json must be a JSON array of {description, amount} objects.
    Returns {"subtotal": X, "tax": Y, "total": Z, "tax_rate": tax_rate}.
    """
    try:
        items = json.loads(line_items_json) if isinstance(line_items_json, str) else line_items_json
    except Exception as e:
        return json.dumps({"error": f"Invalid line_items JSON: {e}"})
    if not isinstance(items, list):
        return json.dumps({"error": "line_items must be a JSON array"})

    try:
        subtotal = sum(float(item.get("amount", 0)) for item in items)
    except Exception as e:
        return json.dumps({"error": f"Could not sum amounts: {e}"})

    tax = round(subtotal * float(tax_rate), 2)
    total = round(subtotal + tax, 2)
    return json.dumps({
        "subtotal": round(subtotal, 2),
        "tax": tax,
        "total": total,
        "tax_rate": tax_rate,
        "item_count": len(items),
    })


@tool
def update_invoice_status(invoice_id: str, new_status: str) -> str:
    """Update an invoice's status (e.g. mark as 'Paid' or 'Unpaid').
    Returns the updated record on success."""
    valid = {"Paid", "Unpaid", "Overdue", "Cancelled"}
    if new_status not in valid:
        return json.dumps({"error": f"status must be one of {sorted(valid)}"})
    try:
        resp = _invoices.update_item(
            Key={"id": invoice_id},
            UpdateExpression="SET #s = :s",
            ConditionExpression="attribute_exists(id)",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": new_status},
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "ConditionalCheckFailedException":
            return json.dumps({"error": f"Invoice {invoice_id} not found"})
        return json.dumps({"error": str(e)})
    return json.dumps(_jsonable(resp["Attributes"]))


model = BedrockModel(model_id="us.anthropic.claude-sonnet-4-6")

agent = Agent(
    model=model,
    tools=[
        get_invoice,
        list_invoices,
        list_unpaid_invoices,
        get_customer,
        get_job,
        calculate_invoice_total,
        update_invoice_status,
    ],
    system_prompt=(
        "You are the Billing & Invoicing Agent for the FSM system. You have "
        "direct access to the FSM Invoices, Customers, and "
        "Jobs DynamoDB tables via your tools. "
        "CRITICAL: Always call the tools to read real data. Never fabricate "
        "invoice IDs, amounts, customer names, or dates. If an invoice is not "
        "found, say so clearly — do not invent a plausible-looking answer. "
        "When asked to 'explain' an invoice, fetch the invoice first, then "
        "fetch the related customer and job to give full context. "
        "Reply concisely, citing invoice IDs, amounts, and dates from the data."
    ),
)


@app.entrypoint
def billing_invoicing_agent_handler(payload):
    user_input = payload.get("prompt", payload.get("request", ""))
    response = agent(user_input)
    return response.message["content"][0]["text"]


if __name__ == "__main__":
    app.run()
