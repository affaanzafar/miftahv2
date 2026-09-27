"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "../../../components/Nav";

const STORAGE_KEY = "miftah_execution_tracker_v1";
const STATUSES = {
  planned: "Planned",
  done: "Done",
  partial: "Partial",
  missed: "Missed",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function loadTracker() {
  if (typeof window === "undefined") return { tasks: [], goals: [], logs: [] };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { tasks: [], goals: [], logs: [] };
  } catch {
    return { tasks: [], goals: [], logs: [] };
  }
}

export default function TrackerPage() {
  const [date, setDate] = useState(todayKey());
  const [data, setData] = useState({ tasks: [], goals: [], logs: [] });
  const [draft, setDraft] = useState({ title: "", category: "Hifz", start: "08:00", end: "09:00" });
  const [goalDraft, setGoalDraft] = useState("");
  const [timer, setTimer] = useState(null);

  useEffect(() => {
    setData(loadTracker());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const tasks = data.tasks.filter((task) => task.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const goals = data.goals.filter((goal) => !goal.done);
  const backlog = data.tasks.filter((task) => task.status === "missed");

  const stats = useMemo(() => {
    const planned = tasks.reduce((sum, task) => sum + minutesBetween(task.start, task.end), 0);
    const done = tasks.reduce((sum, task) => {
      const mins = minutesBetween(task.start, task.end);
      if (task.status === "done") return sum + mins;
      if (task.status === "partial") return sum + Math.round(mins / 2);
      return sum;
    }, 0);
    const missed = tasks.reduce((sum, task) => task.status === "missed" ? sum + minutesBetween(task.start, task.end) : sum, 0);
    return { planned, done, missed, rate: planned ? Math.round((done / planned) * 100) : 0 };
  }, [tasks]);

  function addTask(e) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setData((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        { id: uid(), date, title: draft.title.trim(), category: draft.category.trim() || "General", start: draft.start, end: draft.end, status: "planned" },
      ],
    }));
    setDraft({ ...draft, title: "" });
  }

  function setTaskStatus(id, status) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? { ...task, status } : task),
    }));
  }

  function addGoal(e) {
    e.preventDefault();
    if (!goalDraft.trim()) return;
    setData((current) => ({ ...current, goals: [...current.goals, { id: uid(), title: goalDraft.trim(), done: false }] }));
    setGoalDraft("");
  }

  function completeGoal(id) {
    setData((current) => ({ ...current, goals: current.goals.map((goal) => goal.id === id ? { ...goal, done: true } : goal) }));
  }

  function toggleTimer() {
    if (timer) {
      const endedAt = Date.now();
      const minutes = Math.max(1, Math.round((endedAt - timer.startedAt) / 60000));
      setData((current) => ({
        ...current,
        logs: [...current.logs, { id: uid(), date: todayKey(), title: timer.title, category: timer.category, minutes }],
      }));
      setTimer(null);
      return;
    }
    setTimer({ title: "Quick focus", category: "Study", startedAt: Date.now() });
  }

  return (
    <>
      <Nav />
      <main className="page tracker-page">
        <section className="tracker-hero">
          <p className="eyebrow">Daily tracker</p>
          <h1 className="page-title">Plan it. Recite it. Mark what actually happened.</h1>
          <p className="page-subtitle">
            A lightweight execution tracker for hifz, study, revision, breaks, and anything else you want to keep honest.
          </p>
        </section>

        <section className="tracker-grid">
          <div className="card tracker-stat-card">
            <span>Planned</span>
            <strong>{formatMinutes(stats.planned)}</strong>
          </div>
          <div className="card tracker-stat-card">
            <span>Done</span>
            <strong>{formatMinutes(stats.done)}</strong>
          </div>
          <div className="card tracker-stat-card">
            <span>Missed</span>
            <strong>{formatMinutes(stats.missed)}</strong>
          </div>
          <div className="card tracker-stat-card">
            <span>Execution</span>
            <strong>{stats.rate}%</strong>
          </div>
        </section>

        <div className="tracker-layout">
          <section className="card">
            <div className="tracker-section-head">
              <div>
                <p className="eyebrow">Today</p>
                <h2>Schedule</h2>
              </div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <form className="tracker-form" onSubmit={addTask}>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="What are you working on?"
              />
              <input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="hifz, revision, study..."
              />
              <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
              <button type="submit">Add block</button>
            </form>

            <div className="tracker-task-list">
              {tasks.length === 0 ? (
                <p className="muted">Nothing planned here yet. Add a small block and keep it realistic.</p>
              ) : tasks.map((task) => (
                <article key={task.id} className={`tracker-task tracker-${task.status}`}>
                  <div>
                    <strong>{task.start}–{task.end} · {task.title}</strong>
                    <p className="muted">{task.category} · {formatMinutes(minutesBetween(task.start, task.end))} · {STATUSES[task.status]}</p>
                  </div>
                  <div className="tracker-task-actions">
                    <button type="button" onClick={() => setTaskStatus(task.id, "done")}>Done</button>
                    <button type="button" className="secondary" onClick={() => setTaskStatus(task.id, "partial")}>Half</button>
                    <button type="button" className="secondary" onClick={() => setTaskStatus(task.id, "missed")}>Missed</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="tracker-side">
            <section className="card">
              <p className="eyebrow">Focus timer</p>
              <h2>{timer ? "Timer running" : "Start a quick session"}</h2>
              <p className="muted">Use this when something real happens outside the schedule.</p>
              <button type="button" onClick={toggleTimer}>{timer ? "Stop and save" : "Start timer"}</button>
            </section>

            <section className="card">
              <p className="eyebrow">Goals</p>
              <h2>Weekly focus</h2>
              <form className="tracker-form tracker-goal-form" onSubmit={addGoal}>
                <input value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} placeholder="What should stay on your radar?" />
                <button type="submit">Add</button>
              </form>
              {goals.length === 0 ? <p className="muted">No open goals. Keep it light and useful.</p> : goals.map((goal) => (
                <div key={goal.id} className="tracker-goal-row">
                  <span>{goal.title}</span>
                  <button type="button" className="secondary" onClick={() => completeGoal(goal.id)}>Done</button>
                </div>
              ))}
            </section>

            <section className="card">
              <p className="eyebrow">Backlog</p>
              <h2>Missed blocks</h2>
              {backlog.length === 0 ? <p className="muted">No missed blocks yet.</p> : backlog.slice(0, 5).map((task) => (
                <p key={task.id} className="muted tracker-backlog-item">{task.date} · {task.title}</p>
              ))}
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
