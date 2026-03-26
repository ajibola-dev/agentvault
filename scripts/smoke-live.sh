#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <base-url>"
  echo "Example: $0 https://agentvault-ecru.vercel.app"
  exit 1
fi

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

check_status() {
  local path="$1"
  local method="${2:-GET}"
  local expected="$3"
  local body="${4:-}"

  local code
  if [[ -n "$body" ]]; then
    code="$(curl -sS -o /tmp/smoke_body.txt -w "%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      --data "$body")"
  else
    code="$(curl -sS -o /tmp/smoke_body.txt -w "%{http_code}" -X "$method" "$BASE_URL$path")"
  fi

  if [[ "$code" == "$expected" ]]; then
    pass "$method $path => $code"
  else
    echo "Response body:"
    cat /tmp/smoke_body.txt || true
    fail "$method $path expected $expected got $code"
  fi
}

echo "Running smoke tests against: $BASE_URL"

check_status "/api/get-tasks" "GET" "200"
check_status "/api/get-agents" "GET" "200"
check_status "/api/auth/session" "GET" "200"
check_status "/api/post-task" "POST" "401" '{"title":"x","description":"y","reward":"1"}'
check_status "/api/assign-task" "POST" "401" '{"taskId":"x","agentId":"y"}'
check_status "/api/update-task-status" "POST" "401" '{"taskId":"x","status":"in_progress"}'
check_status "/api/audit-logs" "GET" "401"
check_status "/api/register-agent" "POST" "401"
check_status "/api/auth/nonce" "POST" "200" '{"address":"0x1111111111111111111111111111111111111111"}'

echo "Smoke test suite completed successfully."
