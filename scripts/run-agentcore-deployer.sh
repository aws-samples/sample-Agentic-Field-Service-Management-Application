#!/usr/bin/env bash
# Run the pinned AgentCore control-plane deployer in an isolated virtual environment.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv-agentcore-deploy"
PYTHON_BIN="${PYTHON_BIN:-python3}"
REQUIREMENTS="${SCRIPT_DIR}/requirements-agentcore-deploy.txt"

command -v "$PYTHON_BIN" >/dev/null 2>&1 || {
  echo "ERROR: ${PYTHON_BIN} is not installed or not on PATH" >&2
  exit 1
}

if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

"${VENV_DIR}/bin/python" -m pip install --disable-pip-version-check --quiet -r "$REQUIREMENTS"
cd "$PROJECT_ROOT"
exec "${VENV_DIR}/bin/python" "${SCRIPT_DIR}/deploy-agentcore-agents.py" "$@"
