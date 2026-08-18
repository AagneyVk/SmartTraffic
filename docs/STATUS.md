# Implementation status

## Working and locally validated

- deterministic connected four-junction traffic lab
- fixed-time baseline
- max-pressure baseline
- predictive-pressure-v1 network-aware controller
- accident and rush-hour disturbance injection
- emergency-corridor scenario marker
- short-horizon clone-based forecast endpoint
- REST + WebSocket backend
- live React control room and network congestion map
- reproducible three-controller benchmark
- regression tests (`3 passed` in the development environment)

## Integrated but requires SUMO on the machine

- TraCI engine adapter
- 2x2 controlled demo network source files
- OSM -> SUMO import helper

## Final research work before making competition claims

- validate traffic-light phase mapping on the generated SUMO network
- add actuated baseline if useful
- run large multi-seed SUMO experiments
- implement short-horizon graph/flow predictor rather than the current clone forecast
- integrate visual traffic estimation (uploaded images/video) with explicit confidence
- emergency vehicle route and green-wave timing in SUMO
- choose/import a real Chennai road corridor for the final demo

The mock engine is for development and regression only; final performance claims must come from SUMO experiments.
