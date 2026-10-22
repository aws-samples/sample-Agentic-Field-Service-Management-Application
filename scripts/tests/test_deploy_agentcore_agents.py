#!/usr/bin/env python3
"""Unit tests for the local AgentCore deployment contract."""

import argparse
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

SCRIPT = Path(__file__).resolve().parents[1] / "deploy-agentcore-agents.py"
SPEC = importlib.util.spec_from_file_location("deploy_agentcore_agents", SCRIPT)
deployer = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = deployer
SPEC.loader.exec_module(deployer)


class AgentCoreDeployerTests(unittest.TestCase):
    def image_map(self, account="123456789012", region="us-east-1"):
        return {
            agent.name: f"{account}.dkr.ecr.{region}.amazonaws.com/bedrock-agentcore-{agent.name}:test"
            for agent in deployer.AGENTS
        }

    def test_load_image_map_requires_exact_agents_and_registry(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "images.json"
            path.write_text(json.dumps(self.image_map()), encoding="utf-8")
            loaded = deployer.load_image_map(path, "123456789012", "us-east-1")
            self.assertEqual(set(loaded), set(deployer.AGENT_BY_NAME))
            invalid = self.image_map()
            invalid["fsm_orchestrator_agent"] = "999999999999.dkr.ecr.us-east-1.amazonaws.com/repo:tag"
            path.write_text(json.dumps(invalid), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must use"):
                deployer.load_image_map(path, "123456789012", "us-east-1")

    def test_deploy_runtime_creates_when_name_is_absent(self):
        client = Mock()
        client.list_agent_runtimes.return_value = {"agentRuntimes": []}
        client.create_agent_runtime.return_value = {"agentRuntimeId": "created"}
        agent = deployer.AGENTS[0]
        response = deployer.deploy_runtime(client, agent, deployer.runtime_name(agent, "prod"), self.image_map()[agent.name], "role", {})
        self.assertEqual(response["agentRuntimeId"], "created")
        client.create_agent_runtime.assert_called_once()
        client.update_agent_runtime.assert_not_called()

    def test_deploy_runtime_updates_exact_existing_name(self):
        client = Mock()
        client.list_agent_runtimes.return_value = {
            "agentRuntimes": [{"agentRuntimeName": deployer.runtime_name(deployer.AGENTS[0], "prod"), "agentRuntimeId": "existing", "status": "READY"}]
        }
        client.update_agent_runtime.return_value = {"agentRuntimeId": "existing"}
        agent = deployer.AGENTS[0]
        response = deployer.deploy_runtime(client, agent, deployer.runtime_name(agent, "prod"), self.image_map()[agent.name], "role", {})
        self.assertEqual(response["agentRuntimeId"], "existing")
        client.update_agent_runtime.assert_called_once()
        client.create_agent_runtime.assert_not_called()

    def test_wait_for_runtime_propagates_failure_reason(self):
        client = Mock()
        client.get_agent_runtime.return_value = {
            "agentRuntimeId": "failed", "agentRuntimeName": "fsm_test", "status": "UPDATE_FAILED", "failureReason": "bad image"
        }
        with self.assertRaisesRegex(RuntimeError, "bad image"):
            deployer.wait_for_runtime(client, "failed", timeout=1, poll_interval=0.01)

    def test_atomic_write_replaces_complete_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            path.write_text("old", encoding="utf-8")
            deployer.atomic_write_json(path, {"ok": True})
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), {"ok": True})
            self.assertEqual(list(path.parent.glob("*.tmp")), [])

    def test_runtime_log_policy_is_scoped_to_the_agent(self):
        agent = deployer.AGENTS[0]
        policy = deployer.execution_policy(
            agent,
            "123456789012",
            "us-east-1",
            "prod",
            self.image_map()[agent.name],
            None,
        )
        statements = {statement["Sid"]: statement for statement in policy["Statement"] if "Sid" in statement}
        expected_runtime_prefix = deployer.runtime_name(agent, "prod")
        self.assertIn(f"/runtimes/{expected_runtime_prefix}-*", statements["CreateRuntimeLogGroups"]["Resource"])
        self.assertIn(f"/runtimes/{expected_runtime_prefix}-*", statements["DescribeRuntimeLogStreams"]["Resource"])
        self.assertNotIn("log-stream", statements["DescribeRuntimeLogStreams"]["Resource"])
        self.assertEqual(statements["DescribeRuntimeLogStreams"]["Action"], "logs:DescribeLogStreams")
        self.assertIn(f"/runtimes/{expected_runtime_prefix}-*:log-stream:*", statements["WriteRuntimeLogStreams"]["Resource"])
        self.assertNotIn("logs:DescribeLogStreams", statements["WriteRuntimeLogStreams"]["Action"])
        self.assertEqual(
            statements["WriteRuntimeMetrics"]["Condition"]["StringEquals"]["cloudwatch:namespace"],
            "bedrock-agentcore",
        )

    def test_runtime_environment_only_enables_gateway_with_secret(self):
        base = argparse.Namespace(environment="prod", gateway_secret_arn=None, gateway_url=None)
        communication = next(agent for agent in deployer.AGENTS if agent.key == "communication")
        self.assertEqual(deployer.runtime_environment(communication, base), {})
        base.gateway_secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"
        base.gateway_url = "https://example.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp"
        environment = deployer.runtime_environment(communication, base)
        self.assertEqual(environment["GATEWAY_CREDENTIALS_SECRET_ARN"], base.gateway_secret_arn)
    def test_runtime_names_are_environment_scoped(self):
        agent = deployer.AGENTS[0]
        self.assertEqual(deployer.runtime_name(agent, "prod"), "fsm_orchestrator_agent_prod")
        self.assertEqual(deployer.runtime_name(agent, "dev"), "fsm_orchestrator_agent_dev")
        self.assertNotEqual(deployer.runtime_name(agent, "prod"), deployer.runtime_name(agent, "dev"))

    def test_prod_requires_exact_confirmation(self):
        base = [
            "--expected-account", "123456789012",
            "--region", "us-east-1",
            "--environment", "prod",
        ]
        with self.assertRaises(SystemExit):
            deployer.parse_args(base)
        args = deployer.parse_args(base + ["--confirm", "DEPLOY-FSM-PROD"])
        self.assertEqual(args.confirm, "DEPLOY-FSM-PROD")


if __name__ == "__main__":
    unittest.main()
