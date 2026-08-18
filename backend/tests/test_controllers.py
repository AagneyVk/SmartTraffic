from app.controllers.actuated import ActuatedController
from app.controllers.fixed_time import FixedTimeController
from app.controllers.max_pressure import MaxPressureController
from app.controllers.mpc_lite import MPCLiteController
from app.controllers.network_max_pressure import NetworkMaxPressureController
from app.controllers.predictive_pressure import PredictivePressureController
from app.simulation.mock_engine import MockTrafficEngine


def test_controllers_emit_all_junction_actions():
    engine = MockTrafficEngine()
    snap = engine.reset(seed=3)
    controllers = (
        FixedTimeController(),
        ActuatedController(),
        MaxPressureController(),
        NetworkMaxPressureController(),
        PredictivePressureController(),
        MPCLiteController(),
    )
    for controller in controllers:
        actions = controller.choose_phases(snap)
        assert set(actions) == {'J1', 'J2', 'J3', 'J4'}
        assert set(actions.values()) <= {'NS', 'EW'}


def test_simulation_is_deterministic():
    a, b = MockTrafficEngine(), MockTrafficEngine()
    a.reset(seed=11); b.reset(seed=11)
    controller_a = PredictivePressureController(); controller_b = PredictivePressureController()
    for _ in range(20):
        sa, sb = a.snapshot(), b.snapshot()
        a.step(controller_a.choose_phases(sa)); b.step(controller_b.choose_phases(sb))
    assert a.snapshot().to_dict() == b.snapshot().to_dict()
