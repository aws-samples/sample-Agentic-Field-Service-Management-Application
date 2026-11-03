#!/usr/bin/env python3
"""Delete the FSM AgentCore resources that deploy-stack.sh creates outside CloudFormation.

For one environment this removes:
  - the eight AgentCore runtimes   <agent>_<environment>
  - the eight runtime IAM roles    FSM-AgentCore-<environment>-<agent>
  - the eight ECR repositories     bedrock-agentcore-<agent> (shared by all environments)

Only these exact names are touched, so other environments and unrelated AgentCore
resources in the account are left alone. The ECR repositories are skipped while
runtimes from another FSM environment still exist, or when --keep-images is set.
"""
from __future__ import annotations

import argparse
import importlib.util
import sys
import time
from pathlib import Path
from typing import Any

from botocore.exceptions import ClientError

ENVIRONMENTS = ("dev", "test", "prod")
ECR_REPOSITORY_PREFIX = "bedrock-agentcore-"

# Reuse the deployer's agent list and naming so cleanup always matches deployment.
_DEPLOYER_PATH = Path(__file__).resolve().parent / "deploy-agentcore-agents.py"
_SPEC = importlib.util.spec_from_file_location("deploy_agentcore_agents", _DEPLOYER_PATH)
deployer = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader
sys.modules[_SPEC.name] = deployer
_SPEC.loader.exec_module(deployer)


def confirmation_token(environment: str) -> str:
    return f"DELETE-FSM-{environment.upper()}"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--expected-account", required=True, help="12-digit AWS account safety guard")
    parser.add_argument("--region", required=True)
    parser.add_argument("--environment", required=True, choices=ENVIRONMENTS)
    parser.add_argument("--profile")
    parser.add_argument("--dry-run", action="store_true", help="List what would be deleted without deleting anything")
    parser.add_argument("--keep-images", action="store_true", help="Keep the ECR repositories")
    parser.add_argument("--confirm", help="Required unless --dry-run; must be DELETE-FSM-<ENVIRONMENT>")
    parser.add_argument("--timeout", type=int, default=600, help="Seconds to wait for runtime deletion")
    parser.add_argument("--poll-interval", type=float, default=10.0)
    args = parser.parse_args(argv)
    expected = confirmation_token(args.environment)
    if not args.dry_run and args.confirm != expected:
        parser.error(f"deleting the {args.environment} environment requires --confirm {expected}")
    if args.timeout <= 0 or args.poll_interval <= 0:
        parser.error("--timeout and --poll-interval must be positive")
    return args


def error_code(exc: ClientError) -> str:
    return exc.response.get("Error", {}).get("Code", "")


def runtime_names(environment: str) -> list[str]:
    return [deployer.runtime_name(agent, environment) for agent in deployer.AGENTS]


def role_names(environment: str) -> list[str]:
    return [deployer.role_name(agent, environment) for agent in deployer.AGENTS]


def repository_names() -> list[str]:
    return [f"{ECR_REPOSITORY_PREFIX}{agent.name}" for agent in deployer.AGENTS]


def find_runtimes(client: Any, names: list[str]) -> list[dict[str, Any]]:
    wanted = set(names)
    return [rt for rt in deployer.list_runtimes(client) if rt.get("agentRuntimeName") in wanted]


def delete_runtimes(client: Any, environment: str, dry_run: bool, failures: list[str]) -> list[str]:
    """Start deletion of this environment's runtimes and return the IDs being deleted."""
    print(f"\n>> AgentCore runtimes ({environment})")
    runtimes = find_runtimes(client, runtime_names(environment))
    if not runtimes:
        print("   none found")
        return []
    deleting: list[str] = []
    for runtime in runtimes:
        name, runtime_id, status = runtime["agentRuntimeName"], runtime["agentRuntimeId"], runtime.get("status")
        if dry_run:
            print(f"   would delete {name} ({runtime_id}, {status})")
            continue
        if status == "DELETING":
            print(f"   {name} is already deleting")
            deleting.append(runtime_id)
            continue
        try:
            client.delete_agent_runtime(agentRuntimeId=runtime_id)
            print(f"   deleting {name} ({runtime_id})")
            deleting.append(runtime_id)
        except ClientError as exc:
            if error_code(exc) == "ResourceNotFoundException":
                print(f"   {name} already deleted")
            else:
                failures.append(f"runtime {name}: {exc}")
                print(f"   FAILED to delete {name}: {exc}")
    return deleting


def wait_for_runtime_deletion(client: Any, runtime_ids: list[str], timeout: int, poll_interval: float, failures: list[str]) -> bool:
    """Return True once every runtime is gone."""
    pending = set(runtime_ids)
    deadline = time.monotonic() + timeout
    while pending and time.monotonic() < deadline:
        for runtime_id in sorted(pending):
            try:
                client.get_agent_runtime(agentRuntimeId=runtime_id)
            except ClientError as exc:
                if error_code(exc) == "ResourceNotFoundException":
                    pending.discard(runtime_id)
                else:
                    raise
        if pending:
            time.sleep(poll_interval)
    if pending:
        failures.append(f"runtimes still deleting after {timeout}s: {', '.join(sorted(pending))}")
        print(f"   still deleting after {timeout}s: {', '.join(sorted(pending))}")
        return False
    print("   all runtimes deleted")
    return True


def delete_roles(iam: Any, environment: str, dry_run: bool, failures: list[str]) -> None:
    print(f"\n>> IAM runtime roles ({environment})")
    found = False
    for name in role_names(environment):
        try:
            iam.get_role(RoleName=name)
        except ClientError as exc:
            if error_code(exc) == "NoSuchEntity":
                continue
            failures.append(f"role {name}: {exc}")
            print(f"   FAILED to read {name}: {exc}")
            continue
        found = True
        if dry_run:
            print(f"   would delete {name}")
            continue
        try:
            for page in iam.get_paginator("list_role_policies").paginate(RoleName=name):
                for policy_name in page["PolicyNames"]:
                    iam.delete_role_policy(RoleName=name, PolicyName=policy_name)
            for page in iam.get_paginator("list_attached_role_policies").paginate(RoleName=name):
                for policy in page["AttachedPolicies"]:
                    iam.detach_role_policy(RoleName=name, PolicyArn=policy["PolicyArn"])
            iam.delete_role(RoleName=name)
            print(f"   deleted {name}")
        except ClientError as exc:
            failures.append(f"role {name}: {exc}")
            print(f"   FAILED to delete {name}: {exc}")
    if not found:
        print("   none found")


def other_environment_runtimes(client: Any, environment: str) -> list[str]:
    names = [name for env in ENVIRONMENTS if env != environment for name in runtime_names(env)]
    return sorted(rt["agentRuntimeName"] for rt in find_runtimes(client, names))


def delete_repositories(ecr: Any, account: str, dry_run: bool, failures: list[str]) -> None:
    print("\n>> ECR repositories")
    found = False
    for name in repository_names():
        if dry_run:
            try:
                ecr.describe_repositories(registryId=account, repositoryNames=[name])
            except ClientError as exc:
                if error_code(exc) == "RepositoryNotFoundException":
                    continue
                raise
            found = True
            print(f"   would delete {name} and its images")
            continue
        try:
            ecr.delete_repository(registryId=account, repositoryName=name, force=True)
            found = True
            print(f"   deleted {name}")
        except ClientError as exc:
            if error_code(exc) == "RepositoryNotFoundException":
                continue
            failures.append(f"repository {name}: {exc}")
            print(f"   FAILED to delete {name}: {exc}")
    if not found:
        print("   none found")


def run(args: argparse.Namespace, session: Any = None) -> list[str]:
    deployer.validate_inputs(
        argparse.Namespace(
            expected_account=args.expected_account,
            region=args.region,
            poll_interval=args.poll_interval,
            timeout=args.timeout,
            gateway_url=None,
            gateway_secret_arn=None,
        )
    )
    session = session or deployer.aws_session(args.profile, args.region)
    deployer.verify_account(session.client("sts"), args.expected_account)
    agentcore = session.client("bedrock-agentcore-control")
    failures: list[str] = []
    mode = "DRY RUN: nothing will be deleted" if args.dry_run else "deleting"
    print(f">> FSM AgentCore cleanup for {args.environment} in {args.region} ({mode})")

    deleting = delete_runtimes(agentcore, args.environment, args.dry_run, failures)
    if deleting and not wait_for_runtime_deletion(agentcore, deleting, args.timeout, args.poll_interval, failures):
        print("\n>> Roles and ECR repositories kept until the runtimes are gone; rerun this script later")
        return failures

    delete_roles(session.client("iam"), args.environment, args.dry_run, failures)

    if args.keep_images:
        print("\n>> ECR repositories kept (--keep-images)")
    else:
        others = other_environment_runtimes(agentcore, args.environment)
        if others:
            print("\n>> ECR repositories kept: other FSM environments still use them:")
            for name in others:
                print(f"   {name}")
        else:
            delete_repositories(session.client("ecr"), args.expected_account, args.dry_run, failures)
    return failures


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    failures = run(args)
    if failures:
        print(f"\nCleanup finished with {len(failures)} failure(s):", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1
    print("\nCleanup finished." if not args.dry_run else "\nDry run finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
