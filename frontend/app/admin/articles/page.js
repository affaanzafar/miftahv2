"use client";

import { useEffect, useState } from "react";
import { api, uploadToCloudinary } from "../../../lib/api";

const MAX_WORDS = 10000;

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState(null);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const overLimit = wordCount > MAX_WORDS;

  function refresh() {
    api.adminListArticles().then(setArticles).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  function slugify(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (overLimit) return;
    setCreating(true);
    setError("");
    try {
      let pdf_url = null;
      if (pdfFile) {
        setUploading(true);
        const uploaded = await uploadToCloudinary(pdfFile, "journey_to_jannah_articles");
        pdf_url = uploaded.url;
        setUploading(false);
      }
      await api.adminCreateArticle({ title, slug: slug || slugify(title), body, pdf_url, is_published: false });
      setTitle("");
      setSlug("");
      setBody("");
      setPdfFile(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
      setUploading(false);
    }
  }

  async function togglePublish(a) {
    try {
      await api.adminPublishArticle(a.id, !a.is_published);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(a) {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await api.adminDeleteArticle(a.id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Articles</h1>
      <p className="page-subtitle">Weekly Journey to Jannah articles. Up to {MAX_WORDS.toLocaleString()} words, with an optional PDF.</p>

      {error && <p className="error-banner">{error}</p>}

      <div className="illuminated-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>New article</h3>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input placeholder={`Slug (auto: ${slugify(title) || "this-weeks-reflection"})`} value={slug} onChange={(e) => setSlug(e.target.value)} />

          <textarea
            placeholder="Article body"
            rows={14}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            style={overLimit ? { borderColor: "var(--wrong)" } : undefined}
          />
          <p className={overLimit ? "error-banner" : "muted"} style={{ margin: 0, fontSize: 13 }}>
            {wordCount.toLocaleString()} / {MAX_WORDS.toLocaleString()} words
            {overLimit && " — over the limit, trim before saving"}
          </p>

          <div>
            <label className="muted" style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
              PDF attachment (optional)
            </label>
            <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
          </div>

          <button type="submit" disabled={creating || overLimit || !title || !body}>
            {uploading ? "Uploading PDF…" : creating ? "Saving…" : "Save as draft"}
          </button>
        </form>
      </div>

      {articles === null && !error && <p className="muted">Loading articles…</p>}
      {articles && articles.length === 0 && (
        <div className="illuminated-card" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 0 }}>No articles yet.</p>
        </div>
      )}

      {articles &&
        articles.map((a) => (
          <div key={a.id} className="illuminated-card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{a.title}</p>
                <p className="muted" style={{ margin: "4px 0" }}>
                  {a.word_count.toLocaleString()} words
                  {a.pdf_url && (
                    <>
                      {" · "}
                      <a href={a.pdf_url} target="_blank" rel="noreferrer">PDF</a>
                    </>
                  )}
                </p>
                <span className={`pill ${a.is_published ? "status-memorized" : "status-new"}`}>
                  {a.is_published ? "Published" : "Draft"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button type="button" className="secondary" onClick={() => togglePublish(a)}>
                  {a.is_published ? "Unpublish" : "Publish"}
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(a)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
    </main>
  );
}
