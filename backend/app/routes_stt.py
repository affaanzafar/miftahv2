from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.models import User
from app.routes_auth import get_current_user
from app.stt import decode_audio_to_array, transcribe

router = APIRouter(prefix="/stt", tags=["stt"])

# A single request body over this size almost certainly isn't a short
# pause-to-pause recitation chunk (the frontend flushes on ~0.7-1s of
# silence or a ~12s hard cap) — reject rather than let something huge
# tie up the model.
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts one short audio clip (webm/opus from the browser's
    MediaRecorder — one "chunk" of recitation, flushed on a pause) and
    returns its transcript via the Tarteel-fine-tuned Whisper model. Stateless:
    the frontend is responsible for stitching returned transcripts together
    across chunks, exactly as it previously stitched together the browser
    Web Speech API's `isFinal` results.
    """
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Audio chunk too large")
    if not raw:
        return {"transcript": ""}

    try:
        audio = decode_audio_to_array(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode audio")

    text = transcribe(audio)
    return {"transcript": text}
