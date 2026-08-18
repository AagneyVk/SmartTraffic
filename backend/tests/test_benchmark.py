from app.services.benchmark import run_benchmark


def test_benchmark_returns_comparable_results():
    results = run_benchmark(steps=20, seed=5)
    assert len(results) == 2
    names = {r['controller'] for r in results}
    assert names == {'fixed-time', 'predictive-pressure-v1'}
    assert all(r['throughput'] >= 0 for r in results)
