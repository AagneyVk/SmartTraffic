from __future__ import annotations

import os
from app.models import NetworkSnapshot, Phase
from app.simulation.base import TrafficEngine


class SumoTrafficEngine(TrafficEngine):
    """TraCI adapter for a real SUMO scenario.

    Set SMARTTRAFFIC_SUMO_CONFIG to a .sumocfg file. The adapter is optional so
    the repo remains runnable on machines without SUMO.
    """

    def __init__(self, gui: bool = False):
        self.gui = gui
        self.config = os.getenv('SMARTTRAFFIC_SUMO_CONFIG', '')
        self._traci = None
        self.tick = 0

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
        self._traci.start([binary, '-c', self.config, '--seed', str(seed)])
        self.tick = 0
        return self._snapshot()

    def inject(self, event: str) -> None:
        return None

    def step(self, phases: dict[str, Phase]) -> NetworkSnapshot:
        if self._traci is None:
            self._load()
        for tls_id, phase in phases.items():
            try:
                logic = self._traci.trafficlight.getAllProgramLogics(tls_id)[0]
                index = 0 if phase == 'NS' else min(2, len(logic.phases) - 1)
                self._traci.trafficlight.setPhase(tls_id, index)
            except Exception:
                pass
        self._traci.simulationStep()
        self.tick += 1
        return self._snapshot()

    def _snapshot(self) -> NetworkSnapshot:
        from app.models import JunctionState
        if self._traci is None:
            return NetworkSnapshot(tick=self.tick, junctions=[])
        junctions = []
        for tls_id in self._traci.trafficlight.getIDList():
            lanes = self._traci.trafficlight.getControlledLanes(tls_id)
            queues = [self._traci.lane.getLastStepHaltingNumber(lane) for lane in lanes[:4]]
            queues += [0] * (4 - len(queues))
            junctions.append(JunctionState(tls_id, queues[0], queues[1], queues[2], queues[3]))
        return NetworkSnapshot(tick=self.tick, junctions=junctions)
