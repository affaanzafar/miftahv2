"""
Server-side speech-to-text using tarteel-ai/whisper-base-ar-quran — a Whisper
model fine-tuned by Tarteel AI specifically on Quranic recitation audio (as
opposed to conversational Arabic, which is what the browser's built-in
Web Speech API is tuned for and why it performs poorly here).

Two responsibilities:
  1. decode_audio_to_array — turn whatever the browser's MediaRecorder sent
     us (webm/opus bytes) into a 16kHz mono float32 waveform, using PyAV.
     PyAV ships its own bundled FFmpeg libraries in the pip wheel, so this
     works without requiring a system-level ffmpeg install on the host.
  2. transcribe — run that waveform through the model and return text.

The model is loaded once, lazily, on first use (not at import time) so the
rest of the app — and its tests — don't pay the multi-hundred-MB download /
load cost unless the /stt endpoint is actually hit.
"""

from io import BytesIO

import av
import numpy as np
import torch
from transformers import WhisperForConditionalGeneration, WhisperProcessor

MODEL_NAME = "tarteel-ai/whisper-base-ar-quran"
TARGET_SR = 16000

_processor: WhisperProcessor | None = None
_model: WhisperForConditionalGeneration | None = None
_forced_decoder_ids = None


def _get_model():
    global _processor, _model, _forced_decoder_ids
    if _model is None:
        _processor = WhisperProcessor.from_pretrained(MODEL_NAME)
        _model = WhisperForConditionalGeneration.from_pretrained(MODEL_NAME)
        _model.eval()
        # Explicitly force Arabic transcription (not translation) even
        # though this checkpoint is Arabic-only — cheap insurance against
        # the base Whisper multilingual decoder head guessing another
        # language on a noisy/short clip.
        _forced_decoder_ids = _processor.get_decoder_prompt_ids(language="ar", task="transcribe")
    return _processor, _model, _forced_decoder_ids


def decode_audio_to_array(raw_bytes: bytes, target_sr: int = TARGET_SR) -> np.ndarray:
    """Decode arbitrary browser-recorded audio (webm/opus, ogg, wav, ...)
    into a 16kHz mono float32 numpy array in [-1, 1], via PyAV."""
    if not raw_bytes:
        return np.zeros(0, dtype=np.float32)

    container = av.open(BytesIO(raw_bytes))
    try:
        stream = container.streams.audio[0]
    except IndexError:
        return np.zeros(0, dtype=np.float32)

    resampler = av.AudioResampler(format="s16", layout="mono", rate=target_sr)
    chunks = []
    for frame in container.decode(stream):
        frame.pts = None
        for rframe in resampler.resample(frame):
            arr = rframe.to_ndarray()
            if arr.size:
                chunks.append(arr)
    container.close()

    if not chunks:
        return np.zeros(0, dtype=np.float32)

    audio = np.concatenate(chunks, axis=1).flatten().astype(np.float32) / 32768.0
    return audio


def transcribe(audio: np.ndarray, sr: int = TARGET_SR) -> str:
    """Run a 16kHz mono waveform through the Tarteel Quran Whisper model
    and return the recognized Arabic text (empty string for silence/noise-
    only input)."""
    # Whisper needs a minimum amount of audio to produce a meaningful
    # attention pattern; anything under ~0.2s is almost certainly a spurious
    # empty chunk (e.g. a VAD flush that caught only a click/breath).
    if audio.size < int(0.2 * sr):
        return ""

    processor, model, forced_decoder_ids = _get_model()
    inputs = processor(audio, sampling_rate=sr, return_tensors="pt")

    with torch.no_grad():
        predicted_ids = model.generate(
            inputs["input_features"],
            forced_decoder_ids=forced_decoder_ids,
            max_new_tokens=200,
        )

    text = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
    return text.strip()
