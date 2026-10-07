#!/usr/bin/env bash
set -euo pipefail

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter SDK is not installed or not on PATH." >&2
  exit 1
fi

flutter create \
  --platforms=android,ios \
  --project-name=pocket_live2d \
  --org=com.rohjoohoon \
  .

flutter pub get
flutter test

echo "Platform bootstrap complete. Next: wire the Native Live2D bridge on Android/iOS."
