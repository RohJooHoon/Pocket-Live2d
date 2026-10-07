"""Configure generated Flutter hosts identically for local builds and CI."""
from pathlib import Path
import plistlib
import shutil

root = Path(__file__).resolve().parent.parent
plist = root / "ios/Runner/Info.plist"
if plist.exists():
    with plist.open("rb") as source:
        data = plistlib.load(source)
    data["NSCameraUsageDescription"] = (
        "Pocket Live2D uses the front camera only while Mimic mode is active "
        "to animate your character from your facial movements."
    )
    with plist.open("wb") as target:
        plistlib.dump(data, target, sort_keys=False)

manifest = root / "android/app/src/main/AndroidManifest.xml"
if manifest.exists():
    text = manifest.read_text()
    if "android.permission.CAMERA" not in text:
        close = text.index(">", text.index("<manifest"))
        text = text[: close + 1] + '\n    <uses-permission android:name="android.permission.CAMERA" />' + text[close + 1 :]
        manifest.write_text(text)
print("Host camera permissions configured.")

# CocoaPods compiles a generated copy of the shared renderer from within its pod root.
plugin = root / "packages/pocket_live2d_native"
runtime = plugin / "ios/Classes/Runtime"
shutil.copytree(plugin / "common", runtime, dirs_exist_ok=True)
