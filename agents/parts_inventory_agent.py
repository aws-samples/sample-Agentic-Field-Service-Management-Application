"""
FSM Parts Inventory Agent.

Reads and writes the environment-scoped FSM Parts DynamoDB table. Tools are intentionally
narrow and return JSON strings so the LLM can reason over them.
"""

import json
import os
from decimal import Decimal
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError
from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

REGION = os.environ.get("AWS_REGION", "us-east-1")
PARTS_TABLE = os.environ["FSM_PARTS_TABLE"]
LOW_STOCK_THRESHOLD = int(os.environ.get("LOW_STOCK_THRESHOLD", "10"))

_dynamodb = boto3.resource("dynamodb", region_name=REGION)
_parts_table = _dynamodb.Table(PARTS_TABLE)


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
def get_part(part_number: str) -> str:
    """Look up a single part by its partNumber (primary key).

    Returns a JSON string of the full item (name, description, category,
    price, inventory, manufacturer, fitment) or an error message if not found.
    """
    try:
        resp = _parts_table.get_item(Key={"partNumber": part_number})
    except ClientError as e:
        return json.dumps({"error": str(e)})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"Part {part_number} not found"})
    return json.dumps(_jsonable(item))


@tool
def check_inventory(part_number: str) -> str:
    """Return just the current inventory count for a part as JSON
    {"partNumber": ..., "inventory": N, "name": "..."}. If the part
    doesn't exist, returns {"error": ...}.
    """
    try:
        resp = _parts_table.get_item(
            Key={"partNumber": part_number},
            ProjectionExpression="partNumber, inventory, #n",
            ExpressionAttributeNames={"#n": "name"},
        )
    except ClientError as e:
        return json.dumps({"error": str(e)})
    item = resp.get("Item")
    if not item:
        return json.dumps({"error": f"Part {part_number} not found"})
    return json.dumps(_jsonable(item))


@tool
def list_parts(category: Optional[str] = None, hvac_model: Optional[str] = None) -> str:
    """List parts, optionally filtered by category or by the HVAC model they fit.
    Returns a JSON array of {partNumber, name, category, inventory, price}.
    No filters -> returns all parts (small catalog, safe to scan).
    """
    scan_kwargs = {
        "ProjectionExpression": "partNumber, #n, category, inventory, price, manufacturer",
        "ExpressionAttributeNames": {"#n": "name"},
    }
    filter_exprs = []
    if category:
        filter_exprs.append(Attr("category").eq(category))
    if hvac_model:
        filter_exprs.append(Attr("fitment").contains(hvac_model))
    if filter_exprs:
        expr = filter_exprs[0]
        for f in filter_exprs[1:]:
            expr = expr & f
        scan_kwargs["FilterExpression"] = expr

    items = []
    try:
        resp = _parts_table.scan(**scan_kwargs)
        items.extend(resp.get("Items", []))
        while "LastEvaluatedKey" in resp:
            scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
            resp = _parts_table.scan(**scan_kwargs)
            items.extend(resp.get("Items", []))
    except ClientError as e:
        return json.dumps({"error": str(e)})

    return json.dumps(_jsonable(items))


@tool
def list_low_stock(threshold: Optional[int] = None) -> str:
    """Return parts whose inventory is at or below the threshold
    (default env LOW_STOCK_THRESHOLD=10). Useful to decide what to reorder.
    """
    t = int(threshold) if threshold is not None else LOW_STOCK_THRESHOLD
    try:
        resp = _parts_table.scan(
            FilterExpression=Attr("inventory").lte(t),
            ProjectionExpression="partNumber, #n, inventory, price, manufacturer",
            ExpressionAttributeNames={"#n": "name"},
        )
        items = resp.get("Items", [])
        while "LastEvaluatedKey" in resp:
            resp = _parts_table.scan(
                FilterExpression=Attr("inventory").lte(t),
                ProjectionExpression="partNumber, #n, inventory, price, manufacturer",
                ExpressionAttributeNames={"#n": "name"},
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            items.extend(resp.get("Items", []))
    except ClientError as e:
        return json.dumps({"error": str(e)})
    return json.dumps({"threshold": t, "parts": _jsonable(items)})


@tool
def adjust_inventory(part_number: str, delta: int, reason: str = "") -> str:
    """Atomically add `delta` (can be negative) to a part's inventory.
    Rejects operations that would drive inventory below zero.
    Returns the new inventory count on success.
    """
    try:
        delta_int = int(delta)
    except (TypeError, ValueError):
        return json.dumps({"error": "delta must be an integer"})

    try:
        if delta_int < 0:
            # Guard: require inventory >= -delta so we don't go negative
            resp = _parts_table.update_item(
                Key={"partNumber": part_number},
                UpdateExpression="SET inventory = inventory + :d",
                ConditionExpression="attribute_exists(partNumber) AND inventory >= :min",
                ExpressionAttributeValues={":d": delta_int, ":min": -delta_int},
                ReturnValues="ALL_NEW",
            )
        else:
            resp = _parts_table.update_item(
                Key={"partNumber": part_number},
                UpdateExpression="SET inventory = if_not_exists(inventory, :zero) + :d",
                ConditionExpression="attribute_exists(partNumber)",
                ExpressionAttributeValues={":d": delta_int, ":zero": 0},
                ReturnValues="ALL_NEW",
            )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code == "ConditionalCheckFailedException":
            return json.dumps({
                "error": "Conditional check failed. Either part doesn't exist or inventory would go negative.",
                "partNumber": part_number,
                "delta": delta_int,
            })
        return json.dumps({"error": str(e)})

    return json.dumps({
        "partNumber": part_number,
        "delta": delta_int,
        "reason": reason,
        "inventory": _jsonable(resp["Attributes"].get("inventory")),
    })


@tool
def reorder_parts(part_number: str, quantity: int) -> str:
    """Reorder a part by adding `quantity` units to inventory.
    This is a convenience wrapper over adjust_inventory for the reorder case.
    Returns the new inventory count.
    """
    try:
        qty = int(quantity)
    except (TypeError, ValueError):
        return json.dumps({"error": "quantity must be an integer"})
    if qty <= 0:
        return json.dumps({"error": "quantity must be positive"})
    return adjust_inventory(part_number, qty, reason="reorder")


model = BedrockModel(model_id="us.anthropic.claude-sonnet-4-6")

agent = Agent(
    model=model,
    tools=[get_part, check_inventory, list_parts, list_low_stock, adjust_inventory, reorder_parts],
    system_prompt=(
        "You are the Parts Inventory Agent responsible for managing the HVAC "
        "parts inventory in the FSM Parts DynamoDB table. "
        "Always call the tools to read real data — never fabricate part numbers, "
        "prices, or stock levels. When asked about availability, call "
        "check_inventory or list_low_stock. When asked to reorder, call "
        "reorder_parts (or adjust_inventory for arbitrary adjustments). "
        "Reply with concise, factual summaries citing part numbers and counts."
    ),
)


@app.entrypoint
def parts_inventory_agent_handler(payload):
    user_input = payload.get("prompt", payload.get("request", ""))
    response = agent(user_input)
    return response.message["content"][0]["text"]


if __name__ == "__main__":
    app.run()
