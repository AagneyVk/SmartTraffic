from __future__ import annotations

from app.controllers.base import Controller
from app.models import NetworkSnapshot, Phase


class PredictivePressureController(Controller):
    """Explainable network-aware controller.

    It combines local queue pressure with one-hop downstream congestion.
    This is intentionally interpretable and acts as the first serious
    baseline before graph forecasting / RL experiments.
    """

    name = 'predictive-pressure-v1'

    def __init__(self, downstream_penalty: float = 0.45):
        self.downstream_penalty = downstream_penalty
        self.links = {
            'J1': {'EW': 'J2', 'NS': 'J3'},
            'J2': {'EW': 'J4', 'NS': 'J1'},
            'J3': {'EW': 'J4', 'NS': 'J1'},
            'J4': {'EW': 'J3', 'NS': 'J2'},
        }

    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        by_id = {j.id: j for j in snapshot.junctions}
        actions: dict[str, Phase] = {}
        for j in snapshot.junctions:
            ns_score = float(j.pressure_ns)
            ew_score = float(j.pressure_ew)
            for phase, downstream in self.links.get(j.id, {}).items():
                downstream_q = by_id.get(downstream).queue if downstream in by_id else 0
                if phase == 'NS':
                    ns_score -= self.downstream_penalty * downstream_q
                else:
                    ew_score -= self.downstream_penalty * downstream_q
            actions[j.id] = 'NS' if ns_score >= ew_score else 'EW'
        return actions
