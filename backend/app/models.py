from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Literal

Phase = Literal['NS', 'EW']


@dataclass
class JunctionState:
    id: str
    north: int
    south: int
    east: int
    west: int
    phase: Phase = 'NS'

    @property
    def queue(self) -> int:
        return self.north + self.south + self.east + self.west

    @property
    def pressure_ns(self) -> int:
        return self.north + self.south

    @property
    def pressure_ew(self) -> int:
        return self.east + self.west

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload['queue'] = self.queue
        return payload


@dataclass
class NetworkSnapshot:
    tick: int
    junctions: list[JunctionState]
    throughput: int = 0
    total_wait: int = 0
    incident: str | None = None

    def to_dict(self) -> dict:
        total_queue = sum(j.queue for j in self.junctions)
        return {
            'tick': self.tick,
            'junctions': [j.to_dict() for j in self.junctions],
            'throughput': self.throughput,
            'total_wait': self.total_wait,
            'total_queue': total_queue,
            'incident': self.incident,
        }
