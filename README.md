# SmartTraffic

**SIH PS90 — Adaptive Smart Traffic Signal Control**

SmartTraffic is a network-aware traffic orchestration prototype that compares a conventional fixed-time controller against an explainable predictive-pressure controller on the same reproducible traffic state. The architecture is designed to graduate from the built-in deterministic traffic lab to real SUMO/TraCI + OpenStreetMap networks without changing the API or control-room UI.

## What is implemented

- FastAPI control backend with REST + WebSocket telemetry.
- Deterministic four-junction traffic engine for development and repeatable benchmarks.
- Fixed-time baseline.
- Network-aware `predictive-pressure-v1` controller that penalizes releasing traffic into congested downstream junctions.
- Scenario injection: accident, rush-hour surge, clear/reset.
- React/Vite control-room UI with live queues, phases, throughput, and benchmark table.
- Reproducible A/B benchmark endpoint using identical seeds and demand.
- Optional SUMO/TraCI adapter and OSM import helper.
- Regression tests for controller completeness, determinism, and benchmark output.

## Architecture

```text
images / sensors / map data
          |
          v
   traffic state model
          |
    +-----+------+
    | controllers|
    +-----+------+
          |
          v
  TrafficEngine interface
      /           \
 mock lab       SUMO/TraCI
      \           /
       live API/WebSocket
              |
              v
       web control room
```

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The frontend expects the API at `http://localhost:8000`; override with `VITE_API_URL`.

## Demo sequence

1. Reset both controllers to seed `7`.
2. Run fixed-time and note queue/throughput.
3. Switch to Predictive Pressure and reset to the same seed.
4. Inject **rush hour** or an **accident** while running.
5. Run the 120-step benchmark and compare average queue, final queue, and throughput.
6. For the SIH final, replace the mock lab with the SUMO adapter and a selected OSM corridor.

## SUMO / real map path

1. Install SUMO and make `sumo`, `sumo-gui`, `netconvert`, and TraCI available.
2. Export a small OSM area.
3. Convert it with `scripts/import_osm.sh`.
4. Create routes + a `.sumocfg` file.
5. Set `SMARTTRAFFIC_SUMO_CONFIG=/absolute/path/demo.sumocfg`.
6. Switch the runner from `MockTrafficEngine` to `SumoTrafficEngine` once the concrete intersection IDs and signal programs are known.

## Research roadmap

The current controller is intentionally explainable. The experimentation track is:

1. fixed-time baseline
2. actuated / max-pressure baseline
3. predictive-pressure controller
4. short-horizon graph traffic forecast
5. model-predictive coordinated signal control
6. emergency-corridor priority
7. robustness tests for incidents, demand surges, sensor loss, and unseen maps

No benchmark number in the project should be hard-coded as a claimed improvement. Results must come from identical simulation seeds/scenarios.
