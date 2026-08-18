from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass
class JunctionRun:
    tick: int
    phase: str
    north: int
    south: int
    east: int
    west: int
    throughput: int
    total_wait: int

    @property
    def total_queue(self) -> int:
        return self.north + self.south + self.east + self.west

    def to_dict(self) -> dict:
        return {
            'tick': self.tick,
            'phase': self.phase,
            'north': self.north,
            'south': self.south,
            'east': self.east,
            'west': self.west,
            'throughput': self.throughput,
            'total_wait': self.total_wait,
            'total_queue': self.total_queue,
        }


class FixedClockController:
    """Conventional fixed-time signal: equal green windows regardless of demand."""

    name = 'fixed-clock'

    def __init__(self, green_ticks: int = 10):
        self.green_ticks = green_ticks

    def choose(self, tick: int, queues: dict[str, int]) -> str:
        return 'NS' if (tick // self.green_ticks) % 2 == 0 else 'EW'


class AdaptiveJunctionController:
    """Demand-aware controller with hysteresis and starvation protection.

    It compares opposing queue pressure, estimates near-term demand using current
    queue plus the last observed growth, respects a minimum green to avoid rapid
    flicker, and enforces a maximum green so the cross-road cannot starve.
    """

    name = 'adaptive-predictive'

    def __init__(self, min_green: int = 4, max_green: int = 14, switch_margin: float = 2.0):
        self.min_green = min_green
        self.max_green = max_green
        self.switch_margin = switch_margin
        self.phase = 'NS'
        self.phase_age = 0
        self.prev = {'NS': 0, 'EW': 0}

    def choose(self, tick: int, queues: dict[str, int]) -> str:
        ns = queues['north'] + queues['south']
        ew = queues['east'] + queues['west']
        ns_growth = ns - self.prev['NS']
        ew_growth = ew - self.prev['EW']
        ns_score = ns + 0.8 * max(0, ns_growth)
        ew_score = ew + 0.8 * max(0, ew_growth)

        self.prev = {'NS': ns, 'EW': ew}
        self.phase_age += 1

        if self.phase_age < self.min_green:
            return self.phase

        other_score = ew_score if self.phase == 'NS' else ns_score
        current_score = ns_score if self.phase == 'NS' else ew_score
        should_switch = other_score > current_score + self.switch_margin
        must_switch = self.phase_age >= self.max_green

        if should_switch or must_switch:
            self.phase = 'EW' if self.phase == 'NS' else 'NS'
            self.phase_age = 0
        return self.phase


def _arrival_schedule(steps: int, seed: int, scenario: str) -> list[dict[str, int]]:
    rng = random.Random(seed)
    rows: list[dict[str, int]] = []
    for tick in range(steps):
        if scenario == 'north-surge':
            ns_boost = 2 if 15 <= tick < 55 else 0
            ew_boost = 0
        elif scenario == 'east-surge':
            ns_boost = 0
            ew_boost = 2 if 15 <= tick < 55 else 0
        else:
            ns_boost = ew_boost = 0
        rows.append({
            'north': rng.randint(0, 2) + ns_boost,
            'south': rng.randint(0, 1) + (1 if ns_boost else 0),
            'east': rng.randint(0, 2) + ew_boost,
            'west': rng.randint(0, 1) + (1 if ew_boost else 0),
        })
    return rows


def _run(controller, arrivals: list[dict[str, int]]) -> list[dict]:
    q = {'north': 4, 'south': 3, 'east': 4, 'west': 3}
    throughput = 0
    total_wait = 0
    frames: list[dict] = []
    service_per_direction = 3
    actual_phase = 'NS'
    pending_phase: str | None = None

    for tick, incoming in enumerate(arrivals):
        for direction, count in incoming.items():
            q[direction] += count

        desired_phase = controller.choose(tick, q)
        if pending_phase is not None:
            actual_phase = pending_phase
            pending_phase = None
            phase = actual_phase
        elif desired_phase != actual_phase:
            phase = 'AMBER'
            pending_phase = desired_phase
        else:
            phase = actual_phase

        if phase == 'NS':
            served = ('north', 'south')
        elif phase == 'EW':
            served = ('east', 'west')
        else:
            served = ()

        for direction in served:
            moved = min(service_per_direction, q[direction])
            q[direction] -= moved
            throughput += moved

        total_wait += sum(q.values())
        frames.append(JunctionRun(
            tick=tick,
            phase=phase,
            north=q['north'],
            south=q['south'],
            east=q['east'],
            west=q['west'],
            throughput=throughput,
            total_wait=total_wait,
        ).to_dict())
    return frames


def run_single_junction_comparison(steps: int = 90, seed: int = 7, scenario: str = 'north-surge') -> dict:
    steps = max(20, min(steps, 300))
    arrivals = _arrival_schedule(steps, seed, scenario)
    fixed = _run(FixedClockController(), arrivals)
    adaptive = _run(AdaptiveJunctionController(), arrivals)

    def summary(frames: list[dict]) -> dict:
        last = frames[-1]
        return {
            'throughput': last['throughput'],
            'average_queue': round(sum(f['total_queue'] for f in frames) / len(frames), 2),
            'average_wait_per_tick': round(last['total_wait'] / len(frames), 2),
            'peak_queue': max(f['total_queue'] for f in frames),
            'final_queue': last['total_queue'],
        }

    return {
        'seed': seed,
        'steps': steps,
        'scenario': scenario,
        'arrival_schedule': arrivals,
        'fixed': {'controller': 'fixed-clock', 'frames': fixed, 'summary': summary(fixed)},
        'adaptive': {'controller': 'adaptive-predictive', 'frames': adaptive, 'summary': summary(adaptive)},
    }
