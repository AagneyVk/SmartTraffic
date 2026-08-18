#!/usr/bin/env bash
set -euo pipefail
trap 'kill 0' EXIT
(cd backend && uvicorn app.main:app --reload --port 8000) &
(cd frontend && npm run dev -- --host 0.0.0.0) &
wait
