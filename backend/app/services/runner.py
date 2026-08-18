from __future__ import annotations

import asyncio
import copy
from dataclasses import dataclass

from app.controllers.fixed_time import FixedTimeController
from app.controllers.max_pressure import MaxPressureController
from app.controllers.predictive_pressure import PredictivePressureController
from app.simulation.mock_engine import MockTrafficEngine

CONTROLLERS = {
    'fixed-time': FixedTimeController,
    'max-pressure': MaxPressureController,
    'predictive-pressure-v1': PredictivePressureController,
}


@dataclass
class RunConfig:
    controller: str = 'predictive-pressure-v1'
    scenario: str = 'normal'
    seed: int = 7


class SimulationRunner:
    def __init__(self):
        self.engine = MockTrafficEngine()
        self.config = RunConfig()
        self.controller = PredictivePressureController()
        self.running = False
        self.clients: set = set()

    def reset(self, config: RunConfig | None = None):
        if config:
            self.config = config
        controller_cls = CONTROLLERS.get(self.config.controller, PredictivePressureController)
        self.controller = controller_cls()
        return self.engine.reset(self.config.scenario, self.config.seed)

    def snapshot(self):
        return self.engine.snapshot()

    def inject(self, event: str):
        self.engine.inject(event)
        return self.snapshot()

    def one_step(self):
        current = self.engine.snapshot()
        phases = self.controller.choose_phases(current)
        return self.engine.step(phases)

    def forecast(self, horizon: int = 15):
        engine = copy.deepcopy(self.engine)
        controller = copy.deepcopy(self.controller)
        for _ in range(max(1, min(horizon, 120))):
            snap = engine.snapshot()
            engine.step(controller.choose_phases(snap))
        return engine.snapshot()

    async def loop(self):
        self.running = True
        try:
            while self.running:
                snap = self.one_step().to_dict()
                dead = []
                for ws in list(self.clients):
                    try:
                        await ws.send_json(snap)
                    except Exception:
                        dead.append(ws)
                for ws in dead:
                    self.clients.discard(ws)
                await asyncio.sleep(0.6)
        finally:
            self.running = False
