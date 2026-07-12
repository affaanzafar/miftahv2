"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../../components/Nav";
import { api } from "../../../../lib/api";
import { useSpeechRecognition } from "../../../../lib/useSpeechRecognition";

const PHASE_LABEL = {
  repeat: "Step 1 — Repeat aloud",
  recall: "Step 2 — Recall from memory",
  cumulative: "Step 3 — Recall together with everything so far",
};

export default function MiftahMethodSessionPage() {
  const { sessionId } = useParams();
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null); // { results, accuracy, passed, message }
  const [submitting, setSubmitting] = useState(false);

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
          <button onClick={() => router.push("/hifz")}>View in Hifz</button>{" "}
          <button className="secondary" onClick={() => router.push("/miftah-method")}>
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
        </p>

        {error && <div className="error-banner">{error}</div>}

        <div className={`phase-banner phase-${session.phase}`}>
          <span>{PHASE_LABEL[session.phase]}</span>
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
            <button onClick={handleTryAgain}>
              {feedback.passed ? "Continue" : "Try again"}
            </button>
          </div>
        )}

        <p className="muted" style={{ marginTop: 24 }}>
          Mastered so far in this session:{" "}
          {cumulativeAyahs.filter((a) => a.ayah_number < session.current_ayah_number).map((a) => a.ayah_number).join(", ") ||
            "none yet"}
        </p>
      </main>
    </>
  );
}
