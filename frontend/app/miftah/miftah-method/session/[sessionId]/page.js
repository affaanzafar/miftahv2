"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../../../components/Nav";
import { api } from "../../../../../lib/api";
import { useSpeechRecognition } from "../../../../../lib/useSpeechRecognition";

const PHASE_LABEL = {
  repeat: "Step 1 — Repeat aloud",
  recall: "Step 2 — Recall from memory",
  cumulative: "Step 3 — Recall together with everything so far",
};

const PHASE_LABEL_SKIP_REPEAT = {
  recall: "Recall from memory",
  cumulative: "Recall together with everything so far",
};

export default function MiftahMethodSessionPage() {
  const { sessionId } = useParams();
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null); // { results, accuracy, passed, message }
  const [submitting, setSubmitting] = useState(false);
  const [scriptScope, setScriptScope] = useState(null); // null (closed) | "session" | "surah"
  const [surahMemorized, setSurahMemorized] = useState(null); // fetched lazily on first "whole surah" view

  function loadSurahMemorized(surahId) {
    if (surahMemorized) return;
    api
      .getProgress()
      .then((rows) => {
        const memorized = rows
          .filter((r) => r.surah_id === Number(surahId) && r.status === "memorized")
          .sort((a, b) => a.ayah_number - b.ayah_number);
        setSurahMemorized(memorized);
      })
      .catch((e) => setError(e.message));
  }

  const { transcript, isListening, isSupported, start, stop, reset } = useSpeechRecognition();

  function load() {
    api
      .getMiftahMethodSession(sessionId)
      .then(setSession)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [sessionId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.submitMiftahMethodAttempt(sessionId, transcript);
      setSession((prev) => ({ ...prev, ...res.session }));
      setFeedback(res);
      reset();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleTryAgain() {
    setFeedback(null);
    reset();
  }

  if (error && !session) {
    return (
      <>
        <Nav />
        <main className="page">
          <div className="error-banner">{error}</div>
        </main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Nav />
        <main className="page">
          <p className="muted">Loading…</p>
        </main>
      </>
    );
  }

  if (session.status === "completed") {
    return (
      <>
        <Nav />
        <main className="page">
          <h1 className="page-title">Session complete</h1>
          <div className="card">
            <h3>{session.surah.name_transliteration}</h3>
            <p className="muted">
              Ayahs {session.start_ayah_number}–{session.end_ayah_number}
            </p>
            <p style={{ fontSize: 20, margin: "12px 0 0" }}>
              Memorized individually, and fluent as a set. Nicely done.
            </p>
          </div>
          <button onClick={() => router.push("/miftah/hifz")}>View in Hifz</button>{" "}
          <button className="secondary" onClick={() => router.push("/miftah/miftah-method")}>
            Start another session
          </button>
        </main>
      </>
    );
  }

  const currentAyah = session.ayahs.find((a) => a.ayah_number === session.current_ayah_number);
  const cumulativeAyahs = session.ayahs.filter(
    (a) => a.ayah_number >= session.start_ayah_number && a.ayah_number <= session.current_ayah_number
  );
  const textVisible = session.phase === "repeat";

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">{session.surah.name_transliteration}</h1>
        <p className="page-subtitle">
          Ayah {session.current_ayah_number} of {session.end_ayah_number} (started at {session.start_ayah_number})
          {session.skip_repeat && " · Test mode — reciting from memory only"}
        </p>

        {error && <div className="error-banner">{error}</div>}

        <div className={`phase-banner phase-${session.phase}`}>
          <span>
            {session.skip_repeat ? PHASE_LABEL_SKIP_REPEAT[session.phase] : PHASE_LABEL[session.phase]}
          </span>
          {session.phase === "repeat" && (
            <div className="repeat-dots">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`repeat-dot ${i < session.repeat_count ? "filled" : ""}`} />
              ))}
            </div>
          )}
        </div>

        {!isSupported && (
          <div className="error-banner">
            Your browser doesn't support live speech recognition (Chrome or Edge work best).
          </div>
        )}

        <div className="illuminated-card">
          {session.phase === "cumulative" ? (
            <div className="hidden-ayah-placeholder">
              Recite ayahs {session.start_ayah_number}–{session.current_ayah_number} together, from memory.
            </div>
          ) : textVisible ? (
            <p className="ayah-arabic">
              {currentAyah?.words.map((w) => (
                <span key={w.position} className="ayah-word">
                  {w.text_uthmani}{" "}
                </span>
              ))}
            </p>
          ) : (
            <div className="hidden-ayah-placeholder">Recite this ayah from memory — no peeking.</div>
          )}
        </div>

        {!feedback ? (
          <div className="card">
            <p className="muted">
              {isListening ? "Listening… recite, then press stop." : "Press start, then recite aloud."}
            </p>
            <p style={{ minHeight: 24 }}>{transcript}</p>
            {!isListening ? (
              <button onClick={start} disabled={!isSupported}>🎙️ Start speaking</button>
            ) : (
              <button className="danger" onClick={stop}>⏹ Stop</button>
            )}{" "}
            <button className="secondary" onClick={handleSubmit} disabled={!transcript || submitting}>
              {submitting ? "Checking…" : "Submit"}
            </button>
          </div>
        ) : (
          <div className="card">
            <p>
              Accuracy: <strong>{feedback.accuracy}%</strong>
            </p>
            <p className={feedback.passed ? "success-banner" : "error-banner"} style={{ marginTop: 8 }}>
              {feedback.message}
            </p>
            {/* Word-level breakdown — what was actually said vs. what was expected.
                Shown for every phase, including recall/cumulative where the ayah text
                was hidden while reciting: the point here isn't to peek before reciting,
                it's to see exactly which word(s) broke a failed (or passed) attempt. */}
            {feedback.results?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p className="muted" style={{ marginBottom: 6 }}>What you recited:</p>
                <p className="ayah-arabic" style={{ fontSize: 24 }}>
                  {feedback.results
                    .filter((r) => r.status !== "added")
                    .map((r, i) => (
                      <span key={i} className={`ayah-word ${r.status}`} title={r.status}>
                        {r.expected ?? r.recognized}{" "}
                      </span>
                    ))}
                </p>
                {feedback.results.some((r) => r.status === "wrong" || r.status === "missed") && (
                  <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    <span style={{ color: "var(--wrong)" }}>underlined</span> = said differently ·{" "}
                    <span style={{ color: "var(--gold)" }}>faded</span> = skipped entirely
                  </p>
                )}
              </div>
            )}
            <button onClick={handleTryAgain} style={{ marginTop: 12 }}>
              {feedback.passed ? "Continue" : "Try again"}
            </button>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <p className="muted" style={{ marginBottom: 8 }}>
            Mastered so far in this session:{" "}
            {cumulativeAyahs.filter((a) => a.ayah_number < session.current_ayah_number).map((a) => a.ayah_number).join(", ") ||
              "none yet"}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setScriptScope(scriptScope === "session" ? null : "session")}
            >
              {scriptScope === "session" ? "Hide script" : "View this session's script"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const next = scriptScope === "surah" ? null : "surah";
                setScriptScope(next);
                if (next === "surah") loadSurahMemorized(session.surah_id);
              }}
            >
              {scriptScope === "surah" ? "Hide script" : "View whole surah memorized"}
            </button>
          </div>

          {scriptScope === "session" && (
            <div className="card" style={{ marginTop: 12 }}>
              {cumulativeAyahs.filter((a) => a.ayah_number < session.current_ayah_number).length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Nothing mastered in this session yet.</p>
              ) : (
                cumulativeAyahs
                  .filter((a) => a.ayah_number < session.current_ayah_number)
                  .map((a) => (
                    <p key={a.id} className="ayah-arabic" style={{ marginBottom: 10 }}>
                      <span className="muted" style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, marginRight: 8 }}>
                        {a.ayah_number}
                      </span>
                      {a.words.map((w) => (
                        <span key={w.position} className="ayah-word">
                          {w.text_uthmani}{" "}
                        </span>
                      ))}
                    </p>
                  ))
              )}
            </div>
          )}

          {scriptScope === "surah" && (
            <div className="card" style={{ marginTop: 12 }}>
              {!surahMemorized ? (
                <p className="muted" style={{ margin: 0 }}>Loading…</p>
              ) : surahMemorized.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>No ayahs marked memorized in {session.surah.name_transliteration} yet.</p>
              ) : (
                surahMemorized.map((a) => (
                  <p key={a.ayah_id} className="ayah-arabic" style={{ marginBottom: 10 }}>
                    <span className="muted" style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, marginRight: 8 }}>
                      {a.ayah_number}
                    </span>
                    {a.text_uthmani}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
