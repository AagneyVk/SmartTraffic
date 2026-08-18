from app.services.benchmark import run_benchmark, run_benchmark_suite


def test_benchmark_returns_comparable_results():
    results = run_benchmark(steps=20, seed=5)
    assert len(results) == 5
    names = {r['controller'] for r in results}
    assert names == {
        'fixed-time',
        'actuated',
        'max-pressure',
        'predictive-pressure-v1',
        'mpc-lite-v1',
    }
    assert all(r['throughput'] >= 0 for r in results)
    assert all(r['peak_queue'] >= r['final_queue'] or r['peak_queue'] >= 0 for r in results)


def test_benchmark_suite_is_ranked_and_reproducible():
    a = run_benchmark_suite(steps=40, seeds=[3, 7], scenarios=['normal', 'accident'])
    b = run_benchmark_suite(steps=40, seeds=[3, 7], scenarios=['normal', 'accident'])
    assert a == b
    assert len(a['summary']) == 5
    queues = [row['mean_average_queue'] for row in a['summary']]
    assert queues == sorted(queues)
    assert all(row['runs'] == 4 for row in a['summary'])
