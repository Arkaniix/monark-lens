#!/usr/bin/env python3
"""Package dist/ into monark-lens-v<version>.zip (mirrors the v1 build.sh zip step)."""
import json
import os
import zipfile

with open("dist/manifest.json", encoding="utf-8") as f:
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
