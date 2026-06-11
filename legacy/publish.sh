#!/bin/bash
set -e
cd ~/monark-lens
./build.sh "$@"
VERSION=$(python3 -c "import json; print(json.load(open('dist/manifest.json'))['version'])")
cp "monark-lens-v${VERSION}.zip" /var/www/monark-builds/
cp "monark-lens-v${VERSION}.zip" /var/www/monark-builds/monark-lens-latest.zip
echo "Published: https://api.monark-market.fr/builds/monark-lens-v${VERSION}.zip"
echo "Latest:    https://api.monark-market.fr/builds/monark-lens-latest.zip"
