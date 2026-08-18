from __future__ import annotations

from app.controllers.fixed_time import FixedTimeController
from app.controllers.max_pressure import MaxPressureController
from app.controllers.predictive_pressure import PredictivePressureController
from app.simulation.mock_engine import MockTrafficEngine

CONTROLLERS = {'fixed-time': FixedTimeController, 'max-pressure': MaxPressureController, 'predictive-pressure-v1': PredictivePressureController}


def run_comparison(left: str = 'fixed-time', right: str = 'predictive-pressure-v1', steps: int = 90, seed: int = 7, event: str | None = 'accident', event_tick: int = 20) -> dict:
    """Return aligned frame sequences from identical initial state and demand."""
    steps = max(1, min(steps, 300))
    event_tick = max(0, min(event_tick, steps - 1))
    names = (left, right)
    engines = [MockTrafficEngine(), MockTrafficEngine()]
    controllers = [CONTROLLERS.get(name, PredictivePressureController)() for name in names]
    for engine in engines:
        engine.reset(seed=seed)
    histories = [[], []]
    for tick in range(steps + 1):
        for i, engine in enumerate(engines):
            histories[i].append(engine.snapshot().to_dict())
        if tick == steps:
            break
        if event and tick == event_tick:
            for engine in engines:
                engine.inject(event)
        for engine, controller in zip(engines, controllers):
            snap = engine.snapshot()
            engine.step(controller.choose_phases(snap))
    return {'seed': seed, 'steps': steps, 'event': event, 'event_tick': event_tick, 'left': {'controller': names[0], 'frames': histories[0]}, 'right': {'controller': names[1], 'frames': histories[1]}}
