from app.controllers.base import Controller
from app.models import NetworkSnapshot, Phase


class FixedTimeController(Controller):
    name = 'fixed-time'

    def __init__(self, cycle: int = 8):
        self.cycle = cycle

    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        phase: Phase = 'NS' if (snapshot.tick // self.cycle) % 2 == 0 else 'EW'
        return {j.id: phase for j in snapshot.junctions}
