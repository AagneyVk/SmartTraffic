from __future__ import annotations

import random
from app.models import JunctionState, NetworkSnapshot, Phase
from app.simulation.base import TrafficEngine


class MockTrafficEngine(TrafficEngine):
    """Deterministic four-junction traffic lab with queue propagation.

    It is not a replacement for SUMO. It exists to keep the API, frontend and
    controller tests runnable everywhere while still modelling one-hop traffic
    transfer and downstream spillback pressure.
    """

    EXTERNAL_APPROACHES = {
        'J1': ('north', 'west'),
        'J2': ('north', 'east'),
        'J3': ('south', 'west'),
        'J4': ('south', 'east'),
    }

    STRAIGHT_TRANSFERS = {
        ('J1', 'west'): ('J2', 'west'),
        ('J1', 'north'): ('J3', 'north'),
        ('J2', 'west'): None,
        ('J2', 'north'): ('J4', 'north'),
        ('J3', 'west'): ('J4', 'west'),
        ('J3', 'south'): ('J1', 'south'),
        ('J4', 'west'): None,
        ('J4', 'south'): ('J2', 'south'),
        ('J1', 'east'): None,
        ('J1', 'south'): None,
        ('J2', 'east'): ('J1', 'east'),
        ('J2', 'south'): None,
        ('J3', 'east'): None,
        ('J3', 'north'): None,
        ('J4', 'east'): ('J3', 'east'),
        ('J4', 'north'): None,
    }

    def __init__(self):
        self.rng = random.Random(7)
        self.tick = 0
        self.throughput = 0
        self.total_wait = 0
        self.incident: str | None = None
        self.junctions: list[JunctionState] = []
        self.arrival_multiplier = 1.0
        self.emergency_ticks = 0
        self.reset()

    def reset(self, scenario: str = 'normal', seed: int = 7) -> NetworkSnapshot:
        self.rng.seed(seed)
        self.tick = 0
        self.throughput = 0
        self.total_wait = 0
        self.incident = None
        self.emergency_ticks = 0
        self.arrival_multiplier = 1.0 if scenario == 'normal' else 1.8
        self.junctions = [
            JunctionState('J1', 12, 3, 4, 22),
            JunctionState('J2', 7, 4, 13, 8),
            JunctionState('J3', 3, 9, 4, 14),
            JunctionState('J4', 6, 10, 12, 5),
        ]
        return self.snapshot()

    def inject(self, event: str) -> None:
        if event == 'rush-hour':
            self.arrival_multiplier = 2.2
            self.incident = 'rush-hour'
        elif event == 'accident':
            self.incident = 'accident:J2-west'
        elif event == 'emergency':
            self.emergency_ticks = 24
            self.incident = 'emergency-corridor:J1-J2-J4'
        elif event == 'clear':
            self.incident = None
            self.arrival_multiplier = 1.0
            self.emergency_ticks = 0

    def _arrivals(self) -> int:
        return max(0, int(round(self.rng.randint(0, 3) * self.arrival_multiplier)))

    def _service(self, junction_id: str, direction: str) -> int:
        if self.incident == 'accident:J2-west' and junction_id == 'J2' and direction == 'west':
            return 1
        return 5

    def step(self, phases: dict[str, Phase]) -> NetworkSnapshot:
        self.tick += 1
        by_id = {j.id: j for j in self.junctions}
        for jid, approaches in self.EXTERNAL_APPROACHES.items():
            j = by_id[jid]
            for direction in approaches:
                setattr(j, direction, getattr(j, direction) + self._arrivals())

        transfers: list[tuple[str, str, int]] = []
        exited = 0
        for j in self.junctions:
            j.phase = phases.get(j.id, j.phase)
            served_dirs = ('north', 'south') if j.phase == 'NS' else ('east', 'west')
            for direction in served_dirs:
                queue = getattr(j, direction)
                moved = min(self._service(j.id, direction), queue)
                setattr(j, direction, queue - moved)
                target = self.STRAIGHT_TRANSFERS.get((j.id, direction))
                if target is None:
                    exited += moved
                else:
                    transfers.append((target[0], target[1], moved))

        for jid, direction, count in transfers:
            target = by_id[jid]
            setattr(target, direction, getattr(target, direction) + count)

        self.throughput += exited
        self.total_wait += sum(j.queue for j in self.junctions)
        if self.emergency_ticks > 0:
            self.emergency_ticks -= 1
            if self.emergency_ticks == 0 and self.incident and self.incident.startswith('emergency'):
                self.incident = None
        return self.snapshot()

    def snapshot(self) -> NetworkSnapshot:
        return NetworkSnapshot(
            tick=self.tick,
            junctions=[JunctionState(**j.__dict__) for j in self.junctions],
            throughput=self.throughput,
            total_wait=self.total_wait,
            incident=self.incident,
        )
