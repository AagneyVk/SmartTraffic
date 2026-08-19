import shutil

import pytest

from app.services.sumo_physics import run_sumo_physics_comparison


@pytest.mark.skipif(shutil.which('sumo') is None or shutil.which('netconvert') is None, reason='SUMO not installed')
def test_sumo_physics_returns_authoritative_vehicle_frames():
    result = run_sumo_physics_comparison(steps=30, seed=7, scenario='balanced')
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
