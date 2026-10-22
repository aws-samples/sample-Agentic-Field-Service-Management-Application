#!/usr/bin/env bash
# Build each FSM agent image with Docker or Finch and optionally push to ECR.
# This script does not update AgentCore runtimes; use each pushed container URI
# in a separate AgentCore runtime update.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_CONFIG_FILE="${SCRIPT_DIR}/.agent-images.env"
CONFIG_FILE="$DEFAULT_CONFIG_FILE"
DOCKERFILE="${PROJECT_ROOT}/Dockerfile"

# agent name -> Python module
declare -a AGENTS=(
  "fsm_orchestrator_agent:agents.orchestrator_agent"
  "fsm_hvac_monitoring_agent:agents.hvac_monitoring_agent"
  "fsm_parts_inventory_agent:agents.parts_inventory_agent"
  "fsm_technician_scheduling_agent:agents.technician_scheduling_agent"
  "fsm_customer_communication_agent:agents.customer_communication_agent"
  "fsm_customer_authentication_agent:agents.customer_authentication_agent"
  "fsm_billing_invoicing_agent:agents.billing_invoicing_agent"
  "fsm_technical_documentation_agent:agents.technical_documentation_agent"
)

usage() {
  cat <<'EOF'
Usage: ./scripts/rebuild-agent-images.sh [options]

Builds one or all FSM agent images using Docker or Finch. By default, images
are pushed to ECR to preserve the existing deployment behavior. Run the setup
script first, or provide equivalent options/environment values.

Options:
  --config PATH              Configuration file (default: scripts/.agent-images.env)
  --engine docker|finch      Override configured container engine
  --profile NAME             Override AWS CLI profile
  --region REGION            Override AWS region
  --account-id 12_DIGITS     Override expected AWS account safety guard
  --platform PLATFORM        Override target image platform
  --registry HOST            Override ECR registry
  --repository-prefix VALUE  Override ECR repository prefix
  --tag TAG                  Use an exact image tag instead of a generated UTC tag
  --tag-suffix SUFFIX        Suffix for a generated tag
  --agent NAME               Build only one agent
  --results-file PATH        Override output JSON path
  --push                     Push images to ECR (default)
  --no-push                  Build locally without AWS calls or ECR changes
  --dry-run                  Print commands without executing or writing results
  --list-agents              List valid agent names
  -h, --help                 Show this help

Precedence: command-line options > configuration file > built-in defaults.
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

show_command() {
  printf '+ '
  printf '%q ' "$@"
  printf '\n'
}

run_command() {
  show_command "$@"
  if [[ "$DRY_RUN" == false ]]; then
    "$@"
  fi
}

list_agents() {
  local pair
  for pair in "${AGENTS[@]}"; do
    echo "${pair%%:*}"
  done
}

# Find --config before loading settings so all remaining options can override it.
RAW_ARGS=("$@")
for ((i = 0; i < ${#RAW_ARGS[@]}; i++)); do
  if [[ "${RAW_ARGS[$i]}" == --config ]]; then
    ((i + 1 < ${#RAW_ARGS[@]})) || fail "--config requires a value"
    CONFIG_FILE="${RAW_ARGS[$((i + 1))]}"
  fi
done

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
elif [[ "$CONFIG_FILE" != "$DEFAULT_CONFIG_FILE" ]]; then
  fail "Configuration file not found: ${CONFIG_FILE}"
fi

CONTAINER_ENGINE="${CONTAINER_ENGINE:-docker}"
AWS_PROFILE="${AWS_PROFILE:-}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
IMAGE_PLATFORM="${IMAGE_PLATFORM:-linux/arm64}"
ECR_REPOSITORY_PREFIX="${ECR_REPOSITORY_PREFIX:-bedrock-agentcore-}"
ECR_REGISTRY="${ECR_REGISTRY:-}"
IMAGE_TAG_SUFFIX="${IMAGE_TAG_SUFFIX:-}"
PUSH_RESULTS_FILE="${PUSH_RESULTS_FILE:-scripts/.rebuild-results.json}"
LOCAL_RESULTS_FILE="${LOCAL_RESULTS_FILE:-scripts/.rebuild-results.local.json}"

PUSH=true
DRY_RUN=false
SELECTED_AGENT=""
EXACT_TAG=""
RESULTS_FILE_OVERRIDE=""
SHOW_AGENTS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) [[ $# -ge 2 ]] || fail "--config requires a value"; shift 2 ;;
    --engine) [[ $# -ge 2 ]] || fail "--engine requires a value"; CONTAINER_ENGINE="$2"; shift 2 ;;
    --profile) [[ $# -ge 2 ]] || fail "--profile requires a value"; AWS_PROFILE="$2"; shift 2 ;;
    --region) [[ $# -ge 2 ]] || fail "--region requires a value"; AWS_REGION="$2"; shift 2 ;;
    --account-id) [[ $# -ge 2 ]] || fail "--account-id requires a value"; AWS_ACCOUNT_ID="$2"; shift 2 ;;
    --platform) [[ $# -ge 2 ]] || fail "--platform requires a value"; IMAGE_PLATFORM="$2"; shift 2 ;;
    --registry) [[ $# -ge 2 ]] || fail "--registry requires a value"; ECR_REGISTRY="$2"; shift 2 ;;
    --repository-prefix) [[ $# -ge 2 ]] || fail "--repository-prefix requires a value"; ECR_REPOSITORY_PREFIX="$2"; shift 2 ;;
    --tag) [[ $# -ge 2 ]] || fail "--tag requires a value"; EXACT_TAG="$2"; shift 2 ;;
    --tag-suffix) [[ $# -ge 2 ]] || fail "--tag-suffix requires a value"; IMAGE_TAG_SUFFIX="$2"; shift 2 ;;
    --agent) [[ $# -ge 2 ]] || fail "--agent requires a value"; SELECTED_AGENT="$2"; shift 2 ;;
    --results-file) [[ $# -ge 2 ]] || fail "--results-file requires a value"; RESULTS_FILE_OVERRIDE="$2"; shift 2 ;;
    --push) PUSH=true; shift ;;
    --no-push) PUSH=false; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --list-agents) SHOW_AGENTS=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

if [[ "$SHOW_AGENTS" == true ]]; then
  list_agents
  exit 0
fi

[[ "$CONTAINER_ENGINE" == docker || "$CONTAINER_ENGINE" == finch ]] || fail "Container engine must be docker or finch"
[[ -n "$AWS_REGION" && "$AWS_REGION" != *[[:space:]]* ]] || fail "AWS region must be non-empty and contain no spaces"
[[ -n "$IMAGE_PLATFORM" && "$IMAGE_PLATFORM" != *[[:space:]]* ]] || fail "Image platform must be non-empty and contain no spaces"
[[ -f "$DOCKERFILE" ]] || fail "Dockerfile not found: ${DOCKERFILE}"

if [[ -n "$AWS_ACCOUNT_ID" && ! "$AWS_ACCOUNT_ID" =~ ^[0-9]{12}$ ]]; then
  fail "AWS account ID must contain exactly 12 digits"
fi

TAG="$EXACT_TAG"
if [[ -z "$TAG" ]]; then
  TAG="$(date -u +%Y%m%d-%H%M%S)"
  [[ -n "$IMAGE_TAG_SUFFIX" ]] && TAG="${TAG}-${IMAGE_TAG_SUFFIX}"
fi
[[ "$TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || fail "Invalid container image tag: ${TAG}"

if [[ -n "$SELECTED_AGENT" ]]; then
  AGENT_FOUND=false
  for pair in "${AGENTS[@]}"; do
    if [[ "${pair%%:*}" == "$SELECTED_AGENT" ]]; then
      AGENT_FOUND=true
      break
    fi
  done
  if [[ "$AGENT_FOUND" == false ]]; then
    echo "Valid agents:" >&2
    list_agents >&2
    fail "Unknown agent: ${SELECTED_AGENT}"
  fi
fi

AWS_ARGS=(--region "$AWS_REGION")
[[ -n "$AWS_PROFILE" ]] && AWS_ARGS+=(--profile "$AWS_PROFILE")

if [[ "$PUSH" == true && "$DRY_RUN" == false && -z "$AWS_ACCOUNT_ID" ]]; then
  fail "A 12-digit expected AWS account safety guard is required for pushes; run setup or pass --account-id"
fi
if [[ -z "$AWS_ACCOUNT_ID" ]]; then
  if [[ "$PUSH" == true ]]; then
    AWS_ACCOUNT_ID=000000000000
    echo "WARNING: dry-run is using placeholder AWS account ${AWS_ACCOUNT_ID}; configure a real account before pushing." >&2
  else
    AWS_ACCOUNT_ID=local
  fi
fi

EXPECTED_ECR_REGISTRY=""
if [[ "$AWS_ACCOUNT_ID" == local ]]; then
  [[ -n "$ECR_REGISTRY" ]] || ECR_REGISTRY=fsm-local
else
  ECR_DNS_SUFFIX=amazonaws.com
  [[ "$AWS_REGION" == cn-* ]] && ECR_DNS_SUFFIX=amazonaws.com.cn
  EXPECTED_ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.${ECR_DNS_SUFFIX}"
  [[ -n "$ECR_REGISTRY" ]] || ECR_REGISTRY="$EXPECTED_ECR_REGISTRY"
  if [[ "$PUSH" == true && "$ECR_REGISTRY" != "$EXPECTED_ECR_REGISTRY" ]]; then
    fail "ECR registry must match configured account and region: ${EXPECTED_ECR_REGISTRY}"
  fi
fi

if [[ "$PUSH" == true && "$DRY_RUN" == false ]]; then
  command -v aws >/dev/null 2>&1 || fail "AWS CLI is required when pushing images"
  ACTUAL_ACCOUNT_ID="$(aws "${AWS_ARGS[@]}" sts get-caller-identity --query Account --output text)"
  [[ "$ACTUAL_ACCOUNT_ID" =~ ^[0-9]{12}$ ]] || fail "Could not resolve a 12-digit account ID from AWS credentials"
  if [[ "$AWS_ACCOUNT_ID" != "$ACTUAL_ACCOUNT_ID" ]]; then
    fail "Active AWS account ${ACTUAL_ACCOUNT_ID} does not match configured safety guard ${AWS_ACCOUNT_ID}"
  fi
fi

if [[ "$DRY_RUN" == false ]]; then
  command -v "$CONTAINER_ENGINE" >/dev/null 2>&1 || fail "${CONTAINER_ENGINE} is not installed or not on PATH"
  if [[ "$CONTAINER_ENGINE" == docker ]]; then
    docker info >/dev/null 2>&1 || fail "Docker is not running"
    docker buildx version >/dev/null 2>&1 || fail "Docker Buildx is required"
  else
    finch info >/dev/null 2>&1 || fail "Finch is not running; run 'finch vm init' and 'finch vm start' first"
  fi
fi

if [[ "$PUSH" == true ]]; then
  echo ">> Ensuring ECR repositories exist"
  for pair in "${AGENTS[@]}"; do
    NAME="${pair%%:*}"
    [[ -z "$SELECTED_AGENT" || "$NAME" == "$SELECTED_AGENT" ]] || continue
    REPOSITORY="${ECR_REPOSITORY_PREFIX}${NAME}"
    [[ "$REPOSITORY" =~ ^[a-z0-9]+([._/-][a-z0-9]+)*$ ]] || fail "Invalid ECR repository name: ${REPOSITORY}"
    if [[ "$DRY_RUN" == true ]]; then
      show_command aws "${AWS_ARGS[@]}" ecr describe-repositories --repository-names "$REPOSITORY"
      show_command aws "${AWS_ARGS[@]}" ecr create-repository --repository-name "$REPOSITORY" --image-scanning-configuration scanOnPush=true --image-tag-mutability IMMUTABLE
    elif REPOSITORY_MUTABILITY="$(aws "${AWS_ARGS[@]}" ecr describe-repositories \
      --repository-names "$REPOSITORY" \
      --query 'repositories[0].imageTagMutability' --output text 2>/dev/null)"; then
      [[ "$REPOSITORY_MUTABILITY" == "IMMUTABLE" ]] || \
        fail "Existing ECR repository ${REPOSITORY} must use IMMUTABLE image tags (found ${REPOSITORY_MUTABILITY})"
    else
      run_command aws "${AWS_ARGS[@]}" ecr create-repository \
        --repository-name "$REPOSITORY" \
        --image-scanning-configuration scanOnPush=true \
        --image-tag-mutability IMMUTABLE \
        --tags Key=Application,Value=FSM Key=ManagedBy,Value=rebuild-agent-images.sh
    fi
  done

  echo ">> ECR login: engine=${CONTAINER_ENGINE} registry=${ECR_REGISTRY} region=${AWS_REGION}"
  if [[ "$DRY_RUN" == true ]]; then
    show_command aws "${AWS_ARGS[@]}" ecr get-login-password
    echo "  | ${CONTAINER_ENGINE} login --username AWS --password-stdin ${ECR_REGISTRY}"
  else
    aws "${AWS_ARGS[@]}" ecr get-login-password | \
      "$CONTAINER_ENGINE" login --username AWS --password-stdin "$ECR_REGISTRY"
  fi
fi

echo ">> engine: ${CONTAINER_ENGINE}"
echo ">> platform: ${IMAGE_PLATFORM}"
echo ">> tag: ${TAG}"
echo ">> mode: $([[ "$PUSH" == true ]] && echo push || echo local-only)"

if [[ -n "$RESULTS_FILE_OVERRIDE" ]]; then
  RESULTS_FILE="$RESULTS_FILE_OVERRIDE"
elif [[ "$PUSH" == true ]]; then
  RESULTS_FILE="$PUSH_RESULTS_FILE"
else
  RESULTS_FILE="$LOCAL_RESULTS_FILE"
fi
[[ "$RESULTS_FILE" = /* ]] || RESULTS_FILE="${PROJECT_ROOT}/${RESULTS_FILE}"

RESULTS_TEMP="${RESULTS_FILE}.tmp.$$"
cleanup() {
  rm -f "$RESULTS_TEMP"
}
trap cleanup EXIT

if [[ "$DRY_RUN" == false ]]; then
  mkdir -p "$(dirname "$RESULTS_FILE")"
  printf '{\n' > "$RESULTS_TEMP"
fi
FIRST_RESULT=true
BUILT_COUNT=0

for pair in "${AGENTS[@]}"; do
  NAME="${pair%%:*}"
  MODULE="${pair##*:}"
  [[ -z "$SELECTED_AGENT" || "$NAME" == "$SELECTED_AGENT" ]] || continue

  REPOSITORY="${ECR_REPOSITORY_PREFIX}${NAME}"
  [[ "$REPOSITORY" =~ ^[a-z0-9]+([._/-][a-z0-9]+)*$ ]] || fail "Invalid ECR repository name: ${REPOSITORY}"
  IMAGE_URI="${ECR_REGISTRY}/${REPOSITORY}:${TAG}"

  echo
  echo "====================================================================="
  echo ">> Building ${NAME} (module=${MODULE})"
  echo ">> Image ${IMAGE_URI}"
  echo "====================================================================="

  if [[ "$CONTAINER_ENGINE" == docker ]]; then
    BUILD_COMMAND=(
      docker buildx build
      --platform "$IMAGE_PLATFORM"
      --file "$DOCKERFILE"
      --tag "$IMAGE_URI"
      --build-arg "AWS_REGION=${AWS_REGION}"
      --build-arg "AGENT_MODULE=${MODULE}"
    )
    if [[ "$PUSH" == true ]]; then
      BUILD_COMMAND+=(--push)
    else
      BUILD_COMMAND+=(--load)
    fi
    BUILD_COMMAND+=("$PROJECT_ROOT")
    run_command "${BUILD_COMMAND[@]}"
  else
    BUILD_COMMAND=(
      finch build
      --platform "$IMAGE_PLATFORM"
      --file "$DOCKERFILE"
      --tag "$IMAGE_URI"
      --build-arg "AWS_REGION=${AWS_REGION}"
      --build-arg "AGENT_MODULE=${MODULE}"
      "$PROJECT_ROOT"
    )
    run_command "${BUILD_COMMAND[@]}"
    if [[ "$PUSH" == true ]]; then
      run_command finch push --platform "$IMAGE_PLATFORM" "$IMAGE_URI"
    fi
  fi

  if [[ "$DRY_RUN" == false ]]; then
    if [[ "$FIRST_RESULT" == false ]]; then
      printf ',\n' >> "$RESULTS_TEMP"
    fi
    FIRST_RESULT=false
    printf '  "%s": "%s"' "$NAME" "$IMAGE_URI" >> "$RESULTS_TEMP"
  fi
  BUILT_COUNT=$((BUILT_COUNT + 1))
  echo ">> $([[ "$PUSH" == true ]] && echo pushed || echo built) ${IMAGE_URI}"
done

if [[ "$DRY_RUN" == false ]]; then
  printf '\n}\n' >> "$RESULTS_TEMP"
  mv "$RESULTS_TEMP" "$RESULTS_FILE"
  echo
  echo "Results written to ${RESULTS_FILE}:"
  cat "$RESULTS_FILE"
else
  echo
  echo "Dry run complete; no images were built or pushed and no result file was written."
fi

echo ">> completed ${BUILT_COUNT} agent image(s)"
