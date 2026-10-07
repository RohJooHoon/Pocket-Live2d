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

# Android camera permission for Mimic mode.
ANDROID_MANIFEST="android/app/src/main/AndroidManifest.xml"
if [[ -f "$ANDROID_MANIFEST" ]] && ! grep -q 'android.permission.CAMERA' "$ANDROID_MANIFEST"; then
  python3 - "$ANDROID_MANIFEST" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
needle = '<manifest xmlns:android="http://schemas.android.com/apk/res/android">'
replacement = needle + '\n    <uses-permission android:name="android.permission.CAMERA" />'
if needle in text:
    path.write_text(text.replace(needle, replacement, 1))
else:
    raise SystemExit(f"Could not patch camera permission in {path}")
PY
fi

# iOS camera privacy string for ARKit Mimic mode.
IOS_INFO_PLIST="ios/Runner/Info.plist"
if [[ -f "$IOS_INFO_PLIST" ]] && command -v /usr/libexec/PlistBuddy >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c "Delete :NSCameraUsageDescription" "$IOS_INFO_PLIST" >/dev/null 2>&1 || true
  /usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string Pocket Live2D uses the front camera only while Mimic mode is active to animate your character from your facial movements." "$IOS_INFO_PLIST"
fi

flutter pub get
flutter test

echo "Platform bootstrap complete. Camera permissions for Mimic mode are configured."
