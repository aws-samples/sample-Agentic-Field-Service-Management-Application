#!/usr/bin/env bash
# Validate deploy-stack.sh safety guards and frontend environment generation without AWS writes.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_SCRIPT="${PROJECT_ROOT}/deploy-stack.sh"
MAIN_TEMPLATE="${PROJECT_ROOT}/fsm-deployment-main.yaml"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/fsm-deploy-stack-test.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
assert_contains() {
  grep -F -- "$2" "$1" >/dev/null || fail "Expected '$2' in $1"
}
assert_not_contains() {
  if grep -F -- "$2" "$1" >/dev/null; then
    fail "Did not expect '$2' in $1"
  fi
}
expect_failure() {
  local expected="$1"
  shift
  local output="${TEST_ROOT}/failure-$RANDOM.log"
  if "$@" >"$output" 2>&1; then
    fail "Command unexpectedly succeeded: $*"
  fi
  assert_contains "$output" "$expected"
}

expect_failure "--region must be a valid AWS region" "$DEPLOY_SCRIPT"
expect_failure "Production deployment requires --confirm DEPLOY-FSM-PROD" \
  "$DEPLOY_SCRIPT" --region us-east-1 --environment prod --expected-account 123456789012 \
  --admin-email owner@example.org --engine docker --preflight-only
expect_failure "Refusing placeholder administrator email" \
  "$DEPLOY_SCRIPT" --region us-east-1 --environment dev --expected-account 123456789012 \
  --admin-email admin@example.com --engine docker --preflight-only
expect_failure "Deletion confirmation is not valid for deployment" \
  "$DEPLOY_SCRIPT" --region us-east-1 --environment prod --expected-account 123456789012 \
  --admin-email owner@example.org --engine docker --confirm "DELETE FSM PROD WITHOUT BACKUP" --preflight-only

FAKE_BIN="${TEST_ROOT}/bin"
CALL_LOG="${TEST_ROOT}/calls.log"
mkdir -p "$FAKE_BIN"
: > "$CALL_LOG"
export CALL_LOG
cat > "${FAKE_BIN}/aws" <<'EOF'
#!/usr/bin/env bash
printf 'aws %s\n' "$*" >> "$CALL_LOG"
if [[ "$*" == *" sts get-caller-identity "* && "$*" == *" --query Account "* ]]; then
  printf '%s\n' "${FAKE_ACCOUNT:-123456789012}"
elif [[ "$*" == *" sts get-caller-identity "* && "$*" == *" --query Arn "* ]]; then
  printf 'arn:aws:iam::%s:user/test\n' "${FAKE_ACCOUNT:-123456789012}"
elif [[ "$*" == *" cloudformation validate-template "* ]]; then
  printf '{}\n'
else
  echo "unexpected fake AWS call: $*" >&2
  exit 88
fi
EOF
cat > "${FAKE_BIN}/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "$CALL_LOG"
case "$*" in
  info|"buildx version") exit 0 ;;
  *) exit 87 ;;
esac
EOF
chmod +x "${FAKE_BIN}/aws" "${FAKE_BIN}/docker"

BASE_ARGS=(
  --region us-east-1
  --environment prod
  --expected-account 123456789012
  --admin-email owner@example.org
  --engine docker
  --confirm DEPLOY-FSM-PROD
  --preflight-only
)

export PATH="${FAKE_BIN}:${PATH}"
export FAKE_ACCOUNT=999999999999
expect_failure "does not match expected account" "$DEPLOY_SCRIPT" "${BASE_ARGS[@]}"

: > "$CALL_LOG"
export FAKE_ACCOUNT=123456789012
PREFLIGHT_OUTPUT="${TEST_ROOT}/preflight.log"
"$DEPLOY_SCRIPT" "${BASE_ARGS[@]}" >"$PREFLIGHT_OUTPUT"
assert_contains "$PREFLIGHT_OUTPUT" "PASS: preflight completed without AWS writes"
assert_contains "$CALL_LOG" "docker info"
assert_contains "$CALL_LOG" "docker buildx version"
assert_contains "$CALL_LOG" "cloudformation validate-template"
assert_not_contains "$CALL_LOG" "create-"
assert_not_contains "$CALL_LOG" "put-"
assert_not_contains "$CALL_LOG" "update-"
assert_not_contains "$CALL_LOG" "delete-"
assert_not_contains "$CALL_LOG" " deploy "
assert_not_contains "$CALL_LOG" " s3 cp "
assert_not_contains "$CALL_LOG" " s3 sync "

FRONTEND_ENV="${TEST_ROOT}/frontend.env"
FSM_DEPLOY_LIBRARY_ONLY=true source "$DEPLOY_SCRIPT"
write_frontend_env "$FRONTEND_ENV" \
  REACT_APP_AWS_REGION us-east-1 \
  REACT_APP_APP_URL https://example.cloudfront.net \
  REACT_APP_SAMPLE_VALUE 'value/with+special=chars'
# shellcheck disable=SC1090
source "$FRONTEND_ENV"
[[ "$REACT_APP_AWS_REGION" == us-east-1 ]] || fail "Region was not preserved"
[[ "$REACT_APP_APP_URL" == https://example.cloudfront.net ]] || fail "App URL was not preserved"
[[ "$REACT_APP_SAMPLE_VALUE" == 'value/with+special=chars' ]] || fail "Special characters were not safely preserved"

assert_contains "$MAIN_TEMPLATE" "TemplatePrefix:"
assert_contains "$MAIN_TEMPLATE" "\${TemplatePrefix}/fsm-dynamodb.yaml"
assert_contains "$MAIN_TEMPLATE" "\${TemplatePrefix}/fsm-lambda.yaml"
assert_contains "$MAIN_TEMPLATE" "\${TemplatePrefix}/fsm-api.yaml"
assert_contains "$MAIN_TEMPLATE" "\${TemplatePrefix}/fsm-realtime.yaml"
assert_contains "$MAIN_TEMPLATE" "\${TemplatePrefix}/fsm-data-population.yaml"

# P0 auth: every deploy publishes a new REST deployment, ships no API key,
# and smoke-tests that anonymous API calls are rejected.
assert_contains "$DEPLOY_SCRIPT" "apigateway create-deployment --rest-api-id"
assert_contains "$DEPLOY_SCRIPT" '"FSM customers API without a token" 401'
assert_not_contains "$DEPLOY_SCRIPT" "REACT_APP_API_KEY"
assert_not_contains "$DEPLOY_SCRIPT" "get-api-key"
assert_not_contains "$DEPLOY_SCRIPT" "delete-stack"
assert_not_contains "$DEPLOY_SCRIPT" "sed -i"
assert_not_contains "$DEPLOY_SCRIPT" "pip3 install"
assert_not_contains "$DEPLOY_SCRIPT" 'TEMP_PASSWORD='
assert_not_contains "$DEPLOY_SCRIPT" 's3 sync build/ s3://'
assert_not_contains "$DEPLOY_SCRIPT" 'sync "${PROJECT_ROOT}/build/" "s3://${REACT_APP_BUCKET}/" --delete'

echo "PASS: deploy-stack guards, read-only preflight, versioned templates, and frontend environment generation"
