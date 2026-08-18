from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.services.benchmark import run_benchmark
from app.services.comparison import run_comparison
from app.services.emergency import PRIORITY_PROFILES, plan_green_corridor
from app.services.runner import RunConfig, SimulationRunner
from app.services.vision import detect_vehicles, detector_status

runner = SimulationRunner()
loop_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    runner.reset()
    yield
    runner.running = False
    global loop_task
    if loop_task:
        loop_task.cancel()


app = FastAPI(title='SmartTraffic API', version='1.2.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=False, allow_methods=['*'], allow_headers=['*'])


class ResetRequest(BaseModel):
    controller: str = 'predictive-pressure-v1'
    scenario: str = 'normal'
    seed: int = 7


class EventRequest(BaseModel):
    event: str


class CorridorRequest(BaseModel):
    route: list[str]
    vehicle_type: str = 'ambulance'
    segment_travel_seconds: list[float] | None = None
    lead_seconds: float | None = None
    hold_seconds: float | None = None


@app.get('/health')
def health():
    return {
        'status': 'ok',
        'engine': runner.engine.__class__.__name__,
        'controller': runner.controller.name,
        'vision': detector_status(),
    }


@app.get('/api/state')
def state():
    return runner.snapshot().to_dict()


@app.post('/api/reset')
def reset(body: ResetRequest):
    return runner.reset(RunConfig(**body.model_dump())).to_dict()


@app.post('/api/event')
def event(body: EventRequest):
    return runner.inject(body.event).to_dict()


@app.post('/api/step')
def step():
    return runner.one_step().to_dict()


@app.get('/api/benchmark')
def benchmark(steps: int = 120, seed: int = 7):
    return {'results': run_benchmark(steps=steps, seed=seed)}


@app.get('/api/forecast')
def forecast(horizon: int = 15):
    return runner.forecast(horizon).to_dict()


@app.get('/api/comparison')
def comparison(left: str = 'fixed-time', right: str = 'predictive-pressure-v1', steps: int = 90, seed: int = 7, event: str = 'accident', event_tick: int = 20):
    return run_comparison(left=left, right=right, steps=steps, seed=seed, event=event or None, event_tick=event_tick)


@app.get('/api/vision/status')
def vision_status():
    return detector_status()


@app.post('/api/vision/analyse')
async def vision_analyse(file: UploadFile = File(...)):
    payload = await file.read()
    return detect_vehicles(payload, file.filename or 'upload.jpg')


@app.get('/api/priority/types')
def priority_types():
    return {'types': PRIORITY_PROFILES}


@app.post('/api/emergency/corridor')
def emergency_corridor(body: CorridorRequest):
    return plan_green_corridor(
        route=body.route,
        vehicle_type=body.vehicle_type,
        segment_travel_seconds=body.segment_travel_seconds,
        lead_seconds=body.lead_seconds,
        hold_seconds=body.hold_seconds,
    )


@app.post('/api/run')
async def run():
    global loop_task
    if not runner.running:
        loop_task = asyncio.create_task(runner.loop())
    return {'running': True}


@app.post('/api/pause')
def pause():
    runner.running = False
    return {'running': False}


@app.websocket('/ws')
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    runner.clients.add(ws)
    try:
        await ws.send_json(runner.snapshot().to_dict())
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        runner.clients.discard(ws)
