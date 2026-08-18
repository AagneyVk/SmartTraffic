from __future__ import annotations

from abc import ABC, abstractmethod
from app.models import NetworkSnapshot, Phase


class Controller(ABC):
    name = 'base'

    @abstractmethod
    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        raise NotImplementedError
