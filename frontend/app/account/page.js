"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";
import AnimatedNumber from "../../components/AnimatedNumber";
import { api } from "../../lib/api";

export default function AccountPage() {
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [tab, setTab] = useState("followers"); // "followers" | "following" | "find"
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  function loadCore() {
    api.me().then((u) => {
      setMe(u);
      setNameInput(u.display_name || "");
      api.listFollowers(u.id).then(setFollowers).catch(() => {});
      api.listFollowing(u.id).then(setFollowing).catch(() => {});
    }).catch((e) => setError(e.message));
    api.myProfile().then(setProfile).catch((e) => setError(e.message));
    api.listGoals().then(setGoals).catch(() => {});
  }

  useEffect(loadCore, []);

  async function handleSaveName(e) {
    e.preventDefault();
    setSavingName(true);
    setError("");
    try {
      await api.updateDisplayName(nameInput.trim());
      setEditingName(false);
      loadCore();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    setError("");
    try {
      const results = await api.searchUsers(searchQuery);
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleFollow(userId) {
    setError("");
    try {
      await api.followUser(userId);
      setNotice("Followed.");
      handleSearch({ preventDefault: () => {} });
      loadCore();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnfollow(userId) {
    setError("");
    try {
      await api.unfollowUser(userId);
      loadCore();
      if (searchQuery) handleSearch({ preventDefault: () => {} });
    } catch (err) {
      setError(err.message);
    }
  }

  if (!me || !profile) {
    return (
      <>
        <Nav />
        <main className="page">
          {error ? <div className="error-banner">{error}</div> : <p className="muted">Loading…</p>}
        </main>
      </>
    );
  }

  const listForTab = tab === "followers" ? followers : tab === "following" ? following : searchResults;

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Your account</h1>
        <p className="page-subtitle">Profile, progress, and the people you're memorizing alongside.</p>

        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="success-banner">{notice}</div>}

        <div className="illuminated-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              {editingName ? (
                <form onSubmit={handleSaveName} className="inline-form" style={{ marginBottom: 4 }}>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                  <button type="submit" disabled={savingName}>{savingName ? "Saving…" : "Save"}</button>
                  <button type="button" className="secondary" onClick={() => setEditingName(false)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <h2 style={{ margin: "0 0 4px", fontFamily: "Space Grotesk, serif" }}>
                  {profile.display_name || "Unnamed"}{" "}
                  <button
                    className="secondary"
                    style={{ fontSize: 12, padding: "4px 12px", marginLeft: 8 }}
                    onClick={() => setEditingName(true)}
                  >
                    Edit
                  </button>
                </h2>
              )}
              <p className="muted" style={{ margin: 0 }}>{profile.email}</p>
            </div>
          </div>

          <div className="card-row" style={{ marginTop: 24, gap: 16 }}>
            <div className="card" style={{ flex: 1, textAlign: "center" }}>
              <p className="muted">Memorized</p>
              <p style={{ fontSize: 28, margin: 0 }}><AnimatedNumber value={profile.memorized_ayah_count} /></p>
            </div>
            <div className="card" style={{ flex: 1, textAlign: "center" }}>
              <p className="muted">Day streak</p>
              <p style={{ fontSize: 28, margin: 0 }}><AnimatedNumber value={profile.current_streak_days} /></p>
            </div>
            <div className="card" style={{ flex: 1, textAlign: "center" }}>
              <p className="muted">Followers</p>
              <p style={{ fontSize: 28, margin: 0 }}><AnimatedNumber value={profile.follower_count} /></p>
            </div>
            <div className="card" style={{ flex: 1, textAlign: "center" }}>
              <p className="muted">Following</p>
              <p style={{ fontSize: 28, margin: 0 }}><AnimatedNumber value={profile.following_count} /></p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-row">
            <h3 style={{ margin: 0 }}>Goals</h3>
            <a href="/hifz" style={{ fontSize: 14 }}>Manage in Hifz →</a>
          </div>
          {goals.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>No goals set yet.</p>
          ) : (
            goals.map((g) => (
              <div key={g.id} className="member-row">
                <span>{g.title}</span>
                {g.target_date && <span className="muted">{g.target_date.slice(0, 10)}</span>}
              </div>
            ))
          )}
        </div>

        <div className="tabs" style={{ marginTop: 32 }}>
          <button className={`tab-button ${tab === "followers" ? "active" : ""}`} onClick={() => setTab("followers")}>
            Followers
          </button>
          <button className={`tab-button ${tab === "following" ? "active" : ""}`} onClick={() => setTab("following")}>
            Following
          </button>
          <button className={`tab-button ${tab === "find" ? "active" : ""}`} onClick={() => setTab("find")}>
            Find people
          </button>
        </div>

        {tab === "find" && (
          <form className="search-row" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="secondary">Search</button>
          </form>
        )}

        {listForTab.length === 0 ? (
          <p className="muted">
            {tab === "followers" && "No followers yet."}
            {tab === "following" && "You're not following anyone yet — try \"Find people\"."}
            {tab === "find" && "Search for someone by name to follow them."}
          </p>
        ) : (
          listForTab.map((u) => (
            <div key={u.id} className="card card-row">
              <div>
                <h3 style={{ margin: 0 }}>{u.display_name || "Unnamed"}</h3>
                <span className="muted">{u.memorized_ayah_count} ayahs memorized · {u.follower_count} followers</span>
              </div>
              {u.is_following ? (
                <button className="secondary" onClick={() => handleUnfollow(u.id)}>Unfollow</button>
              ) : (
                <button onClick={() => handleFollow(u.id)}>Follow</button>
              )}
            </div>
          ))
        )}
      </main>
    </>
  );
}
