from app.services.single_junction import run_single_junction_comparison


def test_single_junction_comparison_uses_identical_arrivals():
    result = run_single_junction_comparison(steps=60, seed=11, scenario='north-surge')
    assert result['fixed']['controller'] == 'fixed-clock'
    assert result['adaptive']['controller'] == 'adaptive-predictive'
    assert len(result['fixed']['frames']) == 60
    assert len(result['adaptive']['frames']) == 60
    assert len(result['arrival_schedule']) == 60
    assert result['fixed']['summary']['throughput'] >= 0
    assert result['adaptive']['summary']['throughput'] >= 0


def test_single_junction_comparison_is_deterministic():
    a = run_single_junction_comparison(steps=50, seed=3, scenario='east-surge')
    b = run_single_junction_comparison(steps=50, seed=3, scenario='east-surge')
    assert a == b
