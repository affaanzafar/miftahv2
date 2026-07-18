"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Nav from "../../../components/Nav";
import { api } from "../../../lib/api";
import { useSpeechRecognition } from "../../../lib/useSpeechRecognition";

/**
 * Continuous "whole mushaf" recitation.
 *
 * The whole surah (or review range) renders as one scrollable page, like a
 * real mushaf. Recitation is checked ayah-by-ayah under the hood using the
 * same submitAttempt endpoint as before — nothing changed on the backend —
 * but the UI no longer gates you behind a per-ayah submit/next click.
 *
 * While listening is active, every finalized chunk of speech is compared
 * against the ayah currently "in focus". Once enough of that ayah's words
 * have been matched, it's scored and focus auto-advances to the next ayah,
 * without interrupting your recitation. You can pause/resume or stop early
 * at any time; whatever was scored so far is kept.
 */
export default function RecitePage() {
  const { surahId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isReview = searchParams.get("review") === "1";
  const rangeStart = searchParams.get("start") ? Number(searchParams.get("start")) : null;
  const rangeEnd = searchParams.get("end") ? Number(searchParams.get("end")) : null;

  const [surah, setSurah] = useState(null);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [focusIndex, setFocusIndex] = useState(0); // index into ayahsInRange currently being checked
  const [ayahResults, setAyahResults] = useState({}); // ayah.id -> { results, ayah_accuracy }
  const [sessionSummary, setSessionSummary] = useState(null);
  const [appliedToHifz, setAppliedToHifz] = useState(false);
  const [checking, setChecking] = useState(false);

  const { transcript, finalTranscript, isListening, isSupported, start, stop, reset } = useSpeechRecognition();

  const bufferRef = useRef(""); // words accumulated since the last successful ayah check
  const lastProcessedFinalRef = useRef("");
  const focusIndexRef = useRef(0);
  const ayahRefs = useRef({});
  const settleTimerRef = useRef(null);
  const checkingRef = useRef(false); // mirrors `checking` state but read-safe inside async closures
  const pendingRecheckRef = useRef(false);

  useEffect(() => {
    focusIndexRef.current = focusIndex;
  }, [focusIndex]);

  useEffect(() => {
    if (!surahId) return;
    api
      .getSurah(surahId)
      .then(setSurah)
      .catch((e) => setError(e.message));
  }, [surahId]);

  const ayahsInRange = surah
    ? surah.ayahs.filter(
        (a) => a.ayah_number >= (rangeStart || 1) && a.ayah_number <= (rangeEnd || surah.ayah_count)
      )
    : [];

  // Keep the current ayah scrolled into view as focus advances.
  useEffect(() => {
    const ayah = ayahsInRange[focusIndex];
    if (ayah && ayahRefs.current[ayah.id]) {
      ayahRefs.current[ayah.id].scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIndex]);

  async function handleStart() {
    if (!surah || ayahsInRange.length === 0) return;
    try {
      const { session_id } = await api.startSession(
        surah.id,
        ayahsInRange[0].ayah_number,
        ayahsInRange[ayahsInRange.length - 1].ayah_number,
        isReview
      );
      setSessionId(session_id);
      setFocusIndex(0);
      bufferRef.current = "";
      lastProcessedFinalRef.current = "";
      start();
    } catch (e) {
      setError(e.message);
    }
  }

  // Only confirmed (final) speech ever touches the scoring buffer — interim
  // guesses are shown live in the UI but can be revised by the browser as
  // it hears more, so building the buffer from them causes corrupted,
  // out-of-order fragments to get permanently baked in.
  useEffect(() => {
    if (!finalTranscript) return;
    const newPortion = finalTranscript.slice(lastProcessedFinalRef.current.length).trim();
    if (newPortion) {
      bufferRef.current = (bufferRef.current + " " + newPortion).trim();
    }
    lastProcessedFinalRef.current = finalTranscript;
    // Check as soon as enough words are in — no artificial silence wait.
    // maybeCheckFocusAyah already refuses to score until the full expected
    // word count for this ayah has arrived, so this doesn't risk scoring a
    // half-finished ayah; it just removes the extra latency that made
    // continuous, unpaused recitation feel like it needed a pause to
    // "unstick" the checker.
    maybeCheckFocusAyah();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalTranscript]);

  async function maybeCheckFocusAyah() {
    // Gate on the ref, not the `checking` state — React state updates are
    // batched/async, so two finalized speech chunks arriving close together
    // (normal during fluid, unpaused recitation) could both read `checking`
    // as still false and run concurrently, both reading/trimming
    // bufferRef.current at once. That race was corrupting the word window
    // sent for scoring — a real recitation could come back with a wrong
    // score for reasons that had nothing to do with what was actually said.
    if (checkingRef.current) {
      pendingRecheckRef.current = true;
      return;
    }

    const idx = focusIndexRef.current;
    const ayah = ayahsInRange[idx];
    if (!ayah) return;

    const bufferWords = bufferRef.current.split(/\s+/).filter(Boolean);
    const expectedWordCount = ayah.words.length;

    // Require the full expected word count (not a fraction of it) before
    // scoring — this alone (no artificial silence wait) is what keeps a
    // partial recitation from being scored too early.
    if (bufferWords.length < expectedWordCount) return;

    // Only score against a window sized to *this* ayah, not the whole
    // buffer. A fluid reciter (i.e. everyone — nobody pauses hard after
    // every single ayah) will often have already started the next ayah
    // by the time this fires, so the buffer can contain real spillover.
    // Sending that whole overflowing buffer to alignment let words from
    // the *next* ayah get matched into the *current* one — especially bad
    // in surahs with repeated phrases (e.g. "الرحمن الرحيم" appears in
    // both ayah 1 and ayah 3 of Al-Fatihah), where the aligner could latch
    // onto the wrong occurrence and silently wreck an otherwise perfect
    // score. A little slack above the expected count is kept so a stutter
    // or repeated word isn't truncated mid-recitation; anything beyond
    // that is left in the buffer to roll over and be scored correctly
    // against the *next* ayah instead.
    const SLACK_WORDS = 4;
    const windowWords = bufferWords.slice(0, expectedWordCount + SLACK_WORDS);
    const bufferForCheck = windowWords.join(" ");

    checkingRef.current = true;
    setChecking(true);
    try {
      const res = await api.submitAttempt(sessionId, ayah.id, bufferForCheck);
      setAyahResults((prev) => ({ ...prev, [ayah.id]: res }));

      // Trim exactly the words the alignment actually consumed for this
      // ayah — not a fixed expectedWordCount — since a "missed" expected
      // word consumes zero transcript words, and an "added" word consumes
      // one that isn't in ayah.words. Using the fixed count here is what
      // let a single insertion/deletion anywhere upstream cascade into
      // every ayah after it being checked against the wrong slice of buffer.
      const consumedCount = res.results.filter((r) => r.status !== "missed").length;
      bufferRef.current = bufferWords.slice(consumedCount).join(" ");

      if (idx + 1 < ayahsInRange.length) {
        setFocusIndex(idx + 1);
      } else {
        await finishUp();
      }
    } catch (e) {
      // If a single check fails, don't kill the whole session — just keep
      // listening and try again once more speech comes in.
    } finally {
      checkingRef.current = false;
      setChecking(false);
      // New finalized speech arrived while this check was in flight (e.g.
      // the reciter kept going without pausing) — re-run immediately
      // instead of waiting for the *next* speech event, so a continuous
      // reciter never has to stop to "unstick" the checker.
      if (pendingRecheckRef.current) {
        pendingRecheckRef.current = false;
        maybeCheckFocusAyah();
      }
    }
  }

  async function finishUp() {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    stop();
    try {
      const result = await api.completeSession(sessionId);
      setSessionSummary(result);
      if (isReview) {
        await api.applyReview(sessionId);
        setAppliedToHifz(true);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleApplyToHifz() {
    try {
      await api.applyReview(sessionId);
      router.push("/hifz");
    } catch (e) {
      setError(e.message);
    }
  }

  function handleTogglePause() {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (isListening) {
      stop();
    } else {
      reset();
      lastProcessedFinalRef.current = "";
      start();
    }
  }

  function jumpToAyah(idx) {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    bufferRef.current = "";
    lastProcessedFinalRef.current = "";
    reset();
    setFocusIndex(idx);
  }

  if (error) {
    return (
      <>
        <Nav />
        <main className="page">
          <div className="error-banner">{error}</div>
        </main>
      </>
    );
  }

  if (!surah) {
    return (
      <>
        <Nav />
        <main className="page">
          <p className="muted">Loading…</p>
        </main>
      </>
    );
  }

  if (sessionSummary) {
    const scored = Object.values(ayahResults);
    const avgAccuracy = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + r.ayah_accuracy, 0) / scored.length)
      : sessionSummary.accuracy_score;

    return (
      <>
        <Nav />
        <main className="page">
          <h1 className="page-title">{isReview ? "Review complete" : "Session complete"}</h1>
          <div className="card">
            <h3>{surah.name_transliteration}</h3>
            <p className="muted">Overall accuracy</p>
            <p style={{ fontSize: 40, fontFamily: "Amiri, serif", margin: 0 }}>
              {sessionSummary.accuracy_score ?? avgAccuracy}%
            </p>
          </div>
          {appliedToHifz ? (
            <p className="success-banner">Applied to your hifz schedule.</p>
          ) : (
            <button onClick={handleApplyToHifz}>Apply to hifz schedule</button>
          )}{" "}
          <button className="secondary" onClick={() => router.push(isReview ? "/hifz" : "/")}>
            {isReview ? "Back to hifz" : "Back to surahs"}
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="page" style={{ paddingBottom: 160 }}>
        <h1 className="page-title">
          {surah.name_transliteration}{" "}
          <span className="ayah-arabic" style={{ fontSize: 26 }}>
            {surah.name_arabic}
          </span>
        </h1>
        <p className="page-subtitle">
          {isReview
            ? `Review — ayahs ${ayahsInRange[0]?.ayah_number}–${ayahsInRange[ayahsInRange.length - 1]?.ayah_number}`
            : `${surah.ayah_count} ayahs · ${surah.name_translation}`}
        </p>

        {!isSupported && (
          <div className="error-banner">
            Your browser doesn't support live speech recognition (Chrome or Edge work best). You can
            still read the surah below.
          </div>
        )}

        {!sessionId && (
          <button onClick={handleStart} disabled={!isSupported || ayahsInRange.length === 0}>
            {isReview ? "Start review" : "Start reciting"}
          </button>
        )}

        <div style={{ marginTop: 28 }}>
          {ayahsInRange.map((ayah, idx) => {
            const result = ayahResults[ayah.id];
            const isFocus = sessionId && idx === focusIndex && !result;
            const isDone = !!result;

            return (
              <div
                key={ayah.id}
                ref={(el) => (ayahRefs.current[ayah.id] = el)}
                className="illuminated-card"
                style={{
                  marginBottom: 20,
                  cursor: sessionId ? "pointer" : "default",
                  outline: isFocus ? "2px solid var(--gold)" : "none",
                  outlineOffset: 2,
                }}
                onClick={() => sessionId && !isDone && jumpToAyah(idx)}
              >
                <p className="muted" style={{ margin: "0 0 8px" }}>
                  Ayah {ayah.ayah_number}
                  {isDone && (
                    <span style={{ marginLeft: 10 }}>
                      · <strong>{result.ayah_accuracy}%</strong>
                    </span>
                  )}
                  {isFocus && (
                    <span style={{ marginLeft: 10, color: "var(--gold-soft)" }}>
                      {isListening ? "● listening…" : "paused"}
                    </span>
                  )}
                </p>
                <p className="ayah-arabic">
                  {isDone
                    ? result.results
                        .filter((r) => r.status !== "added")
                        .map((r, i) => (
                          <span key={i} className={`ayah-word ${r.status}`}>
                            {r.expected}{" "}
                          </span>
                        ))
                    : ayah.words.map((w) => (
                        <span key={w.position} className="ayah-word">
                          {w.text_uthmani}{" "}
                        </span>
                      ))}
                </p>
              </div>
            );
          })}
        </div>

        {sessionId && !sessionSummary && (
          <div className="card recite-controls">
            <div className="recite-controls-info">
              <p className="muted" style={{ margin: 0 }}>
                Ayah {focusIndex + 1} of {ayahsInRange.length}
                {checking && " · checking…"}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 14, minHeight: 20 }}>{transcript}</p>
            </div>
            <div className="recite-controls-actions">
              <button onClick={handleTogglePause}>{isListening ? "⏸ Pause" : "🎙️ Resume"}</button>
              <button className="secondary" onClick={finishUp}>
                Finish now
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
