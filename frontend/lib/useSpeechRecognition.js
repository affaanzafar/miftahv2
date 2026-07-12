"use client";

import { useRef, useState, useCallback } from "react";

/**
 * Wraps the browser's built-in SpeechRecognition (Web Speech API).
 * Phase 1 "audio capture + STT" step: no server round-trip, no model to
 * host or fine-tune. Works today in Chrome/Edge; Safari/Firefox support is
 * partial, so surface `isSupported` in the UI.
 *
 * continuous: true, because recitation now runs across a whole surah in
 * one open session rather than one ayah at a time. To avoid the duplicate-
 * transcript bug this used to have, onresult only processes results from
 * event.resultIndex onward (never re-reads old entries), and the browser's
 * tendency to silently stop continuous recognition after ~60s of speech is
 * handled by auto-restarting whenever the session ends but the caller
 * hasn't explicitly called stop().
 *
 * Swap point for later: once you have a fine-tuned Quranic ASR model,
 * replace this hook's internals with MediaRecorder + a POST to your own
 * STT endpoint, keeping the same { transcript, isListening, start, stop }
 * interface so the recitation UI doesn't need to change.
 */
export function useSpeechRecognition({ lang = "ar-SA" } = {}) {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const shouldListenRef = useRef(false);

  const createAndStart = useCallback(() => {
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + " ";
        } else {
          interimText += result[0].transcript;
        }
      }
      setTranscript((finalTranscriptRef.current + interimText).trim());
    };

    recognition.onerror = (event) => {
      // "no-speech" fires often during natural pauses — not a real error,
      // the onend handler below will restart us if we're still supposed
      // to be listening.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        shouldListenRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Browser silently ended the session (common timeout behavior)
        // but we're still supposed to be listening — pick back up.
        createAndStart();
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [lang]);

  const start = useCallback(() => {
    if (!isSupported) return;

    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.abort();
      } catch (e) {
        /* no-op */
      }
      recognitionRef.current = null;
    }

    finalTranscriptRef.current = "";
    setTranscript("");
    shouldListenRef.current = true;
    createAndStart();
  }, [isSupported, createAndStart]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
  }, []);

  return { transcript, isListening, isSupported, start, stop, reset };
}
