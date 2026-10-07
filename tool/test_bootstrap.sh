#!/usr/bin/env bash
set -euo pipefail

bootstrap_root=$(cd "$(dirname "$0")/.." && pwd)
bootstrap_fixture=$(mktemp -d)
trap 'rm -rf "$bootstrap_fixture"' EXIT
mkdir -p "$bootstrap_fixture/project/tool" "$bootstrap_fixture/project/lib" "$bootstrap_fixture/bin"
cp "$bootstrap_root/tool/bootstrap_platforms.sh" "$bootstrap_fixture/project/tool/"
printf 'keep app code\n' > "$bootstrap_fixture/project/lib/main.dart"
printf 'keep dependencies\n' > "$bootstrap_fixture/project/pubspec.yaml"
cp "$bootstrap_fixture/project/lib/main.dart" "$bootstrap_fixture/main.expected"
cp "$bootstrap_fixture/project/pubspec.yaml" "$bootstrap_fixture/pubspec.expected"

cat > "$bootstrap_fixture/bin/flutter" <<'FAKE_FLUTTER'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == create ]]; then
  target="${!#}"
  mkdir -p "$target/android" "$target/ios" "$target/lib"
  printf 'generated\n' > "$target/android/host"
  printf 'generated\n' > "$target/ios/host"
  printf 'would replace main\n' > "$target/lib/main.dart"
  printf 'would replace pubspec\n' > "$target/pubspec.yaml"
  printf 'metadata\n' > "$target/.metadata"
fi
FAKE_FLUTTER
chmod +x "$bootstrap_fixture/bin/flutter"
export PATH="$bootstrap_fixture/bin:$PATH"

bash "$bootstrap_fixture/project/tool/bootstrap_platforms.sh"
cmp "$bootstrap_fixture/main.expected" "$bootstrap_fixture/project/lib/main.dart"
cmp "$bootstrap_fixture/pubspec.expected" "$bootstrap_fixture/project/pubspec.yaml"
test -f "$bootstrap_fixture/project/android/host"
test -f "$bootstrap_fixture/project/ios/host"
printf 'custom native code\n' > "$bootstrap_fixture/project/android/host"
cp "$bootstrap_fixture/project/android/host" "$bootstrap_fixture/host.expected"
bash "$bootstrap_fixture/project/tool/bootstrap_platforms.sh"
cmp "$bootstrap_fixture/host.expected" "$bootstrap_fixture/project/android/host"
rm -rf "$bootstrap_fixture/project/ios"
bash "$bootstrap_fixture/project/tool/bootstrap_platforms.sh"
cmp "$bootstrap_fixture/host.expected" "$bootstrap_fixture/project/android/host"
test -f "$bootstrap_fixture/project/ios/host"
echo 'Bootstrap preservation checks passed.'
