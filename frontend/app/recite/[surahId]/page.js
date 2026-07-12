"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Nav from "../../../components/Nav";
import { api } from "../../../lib/api";
import { useSpeechRecognition } from "../../../lib/useSpeechRecognition";

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
  const [ayahIndex, setAyahIndex] = useState(0); // index into ayahsInRange
  const [wordResults, setWordResults] = useState(null); // results for the current ayah
  const [ayahScores, setAyahScores] = useState([]); // accuracy per completed ayah
  const [sessionSummary, setSessionSummary] = useState(null);
  const [appliedToHifz, setAppliedToHifz] = useState(false);

  const { transcript, isListening, isSupported, start, stop, reset } = useSpeechRecognition();

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

  async function handleStart() {
    if (!surah) return;
    try {
      const { session_id } = await api.startSession(
        surah.id,
        ayahsInRange[0].ayah_number,
        ayahsInRange[ayahsInRange.length - 1].ayah_number,
        isReview
      );
      setSessionId(session_id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSubmitAyah() {
    const ayah = ayahsInRange[ayahIndex];
    try {
      const res = await api.submitAttempt(sessionId, ayah.id, transcript);
      setWordResults(res);
      setAyahScores((prev) => [...prev, res.ayah_accuracy]);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleNextAyah() {
    reset();
    setWordResults(null);
    if (ayahIndex + 1 < ayahsInRange.length) {
      setAyahIndex(ayahIndex + 1);
    } else {
      handleComplete();
    }
  }

  async function handleComplete() {
    try {
      const result = await api.completeSession(sessionId);
      setSessionSummary(result);
      if (isReview) {
        // a review session applies straight to the hifz schedule — no extra click needed
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
    return (
      <>
        <Nav />
        <main className="page">
          <h1 className="page-title">{isReview ? "Review complete" : "Session complete"}</h1>
          <div className="card">
            <h3>{surah.name_transliteration}</h3>
            <p className="muted">Overall accuracy</p>
            <p style={{ fontSize: 40, fontFamily: "Amiri, serif", margin: 0 }}>
              {sessionSummary.accuracy_score}%
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

  if (!sessionId) {
    return (
      <>
        <Nav />
        <main className="page">
          <h1 className="page-title">
            {surah.name_transliteration} <span className="ayah-arabic" style={{ fontSize: 26 }}>{surah.name_arabic}</span>
          </h1>
          <p className="page-subtitle">
            {isReview
              ? `Review — ayahs ${ayahsInRange[0]?.ayah_number}–${ayahsInRange[ayahsInRange.length - 1]?.ayah_number}`
              : `${surah.ayah_count} ayahs · ${surah.name_translation}`}
          </p>
          {!isSupported && (
            <div className="error-banner">
              Your browser doesn't support live speech recognition (Chrome or Edge work best).
              You can still browse the text.
            </div>
          )}
          <button onClick={handleStart} disabled={!isSupported || ayahsInRange.length === 0}>
            {isReview ? "Start review" : "Start recitation session"}
          </button>
        </main>
      </>
    );
  }

  const ayah = ayahsInRange[ayahIndex];

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">{surah.name_transliteration}</h1>
        <p className="page-subtitle">
          Ayah {ayah.ayah_number} · {ayahIndex + 1} of {ayahsInRange.length}
        </p>

        <div className="illuminated-card">
          <p className="ayah-arabic">
            {wordResults
              ? wordResults.results
                  .filter((r) => r.status !== "added")
                  .map((r, i) => (
                    <span key={i} className={`ayah-word ${r.status}`}>
                      {r.expected}{" "}
                    </span>
                  ))
              : ayah.words.map((w) => <span key={w.position} className="ayah-word">{w.text_uthmani} </span>)}
          </p>
        </div>

        {!wordResults ? (
          <div className="card">
            <p className="muted">
              {isListening ? "Listening… recite the ayah above, then press stop." : "Press start, then recite the ayah aloud."}
            </p>
            <p style={{ minHeight: 24 }}>{transcript}</p>
            {!isListening ? (
              <button onClick={start}>🎙️ Start speaking</button>
            ) : (
              <button className="danger" onClick={stop}>
                ⏹ Stop
              </button>
            )}{" "}
            <button className="secondary" onClick={handleSubmitAyah} disabled={!transcript}>
              Check my recitation
            </button>
          </div>
        ) : (
          <div className="card">
            <p>
              Accuracy for this ayah: <strong>{wordResults.ayah_accuracy}%</strong>
            </p>
            <p className="muted">
              <span style={{ color: "var(--correct)" }}>green</span> = correct ·{" "}
              <span style={{ color: "var(--wrong)" }}>red</span> = wrong word ·{" "}
              <span style={{ color: "var(--missed)" }}>faded</span> = missed word
            </p>
            <button onClick={handleNextAyah}>
              {ayahIndex + 1 < ayahsInRange.length ? "Next ayah" : "Finish session"}
            </button>
          </div>
        )}
      </main>
    </>
  );
}
