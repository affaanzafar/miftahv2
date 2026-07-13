"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "./api";

/**
 * Server-side speech-to-text, backed by tarteel-ai/whisper-base-ar-quran
 * (a Whisper model fine-tuned by Tarteel AI on Quranic recitation, not
 * conversational Arabic — see backend/app/stt.py).
 *
 * Replaces the previous browser-native Web Speech API implementation for
 * two reasons found in testing:
 *   1. Accuracy — the browser's built-in `ar-SA` recognizer is tuned for
 *      everyday spoken Arabic, not tajweed-governed Quranic recitation, and
 *      produced unrelated/garbled output.
 *   2. Feedback/echo — the built-in SpeechRecognition API gives no access
 *      to the underlying MediaStream, so its mic capture can't be told to
 *      apply echo cancellation. On speakers (no headphones), audio played
 *      back by the page or OS gets picked back up as "recitation". This
 *      hook captures its own stream via getUserMedia with
 *      echoCancellation/noiseSuppression/autoGainControl explicitly on.
 *
 * Same public interface as the old hook — { transcript, finalTranscript,
 * isListening, isSupported, start, stop, reset } — so recite/page.js and
 * miftah-method/session/[sessionId]/page.js needed no changes.
 *
 * How chunking works (since Whisper is batch, not streaming like the old
 * API's interim results): audio is recorded continuously, but a simple
 * volume-based VAD (Web Audio AnalyserNode) watches for a pause after
 * speech. On ~700ms of silence following detected speech — or a 12s hard
 * cap, in case someone recites with no pause at all — the current segment
 * is finalized (MediaRecorder.stop() → a fully self-contained webm blob),
 * uploaded to /stt/transcribe, and a new segment starts immediately so
 * recording never has a gap the user would notice. Each segment's returned
 * text is appended to `finalTranscript`, mirroring how the old hook grew
 * `finalTranscript` from each `isFinal` speech-recognition result — so the
 * recite page's existing buffering/debounce logic needed no changes either.
 */

const SILENCE_FLUSH_MS = 700; // pause length that ends a segment
const MAX_SEGMENT_MS = 12000; // hard cap so a run-on recitation still flushes periodically
const VAD_INTERVAL_MS = 100;
const VAD_VOLUME_THRESHOLD = 0.015; // rough RMS threshold for "speech present"

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    typeof window !== "undefined" &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      typeof window.MediaRecorder !== "undefined"
  );

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const vadTimerRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const segmentStartRef = useRef(0);
  const hasSpeechRef = useRef(false);
  const silenceStartRef = useRef(null);
  const shouldListenRef = useRef(false);
  const finalTranscriptRef = useRef("");

  const mimeType = (() => {
    if (typeof window === "undefined" || !window.MediaRecorder) return "";
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    return candidates.find((c) => window.MediaRecorder.isTypeSupported(c)) || "";
  })();

  const appendFinal = useCallback((text) => {
    if (!text) return;
    finalTranscriptRef.current = (finalTranscriptRef.current + " " + text).trim();
    setFinalTranscript(finalTranscriptRef.current);
    setTranscript(finalTranscriptRef.current);
  }, []);

  const cleanupStream = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startSegmentRecorder = useCallback(() => {
    if (!streamRef.current || !shouldListenRef.current) return;

    const recorder = new window.MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    segmentStartRef.current = Date.now();
    hasSpeechRef.current = false;
    silenceStartRef.current = null;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
      chunksRef.current = [];

      const hadSpeech = hasSpeechRef.current;
      if (shouldListenRef.current) {
        // Kick off the next segment immediately so there's no audible gap
        // in capture while this segment's blob uploads/transcribes.
        startSegmentRecorder();
      } else {
        // Caller pressed stop — this was the final segment. Release the
        // mic/audio graph now; its audio (if any) still gets transcribed
        // below so the last few words the user said aren't dropped.
        cleanupStream();
      }

      if (hadSpeech && blob.size > 0) {
        try {
          const { transcript: text } = await api.transcribeAudio(blob);
          appendFinal(text);
        } catch (e) {
          // Drop a failed chunk rather than killing the whole session —
          // matches the old hook's "keep listening" behavior on a
          // recognition hiccup.
        }
      }
    };

    recorderRef.current = recorder;
    recorder.start();
  }, [mimeType, appendFinal]);

  const flushSegment = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const runVadTick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / buffer.length);

    const now = Date.now();
    const segmentAge = now - segmentStartRef.current;

    if (rms >= VAD_VOLUME_THRESHOLD) {
      hasSpeechRef.current = true;
      silenceStartRef.current = null;
    } else if (hasSpeechRef.current) {
      if (silenceStartRef.current === null) silenceStartRef.current = now;
      if (now - silenceStartRef.current >= SILENCE_FLUSH_MS) {
        flushSegment();
        return;
      }
    }

    if (segmentAge >= MAX_SEGMENT_MS && hasSpeechRef.current) {
      flushSegment();
    }
  }, [flushSegment]);

  const start = useCallback(async () => {
    if (!isSupported) return;

    finalTranscriptRef.current = "";
    setTranscript("");
    setFinalTranscript("");
    shouldListenRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextImpl();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      vadTimerRef.current = setInterval(runVadTick, VAD_INTERVAL_MS);

      setIsListening(true);
      startSegmentRecorder();
    } catch (e) {
      shouldListenRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, runVadTick, startSegmentRecorder]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;

    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      // recorder.onstop (set in startSegmentRecorder) sees
      // shouldListenRef.current === false and handles both transcribing
      // this final segment and releasing the mic/audio graph afterward.
      recorderRef.current.stop();
    } else {
      cleanupStream();
    }

    setIsListening(false);
  }, [cleanupStream]);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
    setFinalTranscript("");
  }, []);

  return { transcript, finalTranscript, isListening, isSupported, start, stop, reset };
}
