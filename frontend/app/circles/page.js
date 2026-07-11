"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function CirclesPage() {
  const [circles, setCircles] = useState([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [activeCircle, setActiveCircle] = useState(null);
  const [feed, setFeed] = useState([]);

  function refresh() {
    api.listCircles().then(setCircles).catch((e) => setError(e.message));
  }

  useEffect(refresh, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createCircle({ name, description, is_private: false });
      setName("");
      setDescription("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openCircle(circle) {
    setActiveCircle(circle);
    try {
      const data = await api.circleProgress(circle.id);
      setFeed(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Study circles</h1>
        <p className="page-subtitle">Share progress and stay accountable with others.</p>
        <p className="muted" style={{ marginTop: -20, marginBottom: 24 }}>
          Note: progress shared in a circle is visible to every member of that circle.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleCreate} className="card">
          <label htmlFor="circleName">Create a circle</label>
          <input id="circleName" type="text" placeholder="Circle name" value={name} onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="circleDesc">Description (optional)</label>
          <textarea id="circleDesc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit">Create circle</button>
        </form>

        {circles.map((c) => (
          <div key={c.id} className="card">
            <div className="card-row">
              <div>
                <h3>{c.name}</h3>
                <span className="muted">{c.member_count} members</span>
              </div>
              <button className="secondary" onClick={() => openCircle(c)}>
                View progress
              </button>
            </div>

            {activeCircle?.id === c.id && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--parchment-deep)", paddingTop: 16 }}>
                {feed.map((f) => (
                  <div key={f.user_id} className="card-row" style={{ padding: "8px 0" }}>
                    <span>{f.display_name || "Member"}</span>
                    <span className="muted">{f.memorized_ayah_count} ayahs memorized</span>
                    <span className="pill status-learning">{f.role}</span>
                  </div>
                ))}
                {feed.length === 0 && <p className="muted">No members yet.</p>}
              </div>
            )}
          </div>
        ))}

        {circles.length === 0 && <p className="muted">You're not in any circles yet.</p>}
      </main>
    </>
  );
}
