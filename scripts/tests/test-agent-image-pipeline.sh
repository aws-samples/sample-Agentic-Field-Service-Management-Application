#!/usr/bin/env bash
# Exercise Docker and Finch command paths without contacting AWS or a registry.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REBUILD_SCRIPT="${PROJECT_ROOT}/scripts/rebuild-agent-images.sh"
SETUP_SCRIPT="${PROJECT_ROOT}/scripts/setup-agent-images.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/fsm-agent-image-test.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

FAKE_BIN="${TEST_ROOT}/bin"
CALL_LOG="${TEST_ROOT}/calls.log"
mkdir -p "$FAKE_BIN"
: > "$CALL_LOG"
export CALL_LOG

cat > "${FAKE_BIN}/aws" <<'EOF'
#!/usr/bin/env bash
printf 'aws %s\n' "$*" >> "$CALL_LOG"
case " $* " in
  *" sts get-caller-identity "*) printf '123456789012\n' ;;
  *" ecr get-login-password "*) printf 'test-password\n' ;;
  *" ecr describe-repositories "*)
    if [[ -n "${FAKE_REPOSITORY_MUTABILITY:-}" ]]; then
      printf '%s\n' "$FAKE_REPOSITORY_MUTABILITY"
    else
      exit 254
    fi
    ;;
  *) exit 0 ;;
esac
EOF

cat > "${FAKE_BIN}/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "$CALL_LOG"
if [[ "${1:-}" == login ]]; then
  cat >/dev/null
fi
EOF

cat > "${FAKE_BIN}/finch" <<'EOF'
#!/usr/bin/env bash
printf 'finch %s\n' "$*" >> "$CALL_LOG"
if [[ "${1:-}" == login ]]; then
  cat >/dev/null
fi
EOF
chmod +x "${FAKE_BIN}/aws" "${FAKE_BIN}/docker" "${FAKE_BIN}/finch"
export PATH="${FAKE_BIN}:${PATH}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"
  grep -F -- "$expected" "$file" >/dev/null || fail "Expected '${expected}' in ${file}"
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"
  if grep -F -- "$unexpected" "$file" >/dev/null; then
    fail "Did not expect '${unexpected}' in ${file}"
  fi
}

write_config() {
  local engine="$1"
  local path="$2"
  local push_results="$3"
  local local_results="$4"
  local account_id="${5-123456789012}"
  local registry="${6-}"
  cat > "$path" <<EOF
CONTAINER_ENGINE=${engine}
AWS_PROFILE=test-profile
AWS_REGION=us-west-2
AWS_ACCOUNT_ID=${account_id}
IMAGE_PLATFORM=linux/arm64
ECR_REPOSITORY_PREFIX=bedrock-agentcore-
ECR_REGISTRY=${registry}
IMAGE_TAG_SUFFIX=
PUSH_RESULTS_FILE=${push_results}
LOCAL_RESULTS_FILE=${local_results}
EOF
}

DOCKER_CONFIG="${TEST_ROOT}/docker.env"
DOCKER_RESULTS="${TEST_ROOT}/docker-results.json"
DOCKER_LOCAL_RESULTS="${TEST_ROOT}/docker-local-results.json"
write_config docker "$DOCKER_CONFIG" "$DOCKER_RESULTS" "$DOCKER_LOCAL_RESULTS"

"$REBUILD_SCRIPT" --config "$DOCKER_CONFIG" \
  --agent fsm_billing_invoicing_agent --tag test-docker
assert_contains "$CALL_LOG" "aws --region us-west-2 --profile test-profile sts get-caller-identity"
assert_contains "$CALL_LOG" "ecr describe-repositories --repository-names bedrock-agentcore-fsm_billing_invoicing_agent"
assert_contains "$CALL_LOG" "ecr create-repository --repository-name bedrock-agentcore-fsm_billing_invoicing_agent"
assert_contains "$CALL_LOG" "--image-tag-mutability IMMUTABLE"
assert_contains "$CALL_LOG" "docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-west-2.amazonaws.com"
assert_contains "$CALL_LOG" "docker buildx build"
assert_contains "$CALL_LOG" "--build-arg AGENT_MODULE=agents.billing_invoicing_agent"
assert_contains "$CALL_LOG" "--push"
assert_contains "$DOCKER_RESULTS" '"fsm_billing_invoicing_agent": "123456789012.dkr.ecr.us-west-2.amazonaws.com/bedrock-agentcore-fsm_billing_invoicing_agent:test-docker"'

: > "$CALL_LOG"
export FAKE_REPOSITORY_MUTABILITY=MUTABLE
if "$REBUILD_SCRIPT" --config "$DOCKER_CONFIG" \
  --agent fsm_billing_invoicing_agent --tag existing-mutable >"${TEST_ROOT}/mutable.log" 2>&1; then
  fail "Existing mutable ECR repository unexpectedly succeeded"
fi
assert_contains "${TEST_ROOT}/mutable.log" "must use IMMUTABLE image tags"
assert_not_contains "$CALL_LOG" "ecr get-login-password"
assert_not_contains "$CALL_LOG" "docker buildx build"
unset FAKE_REPOSITORY_MUTABILITY

: > "$CALL_LOG"
"$REBUILD_SCRIPT" --config "$DOCKER_CONFIG" \
  --agent fsm_billing_invoicing_agent --tag test-local --no-push
assert_contains "$CALL_LOG" "docker buildx build"
assert_contains "$CALL_LOG" "--load"
assert_not_contains "$CALL_LOG" "aws "
assert_not_contains "$CALL_LOG" "docker login"
assert_contains "$DOCKER_LOCAL_RESULTS" 'test-local'

FINCH_CONFIG="${TEST_ROOT}/finch.env"
FINCH_RESULTS="${TEST_ROOT}/finch-results.json"
FINCH_LOCAL_RESULTS="${TEST_ROOT}/finch-local-results.json"
write_config finch "$FINCH_CONFIG" "$FINCH_RESULTS" "$FINCH_LOCAL_RESULTS"

: > "$CALL_LOG"
"$REBUILD_SCRIPT" --config "$FINCH_CONFIG" \
  --agent fsm_orchestrator_agent --tag test-finch
assert_contains "$CALL_LOG" "finch login --username AWS --password-stdin 123456789012.dkr.ecr.us-west-2.amazonaws.com"
assert_contains "$CALL_LOG" "finch build --platform linux/arm64"
assert_contains "$CALL_LOG" "--build-arg AGENT_MODULE=agents.orchestrator_agent"
assert_contains "$CALL_LOG" "finch push --platform linux/arm64 123456789012.dkr.ecr.us-west-2.amazonaws.com/bedrock-agentcore-fsm_orchestrator_agent:test-finch"
assert_contains "$FINCH_RESULTS" 'test-finch'

MISSING_GUARD_CONFIG="${TEST_ROOT}/missing-guard.env"
write_config docker "$MISSING_GUARD_CONFIG" "${TEST_ROOT}/missing-guard-push.json" \
  "${TEST_ROOT}/missing-guard-local.json" ""
: > "$CALL_LOG"
if "$REBUILD_SCRIPT" --config "$MISSING_GUARD_CONFIG" \
  --agent fsm_billing_invoicing_agent --tag missing-guard >"${TEST_ROOT}/missing-guard.log" 2>&1; then
  fail "Push without an expected account guard should have failed"
fi
assert_contains "${TEST_ROOT}/missing-guard.log" "expected AWS account safety guard is required"
assert_not_contains "$CALL_LOG" "aws "

MISMATCHED_REGISTRY_CONFIG="${TEST_ROOT}/mismatched-registry.env"
write_config docker "$MISMATCHED_REGISTRY_CONFIG" "${TEST_ROOT}/mismatch-push.json" \
  "${TEST_ROOT}/mismatch-local.json" "123456789012" "example.invalid"
: > "$CALL_LOG"
if "$REBUILD_SCRIPT" --config "$MISMATCHED_REGISTRY_CONFIG" \
  --agent fsm_billing_invoicing_agent --tag mismatched-registry >"${TEST_ROOT}/mismatched-registry.log" 2>&1; then
  fail "Push to a registry outside the configured account and region should have failed"
fi
assert_contains "${TEST_ROOT}/mismatched-registry.log" "ECR registry must match configured account and region"
assert_not_contains "$CALL_LOG" "get-login-password"
assert_not_contains "$CALL_LOG" "login"

SETUP_CONFIG="${TEST_ROOT}/setup.env"
"$SETUP_SCRIPT" --non-interactive --force --config "$SETUP_CONFIG" \
  --engine finch --profile test-profile --region eu-west-1 \
  --account-id 123456789012 --platform linux/arm64 \
  --repository-prefix custom-agent- --tag-suffix ci >/dev/null
assert_contains "$SETUP_CONFIG" 'CONTAINER_ENGINE=finch'
assert_contains "$SETUP_CONFIG" 'AWS_PROFILE=test-profile'
assert_contains "$SETUP_CONFIG" 'AWS_REGION=eu-west-1'
assert_contains "$SETUP_CONFIG" 'AWS_ACCOUNT_ID=123456789012'
assert_contains "$SETUP_CONFIG" 'ECR_REPOSITORY_PREFIX=custom-agent-'

if "$REBUILD_SCRIPT" --config "$DOCKER_CONFIG" --agent not-an-agent --dry-run >/dev/null 2>&1; then
  fail "Unknown agent should have failed validation"
fi

echo "PASS: Docker, Finch, local-only, setup, and validation paths"
