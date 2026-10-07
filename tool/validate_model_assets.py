"""Fail a build if a bundled model references missing or unsafe resources."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "assets/live2d"
models = list(root.glob("*/*.model3.json"))
if not models:
    raise SystemExit("No test Live2D model is bundled.")
for model in models:
    data = json.loads(model.read_text())
    refs = data["FileReferences"]
    resources = [refs["Moc"], *refs["Textures"]]
    resources += [refs[key] for key in ("Physics", "Pose", "UserData", "DisplayInfo") if key in refs]
    resources += [entry["File"] for entry in refs.get("Expressions", [])]
    resources += [entry["File"] for group in refs.get("Motions", {}).values() for entry in group]
    for relative in resources:
        target = (model.parent / relative).resolve()
        if not target.is_relative_to(model.parent.resolve()):
            raise SystemExit(f"Unsafe model reference: {relative}")
        if not target.is_file() or target.stat().st_size == 0:
            raise SystemExit(f"Missing model resource: {target}")
    moc = model.parent / refs["Moc"]
    if moc.read_bytes()[:4] != b"MOC3":
        raise SystemExit(f"Invalid MOC3 header: {moc}")
    for relative in refs["Textures"]:
        if (model.parent / relative).read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            raise SystemExit(f"Invalid PNG: {relative}")
    print(f"{model.relative_to(root)}: {len(resources)} resources verified")
