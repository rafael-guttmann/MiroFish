"""Validate every charter card against schema.json and its source plugin.

Usage: python validate.py [--plugins DIR]
Without --plugins only the schema is checked. With it, each card's agents and
desk skill must exist in the unzipped plugin folder.
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent


def check(value, schema, path, errors):
    t = schema.get("type")
    types = {"object": dict, "array": list, "string": str, "boolean": bool, "integer": int, "number": (int, float)}
    if t and not isinstance(value, types[t]):
        errors.append(f"{path}: expected {t}")
        return
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: must be {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} not in {schema['enum']}")
    if "pattern" in schema and isinstance(value, str) and not re.search(schema["pattern"], value):
        errors.append(f"{path}: does not match {schema['pattern']}")
    if isinstance(value, dict):
        props = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}.{key}: required")
        for key, sub in value.items():
            if key in props:
                check(sub, props[key], f"{path}.{key}", errors)
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}.{key}: unknown field")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path}: needs at least {schema['minItems']} items")
        if "items" in schema:
            for i, item in enumerate(value):
                check(item, schema["items"], f"{path}[{i}]", errors)


def check_source(card, plugins, errors):
    root = plugins / card["source"]["plugin"]
    if not root.is_dir():
        errors.append(f"plugin folder not found: {root}")
        return
    for a in card["agents"]:
        if not (root / card["source"]["agents_dir"] / f"{a['id']}.md").is_file():
            errors.append(f"agent file missing: {a['id']}")
    if not (root / card["source"]["skills_dir"] / card["desk"]["skill"] / "SKILL.md").is_file():
        errors.append(f"desk skill missing: {card['desk']['skill']}")
    for rel in card.get("tools_runtime", []):
        if not (root / rel).exists():
            errors.append(f"runtime asset missing: {rel}")
    ids = {a["id"] for a in card["agents"]}
    for ref in card.get("senior_panel", []) + [card.get("signoff_seat")]:
        if ref and ref not in ids:
            errors.append(f"unknown seat referenced: {ref}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plugins", type=Path)
    args = ap.parse_args()
    schema = json.loads((HERE / "schema.json").read_text())
    failed = False
    for f in sorted(HERE.glob("*.json")):
        if f.name == "schema.json":
            continue
        card = json.loads(f.read_text())
        errors = []
        check(card, schema, "$", errors)
        if not errors and args.plugins:
            check_source(card, args.plugins, errors)
        print(("FAIL " if errors else "ok   ") + f.name)
        for e in errors:
            print("   -", e)
        failed |= bool(errors)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
