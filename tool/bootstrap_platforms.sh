#!/usr/bin/env bash
set -euo pipefail

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter SDK is not installed or not on PATH." >&2
  exit 1
fi

cd "$(dirname "$0")/.."
# Generate only host projects in a temporary app. Never overwrite lib/, test/
# or pubspec.yaml, and preserve existing native host customizations.
if [[ ! -d android || ! -d ios ]]; then
  platform_temp=$(mktemp -d)
  trap 'rm -rf "$platform_temp"' EXIT
  flutter create --no-pub --platforms=android,ios \
    --project-name=pocket_live2d --org=com.rohjoohoon "$platform_temp/host"
  for platform in android ios; do
    if [[ ! -d "$platform" ]]; then
      cp -R "$platform_temp/host/$platform" "$platform"
    fi
  done
  if [[ ! -f .metadata ]]; then
    cp "$platform_temp/host/.metadata" .metadata
  fi
fi

# iOS host setup runs on macOS; preserve an existing usage description.
if [[ -f ios/Runner/Info.plist && -x /usr/libexec/PlistBuddy ]]; then
  if ! /usr/libexec/PlistBuddy -c 'Print :NSMotionUsageDescription' ios/Runner/Info.plist >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c 'Add :NSMotionUsageDescription string 기기 기울기에 캐릭터가 반응하도록 움직임 데이터를 사용합니다.' ios/Runner/Info.plist
  fi
fi

flutter pub get
if [[ "${POCKET_LIVE2D_SKIP_TESTS:-0}" != 1 ]]; then
  flutter test --timeout 30s
fi
echo "Platform bootstrap complete. Run flutter run on an iPhone or Android device."
