# SmartTraffic

**SIH PS90 — Adaptive Smart Traffic Signal Control**

SmartTraffic is a local-first traffic-control prototype focused on a clear single-junction A/B demonstration: the same intersection and the same seeded vehicle arrivals are run under a conventional fixed-clock signal and under SmartTraffic's adaptive controller. The browser visualizes both simulations side-by-side with proper signal phases, queue spacing, and POV/bird's-eye views.

## Current judge-facing demo

- One physical intersection shown twice side-by-side.
- Left: conventional fixed-clock signal timing.
- Right: SmartTraffic adaptive-predictive controller.
- Both sides receive the exact same deterministic arrival schedule.
- Proper N/S green, amber clearance, and E/W green transitions.
- Queue-positioned cars with fixed spacing so vehicles do not overlap.
- North/south surge, east/west surge, and balanced scenarios.
- Average queue, wait, throughput, peak queue, and current queue comparison.
- POV and bird's-eye camera modes.

The wider repository still contains network-level controller experiments, SUMO/TraCI adapters, emergency priority work, and benchmark services for future expansion. The main browser demo is intentionally single-junction so the comparison is easy to understand and defend.

## Run locally

SmartTraffic is **not dependent on Vercel or any hosted backend**. Run the backend and frontend in two terminals.

### 1. Backend

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the environment:

**Windows PowerShell**

```powershell
.\.venv\Scripts\Activate.ps1
```

**Windows Command Prompt**

```bat
.venv\Scripts\activate.bat
```

**Linux/macOS**

```bash
source .venv/bin/activate
```

Then install and start FastAPI:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check the backend directly in your browser:

```text
http://localhost:8000/health
```

For the single-junction comparison API:

```text
http://localhost:8000/api/single-junction/comparison?steps=100&seed=7&scenario=north-surge
```

Both URLs should return JSON.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally:

```text
http://localhost:5173
```

The frontend connects directly to:

```text
http://localhost:8000
```

You can override it with `VITE_API_URL` if needed.

## If the browser says BACKEND OFFLINE

1. Confirm `uvicorn app.main:app --reload --port 8000` is still running.
2. Open `http://localhost:8000/health` manually.
3. If that page does not return JSON, fix/start the backend first.
4. Return to the frontend and click **Reconnect backend**.

The frontend now reports the actual backend URL instead of showing an ambiguous JSON/token parsing error.

## Single-junction experiment

The endpoint:

```text
GET /api/single-junction/comparison
```

creates one seeded arrival schedule and feeds the same arrivals into both controllers.

### Fixed Clock

- equal timed green windows
- no awareness of queue demand
- amber transition when changing phase

### SmartTraffic Adaptive

- compares N/S and E/W queue pressure
- includes recent queue growth in the short-horizon score
- minimum-green hysteresis prevents rapid flickering
- maximum-green protection prevents starvation
- amber transition before changing phase

This makes the A/B comparison reproducible and fair.

## Research / expansion path

The wider research track remains:

1. fixed-clock baseline
2. actuated baseline
3. max-pressure baseline
4. predictive pressure control
5. movement-level/network pressure
6. SUMO/TraCI validation
7. real OpenStreetMap junction geometry
8. emergency / ambulance / fire / police priority handling
9. robustness testing across incidents and unseen demand patterns

No mock-simulator result should be presented as a final SIH performance claim. Final claims should come from controlled SUMO experiments using identical scenarios/seeds.
