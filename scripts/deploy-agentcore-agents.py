#!/usr/bin/env python3
"""Create or update the eight FSM AgentCore runtimes from validated ECR images."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError

MODEL_ID = "us.anthropic.claude-sonnet-4-6"
FOUNDATION_MODEL_ID = MODEL_ID.removeprefix("us.")
TERMINAL_STATUSES = {"READY", "CREATE_FAILED", "UPDATE_FAILED"}
DDB_READ_ACTIONS = ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:Scan"]


@dataclass(frozen=True)
class AgentSpec:
    name: str
    key: str
    table_env: dict[str, str]
    write_tables: tuple[str, ...] = ()
    uses_gateway: bool = False


AGENTS = (
    AgentSpec(
        "fsm_orchestrator_agent",
        "orchestrator",
        {
            "FSM_CUSTOMERS_TABLE": "Customers",
            "FSM_JOBS_TABLE": "Jobs",
            "FSM_TECHNICIANS_TABLE": "Technicians",
            "FSM_INVOICES_TABLE": "Invoices",
            "FSM_PARTS_TABLE": "Parts",
            "FSM_METRICS_TABLE": "Metrics",
        },
        ("Jobs",),
    ),
    AgentSpec("fsm_hvac_monitoring_agent", "monitoring", {}, uses_gateway=True),
    AgentSpec("fsm_parts_inventory_agent", "inventory", {"FSM_PARTS_TABLE": "Parts"}, ("Parts",)),
    AgentSpec(
        "fsm_technician_scheduling_agent",
        "scheduling",
        {"FSM_TECHNICIANS_TABLE": "Technicians", "FSM_JOBS_TABLE": "Jobs"},
        ("Jobs",),
    ),
    AgentSpec("fsm_customer_communication_agent", "communication", {}, uses_gateway=True),
    AgentSpec("fsm_customer_authentication_agent", "authentication", {}),
    AgentSpec(
        "fsm_billing_invoicing_agent",
        "billing",
        {"FSM_INVOICES_TABLE": "Invoices", "FSM_CUSTOMERS_TABLE": "Customers", "FSM_JOBS_TABLE": "Jobs"},
        ("Invoices",),
    ),
    AgentSpec("fsm_technical_documentation_agent", "documentation", {}),
)
AGENT_BY_NAME = {agent.name: agent for agent in AGENTS}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-account", required=True, help="12-digit AWS account safety guard")
    parser.add_argument("--region", required=True)
    parser.add_argument("--environment", required=True, choices=("dev", "test", "prod"))
    parser.add_argument("--image-map", default="scripts/.rebuild-results.json")
    parser.add_argument("--output", default="scripts/.agentcore-deployment-results.json")
    parser.add_argument("--arn-map", default="scripts/.agent-runtime-arns.json")
    parser.add_argument("--profile")
    parser.add_argument("--confirm", help="Required for prod; must be DEPLOY-FSM-PROD")
    parser.add_argument("--gateway-url", help="Optional AgentCore Gateway MCP URL")
    parser.add_argument("--gateway-secret-arn", help="Secrets Manager ARN with client_id, client_secret, and token_url")
    parser.add_argument("--poll-interval", type=float, default=15.0)
    parser.add_argument("--timeout", type=int, default=1200)
    args = parser.parse_args(argv)
    if args.environment == "prod" and args.confirm != "DEPLOY-FSM-PROD":
        parser.error("production deployment requires --confirm DEPLOY-FSM-PROD")
    return args


def partition_for_region(region: str) -> str:
    if region.startswith("cn-"):
        return "aws-cn"
    if region.startswith("us-gov-"):
        return "aws-us-gov"
    return "aws"


def validate_inputs(args: argparse.Namespace) -> None:
    if not re.fullmatch(r"\d{12}", args.expected_account):
        raise ValueError("--expected-account must contain exactly 12 digits")
    if not re.fullmatch(r"[a-z]{2}(?:-gov)?-[a-z]+-\d", args.region):
        raise ValueError(f"Invalid AWS region: {args.region}")
    if args.poll_interval <= 0 or args.timeout <= 0:
        raise ValueError("poll interval and timeout must be positive")
    if bool(args.gateway_url) != bool(args.gateway_secret_arn):
        raise ValueError("--gateway-url and --gateway-secret-arn must be supplied together")
    if args.gateway_url and not re.fullmatch(r"https://[^\s]+/mcp/?", args.gateway_url):
        raise ValueError("--gateway-url must be an HTTPS MCP URL")
    if args.gateway_secret_arn:
        partition = partition_for_region(args.region)
        prefix = f"arn:{partition}:secretsmanager:{args.region}:{args.expected_account}:secret:"
        if not args.gateway_secret_arn.startswith(prefix):
            raise ValueError("Gateway secret ARN must match the expected account and region")


def load_image_map(path: Path, account: str, region: str) -> dict[str, str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read image map {path}: {exc}") from exc
    if not isinstance(data, dict) or set(data) != set(AGENT_BY_NAME):
        missing = sorted(set(AGENT_BY_NAME) - set(data if isinstance(data, dict) else {}))
        extra = sorted(set(data if isinstance(data, dict) else {}) - set(AGENT_BY_NAME))
        raise ValueError(f"Image map must contain exactly the eight FSM agents; missing={missing}, extra={extra}")

    dns_suffix = "amazonaws.com.cn" if region.startswith("cn-") else "amazonaws.com"
    registry = f"{account}.dkr.ecr.{region}.{dns_suffix}"
    validated: dict[str, str] = {}
    for name, value in data.items():
        if not isinstance(value, str):
            raise ValueError(f"Image URI for {name} must be a string")
        repository = f"bedrock-agentcore-{name}"
        pattern = rf"^{re.escape(registry)}/{re.escape(repository)}(?:[:][A-Za-z0-9_][A-Za-z0-9_.-]{{0,127}}|@sha256:[0-9a-f]{{64}})$"
        if not re.fullmatch(pattern, value):
            raise ValueError(f"Image URI for {name} must use {registry}/{repository} with a tag or digest")
        validated[name] = value
    return validated


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except BaseException:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def aws_session(profile: str | None, region: str) -> boto3.Session:
    return boto3.Session(profile_name=profile, region_name=region)


def verify_account(sts: Any, expected: str) -> None:
    identity = sts.get_caller_identity()
    actual = identity.get("Account")
    if actual != expected:
        raise RuntimeError(f"Active AWS account {actual} does not match expected account {expected}")
    print(f">> AWS identity: {identity.get('Arn')} (account {actual})")


def table_name(logical_name: str, environment: str) -> str:
    return f"FSM-{logical_name}-{environment}"


def runtime_name(agent: AgentSpec, environment: str) -> str:
    value = f"{agent.name}_{environment}"
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,47}", value):
        raise ValueError(f"AgentCore runtime name is invalid: {value}")
    return value


def role_name(agent: AgentSpec, environment: str) -> str:
    value = f"FSM-AgentCore-{environment}-{agent.name}"
    if len(value) > 64:
        raise ValueError(f"IAM role name is too long: {value}")
    return value


def assume_role_policy(account: str, region: str, partition: str) -> dict[str, Any]:
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "bedrock-agentcore.amazonaws.com"},
                "Action": "sts:AssumeRole",
                "Condition": {
                    "StringEquals": {"aws:SourceAccount": account},
                    "ArnLike": {"aws:SourceArn": f"arn:{partition}:bedrock-agentcore:{region}:{account}:*"},
                },
            }
        ],
    }


def execution_policy(
    agent: AgentSpec,
    account: str,
    region: str,
    environment: str,
    image_uri: str,
    gateway_secret_arn: str | None,
) -> dict[str, Any]:
    partition = partition_for_region(region)
    repository = image_uri.split("/", 1)[1].split(":", 1)[0].split("@", 1)[0]
    runtime_name_value = runtime_name(agent, environment)
    statements: list[dict[str, Any]] = [
        {
            "Sid": "ReadRuntimeImage",
            "Effect": "Allow",
            "Action": ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"],
            "Resource": f"arn:{partition}:ecr:{region}:{account}:repository/{repository}",
        },
        {"Sid": "AuthenticateToEcr", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*"},
        {
            "Sid": "InvokeConfiguredModel",
            "Effect": "Allow",
            "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
            "Resource": [
                f"arn:{partition}:bedrock:*::foundation-model/{FOUNDATION_MODEL_ID}",
                f"arn:{partition}:bedrock:*:{account}:inference-profile/{MODEL_ID}",
            ],
        },
        {
            "Sid": "CreateRuntimeLogGroups",
            "Effect": "Allow",
            "Action": ["logs:CreateLogGroup", "logs:PutResourcePolicy"],
            "Resource": f"arn:{partition}:logs:{region}:{account}:log-group:/aws/bedrock-agentcore/runtimes/{runtime_name_value}-*",
        },
        {
            "Sid": "DescribeRuntimeLogGroups",
            "Effect": "Allow",
            "Action": "logs:DescribeLogGroups",
            "Resource": f"arn:{partition}:logs:{region}:{account}:log-group:*",
        },
        {
            "Sid": "DescribeRuntimeLogStreams",
            "Effect": "Allow",
            "Action": "logs:DescribeLogStreams",
            "Resource": f"arn:{partition}:logs:{region}:{account}:log-group:/aws/bedrock-agentcore/runtimes/{runtime_name_value}-*",
        },
        {
            "Sid": "WriteRuntimeLogStreams",
            "Effect": "Allow",
            "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
            "Resource": f"arn:{partition}:logs:{region}:{account}:log-group:/aws/bedrock-agentcore/runtimes/{runtime_name_value}-*:log-stream:*",
        },
        {
            "Sid": "WriteRuntimeTraces",
            "Effect": "Allow",
            "Action": ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets"],
            "Resource": "*",
        },
        {
            "Sid": "WriteRuntimeMetrics",
            "Effect": "Allow",
            "Action": "cloudwatch:PutMetricData",
            "Resource": "*",
            "Condition": {"StringEquals": {"cloudwatch:namespace": "bedrock-agentcore"}},
        },
    ]

    read_resources = [
        f"arn:{partition}:dynamodb:{region}:{account}:table/{table_name(logical, environment)}"
        for logical in sorted(set(agent.table_env.values()))
    ]
    if read_resources:
        statements.append({"Sid": "ReadFsmTables", "Effect": "Allow", "Action": DDB_READ_ACTIONS, "Resource": read_resources})
    if agent.write_tables:
        write_resources = [
            f"arn:{partition}:dynamodb:{region}:{account}:table/{table_name(logical, environment)}"
            for logical in agent.write_tables
        ]
        statements.append({"Sid": "UpdateFsmTables", "Effect": "Allow", "Action": "dynamodb:UpdateItem", "Resource": write_resources})
    if agent.uses_gateway and gateway_secret_arn:
        statements.append(
            {"Sid": "ReadGatewayCredentials", "Effect": "Allow", "Action": "secretsmanager:GetSecretValue", "Resource": gateway_secret_arn}
        )
    return {"Version": "2012-10-17", "Statement": statements}


def ensure_role(iam: Any, agent: AgentSpec, args: argparse.Namespace, image_uri: str) -> str:
    name = role_name(agent, args.environment)
    partition = partition_for_region(args.region)
    trust = assume_role_policy(args.expected_account, args.region, partition)
    try:
        response = iam.get_role(RoleName=name)
        iam.update_assume_role_policy(RoleName=name, PolicyDocument=json.dumps(trust))
        created = False
    except iam.exceptions.NoSuchEntityException:
        response = iam.create_role(
            RoleName=name,
            Description=f"Execution role for {agent.name} ({args.environment})",
            AssumeRolePolicyDocument=json.dumps(trust),
            Tags=[
                {"Key": "Application", "Value": "FSM"},
                {"Key": "Environment", "Value": args.environment},
                {"Key": "ManagedBy", "Value": "deploy-agentcore-agents.py"},
            ],
        )
        created = True
    policy = execution_policy(
        agent,
        args.expected_account,
        args.region,
        args.environment,
        image_uri,
        args.gateway_secret_arn,
    )
    iam.put_role_policy(RoleName=name, PolicyName="FSMRuntimeAccess", PolicyDocument=json.dumps(policy))
    if created:
        iam.get_waiter("role_exists").wait(RoleName=name)
        time.sleep(5)
    return response["Role"]["Arn"]


def runtime_environment(agent: AgentSpec, args: argparse.Namespace) -> dict[str, str]:
    environment = {
        variable: table_name(logical, args.environment)
        for variable, logical in agent.table_env.items()
    }
    if agent.name == "fsm_parts_inventory_agent":
        environment["LOW_STOCK_THRESHOLD"] = "10"
    if agent.uses_gateway and args.gateway_secret_arn:
        environment["GATEWAY_URL"] = args.gateway_url
        environment["GATEWAY_CREDENTIALS_SECRET_ARN"] = args.gateway_secret_arn
    return environment


def list_runtimes(client: Any) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    token: str | None = None
    while True:
        kwargs = {"maxResults": 100}
        if token:
            kwargs["nextToken"] = token
        response = client.list_agent_runtimes(**kwargs)
        results.extend(response.get("agentRuntimes", []))
        token = response.get("nextToken")
        if not token:
            return results


def find_runtime(client: Any, name: str) -> dict[str, Any] | None:
    matches = [runtime for runtime in list_runtimes(client) if runtime.get("agentRuntimeName") == name]
    if len(matches) > 1:
        raise RuntimeError(f"Found multiple runtimes named {name}; refusing an ambiguous update")
    return matches[0] if matches else None


def call_agentcore_with_role_retry(operation: Any, operation_name: str, **kwargs: Any) -> dict[str, Any]:
    """Retry only the transient IAM propagation error returned by AgentCore."""
    max_attempts = 6
    for attempt in range(1, max_attempts + 1):
        try:
            return operation(**kwargs)
        except ClientError as exc:
            error = exc.response.get("Error", {})
            code = error.get("Code")
            message = error.get("Message", "")
            is_role_propagation_error = code == "ValidationException" and "Role validation failed" in message
            if not is_role_propagation_error or attempt == max_attempts:
                raise
            delay = min(5 * (2 ** (attempt - 1)), 30)
            print(
                f">> {operation_name} is waiting for IAM role propagation; "
                f"retrying in {delay}s ({attempt}/{max_attempts})"
            )
            time.sleep(delay)
    raise AssertionError("unreachable")


def deploy_runtime(
    client: Any,
    agent: AgentSpec,
    runtime_name_value: str,
    image_uri: str,
    role_arn: str,
    environment: dict[str, str],
) -> dict[str, Any]:
    artifact = {"containerConfiguration": {"containerUri": image_uri}}
    existing = find_runtime(client, runtime_name_value)
    common = {
        "agentRuntimeArtifact": artifact,
        "roleArn": role_arn,
        "networkConfiguration": {"networkMode": "PUBLIC"},
        "environmentVariables": environment,
        "description": f"FSM {agent.key} runtime",
    }
    if existing:
        status = existing.get("status")
        if status == "DELETING":
            raise RuntimeError(f"Runtime {runtime_name_value} is deleting; wait for deletion before redeploying")
        print(f">> Updating {runtime_name_value} ({existing['agentRuntimeId']})")
        return call_agentcore_with_role_retry(
            client.update_agent_runtime,
            "UpdateAgentRuntime",
            agentRuntimeId=existing["agentRuntimeId"],
            **common,
        )
    print(f">> Creating {runtime_name_value}")
    return call_agentcore_with_role_retry(
        client.create_agent_runtime,
        "CreateAgentRuntime",
        agentRuntimeName=runtime_name_value,
        **common,
    )


def wait_for_runtime(client: Any, runtime_id: str, timeout: int, poll_interval: float) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    while True:
        response = client.get_agent_runtime(agentRuntimeId=runtime_id)
        status = response.get("status")
        print(f"   {response.get('agentRuntimeName', runtime_id)}: {status}")
        if status in TERMINAL_STATUSES:
            if status != "READY":
                raise RuntimeError(f"Runtime {runtime_id} failed with {status}: {response.get('failureReason', 'no reason provided')}")
            return response
        if time.monotonic() >= deadline:
            raise TimeoutError(f"Timed out waiting for runtime {runtime_id}; last status={status}")
        time.sleep(poll_interval)


def serializable_runtime(
    agent: AgentSpec,
    runtime_name_value: str,
    details: dict[str, Any],
    image_uri: str,
    role_arn: str,
    environment: dict[str, str],
) -> dict[str, Any]:
    return {
        "key": agent.key,
        "agentRuntimeName": runtime_name_value,
        "agentRuntimeId": details["agentRuntimeId"],
        "agentRuntimeArn": details["agentRuntimeArn"],
        "agentRuntimeVersion": str(details["agentRuntimeVersion"]),
        "status": details["status"],
        "imageUri": image_uri,
        "roleArn": role_arn,
        "environmentVariables": environment,
    }


def run(args: argparse.Namespace, session: boto3.Session | None = None) -> dict[str, Any]:
    validate_inputs(args)
    image_map = load_image_map(Path(args.image_map), args.expected_account, args.region)
    session = session or aws_session(args.profile, args.region)
    verify_account(session.client("sts"), args.expected_account)
    iam = session.client("iam")
    agentcore = session.client("bedrock-agentcore-control")

    pending: list[tuple[AgentSpec, str, str, str, dict[str, str], str]] = []
    for agent in AGENTS:
        image_uri = image_map[agent.name]
        runtime_name_value = runtime_name(agent, args.environment)
        role_arn = ensure_role(iam, agent, args, image_uri)
        environment = runtime_environment(agent, args)
        response = deploy_runtime(agentcore, agent, runtime_name_value, image_uri, role_arn, environment)
        pending.append((agent, runtime_name_value, response["agentRuntimeId"], image_uri, environment, role_arn))

    runtimes: dict[str, Any] = {}
    arn_map: dict[str, str] = {}
    for agent, runtime_name_value, runtime_id, image_uri, environment, role_arn in pending:
        details = wait_for_runtime(agentcore, runtime_id, args.timeout, args.poll_interval)
        record = serializable_runtime(agent, runtime_name_value, details, image_uri, role_arn, environment)
        runtimes[agent.name] = record
        arn_map[agent.key] = record["agentRuntimeArn"]

    result = {
        "schemaVersion": 1,
        "accountId": args.expected_account,
        "region": args.region,
        "environment": args.environment,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runtimes": runtimes,
        "agentRuntimeArns": arn_map,
    }
    atomic_write_json(Path(args.output), result)
    atomic_write_json(Path(args.arn_map), arn_map)
    print(f">> Deployment results: {args.output}")
    print(f">> Runtime ARN map: {args.arn_map}")
    return result


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        run(args)
        return 0
    except (ValueError, RuntimeError, TimeoutError, ClientError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
