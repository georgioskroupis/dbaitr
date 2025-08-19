#!/usr/bin/env bash
set -euo pipefail

# Ensure we cleanup spawned processes on exit (Ctrl+C)
INF_PID=""; NEXT_PID=""
cleanup() {
  echo "\n==> Shutting down services..."
  if [ -n "$NEXT_PID" ] && kill -0 "$NEXT_PID" 2>/dev/null; then kill "$NEXT_PID" 2>/dev/null || true; fi
  if [ -f /tmp/dbaitr-next.pid ]; then kill "$(cat /tmp/dbaitr-next.pid)" 2>/dev/null || true; rm -f /tmp/dbaitr-next.pid; fi
  if [ -n "$INF_PID" ] && kill -0 "$INF_PID" 2>/dev/null; then kill "$INF_PID" 2>/dev/null || true; fi
  if [ -f /tmp/dbaitr-sentiment.pid ]; then kill "$(cat /tmp/dbaitr-sentiment.pid)" 2>/dev/null || true; rm -f /tmp/dbaitr-sentiment.pid; fi
  echo "==> Done"
}
trap cleanup EXIT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "==> dbaitr bootstrap starting"

ensure_env() {
  local key="$1"; local val="$2";
  if [ -f .env.local ]; then
    if grep -q "^${key}=" .env.local; then
      # macOS/BSD sed compatibility
      sed -i.bak "s#^${key}=.*#${key}=${val//#/\\#}#" .env.local && rm -f .env.local.bak
    else
      printf "\n%s=%s\n" "$key" "$val" >> .env.local
    fi
  else
    printf "%s=%s\n" "$key" "$val" > .env.local
  fi
}

echo "==> Preparing .env.local"
if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
fi

# Required app URL for background API calls
ensure_env NEXT_PUBLIC_APP_URL "http://localhost:9002"

# Inference service URL (adjust if you run the service elsewhere)
ensure_env SENTIMENT_INFERENCE_URL "http://localhost:8000/"

# Service account handling: prefer env FIREBASE_SERVICE_ACCOUNT, then FIREBASE_SERVICE_ACCOUNT_FILE, then .secrets/serviceAccount.json
ensure_sa() {
  if grep -q '^FIREBASE_SERVICE_ACCOUNT=' .env.local 2>/dev/null && [ -n "$(grep '^FIREBASE_SERVICE_ACCOUNT=' .env.local | cut -d= -f2-)" ]; then
    echo "==> FIREBASE_SERVICE_ACCOUNT already set in .env.local"
    return
  fi
  if [ -n "${FIREBASE_SERVICE_ACCOUNT:-}" ]; then
    ensure_env FIREBASE_SERVICE_ACCOUNT "${FIREBASE_SERVICE_ACCOUNT}"
    echo "==> FIREBASE_SERVICE_ACCOUNT set from environment"
    return
  fi
  if [ -n "${FIREBASE_SERVICE_ACCOUNT_FILE:-}" ] && [ -f "${FIREBASE_SERVICE_ACCOUNT_FILE}" ]; then
    SA_JSON=$(tr -d '\n' < "${FIREBASE_SERVICE_ACCOUNT_FILE}" | sed 's/\r//g')
    ensure_env FIREBASE_SERVICE_ACCOUNT "$SA_JSON"
    echo "==> FIREBASE_SERVICE_ACCOUNT set from FIREBASE_SERVICE_ACCOUNT_FILE=${FIREBASE_SERVICE_ACCOUNT_FILE}"
    return
  fi
  if [ -f .secrets/serviceAccount.json ]; then
    SA_JSON=$(tr -d '\n' < .secrets/serviceAccount.json | sed 's/\r//g')
    ensure_env FIREBASE_SERVICE_ACCOUNT "$SA_JSON"
    echo "==> FIREBASE_SERVICE_ACCOUNT set from .secrets/serviceAccount.json"
    return
  fi
  echo "==> FIREBASE_SERVICE_ACCOUNT not found. Create ./.secrets/serviceAccount.json or set FIREBASE_SERVICE_ACCOUNT(_FILE)."
  if ! grep -q '^FIREBASE_SERVICE_ACCOUNT=' .env.local; then echo "FIREBASE_SERVICE_ACCOUNT=" >> .env.local; fi
}

ensure_sa

echo "==> .env.local summary:"
grep -E '^(NEXT_PUBLIC_APP_URL|SENTIMENT_INFERENCE_URL|NEXT_PUBLIC_FIREBASE_|FIREBASE_SERVICE_ACCOUNT=)' .env.local | sed 's#\(FIREBASE_SERVICE_ACCOUNT=\).*#\1[REDACTED]#'

# Start inference service (Python) using a local venv
echo "==> Starting inference service (FastAPI + Transformers)"
if command -v python3 >/dev/null 2>&1; then
  pushd services/sentiment >/dev/null
  PYBIN="python3"
  if [ ! -d .venv ]; then
    "$PYBIN" -m venv .venv
  fi
  . .venv/bin/activate
  pip install --quiet --upgrade pip >/dev/null
  pip install --quiet -r requirements.txt || { echo "pip install failed"; exit 1; }
  # If already running, stop
  if [ -f /tmp/dbaitr-sentiment.pid ]; then
    kill "$(cat /tmp/dbaitr-sentiment.pid)" 2>/dev/null || true
    rm -f /tmp/dbaitr-sentiment.pid
  fi
  # Also free up port 8000 if a stray process is using it
  S8000=$(lsof -ti :8000 || true)
  if [ -n "$S8000" ]; then kill $S8000 2>/dev/null || true; fi
  : > /tmp/dbaitr-sentiment.log
  .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000 >>/tmp/dbaitr-sentiment.log 2>&1 &
  INF_PID=$!
  echo $INF_PID > /tmp/dbaitr-sentiment.pid
  deactivate || true
  popd >/dev/null
else
  echo "!! python3 not found. Skipping inference service. Set SENTIMENT_INFERENCE_URL to a running service."
fi

echo "==> Waiting for inference service (http://localhost:8000/)"
for i in $(seq 1 40); do
  sleep 0.5
  if curl -sSf http://localhost:8000/ >/dev/null 2>&1; then echo "   inference is up"; break; fi
done || true

echo "==> Installing Node dependencies (if needed)"
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

echo "==> Starting Next.js dev server (Turbopack)"
if [ -f /tmp/dbaitr-next.pid ]; then
  kill "$(cat /tmp/dbaitr-next.pid)" 2>/dev/null || true
  rm -f /tmp/dbaitr-next.pid
fi
N9002=$(lsof -ti :9002 || true)
if [ -n "$N9002" ]; then kill $N9002 2>/dev/null || true; fi
: > /tmp/dbaitr-next.log
npm run dev >>/tmp/dbaitr-next.log 2>&1 &
NEXT_PID=$!
echo $NEXT_PID > /tmp/dbaitr-next.pid

echo "==> Waiting for http://localhost:9002"
for i in $(seq 1 60); do
  sleep 0.5
  if curl -sSf http://localhost:9002/ >/dev/null 2>&1; then echo "   Next.js is up"; break; fi
done || true

# Optional backfill for existing statements (idempotent)
echo "==> Running sentiment backfill (limit=25)"
echo "==> Backfill response:"
curl -s -X POST http://localhost:9002/api/sentiment/backfill -H 'Content-Type: application/json' -d '{"limit":25}' || echo "   backfill skipped or partially successful (Admin env may be required)"

echo "\n==> dbaitr bootstrap complete"
echo "Open http://localhost:9002 in your browser"
echo "\n==> Tailing logs (Ctrl+C to stop)"
echo "--- /tmp/dbaitr-sentiment.log and /tmp/dbaitr-next.log ---"
tail -n 50 -F /tmp/dbaitr-sentiment.log -F /tmp/dbaitr-next.log
