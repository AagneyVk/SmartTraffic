from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CorridorStep:
    junction_id: str
    eta_seconds: float
    green_lead_seconds: float
    hold_seconds: float

    def to_dict(self) -> dict:
        return {
            'junction_id': self.junction_id,
            'eta_seconds': round(self.eta_seconds, 1),
            'green_lead_seconds': round(self.green_lead_seconds, 1),
            'hold_seconds': round(self.hold_seconds, 1),
        }


def plan_green_corridor(route: list[str], segment_travel_seconds: list[float] | None = None, lead_seconds: float = 10.0, hold_seconds: float = 18.0) -> dict:
    if not route:
        return {'route': [], 'schedule': [], 'total_eta_seconds': 0.0}

    if segment_travel_seconds is None:
        segment_travel_seconds = [35.0] * max(0, len(route) - 1)
    if len(segment_travel_seconds) != max(0, len(route) - 1):
        raise ValueError('segment_travel_seconds must contain len(route)-1 values')

    eta = 0.0
    schedule: list[CorridorStep] = []
    for idx, junction_id in enumerate(route):
        schedule.append(CorridorStep(junction_id, eta, lead_seconds, hold_seconds))
        if idx < len(segment_travel_seconds):
            eta += max(1.0, float(segment_travel_seconds[idx]))

    return {
        'route': route,
        'schedule': [step.to_dict() for step in schedule],
        'total_eta_seconds': round(eta, 1),
        'strategy': 'rolling-green-wave',
    }
