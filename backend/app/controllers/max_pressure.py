from app.controllers.base import Controller
from app.models import NetworkSnapshot, Phase


class MaxPressureController(Controller):
    """Local max-pressure baseline: serve the larger opposing queue pair."""

    name = 'max-pressure'

    def choose_phases(self, snapshot: NetworkSnapshot) -> dict[str, Phase]:
        return {
            j.id: ('NS' if j.pressure_ns >= j.pressure_ew else 'EW')
            for j in snapshot.junctions
        }
