"""Stage a user-downloaded Cubism SDK for Web into vendor/cubism/ (git-ignored).

Usage:
    python3 tool/prepare_cubism_web.py /path/to/CubismSdkForWeb-5-r.5

Never commit or publish the staged files: Cubism Core is licensed under the
Live2D Proprietary Software License and may only ship inside a built site.
"""
import argparse
from pathlib import Path
import shutil

parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
parser.add_argument("sdk", type=Path, help="Extracted CubismSdkForWeb-5-r.5 folder (contains Core/ and Framework/)")
args = parser.parse_args()

source = args.sdk.expanduser().resolve()
root = Path(__file__).resolve().parent.parent
target = root / "vendor" / "cubism"

if (source / "Core" / "include").is_dir() or (source / "Framework" / "src" / "CubismFramework.hpp").is_file():
    raise SystemExit(
        "This is the Cubism SDK for Native. The web project needs the Cubism SDK for Web "
        "(CubismSdkForWeb-5-r.5) from https://www.live2d.com/download/cubism-sdk/download-web/"
    )

required = [
    source / "Core" / "live2dcubismcore.min.js",
    source / "Core" / "live2dcubismcore.d.ts",
    source / "Framework" / "src" / "live2dcubismframework.ts",
    source / "Framework" / "Shaders" / "WebGL",
    source / "Framework" / "tsconfig.json",
]
missing = [str(path) for path in required if not path.exists()]
if missing:
    raise SystemExit("Missing SDK files (pass the folder that contains Core/ and Framework/):\n  " + "\n  ".join(missing))

# The renderer uses the 5-r.5 update scheduler and runtime-loaded WebGL shaders.
if not (source / "Framework" / "src" / "motion" / "cubismupdatescheduler.ts").is_file():
    raise SystemExit("This project targets Cubism SDK for Web 5-r.5. Please download that version.")

if target.exists():
    shutil.rmtree(target)
(target / "Core").mkdir(parents=True)
for name in ("live2dcubismcore.min.js", "live2dcubismcore.d.ts", "RedistributableFiles.txt", "LICENSE.md", "README.md"):
    if (source / "Core" / name).is_file():
        shutil.copy2(source / "Core" / name, target / "Core" / name)

framework = target / "Framework"
shutil.copytree(source / "Framework" / "src", framework / "src")
shutil.copytree(source / "Framework" / "Shaders", framework / "Shaders")
# Keeps the Framework compiled with its own settings (ES6 class fields), as in the official samples.
shutil.copy2(source / "Framework" / "tsconfig.json", framework / "tsconfig.json")
for name in ("LICENSE.md", "README.md"):
    if (source / "Framework" / name).is_file():
        shutil.copy2(source / "Framework" / name, framework / name)

print(f"Cubism SDK for Web staged in {target.relative_to(root)}/ (git-ignored).")
print("Next: npm run dev   (or CHARACTER=<id> npm run build)")
