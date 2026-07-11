"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function HifzPage() {
  const [due, setDue] = useState([]);
  const [progress, setProgress] = useState([]);
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState("");

  const [goalTitle, setGoalTitle] = useState("");
  const [goalDate, setGoalDate] = useState("");

  function refresh() {
    Promise.all([api.getDueReviews(), api.getProgress(), api.listGoals()])
      .then(([d, p, g]) => {
        setDue(d);
        setProgress(p);
        setGoals(g);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(refresh, []);

  const memorizedCount = progress.filter((p) => p.status === "memorized").length;
  const learningCount = progress.filter((p) => p.status === "learning").length;

  async function handleCreateGoal(e) {
    e.preventDefault();
    try {
      await api.createGoal({
        title: goalTitle,
        target_date: goalDate ? new Date(goalDate).toISOString() : null,
      });
      setGoalTitle("");
      setGoalDate("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Your hifz</h1>
        <p className="page-subtitle">Spaced-repetition review, powered by your recitation sessions.</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="card-row" style={{ marginBottom: 24, gap: 16 }}>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <p className="muted">Due today</p>
            <p style={{ fontSize: 32, margin: 0 }}>{due.length}</p>
          </div>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <p className="muted">Learning</p>
            <p style={{ fontSize: 32, margin: 0 }}>{learningCount}</p>
          </div>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <p className="muted">Memorized</p>
            <p style={{ fontSize: 32, margin: 0 }}>{memorizedCount}</p>
          </div>
        </div>

        <h3>Goals</h3>
        <form onSubmit={handleCreateGoal} className="card">
          <label htmlFor="goalTitle">New goal</label>
          <input
            id="goalTitle"
            type="text"
            placeholder="e.g. Memorize Juz 30 in 3 months"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            required
          />
          <label htmlFor="goalDate">Target date (optional)</label>
          <input id="goalDate" type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
          <button type="submit">Add goal</button>
        </form>

        {goals.map((g) => (
          <div key={g.id} className="card card-row">
            <div>
              <h3>{g.title}</h3>
              {g.target_date && <span className="muted">Target: {new Date(g.target_date).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}

        <h3 style={{ marginTop: 32 }}>All progress</h3>
        {progress.length === 0 && <p className="muted">No ayahs tracked yet — complete a recitation session to start.</p>}
        {progress.map((p) => (
          <div key={p.ayah_id} className="card card-row">
            <span>Ayah #{p.ayah_id}</span>
            <span className={`pill status-${p.status}`}>{p.status}</span>
            <span className="muted">
              {p.due_at ? `due ${new Date(p.due_at).toLocaleDateString()}` : "not scheduled"}
            </span>
          </div>
        ))}
      </main>
    </>
  );
}
