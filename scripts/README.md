# FSM Scripts

This directory contains utility scripts for the Field Service Management application.

## Update Jobs with Customer IDs

This script adds a `customerId` field to all records in the FSM-Jobs DynamoDB table by matching the customer name with records in the FSM-Customers table.

### Prerequisites

- Node.js (v14 or later)
- AWS CLI configured with appropriate permissions
- AWS credentials with access to DynamoDB

### Installation

```bash
npm install
```

### Usage

```bash
npm run update-jobs
```

or

```bash
node update-jobs-with-customer-ids.js
```

### What the Script Does

1. Fetches all customers from the FSM-Customers table
2. Fetches all jobs from the FSM-Jobs table
3. Creates a mapping of customer names to customer IDs
4. Updates each job with the corresponding customer ID based on the customer name
5. Logs the results to the console

### Expected Output

```
Fetching customers and jobs...
Found 7 customers and 6 jobs
Customer map: { 'TechSolutions Inc': 'cust-002', 'Tech Park Office': 'cust-006', ... }
Updating job job-001 for customer "Acme Corporation" with ID cust-001
Updating job job-004 for customer "City Hospital" with ID cust-004
...
All jobs updated successfully!
```

## AgentCore Container Images

The AgentCore agents can be built with either Docker or Finch. Both engines use the root `Dockerfile`, produce `linux/arm64` images by default, and use one ECR repository per agent.

### Configure

Run the interactive setup:

```bash
./scripts/setup-agent-images.sh
```

This creates the ignored `scripts/.agent-images.env` file with:

- `CONTAINER_ENGINE`: `docker` or `finch`
- `AWS_PROFILE`: optional AWS CLI profile; an empty value uses the default credential chain
- `AWS_REGION`: ECR and AgentCore region
- `AWS_ACCOUNT_ID`: expected account ID used as a push safety guard
- `IMAGE_PLATFORM`: defaults to `linux/arm64`
- `ECR_REPOSITORY_PREFIX`: defaults to `bedrock-agentcore-`
- optional registry and tag settings

No credentials are written to the file. To automate setup, use `--non-interactive` with the corresponding options; see `./scripts/setup-agent-images.sh --help`. A documented template is available at `scripts/agent-images.env.example`.

### Build and validate

```bash
# Show the commands without executing them
./scripts/rebuild-agent-images.sh --dry-run

# Build one image locally; do not call AWS or push to ECR
./scripts/rebuild-agent-images.sh \
  --agent fsm_orchestrator_agent \
  --no-push

# Build and push all configured agent images
./scripts/rebuild-agent-images.sh
```

Docker requires a running Docker daemon and Buildx. Finch requires an initialized, running VM:

```bash
finch vm init
finch vm start
```

The push workflow requires an explicit account guard, resolves the active account with STS, and refuses to continue when the credentials or ECR registry differ from the configured account and region. It creates missing per-agent ECR repositories with immutable tags and scan-on-push enabled, authenticates the selected engine, builds every image from the shared root `Dockerfile`, pushes the images, and atomically writes `scripts/.rebuild-results.json`. Local-only builds write `scripts/.rebuild-results.local.json` instead.

The standalone image script does not update AgentCore runtimes. The supported full `deploy-stack.sh` workflow consumes its image map and then runs the isolated AgentCore deployer, which creates or updates an environment-scoped runtime name for each agent (for example, `_prod`, `_test`, or `_dev`).

### Pipeline self-test

The self-test stubs AWS, Docker, and Finch so it validates both command paths without network calls or registry changes:

```bash
./scripts/tests/test-agent-image-pipeline.sh
```

## Full Deployment Entry Point

Use `./deploy-stack.sh --help` from the repository root. The script requires named `--region`, `--environment`, `--expected-account`, `--admin-email`, and `--engine docker|finch` options. Add `--preflight-only` for read-only validation. Production requires the exact `--confirm DEPLOY-FSM-PROD` value.

The optional `--gateway-url` and `--gateway-secret-arn` options must be supplied together. The URL must be an HTTPS MCP endpoint, and the Secrets Manager value must be JSON containing `client_id`, `client_secret`, and `token_url`. Do not store these values in repository JSON files.

A successful full deployment writes:

- `scripts/.rebuild-results.json`
- `scripts/.agentcore-deployment-results.json`
- `scripts/.agent-runtime-arns.json`

These generated files are deployment outputs, not source configuration.

## Local Safety Tests

Run from the repository root:

```bash
bash scripts/tests/test-deploy-stack.sh
bash scripts/tests/test-agent-image-pipeline.sh
bash scripts/tests/test-package-lambda-functions.sh
python3 -m unittest scripts/tests/test_deploy_agentcore_agents.py
node scripts/tests/test-agents-api-config.js
```

The shell tests use temporary fake AWS and container commands. They do not create registry, runtime, or stack resources.