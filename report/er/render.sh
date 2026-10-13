#!/usr/bin/env bash
# Regenerates the diagrams and renders them to PNG (2x) with headless Chrome.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-google-chrome}"

python3 "$DIR/build_diagrams.py"
render() {
    local name=$1 w=$2 h=$3
    "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
        --window-size="$w,$h" --screenshot="$DIR/$name.png" "file://$DIR/$name.svg" 2>/dev/null
}
render er_diagram 1600 1230
render er_diagram_nokey 1600 950
render schema_diagram 1560 760
render status_diagram 1180 400
echo "wrote the PNG files"
