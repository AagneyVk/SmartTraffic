import pytest

from app.services.sumo_physics import physics_status, run_sumo_physics_comparison


@pytest.mark.skipif(not physics_status()['sumo'] or not physics_status()['netconvert'], reason='SUMO runtime unavailable')
def test_sumo_physics_returns_authoritative_vehicle_frames():
    status = physics_status()
    assert status['sumo_binary']
    assert status['netconvert_binary']
    result = run_sumo_physics_comparison(steps=30, seed=7, scenario='balanced', live=True)
    assert result['engine'] == 'SUMO/TraCI'
    assert result['physics']['authoritative_positions'] is True
    assert result['physics']['car_following'] == 'IDM'
    assert result['physics']['lane_changing'] == 'LC2013'
    assert len(result['fixed']['frames']) == 30
    assert len(result['adaptive']['frames']) == 30
    assert all('vehicles' in frame for frame in result['fixed']['frames'])
    assert any(frame['vehicles'] for frame in result['fixed']['frames'])
    sample = next(v for frame in result['fixed']['frames'] for v in frame['vehicles'])
    assert {'id', 'kind', 'x', 'y', 'angle', 'speed', 'lane'} <= sample.keys()
    assert 'junction_b' in result['adaptive']['frames'][-1]
