from __future__ import annotations

from app.controllers.actuated import ActuatedController
from app.controllers.fixed_time import FixedTimeController
from app.controllers.max_pressure import MaxPressureController
from app.controllers.mpc_lite import MPCLiteController
from app.controllers.predictive_pressure import PredictivePressureController
from app.simulation.mock_engine import MockTrafficEngine

CONTROLLERS = {
    'fixed-time': FixedTimeController,
    'actuated': ActuatedController,
    'max-pressure': MaxPressureController,
    'predictive-pressure-v1': PredictivePressureController,
    'mpc-lite-v1': MPCLiteController,
}


def run_comparison(left: str = 'fixed-time', right: str = 'predictive-pressure-v1', steps: int = 90, seed: int = 7, event: str | None = 'accident', event_tick: int = 20, scenario: str = 'normal') -> dict:
    """Return aligned frame sequences and end metrics from identical demand."""
    steps = max(1, min(steps, 300))
    event_tick = max(0, min(event_tick, steps - 1))
    names = (left, right)
    engines = [MockTrafficEngine(), MockTrafficEngine()]
    controllers = [CONTROLLERS.get(name, PredictivePressureController)() for name in names]
    for engine in engines:
        engine.reset(scenario='rush' if scenario == 'rush' else 'normal', seed=seed)

    histories = [[], []]
    peaks = [0, 0]
    for tick in range(steps + 1):
        for i, engine in enumerate(engines):
            snap = engine.snapshot()
            histories[i].append(snap.to_dict())
            peaks[i] = max(peaks[i], sum(j.queue for j in snap.junctions))
        if tick == steps:
            break
        if event and tick == event_tick:
            for engine in engines:
                engine.inject(event)
        for engine, controller in zip(engines, controllers):
            snap = engine.snapshot()
            engine.step(controller.choose_phases(snap))

    def metrics(engine, peak):
        final = engine.snapshot()
        return {
            'throughput': final.throughput,
            'average_network_queue': round(final.total_wait / max(1, steps), 3),
            'final_queue': sum(j.queue for j in final.junctions),
            'peak_queue': peak,
        }

    return {
        'seed': seed,
        'steps': steps,
        'scenario': scenario,
        'event': event,
        'event_tick': event_tick,
        'left': {'controller': names[0], 'frames': histories[0], 'metrics': metrics(engines[0], peaks[0])},
        'right': {'controller': names[1], 'frames': histories[1], 'metrics': metrics(engines[1], peaks[1])},
    }
