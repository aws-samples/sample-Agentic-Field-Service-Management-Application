#!/usr/bin/env bash
# Safely deploy the complete FSM application with Docker or Finch.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

usage() {
  cat <<'EOF'
Usage: ./deploy-stack.sh --region REGION --environment ENVIRONMENT \
  --expected-account ACCOUNT_ID --admin-email EMAIL --engine docker|finch [options]

Required:
  --region REGION                 AWS region
  --environment dev|test|prod     Deployment environment
  --expected-account ACCOUNT_ID   Exact 12-digit AWS account safety guard
  --admin-email EMAIL             Exact initial Cognito administrator email
  --engine docker|finch           Container engine for all eight agent images

Options:
  --profile PROFILE               AWS CLI profile (default credential chain if omitted)
  --image-tag TAG                 Exact immutable image tag (default: UTC release ID)
  --gateway-url URL               Optional AgentCore Gateway HTTPS MCP URL
  --gateway-secret-arn ARN        Secrets Manager ARN containing client_id, client_secret, token_url
  --confirm VALUE                 Required for prod; must be DEPLOY-FSM-PROD
  --preflight-only                Validate inputs, local tools, identity, and templates; make no AWS writes
  -h, --help                      Show this help

The optional gateway arguments must be supplied together. This script never creates
or stores gateway credentials, deletes a stack, sets a fixed password, mutates tracked
frontend source, commits, or pushes Git changes.
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_value() {
  [[ $# -ge 2 && -n "$2" ]] || fail "$1 requires a value"
}

write_frontend_env() {
  local output="$1"
  shift
  [[ $# -gt 0 && $(( $# % 2 )) -eq 0 ]] || fail "write_frontend_env requires KEY VALUE pairs"
  : > "$output"
  while [[ $# -gt 0 ]]; do
    local key="$1"
    local value="$2"
    [[ "$key" =~ ^REACT_APP_[A-Z0-9_]+$ ]] || fail "Invalid frontend environment key: ${key}"
    printf 'export %s=' "$key" >> "$output"
    printf '%q' "$value" >> "$output"
    printf '\n' >> "$output"
    shift 2
  done
}

if [[ "${FSM_DEPLOY_LIBRARY_ONLY:-false}" == true ]]; then
  return 0 2>/dev/null || exit 0
fi

REGION=""
ENVIRONMENT=""
EXPECTED_ACCOUNT=""
ADMIN_EMAIL=""
CONTAINER_ENGINE=""
AWS_PROFILE=""
IMAGE_TAG=""
GATEWAY_URL=""
GATEWAY_SECRET_ARN=""
CONFIRMATION=""
PREFLIGHT_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) require_value "$@"; REGION="$2"; shift 2 ;;
    --environment) require_value "$@"; ENVIRONMENT="$2"; shift 2 ;;
    --expected-account) require_value "$@"; EXPECTED_ACCOUNT="$2"; shift 2 ;;
    --admin-email) require_value "$@"; ADMIN_EMAIL="$2"; shift 2 ;;
    --engine) require_value "$@"; CONTAINER_ENGINE="$2"; shift 2 ;;
    --profile) require_value "$@"; AWS_PROFILE="$2"; shift 2 ;;
    --image-tag) require_value "$@"; IMAGE_TAG="$2"; shift 2 ;;
    --gateway-url) require_value "$@"; GATEWAY_URL="$2"; shift 2 ;;
    --gateway-secret-arn) require_value "$@"; GATEWAY_SECRET_ARN="$2"; shift 2 ;;
    --confirm) require_value "$@"; CONFIRMATION="$2"; shift 2 ;;
    --preflight-only) PREFLIGHT_ONLY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[[ "$REGION" =~ ^[a-z]{2}(-gov)?-[a-z]+-[0-9]$ ]] || fail "--region must be a valid AWS region"
[[ "$ENVIRONMENT" == dev || "$ENVIRONMENT" == test || "$ENVIRONMENT" == prod ]] || fail "--environment must be dev, test, or prod"
[[ "$EXPECTED_ACCOUNT" =~ ^[0-9]{12}$ ]] || fail "--expected-account must contain exactly 12 digits"
[[ "$ADMIN_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || fail "--admin-email must be an explicit valid email address"
[[ "$ADMIN_EMAIL" != "admin@example.com" ]] || fail "Refusing placeholder administrator email admin@example.com"
[[ "$CONTAINER_ENGINE" == docker || "$CONTAINER_ENGINE" == finch ]] || fail "--engine must be docker or finch"
[[ "$CONFIRMATION" != "DELETE FSM PROD WITHOUT BACKUP" ]] || fail "Deletion confirmation is not valid for deployment"
if [[ "$ENVIRONMENT" == prod && "$CONFIRMATION" != "DEPLOY-FSM-PROD" ]]; then
  fail "Production deployment requires --confirm DEPLOY-FSM-PROD"
fi
if [[ -n "$IMAGE_TAG" && ! "$IMAGE_TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
  fail "--image-tag is not a valid container tag"
fi
if [[ -n "$GATEWAY_URL" || -n "$GATEWAY_SECRET_ARN" ]]; then
  [[ -n "$GATEWAY_URL" && -n "$GATEWAY_SECRET_ARN" ]] || fail "--gateway-url and --gateway-secret-arn must be supplied together"
  [[ "$GATEWAY_URL" =~ ^https://[^[:space:]]+/mcp/?$ ]] || fail "--gateway-url must be an HTTPS MCP URL"
  PARTITION="aws"
  [[ "$REGION" == cn-* ]] && PARTITION="aws-cn"
  [[ "$REGION" == us-gov-* ]] && PARTITION="aws-us-gov"
  [[ "$GATEWAY_SECRET_ARN" == "arn:${PARTITION}:secretsmanager:${REGION}:${EXPECTED_ACCOUNT}:secret:"* ]] || \
    fail "--gateway-secret-arn must match the expected account, region, and partition"
fi

for command_name in aws node npm python3 zip curl "$CONTAINER_ENGINE"; do
  command -v "$command_name" >/dev/null 2>&1 || fail "${command_name} is required"
done

REQUIRED_FILES=(
  Dockerfile
  fsm-deployment-main.yaml
  fsm-dynamodb.yaml
  fsm-lambda.yaml
  fsm-api.yaml
  fsm-realtime.yaml
  fsm-data-population.yaml
  scripts/rebuild-agent-images.sh
  scripts/run-agentcore-deployer.sh
  scripts/package-lambda-functions.sh
  scripts/verify-agent-arns.js
)
for required_file in "${REQUIRED_FILES[@]}"; do
  [[ -f "${PROJECT_ROOT}/${required_file}" ]] || fail "Required file is missing: ${required_file}"
done

if [[ "$CONTAINER_ENGINE" == docker ]]; then
  docker info >/dev/null 2>&1 || fail "Docker is not running"
  docker buildx version >/dev/null 2>&1 || fail "Docker Buildx is required"
else
  finch info >/dev/null 2>&1 || fail "Finch is not running; initialize and start its VM first"
fi

AWS_ARGS=(--no-cli-pager --region "$REGION")
[[ -n "$AWS_PROFILE" ]] && AWS_ARGS+=(--profile "$AWS_PROFILE")
aws_cli() { aws "${AWS_ARGS[@]}" "$@"; }

ACTUAL_ACCOUNT="$(aws_cli sts get-caller-identity --query Account --output text)"
[[ "$ACTUAL_ACCOUNT" == "$EXPECTED_ACCOUNT" ]] || fail "Active AWS account ${ACTUAL_ACCOUNT} does not match expected account ${EXPECTED_ACCOUNT}"
IDENTITY_ARN="$(aws_cli sts get-caller-identity --query Arn --output text)"
echo ">> AWS identity: ${IDENTITY_ARN}"
echo ">> Target: account=${EXPECTED_ACCOUNT} region=${REGION} environment=${ENVIRONMENT} engine=${CONTAINER_ENGINE}"

NESTED_TEMPLATES=(
  fsm-dynamodb.yaml
  fsm-lambda.yaml
  fsm-api.yaml
  fsm-realtime.yaml
  fsm-data-population.yaml
)
for template in fsm-deployment-main.yaml "${NESTED_TEMPLATES[@]}"; do
  TEMPLATE_BYTES="$(wc -c < "${PROJECT_ROOT}/${template}" | tr -d '[:space:]')"
  if (( TEMPLATE_BYTES <= 51200 )); then
    aws_cli cloudformation validate-template --template-body "file://${PROJECT_ROOT}/${template}" >/dev/null
  else
    echo ">> Deferring ${template} validation until its guarded S3 upload (${TEMPLATE_BYTES} bytes exceeds TemplateBody limit)"
  fi
done

if [[ "$PREFLIGHT_ONLY" == true ]]; then
  echo "PASS: preflight completed without AWS writes"
  exit 0
fi

RELEASE_ID="${IMAGE_TAG:-$(date -u +%Y%m%d-%H%M%S)}"
API_STAGE_NAME="prod"
# REST stage throttling (replaces the API key usage plan). Passed to the stack and
# re-applied to the stage after each deploy, so these are the single source of truth.
API_THROTTLE_RATE_LIMIT=50
API_THROTTLE_BURST_LIMIT=100
STACK_NAME="FSM-${ENVIRONMENT}-v9"
LAMBDA_BUCKET="fsm-lambda-code-${EXPECTED_ACCOUNT}-${REGION}-${ENVIRONMENT}-cfn"
TEMPLATE_PREFIX="templates/${RELEASE_ID}"
LAMBDA_CODE_PREFIX="lambda/${RELEASE_ID}"
IMAGE_MAP="${PROJECT_ROOT}/scripts/.rebuild-results.json"
RUNTIME_RESULTS="${PROJECT_ROOT}/scripts/.agentcore-deployment-results.json"
RUNTIME_ARN_FILE="${PROJECT_ROOT}/scripts/.agent-runtime-arns.json"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fsm-deploy.XXXXXX")"
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT
trap 'echo "ERROR: deployment failed at line ${LINENO}" >&2' ERR

IMAGE_ARGS=(
  --engine "$CONTAINER_ENGINE"
  --region "$REGION"
  --account-id "$EXPECTED_ACCOUNT"
  --tag "$RELEASE_ID"
  --results-file "$IMAGE_MAP"
)
[[ -n "$AWS_PROFILE" ]] && IMAGE_ARGS+=(--profile "$AWS_PROFILE")

echo ">> Building and pushing all eight AgentCore images"
"${PROJECT_ROOT}/scripts/rebuild-agent-images.sh" "${IMAGE_ARGS[@]}"

RUNTIME_ARGS=(
  --expected-account "$EXPECTED_ACCOUNT"
  --region "$REGION"
  --environment "$ENVIRONMENT"
  --image-map "$IMAGE_MAP"
  --output "$RUNTIME_RESULTS"
  --arn-map "$RUNTIME_ARN_FILE"
  --confirm "$CONFIRMATION"
)
[[ -n "$AWS_PROFILE" ]] && RUNTIME_ARGS+=(--profile "$AWS_PROFILE")
if [[ -n "$GATEWAY_URL" ]]; then
  RUNTIME_ARGS+=(--gateway-url "$GATEWAY_URL" --gateway-secret-arn "$GATEWAY_SECRET_ARN")
fi

echo ">> Creating or updating environment-scoped AgentCore runtimes"
"${PROJECT_ROOT}/scripts/run-agentcore-deployer.sh" "${RUNTIME_ARGS[@]}"
AGENT_RUNTIME_ARNS="$(node "${PROJECT_ROOT}/scripts/verify-agent-arns.js" "$RUNTIME_RESULTS" --compact)"
[[ -n "$AGENT_RUNTIME_ARNS" ]] || fail "Validated AgentCore ARN map is empty"

echo ">> Ensuring guarded Lambda artifact bucket exists"
if ! aws_cli s3api head-bucket --bucket "$LAMBDA_BUCKET" >/dev/null 2>&1; then
  if [[ "$REGION" == us-east-1 ]]; then
    aws_cli s3api create-bucket --bucket "$LAMBDA_BUCKET" >/dev/null
  else
    aws_cli s3api create-bucket --bucket "$LAMBDA_BUCKET" \
      --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
  fi
fi
aws_cli s3api put-public-access-block --bucket "$LAMBDA_BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws_cli s3api put-bucket-encryption --bucket "$LAMBDA_BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws_cli s3api put-bucket-versioning --bucket "$LAMBDA_BUCKET" --versioning-configuration Status=Enabled

PACKAGE_ARGS=(
  --region "$REGION"
  --environment "$ENVIRONMENT"
  --expected-account "$EXPECTED_ACCOUNT"
  --bucket "$LAMBDA_BUCKET"
  --prefix "$LAMBDA_CODE_PREFIX"
  --confirm "$CONFIRMATION"
)
[[ -n "$AWS_PROFILE" ]] && PACKAGE_ARGS+=(--profile "$AWS_PROFILE")
echo ">> Packaging and uploading Lambda functions"
"${PROJECT_ROOT}/scripts/package-lambda-functions.sh" "${PACKAGE_ARGS[@]}"

echo ">> Uploading and validating versioned nested templates"
TEMPLATE_DNS_SUFFIX="amazonaws.com"
[[ "$REGION" == cn-* ]] && TEMPLATE_DNS_SUFFIX="amazonaws.com.cn"
for template in "${NESTED_TEMPLATES[@]}"; do
  aws_cli s3 cp "${PROJECT_ROOT}/${template}" "s3://${LAMBDA_BUCKET}/${TEMPLATE_PREFIX}/${template}" --only-show-errors
  aws_cli cloudformation validate-template \
    --template-url "https://${LAMBDA_BUCKET}.s3.${REGION}.${TEMPLATE_DNS_SUFFIX}/${TEMPLATE_PREFIX}/${template}" >/dev/null
done

if EXISTING_STATUS="$(aws_cli cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].StackStatus' --output text 2>/dev/null)"; then
  case "$EXISTING_STATUS" in
    ROLLBACK_COMPLETE|CREATE_FAILED|DELETE_FAILED)
      fail "Stack ${STACK_NAME} is ${EXISTING_STATUS}; inspect it and explicitly resolve or delete it before retrying"
      ;;
  esac
fi

echo ">> Deploying CloudFormation stack ${STACK_NAME}; no failed stack will be deleted automatically"
aws_cli cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "${PROJECT_ROOT}/fsm-deployment-main.yaml" \
  --parameter-overrides \
    "ApiStageName=${API_STAGE_NAME}" \
    "ApiThrottleRateLimit=${API_THROTTLE_RATE_LIMIT}" \
    "ApiThrottleBurstLimit=${API_THROTTLE_BURST_LIMIT}" \
    "AdminEmail=${ADMIN_EMAIL}" \
    "Environment=${ENVIRONMENT}" \
    "LambdaCodeBucket=${LAMBDA_BUCKET}" \
    "TemplatePrefix=${TEMPLATE_PREFIX}" \
    "LambdaCodePrefix=${LAMBDA_CODE_PREFIX}" \
    "AgentRuntimeArns=${AGENT_RUNTIME_ARNS}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --no-fail-on-empty-changeset

UTC_NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ">> Initializing missing simulator configuration fields without overwriting existing values"
aws_cli dynamodb update-item \
  --table-name "FSM-SimulatorConfig-${ENVIRONMENT}" \
  --key '{"id":{"S":"hvac-simulator-config"}}' \
  --update-expression 'SET enabled = if_not_exists(enabled, :enabled), lastUpdated = if_not_exists(lastUpdated, :now)' \
  --expression-attribute-values "{\":enabled\":{\"BOOL\":true},\":now\":{\"S\":\"${UTC_NOW}\"}}" >/dev/null

stack_output() {
  local output_key="$1"
  aws_cli cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" --output text
}

CLOUDFRONT_URL="$(stack_output CloudFrontURL)"
CLOUDFRONT_DISTRIBUTION_ID="$(stack_output CloudFrontDistributionId)"
API_ENDPOINT="$(stack_output APIEndpoint)"
WEBSOCKET_ENDPOINT="$(stack_output WebSocketEndpoint)"
REST_API_ID="$(stack_output RestApiId)"
USER_POOL_ID="$(stack_output UserPoolId)"
USER_POOL_CLIENT_ID="$(stack_output UserPoolClientId)"
REACT_APP_BUCKET="$(stack_output ReactAppBucketName)"
for output_value in "$CLOUDFRONT_URL" "$CLOUDFRONT_DISTRIBUTION_ID" "$API_ENDPOINT" "$WEBSOCKET_ENDPOINT" \
  "$REST_API_ID" "$USER_POOL_ID" "$USER_POOL_CLIENT_ID" "$REACT_APP_BUCKET"; do
  [[ -n "$output_value" && "$output_value" != None ]] || fail "A required CloudFormation output is missing"
done

# CloudFormation does not reliably create a new REST API deployment when only
# method settings change, so publish one explicitly. This makes every deploy
# from main push the current method authorization to the stage, and re-applies
# the stage throttling that replaces the old API key usage plan. The stage then
# points at this deployment rather than the CloudFormation-owned one; that drift is
# expected and is corrected again by the next run of this script.
echo ">> Publishing REST API deployment ${RELEASE_ID} to stage ${API_STAGE_NAME}"
aws_cli apigateway create-deployment --rest-api-id "$REST_API_ID" --stage-name "$API_STAGE_NAME" \
  --description "FSM release ${RELEASE_ID}" >/dev/null
aws_cli apigateway update-stage --rest-api-id "$REST_API_ID" --stage-name "$API_STAGE_NAME" \
  --patch-operations \
    "op=replace,path=/*/*/throttling/rateLimit,value=${API_THROTTLE_RATE_LIMIT}" \
    "op=replace,path=/*/*/throttling/burstLimit,value=${API_THROTTLE_BURST_LIMIT}" >/dev/null

FRONTEND_ENV="${TEMP_DIR}/frontend.env"
write_frontend_env "$FRONTEND_ENV" \
  REACT_APP_AWS_REGION "$REGION" \
  REACT_APP_APP_URL "$CLOUDFRONT_URL" \
  REACT_APP_USER_POOL_ID "$USER_POOL_ID" \
  REACT_APP_USER_POOL_CLIENT_ID "$USER_POOL_CLIENT_ID" \
  REACT_APP_COGNITO_DOMAIN "" \
  REACT_APP_API_ENDPOINT "$API_ENDPOINT" \
  REACT_APP_WEBSOCKET_ENDPOINT "$WEBSOCKET_ENDPOINT" \
  REACT_APP_SIMULATOR_ENDPOINT "$API_ENDPOINT"

echo ">> Building the frontend once from ephemeral REACT_APP_* configuration"
(
  set -a
  # shellcheck disable=SC1090
  source "$FRONTEND_ENV"
  set +a
  cd "$PROJECT_ROOT"
  npm run build
)

echo ">> Uploading frontend assets without deleting unrelated or older versioned objects"
aws_cli s3 sync "${PROJECT_ROOT}/build/" "s3://${REACT_APP_BUCKET}/" --only-show-errors
aws_cli cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths '/*' >/dev/null

wait_for_http_status() {
  local name="$1"
  local expected="$2"
  local url="$3"
  shift 3
  local attempt status
  for attempt in {1..12}; do
    status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$@" "$url" || true)"
    if [[ "$status" == "$expected" ]]; then
      echo "PASS: ${name} returned HTTP ${expected}"
      return 0
    fi
    echo ">> ${name} returned HTTP ${status}; expected ${expected}; retrying (${attempt}/12)"
    sleep 10
  done
  fail "${name} did not return HTTP ${expected}"
}

wait_for_http_status "CloudFront application" 200 "$CLOUDFRONT_URL"
# The REST API requires a Cognito ID token; an anonymous call must be rejected.
wait_for_http_status "FSM customers API without a token" 401 "${API_ENDPOINT%/}/customers"

echo
printf 'PASS: FSM deployment completed\n'
printf '  Stack: %s\n' "$STACK_NAME"
printf '  Application: %s\n' "$CLOUDFRONT_URL"
printf '  API: %s\n' "$API_ENDPOINT"
printf '  WebSocket: %s\n' "$WEBSOCKET_ENDPOINT"
printf '  Administrator invitation: %s\n' "$ADMIN_EMAIL"
printf '  AgentCore result: %s\n' "$RUNTIME_RESULTS"
echo "Cognito generates and emails the initial temporary password; this script never prints or stores it."
