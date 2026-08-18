from __future__ import annotations

from app.controllers.fixed_time import FixedTimeController
from app.controllers.predictive_pressure import PredictivePressureController
from app.simulation.mock_engine import MockTrafficEngine


def run_benchmark(steps: int = 120, seed: int = 7, scenario: str = 'rush') -> list[dict]:
    controllers = [FixedTimeController(), PredictivePressureController()]
    results = []
    for controller in controllers:
        engine = MockTrafficEngine()
        engine.reset(scenario='rush' if scenario == 'rush' else 'normal', seed=seed)
        for _ in range(steps):
            snap = engine.snapshot()
            actions = controller.choose_phases(snap)
            engine.step(actions)
        final = engine.snapshot()
        avg_queue = final.total_wait / max(1, steps)
        results.append({
            'controller': controller.name,
            'steps': steps,
            'throughput': final.throughput,
            'average_network_queue': round(avg_queue, 2),
            'final_queue': sum(j.queue for j in final.junctions),
        })
    return results
