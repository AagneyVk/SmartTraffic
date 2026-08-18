# SmartTraffic Roadmap

## M0 — Foundation
- Deterministic mock traffic network
- Fixed-time baseline
- Predictive-pressure controller scaffold
- REST/WebSocket API
- Live control-room UI

## M1 — Real SUMO network
- Implement TraCI adapter
- Build controlled four-junction SUMO scenario
- Import a real OSM road network
- Stream lane/edge state to the UI
- Deterministic reset and replay

## M2 — Strong baselines
- Actuated controller
- Max-pressure controller
- Batch benchmark runner
- Delay, queue, throughput, stops and spillback metrics

## M3 — Predictive coordination
- Short-horizon arrival/queue predictor
- Downstream spillback forecast
- Coordinated multi-junction controller
- Ablation against max-pressure

## M4 — Visual state ingestion
- Uploaded traffic image to lane/vehicle estimates
- Confidence-aware initialization
- Manual correction UI

## M5 — Disturbance handling
- Accident/capacity drop
- Demand surge
- Emergency green corridor
- Sensor/signal fault fallback

## M6 — SIH demonstration
- Side-by-side baseline vs SmartTraffic simulation
- Real-map animated control room
- Future congestion overlay
- Reproducible benchmark report
