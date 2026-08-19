from __future__ import annotations

import random
import shutil
import subprocess
from pathlib import Path

from app.services.single_junction import AdaptiveJunctionController, FixedClockController, _arrival_schedule

ROOT = Path(__file__).resolve().parents[3]
PHYSICS_DIR = ROOT / 'simulation' / 'physics'
NET_FILE = PHYSICS_DIR / 'physics.net.xml'
CONFIG_FILE = PHYSICS_DIR / 'physics.sumocfg'
TYPE_MIX = ('car', 'bike', 'car', 'auto', 'car', 'bus', 'bike', 'van', 'car', 'truck', 'auto', 'car')
ROUTES = {
    'north': 'north_south_A',
    'south': 'south_north_A',
    'east': 'east_west',
    'west': 'west_east',
}


def physics_status() -> dict:
    return {
        'sumo': shutil.which('sumo') is not None,
        'netconvert': shutil.which('netconvert') is not None,
        'network_built': NET_FILE.exists(),
        'config': str(CONFIG_FILE),
    }


def _ensure_network() -> None:
    if NET_FILE.exists():
        return
    netconvert = shutil.which('netconvert')
    if not netconvert:
        raise RuntimeError('SUMO netconvert is not installed or not on PATH')
    subprocess.run([
        netconvert,
        '--node-files', str(PHYSICS_DIR / 'physics.nod.xml'),
        '--edge-files', str(PHYSICS_DIR / 'physics.edg.xml'),
        '--tls.guess', 'true',
        '--junctions.join', 'false',
        '--output-file', str(NET_FILE),
    ], check=True, cwd=PHYSICS_DIR, capture_output=True, text=True)


def _lane_direction(traci, lane_id: str) -> str:
    shape = traci.lane.getShape(lane_id)
    if len(shape) < 2:
        return 'north'
    (x1, y1), (x2, y2) = shape[-2], shape[-1]
    dx, dy = x2 - x1, y2 - y1
    if abs(dx) >= abs(dy):
        return 'west' if dx > 0 else 'east'
    return 'south' if dy > 0 else 'north'


def _queue_by_dir(traci, tls_id: str) -> dict[str, int]:
    out = {'north': 0, 'south': 0, 'east': 0, 'west': 0}
    for lane in set(traci.trafficlight.getControlledLanes(tls_id)):
        out[_lane_direction(traci, lane)] += traci.lane.getLastStepHaltingNumber(lane)
    return out


def _green_phase_index(traci, tls_id: str, axis: str) -> int:
    logic = traci.trafficlight.getAllProgramLogics(tls_id)[0]
    links = traci.trafficlight.getControlledLinks(tls_id)
    wanted = {'north', 'south'} if axis == 'NS' else {'east', 'west'}
    best_i, best_score = 0, float('-inf')
    for i, phase in enumerate(logic.phases):
        score = 0.0
        for sig_i, char in enumerate(phase.state):
            if char not in 'Gg' or sig_i >= len(links) or not links[sig_i]:
                continue
            direction = _lane_direction(traci, links[sig_i][0][0])
            score += 2.0 if direction in wanted else -2.0
        if score > best_score:
            best_i, best_score = i, score
    return best_i


class _SignalDriver:
    def __init__(self, traci, tls_id: str, initial: str = 'NS'):
        self.traci = traci
        self.tls_id = tls_id
        self.logic = traci.trafficlight.getAllProgramLogics(tls_id)[0]
        self.green = {
            'NS': _green_phase_index(traci, tls_id, 'NS'),
            'EW': _green_phase_index(traci, tls_id, 'EW'),
        }
        self.phase_count = len(self.logic.phases)
        self.current = initial
        self.pending: str | None = None
        self.yellow_left = 0
        traci.trafficlight.setPhase(tls_id, self.green[initial])
        traci.trafficlight.setPhaseDuration(tls_id, 9999)

    def apply(self, desired: str) -> str:
        if self.yellow_left > 0:
            self.yellow_left -= 1
            if self.yellow_left == 0 and self.pending:
                self.current = self.pending
                self.pending = None
                self.traci.trafficlight.setPhase(self.tls_id, self.green[self.current])
                self.traci.trafficlight.setPhaseDuration(self.tls_id, 9999)
                return self.current
            return 'AMBER'
        if desired != self.current:
            candidate = (self.green[self.current] + 1) % self.phase_count
            state = self.logic.phases[candidate].state
            if 'y' in state.lower():
                self.traci.trafficlight.setPhase(self.tls_id, candidate)
                self.traci.trafficlight.setPhaseDuration(self.tls_id, 3)
                self.pending = desired
                self.yellow_left = 3
                return 'AMBER'
            self.current = desired
            self.traci.trafficlight.setPhase(self.tls_id, self.green[self.current])
            self.traci.trafficlight.setPhaseDuration(self.tls_id, 9999)
        return self.current


def _inject_arrivals(traci, tick: int, incoming: dict[str, int], seed: int) -> None:
    rng = random.Random(seed * 100000 + tick)
    for direction, count in incoming.items():
        for i in range(count):
            kind = TYPE_MIX[(tick * 7 + i * 3 + list(ROUTES).index(direction)) % len(TYPE_MIX)]
            vid = f'{direction}-{tick}-{i}'
            try:
                traci.vehicle.add(vid, ROUTES[direction], typeID=kind, departLane='best', departSpeed='max')
            except Exception:
                pass
    if tick % 5 == 0:
        for rid, suffix in [('north_south_B', 'bn'), ('south_north_B', 'bs')]:
            kind = TYPE_MIX[rng.randrange(len(TYPE_MIX))]
            try:
                traci.vehicle.add(f'{suffix}-{tick}', rid, typeID=kind, departLane='best', departSpeed='max')
            except Exception:
                pass


def _vehicles(traci) -> list[dict]:
    out = []
    for vid in traci.vehicle.getIDList():
        x, y = traci.vehicle.getPosition(vid)
        out.append({
            'id': vid,
            'kind': traci.vehicle.getTypeID(vid),
            'x': round(x, 3),
            'y': round(y, 3),
            'angle': round(traci.vehicle.getAngle(vid), 3),
            'speed': round(traci.vehicle.getSpeed(vid), 3),
            'lane': traci.vehicle.getLaneID(vid),
        })
    return out


def _run_policy(policy: str, arrivals: list[dict[str, int]], seed: int) -> list[dict]:
    try:
        import traci
    except ImportError as exc:
        raise RuntimeError('Python TraCI package is not installed') from exc
    sumo = shutil.which('sumo')
    if not sumo:
        raise RuntimeError('SUMO executable is not installed or not on PATH')

    if traci.isLoaded():
        traci.close()
    traci.start([sumo, '-c', str(CONFIG_FILE), '--seed', str(seed), '--start'])
    try:
        a_driver = _SignalDriver(traci, 'A', 'NS')
        b_driver = _SignalDriver(traci, 'B', 'NS')
        controller = FixedClockController(green_ticks=15) if policy == 'fixed' else AdaptiveJunctionController(min_green=5, max_green=18, switch_margin=2.0)
        frames = []
        total_wait = 0.0
        throughput = 0
        for tick, incoming in enumerate(arrivals):
            _inject_arrivals(traci, tick, incoming, seed)
            qa = _queue_by_dir(traci, 'A')
            desired_a = controller.choose(tick, qa)
            phase_a = a_driver.apply(desired_a)
            phase_b = b_driver.apply('NS' if (tick // 15) % 2 == 0 else 'EW')
            traci.simulationStep()

            qa = _queue_by_dir(traci, 'A')
            qb = _queue_by_dir(traci, 'B')
            throughput += traci.simulation.getArrivedNumber()
            total_wait += sum(qa.values())
            frames.append({
                'tick': tick,
                'phase': phase_a,
                'north': qa['north'], 'south': qa['south'], 'east': qa['east'], 'west': qa['west'],
                'total_queue': sum(qa.values()),
                'throughput': throughput,
                'total_wait': round(total_wait, 3),
                'junction_b': {
                    'phase': phase_b,
                    'north': qb['north'], 'south': qb['south'], 'east': qb['east'], 'west': qb['west'],
                    'total_queue': sum(qb.values()),
                },
                'vehicles': _vehicles(traci),
            })
        return frames
    finally:
        if traci.isLoaded():
            traci.close()


def _summary(frames: list[dict]) -> dict:
    last = frames[-1]
    return {
        'throughput': last['throughput'],
        'average_queue': round(sum(f['total_queue'] for f in frames) / len(frames), 2),
        'average_wait_per_tick': round(last['total_wait'] / len(frames), 2),
        'peak_queue': max(f['total_queue'] for f in frames),
        'final_queue': last['total_queue'],
        'junction_b_peak_queue': max(f['junction_b']['total_queue'] for f in frames),
    }


def run_sumo_physics_comparison(steps: int = 100, seed: int = 7, scenario: str = 'north-surge') -> dict:
    _ensure_network()
    steps = max(30, min(steps, 180))
    arrivals = _arrival_schedule(steps, seed, scenario)
    fixed = _run_policy('fixed', arrivals, seed)
    adaptive = _run_policy('adaptive', arrivals, seed)
    return {
        'engine': 'SUMO/TraCI',
        'physics': {
            'car_following': 'IDM',
            'lane_changing': 'LC2013',
            'step_seconds': 1,
            'vehicle_types': ['car', 'bike', 'auto', 'bus', 'truck', 'van'],
            'authoritative_positions': True,
        },
        'seed': seed,
        'steps': steps,
        'scenario': scenario,
        'geometry': {'A': {'x': 0, 'y': 0}, 'B': {'x': 180, 'y': 0}},
        'algorithm': {
            'name': 'Predictive Queue-Pressure (PQP)',
            'formula': 'score = queue + 0.8 × positive recent queue growth',
            'min_green_ticks': 5,
            'max_green_ticks': 18,
            'switch_margin': 2.0,
        },
        'fixed': {'controller': 'fixed-clock', 'frames': fixed, 'summary': _summary(fixed)},
        'adaptive': {'controller': 'predictive-queue-pressure', 'frames': adaptive, 'summary': _summary(adaptive)},
    }
