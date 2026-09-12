"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);

  function refresh() {
    api
      .adminListAnnouncements()
      .then(setAnnouncements)
      .catch((e) => setError(e.message));
  }

  useEffect(refresh, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.adminCreateAnnouncement({ title, body, is_published: false });
      setTitle("");
      setBody("");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(a) {
    try {
      await api.adminPublishAnnouncement(a.id, !a.is_published);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(a) {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await api.adminDeleteAnnouncement(a.id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Announcements</h1>
      <p className="page-subtitle">Platform-wide announcements. Draft first, publish when ready.</p>

      {error && <p className="error-banner">{error}</p>}

      <div className="illuminated-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>New announcement</h3>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea placeholder="Body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
          <button type="submit" disabled={creating || !title || !body}>
            {creating ? "Saving…" : "Save as draft"}
          </button>
        </form>
      </div>

      {announcements === null && !error && <p className="muted">Loading announcements…</p>}
      {announcements && announcements.length === 0 && (
        <div className="illuminated-card" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 0 }}>No announcements yet.</p>
        </div>
      )}

      {announcements &&
        announcements.map((a) => (
          <div key={a.id} className="illuminated-card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{a.title}</p>
                <p className="muted" style={{ margin: "6px 0" }}>{a.body}</p>
                <span className={`pill ${a.is_published ? "status-memorized" : "status-new"}`}>
                  {a.is_published ? "Published" : "Draft"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button type="button" className="secondary" onClick={() => togglePublish(a)}>
                  {a.is_published ? "Unpublish" : "Publish"}
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(a)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
    </main>
  );
}
