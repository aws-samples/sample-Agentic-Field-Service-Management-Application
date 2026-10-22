#!/usr/bin/env bash
# Create the local configuration used by rebuild-agent-images.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CONFIG_FILE="${SCRIPT_DIR}/.agent-images.env"
CONFIG_FILE="$DEFAULT_CONFIG_FILE"
NON_INTERACTIVE=false
FORCE=false
ENGINE="${CONTAINER_ENGINE:-}"
PROFILE="${AWS_PROFILE:-}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
PLATFORM="${IMAGE_PLATFORM:-linux/arm64}"
REPOSITORY_PREFIX="${ECR_REPOSITORY_PREFIX:-bedrock-agentcore-}"
REGISTRY="${ECR_REGISTRY:-}"
TAG_SUFFIX="${IMAGE_TAG_SUFFIX:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/setup-agent-images.sh [options]

Interactively creates scripts/.agent-images.env for Docker or Finch builds.
The file stores settings only; AWS credentials remain in the configured AWS
profile or default credential chain.

Options:
  --config PATH                 Configuration file to create
  --engine docker|finch         Container engine
  --profile NAME                AWS CLI profile (empty uses default chain)
  --region REGION               AWS region for ECR and AgentCore
  --account-id 12_DIGITS        Expected AWS account safety guard
  --platform PLATFORM           Image platform (default: linux/arm64)
  --repository-prefix PREFIX    ECR repository prefix
  --registry HOST               Optional full ECR registry override
  --tag-suffix SUFFIX           Optional generated-tag suffix
  --non-interactive             Do not prompt; use options/defaults
  --force                       Replace an existing configuration
  -h, --help                    Show this help
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

prompt_value() {
  local label="$1"
  local default_value="$2"
  local value
  if [[ -n "$default_value" ]]; then
    read -r -p "${label} [${default_value}]: " value
    printf '%s' "${value:-$default_value}"
  else
    read -r -p "${label}: " value
    printf '%s' "$value"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) [[ $# -ge 2 ]] || fail "--config requires a value"; CONFIG_FILE="$2"; shift 2 ;;
    --engine) [[ $# -ge 2 ]] || fail "--engine requires a value"; ENGINE="$2"; shift 2 ;;
    --profile) [[ $# -ge 2 ]] || fail "--profile requires a value"; PROFILE="$2"; shift 2 ;;
    --region) [[ $# -ge 2 ]] || fail "--region requires a value"; REGION="$2"; shift 2 ;;
    --account-id) [[ $# -ge 2 ]] || fail "--account-id requires a value"; ACCOUNT_ID="$2"; shift 2 ;;
    --platform) [[ $# -ge 2 ]] || fail "--platform requires a value"; PLATFORM="$2"; shift 2 ;;
    --repository-prefix) [[ $# -ge 2 ]] || fail "--repository-prefix requires a value"; REPOSITORY_PREFIX="$2"; shift 2 ;;
    --registry) [[ $# -ge 2 ]] || fail "--registry requires a value"; REGISTRY="$2"; shift 2 ;;
    --tag-suffix) [[ $# -ge 2 ]] || fail "--tag-suffix requires a value"; TAG_SUFFIX="$2"; shift 2 ;;
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --force) FORCE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

if [[ -z "$ENGINE" ]]; then
  if command -v docker >/dev/null 2>&1; then
    ENGINE=docker
  elif command -v finch >/dev/null 2>&1; then
    ENGINE=finch
  else
    ENGINE=docker
  fi
fi

if [[ "$NON_INTERACTIVE" == false ]]; then
  ENGINE="$(prompt_value 'Container engine (docker or finch)' "$ENGINE")"
  PROFILE="$(prompt_value 'AWS CLI profile (leave empty for default credential chain)' "$PROFILE")"
fi

# Resolve the region only after interactive profile selection so the default
# comes from the credential context the user chose.
if [[ -z "$REGION" ]] && command -v aws >/dev/null 2>&1; then
  AWS_CONFIG_ARGS=()
  [[ -n "$PROFILE" ]] && AWS_CONFIG_ARGS+=(--profile "$PROFILE")
  REGION="$(aws "${AWS_CONFIG_ARGS[@]}" configure get region 2>/dev/null || true)"
fi
REGION="${REGION:-us-east-1}"

if [[ "$NON_INTERACTIVE" == false ]]; then
  REGION="$(prompt_value 'AWS region' "$REGION")"
  PLATFORM="$(prompt_value 'Image platform' "$PLATFORM")"
  REPOSITORY_PREFIX="$(prompt_value 'ECR repository prefix' "$REPOSITORY_PREFIX")"
fi

[[ "$ENGINE" == docker || "$ENGINE" == finch ]] || fail "Container engine must be docker or finch"
[[ -n "$REGION" && "$REGION" != *[[:space:]]* ]] || fail "AWS region must be non-empty and contain no spaces"
[[ -n "$PLATFORM" && "$PLATFORM" != *[[:space:]]* ]] || fail "Image platform must be non-empty and contain no spaces"
command -v "$ENGINE" >/dev/null 2>&1 || fail "${ENGINE} is not installed or not on PATH"

DETECTED_ACCOUNT=""
if command -v aws >/dev/null 2>&1; then
  AWS_ARGS=(--region "$REGION")
  [[ -n "$PROFILE" ]] && AWS_ARGS+=(--profile "$PROFILE")
  DETECTED_ACCOUNT="$(aws "${AWS_ARGS[@]}" sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  [[ "$DETECTED_ACCOUNT" =~ ^[0-9]{12}$ ]] || DETECTED_ACCOUNT=""
fi

if [[ "$NON_INTERACTIVE" == false ]]; then
  ACCOUNT_ID="$(prompt_value 'Expected AWS account ID (push safety guard)' "${ACCOUNT_ID:-$DETECTED_ACCOUNT}")"
  REGISTRY="$(prompt_value 'Full ECR registry override (normally empty)' "$REGISTRY")"
  TAG_SUFFIX="$(prompt_value 'Generated image tag suffix (optional)' "$TAG_SUFFIX")"
fi

[[ "$ACCOUNT_ID" =~ ^[0-9]{12}$ ]] || fail "A 12-digit --account-id is required; authenticate AWS CLI so setup can detect it, or provide it explicitly"
if [[ -n "$DETECTED_ACCOUNT" && "$DETECTED_ACCOUNT" != "$ACCOUNT_ID" ]]; then
  echo "WARNING: current AWS credentials resolve to ${DETECTED_ACCOUNT}, but the configured guard is ${ACCOUNT_ID}." >&2
  echo "Pushes will be blocked until the active credentials match." >&2
fi

if [[ -e "$CONFIG_FILE" && "$FORCE" == false ]]; then
  if [[ "$NON_INTERACTIVE" == true ]]; then
    fail "Configuration already exists: ${CONFIG_FILE} (use --force to replace it)"
  fi
  read -r -p "Replace ${CONFIG_FILE}? [y/N]: " replace
  [[ "$replace" == y || "$replace" == Y ]] || fail "Configuration was not changed"
fi

mkdir -p "$(dirname "$CONFIG_FILE")"
TEMP_FILE="${CONFIG_FILE}.tmp.$$"
trap 'rm -f "$TEMP_FILE"' EXIT
{
  echo "# Generated by scripts/setup-agent-images.sh"
  echo "# Contains settings only; do not add AWS credentials."
  printf 'CONTAINER_ENGINE=%q\n' "$ENGINE"
  printf 'AWS_PROFILE=%q\n' "$PROFILE"
  printf 'AWS_REGION=%q\n' "$REGION"
  printf 'AWS_ACCOUNT_ID=%q\n' "$ACCOUNT_ID"
  printf 'IMAGE_PLATFORM=%q\n' "$PLATFORM"
  printf 'ECR_REPOSITORY_PREFIX=%q\n' "$REPOSITORY_PREFIX"
  printf 'ECR_REGISTRY=%q\n' "$REGISTRY"
  printf 'IMAGE_TAG_SUFFIX=%q\n' "$TAG_SUFFIX"
  printf 'PUSH_RESULTS_FILE=%q\n' 'scripts/.rebuild-results.json'
  printf 'LOCAL_RESULTS_FILE=%q\n' 'scripts/.rebuild-results.local.json'
} > "$TEMP_FILE"
chmod 600 "$TEMP_FILE"
mv "$TEMP_FILE" "$CONFIG_FILE"
trap - EXIT

echo "Created ${CONFIG_FILE}"
echo "  engine:  ${ENGINE}"
echo "  profile: ${PROFILE:-default credential chain}"
echo "  account: ${ACCOUNT_ID}"
echo "  region:  ${REGION}"
echo "  platform: ${PLATFORM}"
echo
printf 'Validate locally without pushing:\n  %q --config %q --agent fsm_billing_invoicing_agent --no-push\n' \
  "${SCRIPT_DIR}/rebuild-agent-images.sh" "$CONFIG_FILE"
