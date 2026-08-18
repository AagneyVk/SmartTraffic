from __future__ import annotations

import os
from app.models import NetworkSnapshot, Phase
from app.simulation.base import TrafficEngine


class SumoTrafficEngine(TrafficEngine):
    """TraCI adapter for real SUMO networks.

    It derives N/S/E/W approach orientation from lane geometry and scores
    existing SUMO signal programs to map abstract NS/EW actions onto safe green
    phases instead of assuming hard-coded phase indexes.
    """

    def __init__(self, gui: bool = False):
        self.gui = gui
        self.config = os.getenv('SMARTTRAFFIC_SUMO_CONFIG', '')
        self._traci = None
        self.tick = 0
        self.throughput = 0
        self.total_wait = 0
        self.incident: str | None = None
        self._phase_cache: dict[tuple[str, str], int] = {}

    def _load(self):
        if not self.config:
            raise RuntimeError('SMARTTRAFFIC_SUMO_CONFIG is not set')
        try:
            import traci
        except ImportError as exc:
            raise RuntimeError('SUMO/TraCI is not installed') from exc
        self._traci = traci

    def reset(self, scenario: str = 'normal', seed: int = 7) -> NetworkSnapshot:
        self._load()
        binary = 'sumo-gui' if self.gui else 'sumo'
        if self._traci.isLoaded():
            self._traci.close()
        self._traci.start([binary, '-c', self.config, '--seed', str(seed), '--start'])
        self.tick = self.throughput = self.total_wait = 0
        self.incident = None
        self._phase_cache.clear()
        return self._snapshot()

    def _lane_direction(self, lane_id: str) -> str:
        shape = self._traci.lane.getShape(lane_id)
        if len(shape) < 2:
            return 'north'
        (x1, y1), (x2, y2) = shape[-2], shape[-1]
        dx, dy = x2 - x1, y2 - y1
        if abs(dx) >= abs(dy):
            return 'west' if dx > 0 else 'east'
        return 'south' if dy > 0 else 'north'

    def _phase_index_for(self, tls_id: str, desired: Phase) -> int:
        key = (tls_id, desired)
        if key in self._phase_cache:
            return self._phase_cache[key]
        logic = self._traci.trafficlight.getAllProgramLogics(tls_id)[0]
        links = self._traci.trafficlight.getControlledLinks(tls_id)
        desired_dirs = {'north', 'south'} if desired == 'NS' else {'east', 'west'}
        best_index, best_score = 0, float('-inf')
        for idx, phase in enumerate(logic.phases):
            score = 0.0
            for signal_index, char in enumerate(phase.state):
                if char not in 'Gg' or signal_index >= len(links) or not links[signal_index]:
                    continue
                incoming = links[signal_index][0][0]
                direction = self._lane_direction(incoming)
                score += 2.0 if direction in desired_dirs else -1.0
            if score > best_score:
                best_index, best_score = idx, score
        self._phase_cache[key] = best_index
        return best_index

    def inject(self, event: str) -> None:
        if self._traci is None:
            return
        edge_ids = set(self._traci.edge.getIDList())
        if event == 'accident' and 'J1_J2' in edge_ids:
            self._traci.edge.setMaxSpeed('J1_J2', 2.0)
            self.incident = 'accident:J1_J2'
        elif event == 'clear':
            if 'J1_J2' in edge_ids:
                self._traci.edge.setMaxSpeed('J1_J2', 13.9)
            self.incident = None
        elif event == 'emergency':
            route_ids = set(self._traci.route.getIDList())
            if 'west_to_east' in route_ids:
                vid = f'emergency-{self.tick}'
                try:
                    self._traci.vehicle.add(vid, 'west_to_east', typeID='emergency')
                    self.incident = f'emergency:{vid}'
                except Exception:
                    pass

    def step(self, phases: dict[str, Phase]) -> NetworkSnapshot:
        if self._traci is None:
            self._load()
        tls_ids = set(self._traci.trafficlight.getIDList())
        for tls_id, phase in phases.items():
            if tls_id not in tls_ids:
                continue
            try:
                self._traci.trafficlight.setPhase(tls_id, self._phase_index_for(tls_id, phase))
            except Exception:
                pass
        self._traci.simulationStep()
        self.tick += 1
        self.throughput += self._traci.simulation.getArrivedNumber()
        snapshot = self._snapshot()
        self.total_wait += sum(j.queue for j in snapshot.junctions)
        snapshot.throughput = self.throughput
        snapshot.total_wait = self.total_wait
        return snapshot

    def _snapshot(self) -> NetworkSnapshot:
        from app.models import JunctionState
        if self._traci is None:
            return NetworkSnapshot(tick=self.tick, junctions=[])
        junctions = []
        for tls_id in self._traci.trafficlight.getIDList():
            totals = {'north': 0, 'south': 0, 'east': 0, 'west': 0}
            for lane in set(self._traci.trafficlight.getControlledLanes(tls_id)):
                totals[self._lane_direction(lane)] += self._traci.lane.getLastStepHaltingNumber(lane)
            junctions.append(JunctionState(tls_id, totals['north'], totals['south'], totals['east'], totals['west']))
        return NetworkSnapshot(tick=self.tick, junctions=junctions, throughput=self.throughput, total_wait=self.total_wait, incident=self.incident)
