#!/usr/bin/env bash
# Exercise Lambda packaging guards and uploads without contacting AWS or npm.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PACKAGE_SCRIPT="${PROJECT_ROOT}/scripts/package-lambda-functions.sh"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/fsm-lambda-package-test.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT
FAKE_BIN="${TEST_ROOT}/bin"
CALL_LOG="${TEST_ROOT}/calls.log"
mkdir -p "$FAKE_BIN"
: > "$CALL_LOG"
export CALL_LOG

fail() { echo "FAIL: $*" >&2; exit 1; }
assert_contains() { grep -F -- "$2" "$1" >/dev/null || fail "Expected '$2' in $1"; }

cat > "${FAKE_BIN}/aws" <<'EOF'
#!/usr/bin/env bash
printf 'aws %s\n' "$*" >> "$CALL_LOG"
if [[ "$*" == *" sts get-caller-identity "* ]]; then
  printf '%s\n' "${FAKE_ACCOUNT:-123456789012}"
elif [[ "$*" == *" s3api head-bucket "* ]]; then
  exit 0
elif [[ "$*" == *" s3 cp "* ]]; then
  exit 0
else
  echo "unexpected AWS call: $*" >&2
  exit 89
fi
EOF
cat > "${FAKE_BIN}/npm" <<'EOF'
#!/usr/bin/env bash
printf 'npm %s cwd=%s\n' "$*" "$PWD" >> "$CALL_LOG"
grep -F '"aws-sdk": "2.1692.0"' package.json >/dev/null
python3 -I -c 'import json,sys; json.load(open("package.json"))' || exit 1
if grep -qF '"aws-jwt-verify"' package.json; then printf 'jwt-verify-dep cwd=%s %s\n' "$PWD" "$(tr -d '\n' < package.json)" >> "$CALL_LOG"; fi
mkdir -p node_modules/aws-sdk
printf '{"name":"aws-sdk","version":"2.1692.0"}\n' > node_modules/aws-sdk/package.json
EOF
chmod +x "${FAKE_BIN}/aws" "${FAKE_BIN}/npm"
export PATH="${FAKE_BIN}:${PATH}"

ARGS=(
  --region us-east-1
  --environment prod
  --expected-account 123456789012
  --bucket fsm-lambda-code-123456789012-us-east-1-prod-cfn
)

if "$PACKAGE_SCRIPT" "${ARGS[@]}" >"${TEST_ROOT}/missing-confirm.log" 2>&1; then
  fail "Production upload without confirmation unexpectedly succeeded"
fi
assert_contains "${TEST_ROOT}/missing-confirm.log" "requires --confirm DEPLOY-FSM-PROD"
ARGS+=(--confirm DEPLOY-FSM-PROD)

export FAKE_ACCOUNT=999999999999
if "$PACKAGE_SCRIPT" "${ARGS[@]}" >"${TEST_ROOT}/mismatch.log" 2>&1; then
  fail "Mismatched account unexpectedly succeeded"
fi
assert_contains "${TEST_ROOT}/mismatch.log" "does not match expected account"

: > "$CALL_LOG"
export FAKE_ACCOUNT=123456789012
"$PACKAGE_SCRIPT" "${ARGS[@]}" >"${TEST_ROOT}/success.log"
[[ "$(grep -c '^npm install ' "$CALL_LOG")" -eq 13 ]] || fail "Expected 13 isolated npm installs"
[[ "$(grep -c ' s3 cp .*s3://fsm-lambda-code-123456789012-us-east-1-prod-cfn/lambda/' "$CALL_LOG")" -eq 13 ]] || \
  fail "Expected 13 Lambda package uploads"
# aws-jwt-verify is pinned and bundled only into the WebSocket authorizer.
[[ "$(grep -c '^jwt-verify-dep ' "$CALL_LOG")" -eq 1 ]] || fail "Expected aws-jwt-verify in exactly one package"
grep '^jwt-verify-dep ' "$CALL_LOG" | grep -F '/websocketAuthorizer ' | grep -qF '"aws-jwt-verify": "5.2.1"' || \
  fail "aws-jwt-verify must be pinned to 5.2.1 in the websocketAuthorizer package only"
assert_contains "${TEST_ROOT}/success.log" "Packaged and uploaded all Lambda functions"

echo "PASS: Lambda packaging account guard, pinned dependencies, and 13 upload paths"
