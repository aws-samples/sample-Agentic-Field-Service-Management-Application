"""Optional AgentCore Gateway client configuration backed by Secrets Manager."""

from __future__ import annotations

import base64
import json
import os
from typing import Any

import boto3
import requests
from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp.mcp_client import MCPClient


def _load_credentials(secret_arn: str) -> dict[str, str]:
    region = os.environ.get("AWS_REGION", "us-east-1")
    value = boto3.client("secretsmanager", region_name=region).get_secret_value(SecretId=secret_arn)
    if value.get("SecretString"):
        payload = value["SecretString"]
    else:
        payload = base64.b64decode(value["SecretBinary"]).decode("utf-8")
    secret = json.loads(payload)
    required = {"client_id", "client_secret", "token_url"}
    if not isinstance(secret, dict) or not required.issubset(secret):
        raise ValueError(f"Gateway secret must contain {sorted(required)}")
    return {key: str(secret[key]) for key in required}


def _fetch_access_token(credentials: dict[str, str]) -> str:
    response = requests.post(
        credentials["token_url"],
        data={"grant_type": "client_credentials"},
        auth=(credentials["client_id"], credentials["client_secret"]),
        timeout=15,
    )
    response.raise_for_status()
    token = response.json().get("access_token")
    if not token:
        raise ValueError("Cognito token response did not contain access_token")
    return token


def get_full_tools_list(client: MCPClient) -> list[Any]:
    tools: list[Any] = []
    pagination_token = None
    while True:
        page = client.list_tools_sync(pagination_token=pagination_token)
        tools.extend(page)
        pagination_token = getattr(page, "pagination_token", None)
        if pagination_token is None:
            return tools


def create_optional_gateway_client() -> tuple[MCPClient | None, list[Any]]:
    gateway_url = os.environ.get("GATEWAY_URL")
    secret_arn = os.environ.get("GATEWAY_CREDENTIALS_SECRET_ARN")
    if not gateway_url and not secret_arn:
        return None, []
    if not gateway_url or not secret_arn:
        raise ValueError("GATEWAY_URL and GATEWAY_CREDENTIALS_SECRET_ARN must be configured together")

    credentials = _load_credentials(secret_arn)

    def create_transport():
        # MCPClient reopens transports for tool calls. Fetch a fresh token for
        # every transport so long-lived runtimes do not retain an expired token.
        access_token = _fetch_access_token(credentials)
        return streamablehttp_client(gateway_url, headers={"Authorization": f"Bearer {access_token}"})

    client = MCPClient(create_transport)
    with client:
        tools = get_full_tools_list(client)
    return client, tools
