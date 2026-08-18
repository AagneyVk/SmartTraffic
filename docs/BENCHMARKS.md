# Benchmark Plan

SmartTraffic does not claim improvement until repeatable experiments demonstrate it.

## Baselines
- Fixed-time
- Vehicle actuated
- Max-pressure
- Optional RL reference

## Scenarios
- Balanced normal demand
- Directional rush-hour surge
- Sudden event discharge
- Road-capacity reduction / incident
- Oversaturated corridor and spillback
- Emergency vehicle
- Sensor dropout / noisy observations

## Metrics
- Mean trip delay
- Mean and maximum queue
- Network throughput
- Stop count
- Spillback duration
- Fairness across approaches
- Emergency journey time
- Recovery time after disturbance
- Controller computation latency

Every experiment records the seed, scenario, controller configuration and simulator version.
