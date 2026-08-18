from __future__ import annotations

import os
import tempfile
from pathlib import Path

VEHICLE_LABELS = {'car', 'motorcycle', 'bus', 'truck'}


def detector_status() -> dict:
    weights = os.getenv('SMARTTRAFFIC_YOLO_WEIGHTS', 'yolov8n.pt')
    try:
        import ultralytics  # noqa: F401
        available = True
    except Exception:
        available = False
    return {
        'backend': 'ultralytics-yolo',
        'available': available,
        'weights': weights,
        'note': 'Install ultralytics and provide weights locally for offline SIH use.' if not available else 'ready',
    }


def detect_vehicles(image_bytes: bytes, filename: str = 'upload.jpg') -> dict:
    status = detector_status()
    if not status['available']:
        return {
            **status,
            'vehicle_count': None,
            'detections': [],
            'reason': 'YOLO runtime is not installed on this server.',
        }

    from ultralytics import YOLO

    suffix = Path(filename).suffix or '.jpg'
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(image_bytes)
        tmp.flush()
        model = YOLO(status['weights'])
        result = model.predict(source=tmp.name, verbose=False)[0]

    detections = []
    names = result.names
    for box in result.boxes:
        cls_id = int(box.cls.item())
        label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else names[cls_id]
        if label not in VEHICLE_LABELS:
            continue
        xyxy = [round(float(v), 1) for v in box.xyxy[0].tolist()]
        detections.append({
            'label': label,
            'confidence': round(float(box.conf.item()), 4),
            'bbox_xyxy': xyxy,
        })

    return {
        **status,
        'vehicle_count': len(detections),
        'detections': detections,
    }
