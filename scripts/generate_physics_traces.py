from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

from app.services.sumo_physics import write_bundled_trace


if __name__ == '__main__':
    for scenario in ('north-surge', 'east-surge', 'balanced'):
        path = write_bundled_trace(steps=100, seed=7, scenario=scenario)
        print(f'generated {path.relative_to(ROOT)}')
