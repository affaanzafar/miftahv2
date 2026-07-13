import hashlib
import time

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.models import User
from app.routes_auth import get_current_user

router = APIRouter(prefix="/media", tags=["media"])


def _sign(params: dict, api_secret: str) -> str:
    """Cloudinary's signing scheme: sort params by key, join as k=v&k=v,
    append the API secret, then SHA-1 the whole string. Cloudinary
    recomputes this same hash server-side and rejects the upload if it
    doesn't match — this is what stops anyone but our backend from minting
    valid upload requests."""
    to_sign = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    return hashlib.sha1((to_sign + api_secret).encode("utf-8")).hexdigest()


@router.get("/upload-signature")
def get_upload_signature(current_user: User = Depends(get_current_user)):
    if not settings.cloudinary_cloud_name or not settings.cloudinary_api_secret:
        raise HTTPException(
            status_code=503,
            detail="Media uploads aren't configured yet — set the CLOUDINARY_* environment variables.",
        )

    timestamp = int(time.time())
    params_to_sign = {"timestamp": timestamp, "folder": "miftah_circle_chat"}
    signature = _sign(params_to_sign, settings.cloudinary_api_secret)

    return {
        "timestamp": timestamp,
        "signature": signature,
        "api_key": settings.cloudinary_api_key,
        "cloud_name": settings.cloudinary_cloud_name,
        "folder": "miftah_circle_chat",
    }
