from __future__ import annotations

import random
from app.models import JunctionState, NetworkSnapshot, Phase
from app.simulation.base import TrafficEngine


class MockTrafficEngine(TrafficEngine):
    """Deterministic traffic lab used when SUMO is unavailable."""

    def __init__(self):
        self.rng = random.Random(7)
        self.tick = 0
        self.throughput = 0
        self.total_wait = 0
        self.incident: str | None = None
        self.junctions: list[JunctionState] = []
        self.arrival_multiplier = 1.0
        self.reset()

    def reset(self, scenario: str = 'normal', seed: int = 7) -> NetworkSnapshot:
        self.rng.seed(seed)
        self.tick = 0
        self.throughput = 0
        self.total_wait = 0
        self.incident = None
        self.arrival_multiplier = 1.0 if scenario == 'normal' else 1.8
        self.junctions = [
            JunctionState('J1', 12, 8, 22, 15),
            JunctionState('J2', 7, 11, 13, 9),
            JunctionState('J3', 5, 9, 8, 14),
            JunctionState('J4', 10, 6, 12, 7),
        ]
        return self.snapshot()

    def inject(self, event: str) -> None:
        if event == 'rush-hour':
            self.arrival_multiplier = 2.2
            self.incident = 'rush-hour'
        elif event == 'accident':
            self.incident = 'accident:J2-east'
        elif event == 'clear':
            self.incident = None
            self.arrival_multiplier = 1.0

    def _arrivals(self) -> int:
        return max(0, int(round(self.rng.randint(0, 3) * self.arrival_multiplier)))

    def step(self, phases: dict[str, Phase]) -> NetworkSnapshot:
        self.tick += 1
        discharged = 0
        for j in self.junctions:
            j.phase = phases.get(j.id, j.phase)
            j.north += self._arrivals()
            j.south += self._arrivals()
            j.east += self._arrivals()
            j.west += self._arrivals()
            service = 5
            if j.phase == 'NS':
                moved_n = min(service, j.north)
                moved_s = min(service, j.south)
                j.north -= moved_n
                j.south -= moved_s
                discharged += moved_n + moved_s
            else:
                east_service = 1 if self.incident == 'accident:J2-east' and j.id == 'J2' else service
                moved_e = min(east_service, j.east)
                moved_w = min(service, j.west)
                j.east -= moved_e
                j.west -= moved_w
                discharged += moved_e + moved_w
        self.throughput += discharged
        self.total_wait += sum(j.queue for j in self.junctions)
        return self.snapshot()

    def snapshot(self) -> NetworkSnapshot:
        return NetworkSnapshot(
            tick=self.tick,
            junctions=[JunctionState(**j.__dict__) for j in self.junctions],
            throughput=self.throughput,
            total_wait=self.total_wait,
            incident=self.incident,
        )
