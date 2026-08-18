from __future__ import annotations

from app.controllers.base import Controller
from app.models import NetworkSnapshot, Phase


class PredictivePressureController(Controller):
    """Explainable network-aware controller with short-horizon queue trend.

    The controller starts from local max-pressure, estimates whether downstream
    queues are growing or shrinking from the previous observation, and meters
    releases toward links forecast to be more congested. It is deliberately
    lightweight and interpretable; SUMO benchmarks decide whether later graph
    forecasting or MPC variants are worth keeping.
    """

    name = 'predictive-pressure-v1'

    def __init__(self, downstream_penalty: float = 0.45, trend_weight: float = 0.8):
        self.downstream_penalty = downstream_penalty
        self.trend_weight = trend_weight
        self.previous_queues: dict[str, int] = {}
        self.links = {
            'J1': {'EW': 'J2', 'NS': 'J3'},
            'J2': {'EW': 'J1', 'NS': 'J4'},
            'J3': {'EW': 'J4', 'NS': 'J1'},
            'J4': {'EW': 'J3', 'NS': 'J2'},
        }

    def _forecast_queue(self, junction_id: str, current: int) -> float:
        previous = self.previous_queues.get(junction_id, current)
        trend = current - previous
        return max(0.0, current + self.trend_weight * trend)

    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        by_id = {j.id: j for j in snapshot.junctions}
        forecasts = {jid: self._forecast_queue(jid, j.queue) for jid, j in by_id.items()}
        actions: dict[str, Phase] = {}
        for j in snapshot.junctions:
            ns_score = float(j.pressure_ns)
            ew_score = float(j.pressure_ew)
            for phase, downstream in self.links.get(j.id, {}).items():
                downstream_q = forecasts.get(downstream, 0.0)
                if phase == 'NS':
                    ns_score -= self.downstream_penalty * downstream_q
                else:
                    ew_score -= self.downstream_penalty * downstream_q
            actions[j.id] = 'NS' if ns_score >= ew_score else 'EW'
        self.previous_queues = {j.id: j.queue for j in snapshot.junctions}
        return actions
