#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter SDK is not installed or not on PATH." >&2
  exit 1
fi

TASK_PLATFORMS="${1:-android,ios}"
flutter create --platforms="$TASK_PLATFORMS" --project-name=motionmate --org=com.rohjoohoon .
python3 tool/configure_hosts.py
flutter pub get
