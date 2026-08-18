#!/usr/bin/env bash
set -euo pipefail
if [ $# -lt 1 ]; then echo "usage: $0 area.osm.xml [output.net.xml]"; exit 1; fi
OUT=${2:-simulation/osm.net.xml}
netconvert --osm-files "$1" --geometry.remove --roundabouts.guess --ramps.guess --junctions.join --tls.guess --output-file "$OUT"
echo "Wrote $OUT"
