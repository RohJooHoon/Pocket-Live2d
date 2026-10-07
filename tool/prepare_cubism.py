"""Stage a user-installed Cubism Native 5-r.5 SDK; never download or publish Core."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument("sdk", type=Path, help="Extracted official CubismSdkForNative-5-r.5 directory")
args = parser.parse_args()
source = args.sdk.resolve()
root = Path(__file__).resolve().parent.parent
plugin = root / "packages/pocket_live2d_native"
required = [
    source / "Core/include/Live2DCubismCore.h",
    source / "Framework/src/CubismFramework.hpp",
    source / "Samples/OpenGL/thirdParty/stb/stb_image.h",
]
for path in required:
    if not path.is_file():
        raise SystemExit(f"Missing SDK file: {path}")
framework_header = required[1].read_text(encoding="utf-8-sig")
if "LoadFileFunction" not in framework_header:
    raise SystemExit("This adapter requires the Cubism Native 5-r.5 Framework API.")
destination = plugin / "cubism"
destination.mkdir(parents=True, exist_ok=True)
for name in ("Core", "Framework"):
    shutil.copytree(source / name, destination / name, dirs_exist_ok=True)
# Official OpenGL keeps one shader singleton. Wallpaper preview and installed
# Engines run on separate GLSurfaceView threads with separate EGL contexts.
# Keep each thread's GPU programs separate; Runtime serializes Framework access.
shader_cpp = destination / "Framework/src/Rendering/OpenGL/CubismShader_OpenGLES2.cpp"
shader_source = shader_cpp.read_text(encoding="utf-8-sig")
singleton = "CubismShader_OpenGLES2* s_instance;"
if singleton not in shader_source:
    raise SystemExit("Unsupported Framework shader singleton; use Native 5-r.5.")
shader_cpp.write_text(shader_source.replace(singleton, "thread_local " + singleton), encoding="utf-8")
include = destination / "include"
include.mkdir(exist_ok=True)
shutil.copy2(required[2], include / "stb_image.h")
shader_dir = source / "Framework/src/Rendering/OpenGL/Shaders/StandardES"
shaders = list(shader_dir.glob("*.vert")) + list(shader_dir.glob("*.frag"))
if not shaders:
    raise SystemExit("Cubism OpenGL shader sources are missing.")
lines = ["#pragma once", "#include <map>", "#include <string>",
         "inline const std::map<std::string, std::string>& pocketShaderSources() {",
         "static const std::map<std::string, std::string> sources = {"]
for shader in sorted(shaders):
    lines.append("{" + json.dumps(shader.name) + ", " +
                 json.dumps(shader.read_text(encoding="utf-8-sig"), ensure_ascii=True) + "},")
lines += ["};", "return sources;", "}"]
(include / "PocketShaders.hpp").write_text("\n".join(lines) + "\n")
if sys.platform == "darwin":
    ios = plugin / "ios/Cubism"
    shutil.copytree(destination / "Framework", ios / "Framework", dirs_exist_ok=True)
    shutil.copytree(include, ios / "include", dirs_exist_ok=True)
    device = destination / "Core/lib/ios/Release-iphoneos/libLive2DCubismCore.a"
    simulator = destination / "Core/lib/ios/Release-iphonesimulator-arm64/libLive2DCubismCore.a"
    intel = destination / "Core/lib/ios/Release-iphonesimulator-x86_64/libLive2DCubismCore.a"
    for path in (device, simulator):
        if not path.exists():
            raise SystemExit(f"Missing iOS Core library: {path}")
    if intel.exists():
        universal = ios / "libLive2DCubismCore-simulator.a"
        subprocess.run(["lipo", "-create", str(simulator), str(intel), "-output", str(universal)], check=True)
        simulator = universal
    output = ios / "Live2DCubismCore.xcframework"
    if output.exists():
        shutil.rmtree(output)
    subprocess.run(["xcodebuild", "-create-xcframework",
                    "-library", str(device), "-headers", str(destination / "Core/include"),
                    "-library", str(simulator), "-headers", str(destination / "Core/include"),
                    "-output", str(output)], check=True)
print("SDK staged. Re-run bootstrap and pod install. Core remains excluded from Git.")
