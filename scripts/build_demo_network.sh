#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/simulation/demo"
netconvert --node-files demo.nod.xml --edge-files demo.edg.xml --tls.guess true --junctions.join false --output-file demo.net.xml
echo "Built simulation/demo/demo.net.xml"
