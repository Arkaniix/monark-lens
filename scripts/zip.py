#!/usr/bin/env python3
"""Package dist/ into monark-lens-v<version>.zip (mirrors the v1 build.sh zip step)."""
import json
import os
import zipfile

# Le nom du zip porte le label de dev (package.json), pas la version du manifest :
# le manifest doit rester une version Chrome valide (numérique, ex "2.0.0"), alors que
# le package versionne les itérations dev ("2.0.0-dev.1").
with open("package.json", encoding="utf-8") as f:
    version = json.load(f)["version"]

output = f"monark-lens-v{version}.zip"
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _dirs, files in os.walk("dist"):
        for name in files:
            if name == ".DS_Store":
                continue
            path = os.path.join(root, name)
            zf.write(path, os.path.relpath(path, "dist"))

print(f"Built: {output}")
