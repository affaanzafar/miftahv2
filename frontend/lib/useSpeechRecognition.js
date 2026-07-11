"use client";

import { useRef, useState, useCallback } from "react";

/**
 * Wraps the browser's built-in SpeechRecognition (Web Speech API).
 * This is the Phase 1 "audio capture + STT" step: no server round-trip,
 * no model to host or fine-tune. Works today in Chrome/Edge; Safari/Firefox
 * support is partial, so surface `isSupported` in the UI.
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

  const start = useCallback(() => {
    if (!isSupported) return;
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        finalText += event.results[i][0].transcript + " ";
      }
      setTranscript(finalText.trim());
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => setTranscript(""), []);

  return { transcript, isListening, isSupported, start, stop, reset };
}
