# Field Service Management Application

A comprehensive Field Service Management application for HVAC maintenance companies, built with React and AWS Cloudscape Design System. The application uses AWS services including DynamoDB, Lambda, API Gateway, and WebSockets for real-time updates.

> **Disclaimer:** This is sample code, for non-production usage. You should work with your security and legal teams to meet your organizational security, regulatory and compliance requirements before deployment.

## Quick Start

### 1. Clone the Repository

```bash
git clone git@ssh.gitlab.aws.dev:aws-fsm-genai/FSM.git
cd FSM
```

### 2. Validate the Deployment Inputs

Run the read-only preflight first. Substitute your exact AWS account ID and administrator email; placeholder emails are rejected.

```bash
./deploy-stack.sh \
  --region us-east-1 \
  --environment prod \
  --expected-account 123456789012 \
  --admin-email administrator@your-company.example \
  --engine docker \
  --confirm DEPLOY-FSM-PROD \
  --preflight-only
```

The preflight validates local tools, container-engine availability, templates, and the active AWS identity. It performs no AWS writes. Use `--engine finch` to validate Finch instead of Docker.

### 3. Deploy the Application

After reviewing the preflight identity and target, rerun the same command without `--preflight-only`. Production deployments require the exact, case-sensitive confirmation `DEPLOY-FSM-PROD`.

The deployment builds and pushes all eight agent images, creates or updates their environment-scoped AgentCore runtimes (for example, `_prod`, `_test`, or `_dev`), uploads versioned nested templates and Lambda artifacts, deploys the CloudFormation stack, builds and uploads the React application without deleting unrelated S3 objects, invalidates CloudFront, and runs HTTP smoke checks. Cognito generates and emails the administrator's temporary credentials; the script never sets or prints a fixed password.

For non-production environments, use `--environment dev` or `--environment test`; the production confirmation is then optional. Run `./deploy-stack.sh --help` for all options.

## Features

- **Dashboard**: View all HVAC maintenance customers and their system statuses
- **Customer Details**: Monitor HVAC metrics in real-time with interactive charts
- **Scheduler**: Manage service jobs and technician assignments with an interactive map
- **Technician View**: Access job details, documentation, and complete jobs
- **Billing**: Track invoices and customer balances
- **Parts Inventory**: Manage and reorder parts for HVAC systems
- **Simulator**: Generate realistic HVAC metrics and simulate system failures
- **AI Agents**: Intelligent agents powered by Amazon Bedrock for automated workflows and decision support

## Functional Overview

The FSM application serves multiple user personas, each with specific needs and capabilities:

### User Personas and Capabilities

#### 1. Operations Manager
**Primary Pages**: Dashboard, Customer Overview, AI Agents Dashboard
**Capabilities**:
- View overall system health across all customers
- Monitor KPIs including active jobs, pending maintenance, and system alerts
- Access high-level reports on technician efficiency and customer satisfaction
- Identify trends in system performance and maintenance needs
- Receive alerts for critical system failures requiring immediate attention
- Monitor AI agent workflows and status

#### 2. Job Scheduler
**Primary Pages**: Scheduler, Technician Management
**Capabilities**:
- View and manage all pending and scheduled jobs
- Assign technicians to jobs based on skills, location, and availability
- Optimize routes using the interactive map interface
- Reschedule jobs when necessary
- Set job priorities based on customer SLAs and system criticality
- Monitor technician locations and job progress in real-time

#### 3. Technician
**Primary Pages**: Technician View, Job Details
**Capabilities**:
- View assigned jobs and schedule for the day/week
- Access customer information and service history
- View detailed HVAC system specifications and documentation
- Record job notes, parts used, and time spent
- Complete jobs and capture customer sign-off
- Report issues requiring additional work or parts
- Access repair manuals and technical documentation

#### 4. Supply Chain Manager
**Primary Pages**: Parts Inventory, Parts Reordering
**Capabilities**:
- Monitor inventory levels across all parts categories
- View parts usage trends and forecasts
- Process reorder requests from technicians
- Manage supplier relationships and order tracking
- Set up automatic reordering based on minimum stock levels
- Generate reports on parts usage by customer, system type, or technician

#### 5. Finance Manager
**Primary Pages**: Billing, Invoices
**Capabilities**:
- View all completed jobs awaiting invoicing
- Generate and send invoices to customers
- Track payment status and overdue accounts
- Process payments and reconcile accounts
- Generate financial reports by customer, service type, or time period
- Analyze profitability by customer, technician, or service type

#### 6. Customer
**Primary Pages**: Customer Portal, System Status
**Capabilities**:
- View their HVAC system status and performance metrics
- Schedule maintenance or service requests
- View service history and upcoming scheduled maintenance
- Access invoices and payment history
- Receive alerts for system issues or maintenance requirements
- Download system documentation and user guides

### AI Agents Module

The application includes an intelligent AI agents system built with Amazon Bedrock AgentCore Runtime and Strands SDK:

- **Orchestrator Agent**: Coordinates workflow between all other agents and manages complex multi-agent processes
- **HVAC Monitoring Agent**: Monitors HVAC systems, detects anomalies, and predicts potential failures
- **Parts Inventory Agent**: Manages inventory levels, predicts future needs, and automates reordering
- **Technician Scheduling Agent**: Optimizes technician assignments based on skills, location, and availability
- **Customer Communication Agent**: Handles automated notifications and communications with customers
- **Customer Authentication Agent**: Intended to verify customer identity and manage access control. Its tools `verify_customer_stub` and `check_service_contract_stub` are currently STUBS that accept every input and check nothing (threat T10); replace them with real lookups before any production use.
- **Billing & Invoicing Agent**: Generates invoices, calculates costs, and processes payments
- **Technical Documentation Agent**: Creates and retrieves technical documentation and safety protocols

#### AgentCore Runtime Architecture

The agents are deployed using **Amazon Bedrock AgentCore Runtime** instead of traditional Lambda functions, providing:

- **Container-based Deployment**: Each agent runs in its own containerized environment with proper dependency management
- **Automatic Scaling**: AgentCore handles scaling based on demand without manual configuration
- **Integrated Monitoring**: Built-in CloudWatch logs and health monitoring for each agent
- **Simplified Dependencies**: No Lambda layer conflicts or pydantic version issues
- **Direct Invocation**: Agents can be invoked using boto3 `bedrock-agentcore` client

#### Agent Benefits

The AI agents provide several key benefits:
- **Automated Decision Making**: Reduces manual intervention for routine tasks
- **Predictive Maintenance**: Identifies potential issues before they cause system failures
- **Optimized Resource Allocation**: Ensures technicians and parts are available when and where needed
- **Enhanced Customer Experience**: Provides timely and relevant communications
- **Knowledge Management**: Generates and retrieves technical documentation on demand
- **Workflow Automation**: Coordinates complex processes across multiple departments

The agents are particularly valuable for:
- Handling emergency service calls with optimal resource allocation
- Automating routine maintenance scheduling and follow-up
- Providing technicians with relevant documentation and safety protocols
- Streamlining the billing process from job completion to invoice generation
- Monitoring system performance and alerting on potential issues

#### Agent Invocation

Agents can be invoked programmatically using the AWS SDK:

```python
import boto3
import json

client = boto3.client('bedrock-agentcore', region_name='us-east-1')

response = client.invoke_agent_runtime(
    agentRuntimeArn="arn:aws:bedrock-agentcore:us-east-1:ACCOUNT:runtime/fsm_orchestrator_agent-ID",
    qualifier="DEFAULT",
    payload=json.dumps({"prompt": "Analyze this service request..."})
)
```

### Simulator Module

The application includes a powerful simulator module that:

- **Generates Realistic HVAC Metrics**: Creates realistic temperature, pressure, humidity, and power consumption data
- **Simulates System Failures**: Can trigger various failure scenarios including compressor failures, refrigerant leaks, and electrical issues
- **Tests Alert Systems**: Validates that alert thresholds and notification systems work correctly
- **Supports Training**: Allows technicians to practice diagnosing and resolving issues in a simulated environment
- **Enables Demo Mode**: Provides a fully functional demonstration environment with simulated customers and systems
- **Configurable Parameters**: Allows adjustment of simulation speed, failure frequency, and environmental conditions
- **Historical Data Generation**: Can backfill historical data for trend analysis and reporting

The simulator is particularly useful for:
- Training new technicians without affecting real customer systems
- Testing new features and workflows in the application
- Demonstrating the application's capabilities to potential customers
- Stress-testing the system's ability to handle large volumes of data and alerts

## Architecture

### High-Level Design

The Field Service Management (FSM) application is a fully serverless solution on AWS, organized into four planes:

1. **Edge & Web Plane** — Amazon CloudFront fronts an S3 origin (with Origin Access Control) that hosts the React + Cloudscape SPA. CloudFront also routes API traffic so the SPA, the REST API, and the WebSocket API share a single origin from the browser's perspective.
2. **Identity Plane** — Amazon Cognito User Pools authenticate human users (operations managers, schedulers, technicians, finance, customers). The SPA sends the Cognito ID token on every REST call (`Authorization` header) and on the WebSocket connect (`?token=`); API Gateway verifies it (the WebSocket check runs in a dedicated authorizer Lambda) before the request reaches the application Lambdas.
3. **Application & Data Plane** — Amazon API Gateway (REST + WebSocket) terminates HTTPS, applies CORS, rejects requests without a valid Cognito ID token (Cognito User Pools authorizer on REST, Lambda authorizer on WebSocket `$connect`), and invokes AWS Lambda. Lambda functions read/write Amazon DynamoDB tables and publish WebSocket messages back to connected clients via DynamoDB Streams. AWS CloudFormation provisions the entire stack as nested templates.
4. **AI Plane (Amazon Bedrock AgentCore)** — Eight specialist agents run as containerized workloads on Amazon Bedrock AgentCore Runtime. Each agent is built on the Strands SDK with Claude Sonnet 4.6 as the underlying model, has its own ECR image and IAM execution role, and exposes domain-specific tools that read/write the same DynamoDB tables the API Lambdas use. The Orchestrator Agent fronts the interactive "Ask Assistant" chat and can call the other specialists or read DynamoDB directly. AgentCore handles autoscaling, isolation (one Firecracker microVM per session), and OpenTelemetry traces that surface in CloudWatch and back in the UI.

### Architecture Diagram

A full architecture diagram is available as a draw.io file at `docs/architecture.drawio` (open with [diagrams.net](https://app.diagrams.net/) or the VS Code "Draw.io Integration" extension). A simplified ASCII view:

```
                       ┌──────────────────────────┐
                       │        End User          │
                       │   (Browser / Mobile)     │
                       └────────────┬─────────────┘
                                    │ HTTPS
                       ┌────────────▼─────────────┐
                       │       CloudFront         │
                       │   (CDN, OAC, WAF-ready)  │
                       └─────┬───────────┬────────┘
                             │           │
              static assets  │           │ /api, /ws
                             │           │
                  ┌──────────▼─┐     ┌───▼─────────────────┐
                  │    S3      │     │    API Gateway      │
                  │  (SPA)     │     │  REST + WebSocket   │
                  └────────────┘     └───────┬─────────────┘
                                             │
                  ┌────────────┐    ┌────────▼─────────┐
                  │  Cognito   │◄──►│      Lambda      │
                  │ User Pools │    │  Data + Agents   │
                  └────────────┘    │   API Handlers   │
                                    └────────┬─────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                 ┌────────▼─────┐   ┌────────▼────────┐   ┌─────▼────────────┐
                 │   DynamoDB   │   │   CloudWatch    │   │  Bedrock         │
                 │   Tables     │   │  Logs + OTel    │   │  AgentCore       │
                 │              │   │     Traces      │   │  Runtime         │
                 │ Customers    │   │                 │   │                  │
                 │ Jobs         │   │                 │   │ Orchestrator     │
                 │ Technicians  │   │                 │   │ HVAC Monitor     │
                 │ Invoices     │   │                 │   │ Parts Inventory  │
                 │ Metrics      │   │                 │   │ Tech Scheduling  │
                 │ Parts        │   │                 │   │ Customer Comms   │
                 └──────┬───────┘   └─────────────────┘   │ Customer Auth    │
                        │ Streams                         │ Billing          │
                        └────────────► Lambda ─►          │ Tech Docs        │
                                       WebSocket          └────────┬─────────┘
                                       broadcast                   │
                                                                   │ tools
                                                          ┌────────▼─────────┐
                                                          │   DynamoDB       │
                                                          │  (same tables,   │
                                                          │   per-agent IAM) │
                                                          └──────────────────┘
```

### Request Flows

**Standard data read (e.g. customer dashboard):**
Browser → CloudFront → API Gateway (REST, Cognito ID-token auth) → Lambda → DynamoDB → JSON back to browser.

**Real-time HVAC metrics push:**
DynamoDB Streams → Lambda stream handler → API Gateway WebSocket → all subscribed browser clients.

**Ask Assistant chat (new):**
Browser → CloudFront → API Gateway → `FSM-AgentsApiHandler` Lambda → AgentCore `InvokeAgentRuntime` → Orchestrator container → DynamoDB tools (or specialist agents) → response back through the same path. CloudWatch captures OTel spans which the UI fetches via `/agents/trace/{agentKey}/{sessionId}` to render the "Thinking" panel.

**Workflow trigger (multi-agent):**
The Workflow tab POSTs to `/agents/workflow`, which fans out to 4–6 specialist agents in parallel via AgentCore, aggregates their reasoning, and returns a single response with per-step status and trace IDs.

### Component Details

#### Frontend
- **React 18** SPA with AWS Cloudscape Design System
- **AWS Amplify Auth** for Cognito hosted-UI flows; raw `fetch` for data calls
- **react-router-dom** for client-side routing
- **react-leaflet** for the scheduler map view

#### API & Compute
- **API Gateway REST** (`prod` stage) — endpoints for `/customers`, `/jobs`, `/technicians`, `/invoices`, `/metrics`, `/parts`, `/agents/{agent}`, `/agents/workflow`, `/agents/chat`, `/agents/trace/{agent}/{session}`
- **API Gateway WebSocket** — `$connect`, `$disconnect`, `$default` routes for live updates
- **Lambda (Node.js 22)** — one function per resource family plus the agents API handler
- **CloudWatch Logs + Metrics** for every Lambda and AgentCore runtime

#### Data
- **DynamoDB** on-demand tables (one item-collection per domain): `FSM-Customers-prod`, `FSM-Jobs-prod`, `FSM-Technicians-prod`, `FSM-Invoices-prod`, `FSM-Metrics-prod`, `FSM-Parts-prod`, `FSM-Documentation-prod`, `FSM-SimulatorConfig-prod`, `FSM-WebSocketConnections-prod`
- **DynamoDB Streams** on hot tables for real-time fan-out

#### AI / Bedrock AgentCore
- **AgentCore Runtime** hosts each agent in its own ARM64 container image (one ECR repo per agent)
- **Strands SDK** wires the LLM tool-calling loop; **Claude Sonnet 4.6** (`us.anthropic.claude-sonnet-4-6`) is the model
- **Per-agent IAM roles** — least-privilege DynamoDB access scoped to the tables each agent owns (e.g. Billing reaches Invoices/Customers/Jobs only; Parts reaches Parts only; Orchestrator has read across all + write on Jobs for assignments)
- **AgentCore Observability** publishes OTel spans to CloudWatch; the UI surfaces these per chat message

#### Identity & Edge
- **Cognito User Pool** created per deployment environment for browser sign-in
- **CloudFront** with Origin Access Control for S3, HTTPS-only, custom error responses for SPA routing
- **Stage throttling** on API Gateway (rate and burst limits per stage)

### Security Posture

- All public traffic terminates at CloudFront (HTTPS only) and API Gateway (HTTPS only)
- S3 buckets are private; CloudFront fetches via OAC (SigV4, distribution-scoped bucket policy, TLS-only)
- Each Lambda has a scoped IAM execution role (no shared admin role)
- Each AgentCore runtime has its own IAM role with only the DynamoDB actions it needs
- DynamoDB writes from agents are guarded by `attribute_exists` conditions to prevent ghost-record creation
- Optional AgentCore Gateway OAuth credentials are read at runtime from AWS Secrets Manager; they are never read from checked-in JSON configuration

### Deployment Topology

- **`deploy-stack.sh`** validates named inputs and the AWS account before writes, then orchestrates the complete deployment
- **`scripts/rebuild-agent-images.sh`** creates missing immutable ECR repositories and builds/pushes all eight per-agent images with Docker or Finch
- **`scripts/run-agentcore-deployer.sh`** uses an isolated pinned Python environment to create or update environment-scoped AgentCore runtimes and emit validated result files
- **CloudFormation** deploys DynamoDB, Lambda, REST/WebSocket APIs, Cognito, CloudFront, sample data, and the frontend bucket from versioned nested templates

### Data Model
- **Customers**: HVAC system owners with service contracts
- **Jobs**: Maintenance and repair tasks assigned to technicians
- **Technicians**: Field service personnel who perform maintenance
- **Invoices**: Billing records for completed jobs
- **Metrics**: Real-time HVAC system performance data
- **Parts**: Inventory of replacement parts and components

## Deployment

`deploy-stack.sh` is the supported full deployment entry point. It requires named options so the account, region, environment, administrator, and container engine are explicit.

### Prerequisites

- Node.js 18 or later and npm
- Python 3.12 for local AgentCore tooling and image parity
- AWS CLI v2 configured with credentials that can create the documented resources
- `curl` and `zip`
- One supported container engine:
  - Docker Desktop with a running daemon and Docker Buildx, or
  - Finch with an initialized, running VM (`finch vm init`, then `finch vm start`)
- Access to the Claude Sonnet 4.6 inference profile used by the agents (`us.anthropic.claude-sonnet-4-6`)

Agent dependencies are pinned in `agents/requirements.txt` and installed inside the container images. The AgentCore deployer uses an isolated environment pinned by `scripts/requirements-agentcore-deploy.txt`; do not install deployment packages into the host Python environment.

### Full Deployment

```bash
./deploy-stack.sh \
  --region REGION \
  --environment dev|test|prod \
  --expected-account 123456789012 \
  --admin-email EXACT_EMAIL \
  --engine docker|finch \
  [--profile PROFILE] \
  [--image-tag IMMUTABLE_TAG] \
  [--confirm DEPLOY-FSM-PROD]
```

Safety behavior:

- The script resolves the active STS identity and stops if its account differs from `--expected-account`.
- `prod` requires `--confirm DEPLOY-FSM-PROD`. The old deletion confirmation is intentionally rejected.
- `admin@example.com` and invalid email addresses are rejected.
- Failed or rollback-complete CloudFormation stacks are not deleted automatically.
- Nested templates are uploaded under `templates/<immutable-release-id>/`; the oversized API template is validated from its guarded S3 URL.
- Lambda packages are created in isolated directories and include the pinned `aws-sdk==2.1692.0` where required.
- Frontend configuration is generated in a temporary shell file. Tracked source configuration is not rewritten.
- Frontend assets are synced without `--delete`, preserving unrelated or older versioned objects.
- The script does not commit or push Git changes.

The deployment writes these local ignored result files:

- `scripts/.rebuild-results.json`: exact image URI for each of the eight agents
- `scripts/.agentcore-deployment-results.json`: runtime deployment details and READY status
- `scripts/.agent-runtime-arns.json`: compact runtime ARN map used by CloudFormation

### Read-only Preflight

Add `--preflight-only` to perform input, tool, container-engine, identity, and template checks without AWS writes:

```bash
./deploy-stack.sh \
  --region us-east-1 \
  --environment prod \
  --expected-account 123456789012 \
  --admin-email administrator@your-company.example \
  --engine finch \
  --confirm DEPLOY-FSM-PROD \
  --preflight-only
```

### Build Agent Images Separately

The image pipeline supports Docker and Finch independently of the full deploy:

```bash
# Local build only; no AWS calls or push
./scripts/rebuild-agent-images.sh \
  --engine docker \
  --region us-east-1 \
  --agent fsm_billing_invoicing_agent \
  --tag local-validation \
  --no-push \
  --results-file /tmp/fsm-image-results.json

# Guarded build and push; creates missing immutable ECR repositories
./scripts/rebuild-agent-images.sh \
  --engine finch \
  --region us-east-1 \
  --account-id 123456789012 \
  --tag RELEASE_TAG
```

The standalone image script does not update AgentCore runtimes. The full `deploy-stack.sh` flow consumes its result map and performs the runtime updates.

### Optional AgentCore Gateway

Gateway integration is optional. The deploy script does not create a Gateway or store OAuth credentials. To enable it, first create and validate an HTTPS MCP Gateway and store this JSON in AWS Secrets Manager:

```json
{
  "client_id": "REDACTED",
  "client_secret": "REDACTED",
  "token_url": "https://YOUR_COGNITO_DOMAIN/oauth2/token"
}
```

Then supply both options together:

```bash
--gateway-url https://GATEWAY_ID.gateway.bedrock-agentcore.REGION.amazonaws.com/mcp \
--gateway-secret-arn arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:SECRET_NAME
```

The secret ARN must match the expected account and region. Runtime roles receive only `secretsmanager:GetSecretValue` for that ARN. Never place client secrets, access tokens, or Gateway credentials in `agentcore_gateway_config.json`, tracked files, command output, or runtime environment values.

### Validation

Run the local safety and pipeline suite before a deployment:

```bash
bash scripts/tests/test-deploy-stack.sh
bash scripts/tests/test-agent-image-pipeline.sh
bash scripts/tests/test-package-lambda-functions.sh
python3 -m unittest scripts/tests/test_deploy_agentcore_agents.py
node scripts/tests/test-agents-api-config.js
cfn-lint --non-zero-exit-code error \
  fsm-deployment-main.yaml fsm-dynamodb.yaml fsm-lambda.yaml \
  fsm-api.yaml fsm-realtime.yaml fsm-data-population.yaml
npm run build
```

For a built image, run it on a free loopback port and verify `GET /ping` returns a healthy status before pushing it.

### Post-deployment

The script prints the CloudFront URL and service endpoints after its smoke checks pass. Cognito sends the initial administrator invitation to `--admin-email`; no temporary password is printed or fixed in code. Review the generated AgentCore result files and CloudFormation outputs for the authoritative runtime ARNs and resource IDs.

## Component Explanations

### CloudFormation Templates

The deployment uses several CloudFormation templates:

#### 1. fsm-deployment-main.yaml
- Main template that orchestrates the deployment of all components
- Creates S3 bucket for the React application
- Sets up CloudFront distribution with Origin Access Control
- Creates Cognito User Pool and admin user
- References nested stacks for other components

#### 2. fsm-dynamodb.yaml
- Creates DynamoDB tables for:
  - Customers: Stores customer information and HVAC system details
  - Jobs: Tracks maintenance and repair tasks
  - Technicians: Manages field service personnel information
  - Invoices: Records billing information
  - Metrics: Stores HVAC system performance data
  - Parts: Manages inventory of replacement parts

#### 3. fsm-lambda.yaml
- Creates Lambda functions for:
  - Customer operations (list, get by ID)
  - Job operations (list, get by ID, assign, complete)
  - Technician operations (list, get by ID)
  - Invoice operations (list, get by ID)
  - Metrics operations (get real-time and historical data)
  - Parts operations (list, reorder)
  - WebSocket operations (connect, disconnect, message)
  - Agents API handler for interacting with Bedrock agents

#### 4. fsm-api.yaml
- Creates API Gateway REST API with:
  - Resources for customers, jobs, technicians, invoices, metrics, and parts
  - Methods for GET, POST operations
  - Cognito User Pools authorization on every non-OPTIONS method
  - CORS configuration
  - Endpoints for interacting with Bedrock agents
- Creates WebSocket API for real-time updates

#### 5. fsm-data-population.yaml
- Creates sample data for demonstration purposes
- Populates DynamoDB tables with initial data

#### 6. fsm-realtime.yaml
- Creates the WebSocket API and connection management resources
- Connects DynamoDB stream events to the real-time update path

The eight AI agents are deployed as AgentCore runtimes by `scripts/deploy-agentcore-agents.py`; they are not created by a legacy `fsm-agents.yaml` Lambda template.

### Lambda Functions

The application includes several Lambda functions:

#### Data Access Functions
- **CustomerFunction**: Retrieves list of customers
- **CustomerByIdFunction**: Retrieves details for a specific customer
- **JobsFunction**: Retrieves list of jobs
- **JobByIdFunction**: Retrieves details for a specific job
- **AssignTechnicianFunction**: Assigns a technician to a job
- **CompleteJobFunction**: Marks a job as complete
- **TechniciansFunction**: Retrieves list of technicians
- **PartsFunction**: Retrieves list of parts
- **PartsReorderFunction**: Processes part reorder requests

#### WebSocket Functions
- **WebSocketConnectFunction**: Handles client connections
- **WebSocketDisconnectFunction**: Handles client disconnections
- **WebSocketMessageFunction**: Processes messages from clients

#### Agent API Function
- **AgentsApiHandlerFunction**: Validates the deployed runtime ARN map and invokes the eight AgentCore runtimes

### API Gateway

The API Gateway provides RESTful endpoints for:
- `/customers`: Customer management
- `/jobs`: Job management
- `/technicians`: Technician management
- `/invoices`: Invoice management
- `/metrics`: HVAC system metrics
- `/parts`: Parts inventory management
- `/agents/{agent}`: Bedrock agents interaction

Every non-OPTIONS endpoint requires a Cognito ID token (`Authorization: <ID token>`); unauthenticated calls get HTTP 401. OPTIONS preflight is unauthenticated so CORS works.

### WebSocket API

The WebSocket API enables real-time updates for:
- HVAC system metrics changes
- Job status updates
- Technician location updates
- New customer alerts
- Inventory level notifications

### Local Development

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.development` to `.env.development.local` (gitignored) and fill in the API endpoint and WebSocket endpoint printed by `deploy-stack.sh`. Never commit live values.

4. Start the development server:

```bash
npm start
```

This will open the application in your default web browser at [http://localhost:3000](http://localhost:3000).

## Security

- **User Authentication**: Cognito User Pools (12+ character passwords, admin-created users only).
- **API access**: every non-OPTIONS REST method uses a Cognito User Pools authorizer that validates the signed-in user's ID token. The WebSocket `$connect` route uses a Lambda REQUEST authorizer (`lambda/websocketAuthorizer.js`) that verifies the same ID token, passed as `?token=`, with `aws-jwt-verify`. There is no API key; abuse is limited by stage throttling. The REST deployment is tied to the release ID so authorization changes always reach the stage.
- **Backups**: point-in-time recovery is enabled on all nine DynamoDB tables.
- **IAM**: the Lambda stack defines four narrowly scoped execution roles instead of one shared role:
  `ApiDataAccessRole` (REST handlers, named environment tables only), `WebSocketHandlerRole` (connections table + `execute-api:ManageConnections`), `RealtimeBroadcastRole` (metrics/simulator tables, stream read, WebSocket push), and `AgentsApiRole` (`bedrock-agentcore:InvokeAgentRuntime` on `runtime/fsm_*` and their log groups only). AgentCore execution roles are generated per agent by `scripts/deploy-agentcore-agents.py` with table-scoped statements. No `*FullAccess` managed policies are used anywhere in the repository.
- **S3 / CloudFront**: the React bucket has all four public-access blocks enabled, SSE-S3, versioning, and `BucketOwnerEnforced`. CloudFront reads it through Origin Access Control (SigV4) with a bucket policy scoped to the distribution ARN and a `Deny` on non-TLS transport. There is no S3 website endpoint and no `http-only` origin.
- **CORS**: every Lambda derives its single allowed origin from the `CORS_ORIGIN` environment variable (the CloudFront URL). Wildcards are rejected by template `AllowedPattern`s and by the runtime helper in `lambda/wrapper/cors-wrapper.js`, which fails closed and never emits `Access-Control-Allow-Credentials`.
- **No committed identifiers**: account IDs, ARNs, API IDs, Cognito IDs, and endpoints are not committed. `.env.development` contains placeholders only; live values are generated ephemerally by `deploy-stack.sh`. Agents and Lambdas require table names from the environment and no longer fall back to `-prod` tables. Test scripts read their targets from environment variables.
- **Versioned artifacts**: nested templates and Lambda packages are uploaded under `templates/<release>/` and `lambda/<release>/`, so every stack update picks up the new code.

Known gaps (not addressed by the templates in this repository; see Security Considerations): authentication is enforced at API Gateway, but handlers do not enforce per-user or per-role authorization, so any signed-in user can read and modify all records. Cognito MFA is not enabled, and no Bedrock Guardrail is attached to the agents (T13). Add role and ownership checks from the token claims (`event.requestContext.authorizer.claims`) before exposing the API beyond a demo environment.

## Security Considerations

This sample is intended for demonstration. Before any production use, note:

- **Authorization is coarse (T2/T6):** REST methods and the WebSocket `$connect` route require a valid Cognito ID token, and there is no API key. But once signed in, every user has full read/write access to all application data and to all agents; there is no per-user or per-role scoping. *Production alternative:* enforce per-user or per-tenant authorization in the API handlers from the token claims (`event.requestContext.authorizer.claims`), for example Cognito groups mapped to roles, so each user reaches only their own records and permitted agents.
- **Agents run without a Bedrock Guardrail (T13):** agent prompts and responses are not filtered for prompt injection, sensitive-data egress or disallowed content. *Production alternative:* attach an Amazon Bedrock Guardrail to every agent and model invocation, and fail closed if the guardrail is unavailable.

## Real-time Updates

The application uses WebSockets to receive real-time updates when data changes in DynamoDB:

1. When a user connects to the application, a WebSocket connection is established
2. The client subscribes to specific topics (customers, jobs, technicians, etc.)
3. When data changes in DynamoDB, Lambda functions notify connected clients via WebSocket
4. The React components update automatically when new data is received

## Customization

You can customize the application by:

1. Modifying the React components in `src/pages`
2. Updating the Lambda functions in `lambda/`
3. Extending the DynamoDB schema by updating the CloudFormation template

## License

This project is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for details.

### AI Agents Dashboard

The application includes a dedicated AI Agents Dashboard that provides visibility into the agent workflows and status:

- **Agent Status Monitoring**: View the current status of all 8 AI agents in real-time
- **Workflow Tracking**: Monitor active and completed workflows with detailed step information
- **Agent Activity History**: See recent actions performed by each agent with timestamps and status
- **Workflow Details**: Examine the steps, timing, and results of each agent workflow
- **Test Workflows**: Trigger test workflows to see the agents in action
- **Status Indicators**: Visual indicators show the status of agents and workflow steps

The AI Agents Dashboard is particularly useful for:
- Monitoring the health and activity of the AI agent system
- Troubleshooting issues with agent workflows
- Understanding how agents collaborate on complex tasks
- Verifying that automated processes are working correctly
- Demonstrating the capabilities of the AI agent system to stakeholders
## Troubleshooting

### Agent Image Dependency Issues

Agent dependencies are pinned in `agents/requirements.txt` and installed only inside the Python 3.12 container image. Do not repair a failed image build by installing unpinned packages into host Python. Instead:

1. Run `bash scripts/tests/test-agent-image-pipeline.sh`.
2. Build one agent locally with `--no-push` and an explicit tag.
3. Start the image on a free loopback port and verify `GET /ping`.
4. Fix the pinned requirements or Dockerfile and rebuild before any push.

The isolated control-plane deployer is launched through `scripts/run-agentcore-deployer.sh` and pinned separately in `scripts/requirements-agentcore-deploy.txt`.

### React App Build Issues

If you encounter errors during the React app build:

1. **Missing Dependencies**: Install any missing dependencies:
   ```bash
   npm install
   ```

2. **Source Map Warnings**: Warnings about missing source maps for Cloudscape Design components can be safely ignored.

3. **API Configuration**: Ensure the API configuration files have the correct endpoints (requests authenticate with the Cognito ID token, see `src/utils/auth-headers.js`):
   - `src/config/api-config.js`
   - `src/config/amplify-config.js`
   - `src/config/amplify-config-legacy.js`

### Authentication Issues

If you encounter authentication issues:

1. **Cognito Configuration**: Verify the Cognito User Pool ID and Client ID in:
   - `src/config/auth.js`
   - `src/services/directAuthService.js`

2. **Temporary Password**: Use the temporary credential sent by Cognito to the exact `--admin-email` address, then complete the required password change.

3. **CORS Issues**: If you encounter CORS errors, ensure the CloudFront distribution is properly configured and the API Gateway has CORS enabled.
