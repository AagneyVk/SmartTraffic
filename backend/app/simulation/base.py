from __future__ import annotations

from abc import ABC, abstractmethod
from app.models import NetworkSnapshot, Phase


class TrafficEngine(ABC):
    @abstractmethod
    def reset(self, scenario: str = 'normal', seed: int = 7) -> NetworkSnapshot:
        raise NotImplementedError

    @abstractmethod
    def step(self, phases: dict[str, Phase]) -> NetworkSnapshot:
        raise NotImplementedError

    @abstractmethod
    def inject(self, event: str) -> None:
        raise NotImplementedError
