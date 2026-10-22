# Customer Communication Agent

## Overview

The Customer Communication Agent can gather customer, HVAC, and maintenance data and format status, alert, or maintenance-reminder messages. Delivery through Amazon SNS is optional and requires a pre-created Amazon Bedrock AgentCore Gateway exposing the expected MCP tools.

Gateway OAuth credentials must never be stored in this repository. Historical Gateway client secrets and access tokens associated with earlier local configuration must be considered compromised, rotated, and moved to AWS Secrets Manager before Gateway integration is enabled.

## Runtime behavior

Without Gateway configuration, the agent starts normally and uses its built-in demonstration data for customer, metric, and maintenance lookups. It does **not** deliver an email and reports that Gateway SNS integration is unavailable. A simulated response must not be interpreted as delivery evidence.

When Gateway configuration is enabled, the agent discovers paginated MCP tools and expects these tool names:

- `CustomerTarget___get_customer_tool`
- `MetricsTarget___get_metrics_tool`
- `JobsTarget___get_jobs_tool`
- `SNSTarget___Publish`

Actual delivery requires a working `SNSTarget___Publish` target and all downstream SNS subscription or destination configuration. Validate delivery independently in SNS and CloudWatch; an agent response alone is not sufficient evidence.

## Secure Gateway contract

The supported deployment path accepts only these paired options:

```bash
--gateway-url https://GATEWAY_ID.gateway.bedrock-agentcore.REGION.amazonaws.com/mcp \
--gateway-secret-arn arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:SECRET_NAME
```

`deploy-stack.sh` validates that the URL is HTTPS and ends in `/mcp`, and that the secret ARN belongs to the expected account and region. It passes these runtime environment values only to agents that use Gateway tools:

- `GATEWAY_URL`
- `GATEWAY_CREDENTIALS_SECRET_ARN`

The Secrets Manager value must be a JSON object:

```json
{
  "client_id": "REDACTED",
  "client_secret": "REDACTED",
  "token_url": "https://YOUR_COGNITO_DOMAIN/oauth2/token"
}
```

At startup, `agents/gateway_client.py` retrieves the secret, requests a client-credentials token with a 15-second timeout, and uses that token only in the MCP Authorization header. Runtime IAM grants only `secretsmanager:GetSecretValue` for the supplied ARN.

Do not put a client secret, token, Gateway credential, or live resource identifier in either `agentcore_gateway_config.json` file, source code, documentation, image build arguments, command output, or plain environment values.

## Deployment

Run a read-only preflight first:

```bash
./deploy-stack.sh \
  --region us-east-1 \
  --environment prod \
  --expected-account 123456789012 \
  --admin-email administrator@your-company.example \
  --engine docker \
  --gateway-url https://GATEWAY_ID.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp \
  --gateway-secret-arn arn:aws:secretsmanager:us-east-1:123456789012:secret:SECRET_NAME \
  --confirm DEPLOY-FSM-PROD \
  --preflight-only
```

After verifying the identity and target, rerun without `--preflight-only`. Omitting both Gateway options deploys all agents with Gateway integration disabled.

The legacy `scripts/create-agentcore-gateway.py`, `deploy-single-agent.py`, and `test-gateway-connection.py` flows were removed: they attached `*FullAccess` policies, wrote gateway secrets to plaintext files, and hardcoded live endpoints. Gateway credentials must be stored in Secrets Manager and supplied to `deploy-stack.sh` via `--gateway-url` / `--gateway-secret-arn`.

## Local validation

The currently validated checks are:

```bash
bash scripts/tests/test-deploy-stack.sh
bash scripts/tests/test-agent-image-pipeline.sh
python3 -m unittest scripts/tests/test_deploy_agentcore_agents.py
```

For container validation, build the communication agent with `scripts/rebuild-agent-images.sh --no-push`, start it on a free loopback port, and verify `GET /ping`. This proves that the runtime starts; it does not prove Gateway authentication or SNS delivery.

## Notification types

`send_comprehensive_notification` supports:

- `status_update`
- `alert`
- `maintenance_reminder`

Templates are defined in `agents/email_templates.py`. Production notification tests must use approved test recipients and verify delivery through the configured SNS path.