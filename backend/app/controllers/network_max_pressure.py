from __future__ import annotations

from app.controllers.base import Controller
from app.models import NetworkSnapshot, Phase


class NetworkMaxPressureController(Controller):
    """Movement-level network max-pressure controller.

    Unlike the simple local baseline, this scores each movement using
    upstream queue minus the queue on the actual downstream receiving approach.
    That prevents a green phase from blindly discharging traffic into a blocked
    downstream link.
    """

    name = 'network-max-pressure'

    TRANSFERS = {
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

    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        by_id = {j.id: j for j in snapshot.junctions}
        actions: dict[str, Phase] = {}

        for j in snapshot.junctions:
            scores: dict[Phase, float] = {'NS': 0.0, 'EW': 0.0}
            for phase, directions in (('NS', ('north', 'south')), ('EW', ('east', 'west'))):
                for direction in directions:
                    upstream = float(getattr(j, direction))
                    target = self.TRANSFERS.get((j.id, direction))
                    downstream = 0.0 if target is None else float(getattr(by_id[target[0]], target[1]))
                    scores[phase] += upstream - downstream
            actions[j.id] = 'NS' if scores['NS'] >= scores['EW'] else 'EW'

        return actions
