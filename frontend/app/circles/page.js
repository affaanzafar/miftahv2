"use client";

import { useEffect, useRef, useState } from "react";
import Nav from "../../components/Nav";
import { api, uploadToCloudinary } from "../../lib/api";

const POLL_INTERVAL_MS = 4000;

function CircleChat({ circleId, myUserId }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const lastIdRef = useRef(0);
  const listRef = useRef(null);
  const pollRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const newMessages = await api.listCircleMessages(circleId, lastIdRef.current);
        if (cancelled || newMessages.length === 0) return;
        lastIdRef.current = newMessages[newMessages.length - 1].id;
        setMessages((prev) => [...prev, ...newMessages]);
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
        });
      } catch (e) {
        // Transient errors just get retried on the next poll tick.
      }
    }

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [circleId]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setDraft("");
    try {
      const msg = await api.sendCircleMessage(circleId, body);
      lastIdRef.current = msg.id;
      setMessages((prev) => [...prev, msg]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (e) {
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  async function handleAttach(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    setAttachMenuOpen(false);
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Files must be under 10MB.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const { url, media_type } = await uploadToCloudinary(file);
      const msg = await api.sendCircleMessage(circleId, null, url, media_type);
      lastIdRef.current = msg.id;
      setMessages((prev) => [...prev, msg]);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        ref={listRef}
        style={{
          maxHeight: 280,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "4px 2px",
          marginBottom: 10,
        }}
      >
        {messages.length === 0 && <p className="muted" style={{ margin: 0 }}>No messages yet — say salam.</p>}
        {messages.map((m) => {
          const mine = m.user_id === myUserId;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: mine ? "rgba(45, 212, 167, 0.16)" : "rgba(255,255,255,0.06)",
                border: "1px solid var(--glass-border)",
                borderRadius: 12,
                padding: "8px 12px",
              }}
            >
              {!mine && (
                <p className="muted" style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700 }}>
                  {m.display_name || "Member"}
                </p>
              )}
              {m.media_url && m.media_type === "image" && (
                <img
                  src={m.media_url}
                  alt="Shared attachment"
                  style={{ maxWidth: "100%", borderRadius: 8, display: "block", marginBottom: m.body ? 6 : 0 }}
                />
              )}
              {m.media_url && m.media_type === "file" && (
                <a
                  href={m.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", marginBottom: m.body ? 6 : 0, fontSize: 13 }}
                >
                  📎 Attachment
                </a>
              )}
              {m.body && <p style={{ margin: 0, fontSize: 14 }}>{m.body}</p>}
            </div>
          );
        })}
      </div>
      {uploadError && <div className="error-banner" style={{ marginBottom: 8 }}>{uploadError}</div>}

      {/* Hidden inputs, one per source. `capture="environment"` on the
          camera input is what makes mobile browsers open the camera app
          directly instead of a gallery/file picker. */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleAttach}
        style={{ display: "none" }}
        accept="image/*"
        capture="environment"
      />
      <input
        type="file"
        ref={galleryInputRef}
        onChange={handleAttach}
        style={{ display: "none" }}
        accept="image/*,video/*"
      />
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleAttach}
        style={{ display: "none" }}
        accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.zip"
      />

      <div style={{ position: "relative" }}>
        {attachMenuOpen && (
          <div
            className="card"
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: 8,
              width: 180,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              className="secondary"
              style={{ justifyContent: "flex-start", textAlign: "left" }}
              onClick={() => cameraInputRef.current?.click()}
            >
              📷 Take photo
            </button>
            <button
              type="button"
              className="secondary"
              style={{ justifyContent: "flex-start", textAlign: "left" }}
              onClick={() => galleryInputRef.current?.click()}
            >
              🖼️ Photo library
            </button>
            <button
              type="button"
              className="secondary"
              style={{ justifyContent: "flex-start", textAlign: "left" }}
              onClick={() => documentInputRef.current?.click()}
            >
              📄 Document
            </button>
          </div>
        )}

        <form className="inline-form" onSubmit={handleSend}>
          <button
            type="button"
            className="secondary"
            onClick={() => setAttachMenuOpen((open) => !open)}
            disabled={uploading}
            style={{ flexShrink: 0 }}
            title="Attach"
          >
            {uploading ? "…" : attachMenuOpen ? "✕" : "📎"}
          </button>
          <input
            type="text"
            placeholder="Message the circle…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" className="secondary" disabled={sending || !draft.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

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
  const [activeSubTab, setActiveSubTab] = useState("progress"); // "progress" | "chat"
  const [feed, setFeed] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [myUserId, setMyUserId] = useState(null);

  function refreshMine() {
    api.listCircles().then(setCircles).catch((e) => setError(e.message));
  }

  function refreshDiscover(q = "") {
    api.discoverCircles(q).then(setDiscovered).catch((e) => setError(e.message));
  }

  useEffect(refreshMine, []);
  useEffect(() => {
    api.me().then((u) => setMyUserId(u.id)).catch(() => {});
  }, []);
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
    if (activeCircle?.id === circle.id) {
      setActiveCircle(null);
      return;
    }
    setActiveCircle(circle);
    setActiveSubTab("progress");
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
        <p className="page-subtitle">Share progress, chat, and stay accountable together.</p>

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
                    {activeCircle?.id === c.id ? "Hide" : "Open"}
                  </button>
                </div>

                {activeCircle?.id === c.id && (
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--glass-border)", paddingTop: 16 }}>
                    <div className="tabs" style={{ marginBottom: 12 }}>
                      <button
                        className={`tab-button ${activeSubTab === "progress" ? "active" : ""}`}
                        onClick={() => setActiveSubTab("progress")}
                      >
                        Progress
                      </button>
                      <button
                        className={`tab-button ${activeSubTab === "chat" ? "active" : ""}`}
                        onClick={() => setActiveSubTab("chat")}
                      >
                        Chat
                      </button>
                    </div>

                    {activeSubTab === "progress" && (
                      <>
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
                      </>
                    )}

                    {activeSubTab === "chat" && myUserId && (
                      <CircleChat circleId={c.id} myUserId={myUserId} />
                    )}
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
