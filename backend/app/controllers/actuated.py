from __future__ import annotations

from app.controllers.base import Controller
from app.models import NetworkSnapshot, Phase


class ActuatedController(Controller):
    """Demand-responsive baseline with minimum green and hysteresis.

    This approximates a practical detector-actuated signal: serve the heavier
    approach pair, but avoid chattering by holding a phase for a minimum number
    of ticks and only switching when the competing demand is meaningfully larger.
    """

    name = 'actuated'

    def __init__(self, min_green: int = 3, switch_margin: float = 3.0):
        self.min_green = min_green
        self.switch_margin = switch_margin
        self.phase: dict[str, Phase] = {}
        self.age: dict[str, int] = {}

    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        actions: dict[str, Phase] = {}
        for j in snapshot.junctions:
            current = self.phase.get(j.id, j.phase)
            age = self.age.get(j.id, 0)
            ns = float(j.pressure_ns)
            ew = float(j.pressure_ew)
            desired: Phase = 'NS' if ns >= ew else 'EW'

            if current != desired and age >= self.min_green:
                advantage = (ns - ew) if desired == 'NS' else (ew - ns)
                if advantage >= self.switch_margin:
                    current = desired
                    age = 0

            actions[j.id] = current
            self.phase[j.id] = current
            self.age[j.id] = age + 1
        return actions
