"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function CirclesPage() {
  const [tab, setTab] = useState("mine"); // "mine" | "discover"
  const [circles, setCircles] = useState([]);
  const [discovered, setDiscovered] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [activeCircle, setActiveCircle] = useState(null);
  const [feed, setFeed] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");

  function refreshMine() {
    api.listCircles().then(setCircles).catch((e) => setError(e.message));
  }

  function refreshDiscover(q = "") {
    api.discoverCircles(q).then(setDiscovered).catch((e) => setError(e.message));
  }

  useEffect(refreshMine, []);
  useEffect(() => {
    if (tab === "discover") refreshDiscover(query);
  }, [tab]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createCircle({ name, description, is_private: false });
      setName("");
      setDescription("");
      refreshMine();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    refreshDiscover(query);
  }

  async function handleJoin(circleId) {
    setError("");
    try {
      await api.joinCircle(circleId);
      setNotice("Joined the circle.");
      refreshMine();
      refreshDiscover(query);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openCircle(circle) {
    setError("");
    setActiveCircle(activeCircle?.id === circle.id ? null : circle);
    if (activeCircle?.id === circle.id) return;
    try {
      const data = await api.circleProgress(circle.id);
      setFeed(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleInvite(e, circleId) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const member = await api.inviteToCircle(circleId, inviteEmail);
      setNotice(`${member.display_name || member.user_id} added to the circle.`);
      setInviteEmail("");
      if (activeCircle?.id === circleId) {
        const data = await api.circleProgress(circleId);
        setFeed(data);
      }
      refreshMine();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Study circles</h1>
        <p className="page-subtitle">Share progress, invite people, and stay accountable together.</p>

        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="success-banner">{notice}</div>}

        <div className="tabs">
          <button className={`tab-button ${tab === "mine" ? "active" : ""}`} onClick={() => setTab("mine")}>
            My circles
          </button>
          <button className={`tab-button ${tab === "discover" ? "active" : ""}`} onClick={() => setTab("discover")}>
            Find circles
          </button>
        </div>

        {tab === "mine" && (
          <>
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
                    {activeCircle?.id === c.id ? "Hide" : "View progress"}
                  </button>
                </div>

                {activeCircle?.id === c.id && (
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--parchment-deep)", paddingTop: 16 }}>
                    {feed.map((f) => (
                      <div key={f.user_id} className="member-row">
                        <span>{f.display_name || "Member"}</span>
                        <span className="muted">{f.memorized_ayah_count} ayahs memorized</span>
                        <span className="pill status-learning">{f.role}</span>
                      </div>
                    ))}
                    {feed.length === 0 && <p className="muted">No members yet.</p>}

                    <form className="inline-form" onSubmit={(e) => handleInvite(e, c.id)}>
                      <input
                        type="email"
                        placeholder="Add someone by email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                      <button type="submit" className="secondary">Add</button>
                    </form>
                  </div>
                )}
              </div>
            ))}

            {circles.length === 0 && <p className="muted">You're not in any circles yet — create one, or find one under "Find circles".</p>}
          </>
        )}

        {tab === "discover" && (
          <>
            <form className="search-row" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search circles by name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit" className="secondary">Search</button>
            </form>

            {discovered.map((c) => (
              <div key={c.id} className="card card-row">
                <div>
                  <h3>{c.name}</h3>
                  {c.description && <p className="muted" style={{ margin: "2px 0" }}>{c.description}</p>}
                  <span className="muted">{c.member_count} members</span>
                </div>
                <button onClick={() => handleJoin(c.id)}>Join</button>
              </div>
            ))}

            {discovered.length === 0 && (
              <p className="muted">No public circles found{query ? ` for "${query}"` : ""} — try a different search, or create your own.</p>
            )}
          </>
        )}
      </main>
    </>
  );
}
