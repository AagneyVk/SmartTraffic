from __future__ import annotations

from app.controllers.base import Controller
from app.models import NetworkSnapshot, Phase
from app.controllers.network_max_pressure import NetworkMaxPressureController


class PredictivePressureController(Controller):
    """Short-horizon predictive movement-pressure controller.

    It forecasts each directional approach queue from its recent trend, then
    computes movement pressure using upstream forecast minus the forecast of the
    actual downstream receiving approach. A small switch penalty reduces signal
    chattering. This keeps the controller explainable and network-aware.
    """

    name = 'predictive-pressure-v2'

    def __init__(self, trend_weight: float = 0.6, switch_penalty: float = 0.5):
        self.trend_weight = trend_weight
        self.switch_penalty = switch_penalty
        self.previous_approaches: dict[tuple[str, str], float] = {}
        self.previous_phase: dict[str, Phase] = {}
        self.transfers = NetworkMaxPressureController.TRANSFERS

    def _forecast(self, jid: str, direction: str, current: float) -> float:
        key = (jid, direction)
        previous = self.previous_approaches.get(key, current)
        trend = current - previous
        return max(0.0, current + self.trend_weight * trend)

    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        forecasts: dict[tuple[str, str], float] = {}
        for j in snapshot.junctions:
            for direction in ('north', 'south', 'east', 'west'):
                forecasts[(j.id, direction)] = self._forecast(j.id, direction, float(getattr(j, direction)))

        actions: dict[str, Phase] = {}
        for j in snapshot.junctions:
            scores: dict[Phase, float] = {'NS': 0.0, 'EW': 0.0}
            for phase, directions in (('NS', ('north', 'south')), ('EW', ('east', 'west'))):
                for direction in directions:
                    upstream = forecasts[(j.id, direction)]
                    target = self.transfers.get((j.id, direction))
                    downstream = 0.0 if target is None else forecasts[(target[0], target[1])]
                    scores[phase] += upstream - downstream
                if self.previous_phase.get(j.id) not in (None, phase):
                    scores[phase] -= self.switch_penalty
            actions[j.id] = 'NS' if scores['NS'] >= scores['EW'] else 'EW'

        self.previous_approaches = {
            (j.id, direction): float(getattr(j, direction))
            for j in snapshot.junctions
            for direction in ('north', 'south', 'east', 'west')
        }
        self.previous_phase = actions.copy()
        return actions
