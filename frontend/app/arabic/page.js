"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../../components/Nav";
import { api, getToken } from "../../lib/api";

const TABS = ["Quiz", "Progress", "Free Courses", "Additional Resources"];

export default function ArabicLearningPage() {
  const [tab, setTab] = useState("Quiz");

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Arabic Learning</h1>
        <p className="page-subtitle">Quizzes, progress, free courses, and resources — free, no account required to browse.</p>

        <div className="tabs" role="tablist" aria-label="Arabic Learning sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`tab-button ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          {tab === "Quiz" && <QuizTab />}
          {tab === "Progress" && <ProgressTab />}
          {tab === "Free Courses" && <CoursesTab />}
          {tab === "Additional Resources" && <ResourcesTab />}
        </div>
      </main>
    </>
  );
}

/* --------------------------------- Quiz --------------------------------- */

function QuizTab() {
  const [quizzes, setQuizzes] = useState(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null); // { id, title, questions }
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const loggedIn = typeof window !== "undefined" && !!getToken();

  useEffect(() => {
    api.listQuizzes().then(setQuizzes).catch((e) => setError(e.message));
  }, []);

  async function openQuiz(summary) {
    setError("");
    setResult(null);
    try {
      const detail = await api.getQuiz(summary.id);
      setActive(detail);
      setAnswers(new Array(detail.questions.length).fill(null));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSubmit() {
    if (answers.some((a) => a === null)) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await api.submitQuiz(active.id, answers);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="error-banner">{error}</p>;

  if (active && !result) {
    return (
      <div className="illuminated-card">
        <h3 style={{ marginTop: 0 }}>{active.title}</h3>
        <p className="muted">{active.course_title}</p>
        {active.questions.map((q, qi) => (
          <div key={q.id} style={{ marginBottom: 20 }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>{qi + 1}. {q.prompt}</p>
            {q.options.map((opt, oi) => (
              <label key={oi} style={{ display: "block", padding: "6px 0", cursor: "pointer" }}>
                <input
                  type="radio"
                  name={`q-${qi}`}
                  checked={answers[qi] === oi}
                  onChange={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                  style={{ marginRight: 8 }}
                />
                {opt}
              </label>
            ))}
          </div>
        ))}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={handleSubmit} disabled={submitting || answers.some((a) => a === null)}>
            {submitting ? "Scoring…" : "Submit"}
          </button>
          <button type="button" className="secondary" onClick={() => setActive(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="illuminated-card" style={{ textAlign: "center" }}>
        <h3 style={{ marginTop: 0 }}>{result.quiz_title}</h3>
        <p style={{ fontSize: 32, fontWeight: 700, margin: "8px 0" }}>{result.score_pct}%</p>
        <p className="muted">{result.correct_count} of {result.total} correct</p>
        <button type="button" onClick={() => { setActive(null); setResult(null); }}>Back to quizzes</button>
      </div>
    );
  }

  if (quizzes === null) return <p className="muted">Loading quizzes…</p>;
  if (quizzes.length === 0) {
    return (
      <div className="illuminated-card" style={{ textAlign: "center" }}>
        <p style={{ marginBottom: 0 }}>No quizzes yet — check back shortly.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {!loggedIn && <p className="muted">You can take quizzes as a guest, but sign in to save your scores.</p>}
      {quizzes.map((q) => (
        <div key={q.id} className="illuminated-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{q.title}</p>
            <p className="muted" style={{ margin: "4px 0 0" }}>{q.course_title} · {q.question_count} questions</p>
          </div>
          <button type="button" onClick={() => openQuiz(q)}>Start</button>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Progress ------------------------------- */

function ProgressTab() {
  const [courses, setCourses] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const loggedIn = typeof window !== "undefined" && !!getToken();

  useEffect(() => {
    if (!loggedIn) return;
    Promise.all([api.listArabicCourses(), api.myQuizResults()])
      .then(([c, r]) => {
        setCourses(c.filter((x) => x.enrolled));
        setResults(r);
      })
      .catch((e) => setError(e.message));
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="illuminated-card" style={{ textAlign: "center" }}>
        <p style={{ marginBottom: 12 }}>Sign in to track your course progress and quiz scores.</p>
        <Link href="/miftah/login"><button type="button">Sign in</button></Link>
      </div>
    );
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (courses === null) return <p className="muted">Loading your progress…</p>;

  return (
    <div>
      <h3>Courses</h3>
      {courses.length === 0 && <p className="muted">You haven't enrolled in a course yet.</p>}
      {courses.map((c) => (
        <div key={c.id} className="illuminated-card" style={{ marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{c.title}</p>
          <div style={{ height: 6, borderRadius: 999, background: "var(--parchment-deep)", overflow: "hidden", marginTop: 8 }}>
            <div style={{ height: "100%", width: `${c.progress_pct}%`, background: "var(--forest)", borderRadius: 999 }} />
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>{c.progress_pct}% complete</p>
        </div>
      ))}

      <h3 style={{ marginTop: 24 }}>Quiz history</h3>
      {results && results.length === 0 && <p className="muted">No quizzes taken yet.</p>}
      {results && results.map((r, i) => (
        <div key={i} className="illuminated-card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0 }}>{r.quiz_title}</p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{r.course_title} · {new Date(r.taken_at).toLocaleDateString()}</p>
          </div>
          <p style={{ margin: 0, fontWeight: 700 }}>{r.score_pct}%</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Free Courses ------------------------------ */

function CoursesTab() {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listArabicCourses().then(setCourses).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error-banner">{error}</p>;
  if (courses === null) return <p className="muted">Loading courses…</p>;
  if (courses.length === 0) {
    return (
      <div className="illuminated-card" style={{ textAlign: "center" }}>
        <p style={{ marginBottom: 4 }}>Your first course is coming soon.</p>
        <p className="muted" style={{ marginBottom: 0 }}>Check back shortly.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {courses.map((c) => (
        <Link key={c.id} href={`/arabic/${c.slug}`} className="shortcut-card">
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h3 style={{ margin: 0 }}>{c.title}</h3>
              <span className="pill status-new">{c.level}</span>
            </div>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              {c.description || `${c.lesson_count} lessons`}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* --------------------------- Additional Resources -------------------------- */

function ResourcesTab() {
  const resources = [
    { title: "Quran.com", blurb: "Read, listen, and search the Qur'an with translations.", url: "https://quran.com" },
    { title: "Lane's Lexicon", blurb: "Classical Arabic-English dictionary, entry by root.", url: "https://www.studyquran.org/LaneLexicon/" },
    { title: "Al-Dirassa", blurb: "Structured Modern Standard Arabic learning materials.", url: "https://www.al-dirassa.com" },
  ];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {resources.map((r) => (
        <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="shortcut-card">
          <div className="card">
            <h3 style={{ margin: 0 }}>{r.title} ↗</h3>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>{r.blurb}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
