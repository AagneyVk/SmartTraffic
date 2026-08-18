from __future__ import annotations

from app.controllers.base import Controller
from app.models import NetworkSnapshot, Phase


class MPCLiteController(Controller):
    """Short-horizon model-predictive style controller.

    It scores NS/EW choices using local queue pressure, downstream congestion,
    observed queue trend and a switching penalty. This is intentionally light
    enough for real-time edge use while still being network-aware.
    """

    name = 'mpc-lite-v1'

    def __init__(
        self,
        downstream_weight: float = 0.55,
        trend_weight: float = 0.9,
        switch_penalty: float = 2.0,
        spillback_threshold: float = 28.0,
        spillback_weight: float = 0.9,
    ):
        self.downstream_weight = downstream_weight
        self.trend_weight = trend_weight
        self.switch_penalty = switch_penalty
        self.spillback_threshold = spillback_threshold
        self.spillback_weight = spillback_weight
        self.previous_queues: dict[str, float] = {}
        self.previous_phase: dict[str, Phase] = {}
        self.links = {
            'J1': {'EW': 'J2', 'NS': 'J3'},
            'J2': {'EW': 'J1', 'NS': 'J4'},
            'J3': {'EW': 'J4', 'NS': 'J1'},
            'J4': {'EW': 'J3', 'NS': 'J2'},
        }

    def _future_queue(self, jid: str, current: float) -> float:
        previous = self.previous_queues.get(jid, current)
        trend = current - previous
        return max(0.0, current + self.trend_weight * trend)

    def _score(self, jid: str, phase: Phase, local_pressure: float, forecasts: dict[str, float]) -> float:
        score = local_pressure
        downstream = self.links.get(jid, {}).get(phase)
        if downstream:
            q = forecasts.get(downstream, 0.0)
            score -= self.downstream_weight * q
            score -= self.spillback_weight * max(0.0, q - self.spillback_threshold)
        if self.previous_phase.get(jid) not in (None, phase):
            score -= self.switch_penalty
        return score

    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        by_id = {j.id: j for j in snapshot.junctions}
        forecasts = {jid: self._future_queue(jid, float(j.queue)) for jid, j in by_id.items()}
        actions: dict[str, Phase] = {}
        for j in snapshot.junctions:
            ns_score = self._score(j.id, 'NS', float(j.pressure_ns), forecasts)
            ew_score = self._score(j.id, 'EW', float(j.pressure_ew), forecasts)
            actions[j.id] = 'NS' if ns_score >= ew_score else 'EW'

        self.previous_queues = {j.id: float(j.queue) for j in snapshot.junctions}
        self.previous_phase = actions.copy()
        return actions
