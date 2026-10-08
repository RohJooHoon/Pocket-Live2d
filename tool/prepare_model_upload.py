"""Prepare a model folder and character.json for R2; no site rebuild is needed."""
import argparse
import json
import re
import shutil
from pathlib import Path


def prepare_model(slug: str, source: Path, output: Path, *, model_file=None, name=None, credit=None):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", slug):
        raise ValueError("Use 1-64 ASCII letters, numbers, '-' or '_' for the URL name.")
    source, output = source.resolve(), output.resolve()
    if output.is_relative_to(source) or source.is_relative_to(output):
        raise ValueError("The output folder must be separate from the source folder.")
    models = list(source.glob("*.model3.json"))
    if model_file:
        models = [model for model in models if model.name == model_file]
    if len(models) != 1:
        raise ValueError("Choose a folder with one model3.json, or specify --model <filename>.")
    model = models[0]
    if re.search(r"[\\?#:%\x00-\x1f]", model.name):
        raise ValueError("The model3.json filename contains URL-reserved characters.")
    data = json.loads(model.read_text(encoding="utf-8"))
    refs = data["FileReferences"]
    resources = [refs["Moc"], *refs["Textures"]]
    resources += [refs[key] for key in ("Physics", "Pose", "UserData", "DisplayInfo") if refs.get(key)]
    resources += [entry["File"] for entry in refs.get("Expressions", [])]
    motions = refs.get("Motions", {})
    resources += [entry[key] for group in motions.values() for entry in group for key in ("File", "Sound") if entry.get(key)]
    files = {model.name: model}
    for relative in resources:
        if not isinstance(relative, str) or not relative or re.search(r"[\\?#:%\x00-\x1f]", relative):
            raise ValueError(f"Invalid model reference: {relative}")
        path = Path(relative)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError(f"Unsafe model reference: {relative}")
        target = (source / path).resolve()
        if not target.is_relative_to(source) or not target.is_file() or target.stat().st_size == 0:
            raise ValueError(f"Missing or unsafe model resource: {relative}")
        files[relative] = target
    with files[refs["Moc"]].open("rb") as moc:
        if moc.read(4) != b"MOC3":
            raise ValueError("Invalid MOC3 header.")
    # Preserve metadata when preparing a character already in this repository.
    metadata = {}
    config = source.parent / "character.json"
    if config.is_file():
        candidate = json.loads(config.read_text(encoding="utf-8"))
        if candidate.get("model") == model.name:
            metadata = candidate
    groups = [group for group, entries in motions.items() if entries]

    def pick(preferred, fallback):
        return next((group for group in groups if group.casefold() == preferred.casefold()), fallback)

    idle = metadata.get("idleMotion", pick("Idle", groups[0] if groups else ""))
    tap = metadata.get("tapMotion", pick("TapBody", idle))
    descriptor = dict(
        id=slug, name=name or metadata.get("name") or model.name.removesuffix(".model3.json"),
        model=model.name, idleMotion=idle, tapMotion=tap,
        shakeMotion=metadata.get("shakeMotion", pick("Shake", tap)),
    )
    rights = credit if credit is not None else metadata.get("credit")
    if rights:
        descriptor["credit"] = rights
    for relative, file in files.items():
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, destination)
    (output / "character.json").write_text(json.dumps(descriptor, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return descriptor, len(files)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug", help="URL path and R2 folder name, e.g. haru")
    parser.add_argument("model_dir", type=Path, help="Folder containing model3.json and its resources")
    parser.add_argument("--model", help="Select a model3.json when the folder contains several")
    parser.add_argument("--name", help="Display name")
    parser.add_argument("--credit", help="Required copyright or rights notice")
    parser.add_argument("--out", type=Path, help="Output folder (default: .model-uploads/models/<slug>)")
    args = parser.parse_args()
    output = args.out or Path.cwd() / ".model-uploads/models" / args.slug
    try:
        _, count = prepare_model(args.slug, args.model_dir, output, model_file=args.model, name=args.name, credit=args.credit)
    except (ValueError, KeyError, TypeError, OSError) as error:
        parser.exit(1, f"Cannot prepare model: {error}\n")
    print(f"Prepared {count} model files and character.json in {output.resolve()}")
    print(f"Upload this folder's contents under R2 prefix models/{args.slug}/, then open /{args.slug}.")


if __name__ == "__main__":
    main()
