"""YuNet face detection helpers."""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Process-level detector cache for worker reuse.
_detector_cache: Optional[cv2.FaceDetectorYN] = None
_cache_config: Optional[Tuple[str, float, float, int]] = None
_cache_lock = threading.Lock()


class YuNetDetector:
    """Small wrapper around OpenCV YuNet with process-level cache reuse."""

    def __init__(
        self,
        model_path: str,
        max_size: int = 1024,
        score_threshold: float = 0.6,
        nms_threshold: float = 0.3,
        top_k: int = 5000,
    ) -> None:
        if not Path(model_path).is_file():
            raise FileNotFoundError(f"YuNet model not found: {model_path}")

        self.model_path = model_path
        self.max_size = max_size
        self.score_threshold = score_threshold
        self.nms_threshold = nms_threshold
        self.top_k = top_k

    def warmup(self) -> None:
        """Initialize detector cache once during app startup."""
        current_config = (
            self.model_path,
            self.score_threshold,
            self.nms_threshold,
            self.top_k,
        )
        with _cache_lock:
            global _detector_cache, _cache_config
            if _detector_cache is None or _cache_config != current_config:
                _detector_cache = cv2.FaceDetectorYN.create(
                    self.model_path,
                    "",
                    (320, 320),
                    score_threshold=self.score_threshold,
                    nms_threshold=self.nms_threshold,
                    top_k=self.top_k,
                )
                _cache_config = current_config
            else:
                _detector_cache.setInputSize((320, 320))

    def detect(self, image_bytes: bytes) -> Tuple[bool, float]:
        """Detect faces and return (has_face, max_confidence)."""
        return detect_faces_worker(
            image_bytes=image_bytes,
            model_path=self.model_path,
            max_size=self.max_size,
            score_threshold=self.score_threshold,
            nms_threshold=self.nms_threshold,
            top_k=self.top_k,
        )


def detect_faces_worker(
    image_bytes: bytes,
    model_path: str,
    max_size: int,
    score_threshold: float,
    nms_threshold: float,
    top_k: int,
) -> Tuple[bool, float]:
    """Process-level worker function with detector cache reuse."""
    image = _decode_image(image_bytes)
    if image is None:
        return False, 0.0

    resized, _ = _resize_image(image, max_size)
    height, width = resized.shape[:2]

    current_config = (model_path, score_threshold, nms_threshold, top_k)

    with _cache_lock:
        global _detector_cache, _cache_config

        if _detector_cache is None or _cache_config != current_config:
            _detector_cache = cv2.FaceDetectorYN.create(
                model_path,
                "",
                (width, height),
                score_threshold=score_threshold,
                nms_threshold=nms_threshold,
                top_k=top_k,
            )
            _cache_config = current_config
        else:
            _detector_cache.setInputSize((width, height))

        _, faces = _detector_cache.detect(resized)

    if faces is None or len(faces) == 0:
        return False, 0.0

    max_confidence = float(np.max(faces[:, -1]))
    return True, max_confidence


def _decode_image(image_bytes: bytes) -> Optional[np.ndarray]:
    if not image_bytes:
        logger.error("Empty image bytes")
        return None

    data = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        logger.error("Failed to decode image bytes")
    return image


def _resize_image(image: np.ndarray, max_size: int) -> Tuple[np.ndarray, float]:
    height, width = image.shape[:2]
    max_dim = max(height, width)

    if max_dim <= max_size:
        return image, 1.0

    scale = max_size / max_dim
    new_width = int(width * scale)
    new_height = int(height * scale)
    resized = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
    return resized, scale
