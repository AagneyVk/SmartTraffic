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
- deterministic side-by-side comparison replay
- stateful short-horizon downstream trend prediction
- regression tests (`4 passed` in the development environment)

## Integrated but requires SUMO on the machine

- TraCI engine adapter with lane-geometry direction inference and existing-program green-phase selection
- runtime engine switching via `SMARTTRAFFIC_ENGINE=sumo`
- 2x2 controlled demo network source files
- OSM -> SUMO import helper

## Final research work before making competition claims

- validate traffic-light phase mapping on the generated SUMO network
- run large multi-seed SUMO experiments
- implement graph/flow predictor rather than the current clone forecast
- integrate visual traffic estimation (uploaded images/video) with explicit confidence
- implement full emergency green-wave timing in SUMO
- choose/import a real city road corridor for the final demo

The mock engine is for development and regression only; final performance claims must come from SUMO experiments.
