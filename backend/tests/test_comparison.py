from app.services.comparison import run_comparison


def test_comparison_is_aligned_and_reproducible():
    a = run_comparison(steps=12, seed=9, event='accident', event_tick=4)
    b = run_comparison(steps=12, seed=9, event='accident', event_tick=4)
    assert a == b
    assert len(a['left']['frames']) == 13
    assert len(a['right']['frames']) == 13
    assert a['left']['frames'][0] == a['right']['frames'][0]
