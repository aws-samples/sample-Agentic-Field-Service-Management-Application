#!/usr/bin/env bash
# Package and upload FSM Lambda functions using an explicit AWS safety guard.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LAMBDA_DIR="${PROJECT_ROOT}/lambda"
AWS_SDK_VERSION="2.1692.0"
AWS_JWT_VERIFY_VERSION="5.2.1"
NPM_REGISTRY="${FSM_NPM_REGISTRY:-https://registry.npmjs.org/}"
REGION=""
ENVIRONMENT=""
EXPECTED_ACCOUNT=""
CONFIRM=""
AWS_PROFILE=""
LAMBDA_BUCKET=""
LAMBDA_CODE_PREFIX="lambda"

usage() {
  cat <<'EOF'
Usage: scripts/package-lambda-functions.sh --region REGION --environment ENV \
  --expected-account ACCOUNT_ID --bucket BUCKET [--prefix lambda/RELEASE_ID] \
  [--profile PROFILE] [--confirm DEPLOY-FSM-PROD]
EOF
}

fail() { echo "ERROR: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) [[ $# -ge 2 ]] || fail "--region requires a value"; REGION="$2"; shift 2 ;;
    --environment) [[ $# -ge 2 ]] || fail "--environment requires a value"; ENVIRONMENT="$2"; shift 2 ;;
    --expected-account) [[ $# -ge 2 ]] || fail "--expected-account requires a value"; EXPECTED_ACCOUNT="$2"; shift 2 ;;
    --profile) [[ $# -ge 2 ]] || fail "--profile requires a value"; AWS_PROFILE="$2"; shift 2 ;;
    --confirm) [[ $# -ge 2 ]] || fail "--confirm requires a value"; CONFIRM="$2"; shift 2 ;;
    --bucket) [[ $# -ge 2 ]] || fail "--bucket requires a value"; LAMBDA_BUCKET="$2"; shift 2 ;;
    --prefix) [[ $# -ge 2 ]] || fail "--prefix requires a value"; LAMBDA_CODE_PREFIX="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[[ "$EXPECTED_ACCOUNT" =~ ^[0-9]{12}$ ]] || fail "--expected-account must contain exactly 12 digits"
[[ "$REGION" =~ ^[a-z]{2}(-gov)?-[a-z]+-[0-9]$ ]] || fail "Invalid AWS region: ${REGION}"
[[ "$ENVIRONMENT" == dev || "$ENVIRONMENT" == test || "$ENVIRONMENT" == prod ]] || fail "Environment must be dev, test, or prod"
if [[ "$ENVIRONMENT" == prod && "$CONFIRM" != "DEPLOY-FSM-PROD" ]]; then
  fail "Production Lambda upload requires --confirm DEPLOY-FSM-PROD"
fi
[[ -n "$LAMBDA_BUCKET" ]] || fail "--bucket is required"
[[ "$LAMBDA_CODE_PREFIX" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || fail "--prefix must be a valid S3 key prefix"
command -v aws >/dev/null 2>&1 || fail "AWS CLI is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
command -v zip >/dev/null 2>&1 || fail "zip is required"

AWS_ARGS=(--region "$REGION")
[[ -n "$AWS_PROFILE" ]] && AWS_ARGS+=(--profile "$AWS_PROFILE")
ACTUAL_ACCOUNT="$(aws "${AWS_ARGS[@]}" sts get-caller-identity --query Account --output text)"
[[ "$ACTUAL_ACCOUNT" == "$EXPECTED_ACCOUNT" ]] || fail "Active AWS account ${ACTUAL_ACCOUNT} does not match expected account ${EXPECTED_ACCOUNT}"
EXPECTED_BUCKET="fsm-lambda-code-${EXPECTED_ACCOUNT}-${REGION}-${ENVIRONMENT}-cfn"
[[ "$LAMBDA_BUCKET" == "$EXPECTED_BUCKET" ]] || fail "Lambda bucket must be ${EXPECTED_BUCKET}"
aws "${AWS_ARGS[@]}" s3api head-bucket --bucket "$LAMBDA_BUCKET" >/dev/null

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fsm-lambda-package.XXXXXX")"
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

package_lambda() {
  local function_name="$1"
  local handler_file="$2"
  local output_file="$3"
  local handler_name="${4:-$(basename "$handler_file")}"
  local include_cfn_response="${5:-false}"
  local additional_files="${6:-}"
  local extra_dependencies="${7:-}"
  local package_dir="${TEMP_DIR}/${function_name}"

  [[ -f "$handler_file" ]] || fail "Handler not found: ${handler_file}"
  mkdir -p "${package_dir}/wrapper"
  cp "$handler_file" "${package_dir}/${handler_name}"
  cp "${LAMBDA_DIR}/wrapper/cors-wrapper.js" "${package_dir}/wrapper/"

  local additional
  for additional in $additional_files; do
    [[ -f "${LAMBDA_DIR}/${additional}" ]] || fail "Additional Lambda file not found: ${additional}"
    cp "${LAMBDA_DIR}/${additional}" "${package_dir}/"
  done
  if [[ "$include_cfn_response" == true ]]; then
    cp "${LAMBDA_DIR}/cfn-response.js" "${package_dir}/"
  fi

  cat > "${package_dir}/package.json" <<EOF
{
  "name": "${function_name}",
  "version": "1.0.0",
  "private": true,
  "main": "${handler_name}",
  "dependencies": { "aws-sdk": "${AWS_SDK_VERSION}"${extra_dependencies:+, ${extra_dependencies}} }
}
EOF

  (
    cd "$package_dir"
    if ! npm install --omit=dev --ignore-scripts --no-audit --no-fund \
      --registry="$NPM_REGISTRY" --loglevel=error; then
      fail "npm dependency install failed for ${function_name} using registry ${NPM_REGISTRY}"
    fi
    if ! zip -q -r "${TEMP_DIR}/${output_file}" .; then
      fail "ZIP creation failed for ${function_name}"
    fi
  )
  if ! aws "${AWS_ARGS[@]}" s3 cp "${TEMP_DIR}/${output_file}" "s3://${LAMBDA_BUCKET}/${LAMBDA_CODE_PREFIX}/${output_file}" --only-show-errors; then
    fail "Upload failed for ${function_name} to s3://${LAMBDA_BUCKET}/lambda/${output_file}"
  fi
  echo ">> Uploaded ${output_file}"
}

package_lambda customerFunction "${LAMBDA_DIR}/customerFunction.js" customerFunction.zip
package_lambda jobFunction "${LAMBDA_DIR}/jobFunction.js" jobFunction.zip
package_lambda technicianFunction "${LAMBDA_DIR}/technicianFunction.js" technicianFunction.zip
package_lambda invoiceFunction "${LAMBDA_DIR}/invoiceFunction.js" invoiceFunction.zip
package_lambda metricsFunction "${LAMBDA_DIR}/metricsFunction.js" metricsFunction.zip
package_lambda partsFunction "${LAMBDA_DIR}/partsFunction.js" partsFunction.zip
package_lambda websocketHandler "${LAMBDA_DIR}/websocketHandler.js" websocketHandler.zip
package_lambda websocketAuthorizer "${LAMBDA_DIR}/websocketAuthorizer.js" websocketAuthorizer.zip websocketAuthorizer.js false "" "\"aws-jwt-verify\": \"${AWS_JWT_VERIFY_VERSION}\""
package_lambda dataPopulationFunction "${LAMBDA_DIR}/dataPopulation.js" dataPopulation.zip index.js true
package_lambda agentsApiHandler "${LAMBDA_DIR}/agentsApiHandler.js" agentsApiHandler.zip
package_lambda simulatorControlFunction "${LAMBDA_DIR}/simulatorControlFunction.js" simulatorControlFunction.zip
package_lambda metricsSimulatorFunction "${LAMBDA_DIR}/metricsSimulatorFunction.js" metricsSimulatorFunction.zip metricsSimulatorFunction.js false websocketHandler.js
package_lambda dynamoStreamHandler "${LAMBDA_DIR}/dynamoStreamHandler.js" dynamoStreamHandler.zip dynamoStreamHandler.js false websocketHandler.js

echo ">> Packaged and uploaded all Lambda functions to s3://${LAMBDA_BUCKET}/${LAMBDA_CODE_PREFIX}/"
