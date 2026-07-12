"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnimatedNumber from "../../components/AnimatedNumber";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function HifzPage() {
  const router = useRouter();
  const [dueGroups, setDueGroups] = useState([]);
  const [progress, setProgress] = useState([]);
  const [goals, setGoals] = useState([]);
  const [surahs, setSurahs] = useState([]);
  const [error, setError] = useState("");

  const [goalTitle, setGoalTitle] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalSurahId, setGoalSurahId] = useState("");

  function refresh() {
    Promise.all([api.getDueReviewsGrouped(), api.getProgress(), api.listGoals(), api.listSurahs()])
      .then(([d, p, g, s]) => {
        setDueGroups(d);
        setProgress(p);
        setGoals(g);
        setSurahs(s);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(refresh, []);

  const memorizedCount = progress.filter((p) => p.status === "memorized").length;
  const learningCount = progress.filter((p) => p.status === "learning").length;
  const dueAyahCount = dueGroups.reduce((sum, g) => sum + g.ayah_count, 0);

  async function handleCreateGoal(e) {
    e.preventDefault();
    try {
      await api.createGoal({
        title: goalTitle,
        target_surah_id: goalSurahId ? Number(goalSurahId) : null,
        target_date: goalDate ? new Date(goalDate).toISOString() : null,
      });
      setGoalTitle("");
      setGoalDate("");
      setGoalSurahId("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteGoal(id) {
    try {
      await api.deleteGoal(id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function startReview(group) {
    router.push(
      `/recite/${group.surah_id}?review=1&start=${group.start_ayah_number}&end=${group.end_ayah_number}`
    );
  }

  const sortedProgress = [...progress].sort((a, b) => {
    if (a.surah_id !== b.surah_id) return (a.surah_id || 0) - (b.surah_id || 0);
    return (a.ayah_number || 0) - (b.ayah_number || 0);
  });

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Your hifz</h1>
        <p className="page-subtitle">Spaced-repetition review, powered by your recitation sessions and the Miftah Method.</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="card-row" style={{ marginBottom: 24, gap: 16 }}>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <p className="muted">Due today</p>
            <p style={{ fontSize: 32, margin: 0 }}><AnimatedNumber value={dueAyahCount} /></p>
          </div>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <p className="muted">Learning</p>
            <p style={{ fontSize: 32, margin: 0 }}><AnimatedNumber value={learningCount} /></p>
          </div>
          <div className="card" style={{ flex: 1, textAlign: "center" }}>
            <p className="muted">Memorized</p>
            <p style={{ fontSize: 32, margin: 0 }}><AnimatedNumber value={memorizedCount} /></p>
          </div>
        </div>

        <h3>Due for review</h3>
        {dueGroups.length === 0 && (
          <p className="muted">Nothing due right now — recite or work through the Miftah Method to build up ayahs to review.</p>
        )}
        {dueGroups.map((g, i) => (
          <div key={i} className="card card-row">
            <div>
              <h3>{g.surah_name}</h3>
              <span className="muted">
                Ayahs {g.start_ayah_number}
                {g.end_ayah_number !== g.start_ayah_number ? `–${g.end_ayah_number}` : ""} · {g.ayah_count} ayah
                {g.ayah_count === 1 ? "" : "s"}
              </span>
            </div>
            <button onClick={() => startReview(g)}>Review now</button>
          </div>
        ))}

        <h3 style={{ marginTop: 32 }}>Goals</h3>
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
          <label htmlFor="goalSurah">Target surah (optional, for progress tracking)</label>
          <select
            id="goalSurah"
            value={goalSurahId}
            onChange={(e) => setGoalSurahId(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--parchment-deep)",
              borderRadius: "var(--radius)",
              marginBottom: 18,
              fontSize: 15,
              fontFamily: "inherit",
              background: "#fff",
              color: "var(--ink)",
            }}
          >
            <option value="">No specific surah</option>
            {surahs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}. {s.name_transliteration}
              </option>
            ))}
          </select>
          <label htmlFor="goalDate">Target date (optional)</label>
          <input id="goalDate" type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
          <button type="submit">Add goal</button>
        </form>

        {goals.map((g) => (
          <div key={g.id} className="card">
            <div className="card-row">
              <div>
                <h3>{g.title}</h3>
                {g.target_date && <span className="muted">Target: {new Date(g.target_date).toLocaleDateString()}</span>}
              </div>
              <button className="secondary" onClick={() => handleDeleteGoal(g.id)}>
                Remove
              </button>
            </div>
            {g.target_surah_id && (
              <>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${g.progress_percent}%` }} />
                </div>
                <span className="muted">{g.progress_percent}% of the target surah memorized</span>
              </>
            )}
          </div>
        ))}

        <h3 style={{ marginTop: 32 }}>All progress</h3>
        {sortedProgress.length === 0 && <p className="muted">No ayahs tracked yet — complete a recitation session or a Miftah Method session to start.</p>}
        {sortedProgress.map((p) => (
          <div key={p.ayah_id} className="card card-row">
            <span>{p.surah_name ? `${p.surah_name} ${p.ayah_number}` : `Ayah #${p.ayah_id}`}</span>
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
