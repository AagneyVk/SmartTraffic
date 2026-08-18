from __future__ import annotations

from statistics import mean, pstdev

from app.controllers.actuated import ActuatedController
from app.controllers.fixed_time import FixedTimeController
from app.controllers.max_pressure import MaxPressureController
from app.controllers.mpc_lite import MPCLiteController
from app.controllers.network_max_pressure import NetworkMaxPressureController
from app.controllers.predictive_pressure import PredictivePressureController
from app.simulation.mock_engine import MockTrafficEngine


def _controllers():
    return [
        FixedTimeController(),
        ActuatedController(),
        MaxPressureController(),
        NetworkMaxPressureController(),
        PredictivePressureController(),
        MPCLiteController(),
    ]


def _single_run(controller, *, steps: int, seed: int, scenario: str, event: str | None = None, event_tick: int = 30) -> dict:
    engine = MockTrafficEngine()
    engine.reset(scenario='rush' if scenario == 'rush' else 'normal', seed=seed)
    peak_queue = 0
    phase_switches = 0
    previous_actions = None

    for tick in range(steps):
        if event and tick == event_tick:
            engine.inject(event)
        snap = engine.snapshot()
        actions = controller.choose_phases(snap)
        if previous_actions is not None:
            phase_switches += sum(actions[jid] != previous_actions.get(jid) for jid in actions)
        previous_actions = actions.copy()
        engine.step(actions)
        peak_queue = max(peak_queue, sum(j.queue for j in engine.snapshot().junctions))

    final = engine.snapshot()
    return {
        'controller': controller.name,
        'steps': steps,
        'seed': seed,
        'scenario': scenario,
        'event': event,
        'throughput': final.throughput,
        'average_network_queue': round(final.total_wait / max(1, steps), 3),
        'final_queue': sum(j.queue for j in final.junctions),
        'peak_queue': peak_queue,
        'phase_switches': phase_switches,
    }


def run_benchmark(steps: int = 120, seed: int = 7, scenario: str = 'rush') -> list[dict]:
    return [
        _single_run(controller, steps=steps, seed=seed, scenario=scenario)
        for controller in _controllers()
    ]


def run_benchmark_suite(
    steps: int = 180,
    seeds: list[int] | None = None,
    scenarios: list[str] | None = None,
) -> dict:
    """Robust controller comparison across demand and disturbance cases."""
    seeds = seeds or [3, 7, 11, 19, 29]
    scenarios = scenarios or ['normal', 'rush', 'accident', 'rush-accident']
    raw: list[dict] = []

    for scenario in scenarios:
        base_scenario = 'rush' if scenario.startswith('rush') else 'normal'
        event = 'accident' if 'accident' in scenario else None
        for seed in seeds:
            for controller in _controllers():
                raw.append(_single_run(
                    controller,
                    steps=steps,
                    seed=seed,
                    scenario=base_scenario,
                    event=event,
                    event_tick=max(10, steps // 4),
                ))

    summary = []
    for name in [c.name for c in _controllers()]:
        rows = [r for r in raw if r['controller'] == name]
        queues = [r['average_network_queue'] for r in rows]
        throughputs = [r['throughput'] for r in rows]
        peaks = [r['peak_queue'] for r in rows]
        switches = [r['phase_switches'] for r in rows]
        summary.append({
            'controller': name,
            'runs': len(rows),
            'mean_average_queue': round(mean(queues), 3),
            'queue_stddev': round(pstdev(queues), 3),
            'mean_throughput': round(mean(throughputs), 2),
            'mean_peak_queue': round(mean(peaks), 2),
            'mean_phase_switches': round(mean(switches), 2),
        })

    fixed = next(r for r in summary if r['controller'] == 'fixed-time')
    for row in summary:
        row['queue_improvement_vs_fixed_pct'] = round(
            100.0 * (fixed['mean_average_queue'] - row['mean_average_queue']) / max(1e-9, fixed['mean_average_queue']), 2
        )
        row['throughput_improvement_vs_fixed_pct'] = round(
            100.0 * (row['mean_throughput'] - fixed['mean_throughput']) / max(1e-9, fixed['mean_throughput']), 2
        )

    ranking = sorted(summary, key=lambda r: (r['mean_average_queue'], -r['mean_throughput']))
    return {
        'steps_per_run': steps,
        'seeds': seeds,
        'scenarios': scenarios,
        'summary': ranking,
        'raw': raw,
        'note': 'Mock-engine development benchmark only; final SIH claims must be regenerated in SUMO/TraCI.',
    }
