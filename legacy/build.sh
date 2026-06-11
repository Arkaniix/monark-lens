#!/bin/bash
set -e

cd ~/monark-lens

# Lire la version actuelle
VERSION=$(python3 -c "import json; print(json.load(open('dist/manifest.json'))['version'])")

# Incrémenter le patch si --bump est passe
if [ "$1" = "--bump" ]; then
  IFS='.' read -ra PARTS <<< "$VERSION"
  MAJOR=${PARTS[0]}
  MINOR=${PARTS[1]}
  PATCH=${PARTS[2]}
  PATCH=$((PATCH + 1))
  NEW_VERSION="$MAJOR.$MINOR.$PATCH"

  # Mettre a jour la version dans tous les manifests
  python3 -c "
import json
for f in ['dist/manifest.json', 'manifest.json']:
    try:
        data = json.load(open(f))
        data['version'] = '$NEW_VERSION'
        json.dump(data, open(f, 'w'), indent=2)
    except: pass
"

  # Mettre a jour dans le chunk constants
  CONSTANTS_FILE=$(ls dist/chunks/constants-*.js 2>/dev/null | head -1)
  if [ -n "$CONSTANTS_FILE" ]; then
    sed -i "s/EXTENSION_VERSION = \"$VERSION\"/EXTENSION_VERSION = \"$NEW_VERSION\"/" "$CONSTANTS_FILE"
  fi
  # Mettre a jour dans main.js
  sed -i "s/EXTENSION_VERSION = \"$VERSION\"/EXTENSION_VERSION = \"$NEW_VERSION\"/" dist/content/main.js

  VERSION="$NEW_VERSION"
  echo "Version bumped to $VERSION"
fi

# Creer le zip avec Python (pas besoin de zip installé)
OUTPUT="monark-lens-v${VERSION}.zip"
python3 -c "
import zipfile, os
with zipfile.ZipFile('$OUTPUT', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('dist'):
        for f in files:
            if f == '.DS_Store':
                continue
            filepath = os.path.join(root, f)
            arcname = os.path.relpath(filepath, 'dist')
            zf.write(filepath, arcname)
print(f'Built: $OUTPUT')
"

ls -lh "$OUTPUT" | awk '{print "Size:", $5}'
