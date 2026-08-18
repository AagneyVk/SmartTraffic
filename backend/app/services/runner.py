from __future__ import annotations

import asyncio
import copy
import os
from dataclasses import dataclass

from app.controllers.actuated import ActuatedController
from app.controllers.fixed_time import FixedTimeController
from app.controllers.max_pressure import MaxPressureController
from app.controllers.mpc_lite import MPCLiteController
from app.controllers.network_max_pressure import NetworkMaxPressureController
from app.controllers.predictive_pressure import PredictivePressureController
from app.simulation.mock_engine import MockTrafficEngine
from app.simulation.sumo_engine import SumoTrafficEngine

CONTROLLERS = {
    'fixed-time': FixedTimeController,
    'actuated': ActuatedController,
    'max-pressure': MaxPressureController,
    'network-max-pressure': NetworkMaxPressureController,
    'predictive-pressure-v2': PredictivePressureController,
    'mpc-lite-v1': MPCLiteController,
}


@dataclass
class RunConfig:
    controller: str = 'predictive-pressure-v2'
    scenario: str = 'normal'
    seed: int = 7


def make_engine():
    mode = os.getenv('SMARTTRAFFIC_ENGINE', 'mock').lower()
    if mode == 'sumo':
        return SumoTrafficEngine(gui=os.getenv('SMARTTRAFFIC_SUMO_GUI', '0') == '1')
    return MockTrafficEngine()


class SimulationRunner:
    def __init__(self):
        self.engine = make_engine()
        self.config = RunConfig()
        self.controller = PredictivePressureController()
        self.running = False
        self.clients: set = set()

    def reset(self, config: RunConfig | None = None):
        if config:
            self.config = config
        self.controller = CONTROLLERS.get(self.config.controller, PredictivePressureController)()
        return self.engine.reset(self.config.scenario, self.config.seed)

    def snapshot(self):
        if hasattr(self.engine, 'snapshot'):
            return self.engine.snapshot()
        return self.engine._snapshot()

    def inject(self, event: str):
        self.engine.inject(event)
        return self.snapshot()

    def one_step(self):
        current = self.snapshot()
        return self.engine.step(self.controller.choose_phases(current))

    def forecast(self, horizon: int = 15):
        if not isinstance(self.engine, MockTrafficEngine):
            return self.snapshot()
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
