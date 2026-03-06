"""FastAPI service for YuNet face detection."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

import httpx
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, HttpUrl

from face_detector import YuNetDetector

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid int for %s=%s, fallback=%s", name, raw, default)
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning("Invalid float for %s=%s, fallback=%s", name, raw, default)
        return default


@dataclass(frozen=True)
class Settings:
    model_path: str
    max_size: int
    score_threshold: float
    nms_threshold: float
    top_k: int
    api_secret: Optional[str]


def load_settings() -> Settings:
    return Settings(
        model_path=os.getenv("MODEL_PATH", "models/face_detection_yunet_2023mar.onnx"),
        max_size=_env_int("MAX_SIZE", 1024),
        score_threshold=_env_float("SCORE_THRESHOLD", 0.6),
        nms_threshold=_env_float("NMS_THRESHOLD", 0.3),
        top_k=_env_int("TOP_K", 5000),
        api_secret=os.getenv("API_SECRET"),
    )


class DetectResponse(BaseModel):
    has_face: bool
    confidence: float
    error: Optional[str] = None


class DetectUrlRequest(BaseModel):
    url: HttpUrl


settings = load_settings()
app = FastAPI(title="YuNet Face API", version="1.0.0")


def _is_authorized(request: Request) -> bool:
    if not settings.api_secret:
        return True
    return request.headers.get("authorization") == f"Bearer {settings.api_secret}"


def _auth_guard(request: Request) -> None:
    if not _is_authorized(request):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _get_detector() -> YuNetDetector:
    detector: Optional[YuNetDetector] = getattr(app.state, "detector", None)
    if detector is None:
        startup_error = getattr(app.state, "startup_error", "model_not_loaded")
        raise RuntimeError(startup_error)
    return detector


async def _run_detection(image_bytes: bytes) -> DetectResponse:
    if not image_bytes:
        return DetectResponse(has_face=False, confidence=0.0, error="empty_image")

    try:
        detector = _get_detector()
        has_face, confidence = detector.detect(image_bytes)
        return DetectResponse(
            has_face=has_face,
            confidence=float(round(confidence, 6)),
            error=None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Face detection failed")
        return DetectResponse(has_face=False, confidence=0.0, error=str(exc))


@app.on_event("startup")
async def startup_event() -> None:
    try:
        detector = YuNetDetector(
            model_path=settings.model_path,
            max_size=settings.max_size,
            score_threshold=settings.score_threshold,
            nms_threshold=settings.nms_threshold,
            top_k=settings.top_k,
        )
        detector.warmup()

        app.state.detector = detector
        app.state.model_loaded = True
        app.state.startup_error = None
        logger.info("YuNet model loaded: %s", settings.model_path)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Model startup failed")
        app.state.detector = None
        app.state.model_loaded = False
        app.state.startup_error = str(exc)


@app.get("/health")
async def health() -> dict[str, object]:
    model_loaded = bool(getattr(app.state, "model_loaded", False))
    response: dict[str, object] = {
        "status": "ok" if model_loaded else "degraded",
        "model_loaded": model_loaded,
    }
    if not model_loaded:
        response["error"] = getattr(app.state, "startup_error", "unknown")
    return response


@app.post("/detect", response_model=DetectResponse)
async def detect(
    request: Request,
    file: UploadFile | None = File(default=None),
) -> DetectResponse:
    _auth_guard(request)

    content_type = (request.headers.get("content-type") or "").lower()
    try:
        if file is not None:
            image_bytes = await file.read()
        elif content_type.startswith("application/octet-stream"):
            image_bytes = await request.body()
        else:
            return DetectResponse(
                has_face=False,
                confidence=0.0,
                error="unsupported_content_type",
            )
        return await _run_detection(image_bytes)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled /detect error")
        return DetectResponse(has_face=False, confidence=0.0, error=str(exc))


@app.post("/detect-url", response_model=DetectResponse)
async def detect_url(payload: DetectUrlRequest, request: Request) -> DetectResponse:
    _auth_guard(request)

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            result = await client.get(str(payload.url))
            result.raise_for_status()
        return await _run_detection(result.content)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled /detect-url error")
        return DetectResponse(
            has_face=False,
            confidence=0.0,
            error=f"fetch_failed: {exc}",
        )
