"use client";

import { useRef, useState, useCallback } from "react";

function compact(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

/**
 * Wraps the browser's built-in SpeechRecognition (Web Speech API).
 *
 * Mobile Chrome/Android can re-emit the same finalized phrase when continuous
 * recognition restarts internally. Without guardrails, one spoken word can be
 * appended twice or three times. This hook now:
 *   - ignores stale events from old recognition instances,
 *   - appends only new final chunks,
 *   - drops exact duplicate final chunks emitted within a short window,
 *   - trims overlap when a later final result includes the previous words.
 */
export function useSpeechRecognition({ lang = "ar-SA" } = {}) {
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const shouldListenRef = useRef(false);
  const recognitionInstanceIdRef = useRef(0);
  const restartTimerRef = useRef(null);
  const lastFinalChunkRef = useRef({ text: "", at: 0 });
  const recentFinalChunksRef = useRef(new Map());

  const resetDedupe = useCallback(() => {
    finalTranscriptRef.current = "";
    lastFinalChunkRef.current = { text: "", at: 0 };
    recentFinalChunksRef.current = new Map();
  }, []);

  const appendFinalChunk = useCallback((rawChunk) => {
    const chunk = compact(rawChunk);
    if (!chunk) return false;

    const t = nowMs();
    const recent = recentFinalChunksRef.current;

    // Drop the exact duplicate phrase Android/Chrome often replays on mobile
    // immediately after a recognizer restart.
    const lastSeen = recent.get(chunk);
    if (lastSeen && t - lastSeen < 3500) {
      return false;
    }

    const current = compact(finalTranscriptRef.current);
    const currentWords = current ? current.split(" ") : [];
    const chunkWords = chunk.split(" ");

    // If the new final phrase overlaps with the tail of what we already have,
    // append only the non-overlapping suffix. This handles patterns like:
    //   final #1: "الحمد لله"
    //   final #2: "لله رب العالمين"
    // without creating "الحمد لله لله رب العالمين".
    let overlap = 0;
    const maxOverlap = Math.min(currentWords.length, chunkWords.length);
    for (let size = maxOverlap; size > 0; size -= 1) {
      const currentTail = currentWords.slice(currentWords.length - size).join(" ");
      const chunkHead = chunkWords.slice(0, size).join(" ");
      if (currentTail === chunkHead) {
        overlap = size;
        break;
      }
    }

    const suffix = chunkWords.slice(overlap).join(" ").trim();
    if (!suffix) {
      recent.set(chunk, t);
      lastFinalChunkRef.current = { text: chunk, at: t };
      return false;
    }

    finalTranscriptRef.current = compact(`${finalTranscriptRef.current} ${suffix}`);
    lastFinalChunkRef.current = { text: chunk, at: t };
    recent.set(chunk, t);

    // Keep the dedupe map tiny and time-bounded.
    for (const [seenChunk, seenAt] of recent.entries()) {
      if (t - seenAt > 5000) recent.delete(seenChunk);
    }

    return true;
  }, []);

  const createAndStart = useCallback(() => {
    if (!isSupported || !shouldListenRef.current) return;

    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionImpl();
    const instanceId = recognitionInstanceIdRef.current + 1;
    recognitionInstanceIdRef.current = instanceId;

    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      if (instanceId !== recognitionInstanceIdRef.current || !shouldListenRef.current) return;

      let interimText = "";
      let gotNewFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript || "";
        if (result.isFinal) {
          gotNewFinal = appendFinalChunk(text) || gotNewFinal;
        } else {
          interimText = compact(`${interimText} ${text}`);
        }
      }

      if (gotNewFinal) setFinalTranscript(compact(finalTranscriptRef.current));
      setTranscript(compact(`${finalTranscriptRef.current} ${interimText}`));
    };

    recognition.onerror = (event) => {
      if (instanceId !== recognitionInstanceIdRef.current) return;
      // "no-speech" fires during natural pauses; onend will restart if the
      // caller has not explicitly stopped. "aborted" is also expected when
      // replacing an instance.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        shouldListenRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (instanceId !== recognitionInstanceIdRef.current) return;
      recognitionRef.current = null;
      if (shouldListenRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(() => createAndStart(), 180);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, [appendFinalChunk, isSupported, lang]);

  const start = useCallback(() => {
    if (!isSupported) return;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.abort();
      } catch {
        /* no-op */
      }
      recognitionRef.current = null;
    }

    resetDedupe();
    setTranscript("");
    setFinalTranscript("");
    shouldListenRef.current = true;
    createAndStart();
  }, [isSupported, createAndStart, resetDedupe]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionInstanceIdRef.current += 1;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* no-op */
    }
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    resetDedupe();
    setTranscript("");
    setFinalTranscript("");
  }, [resetDedupe]);

  return { transcript, finalTranscript, isListening, isSupported, start, stop, reset };
}
