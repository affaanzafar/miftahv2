"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [level, setLevel] = useState("beginner");
  const [description, setDescription] = useState("");

  function refresh() {
    api
      .adminListCourses()
      .then(setCourses)
      .catch((e) => setError(e.message));
  }

  useEffect(refresh, []);

  function slugify(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.adminCreateCourse({
        title,
        slug: slug || slugify(title),
        level,
        description: description || null,
      });
      setTitle("");
      setSlug("");
      setDescription("");
      setLevel("beginner");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(course) {
    try {
      await api.adminPublishCourse(course.id, !course.is_published);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(course) {
    if (!window.confirm(`Delete "${course.title}"? This removes all its modules and lessons too.`)) return;
    try {
      await api.adminDeleteCourse(course.id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Courses</h1>
      <p className="page-subtitle">Create, publish, and manage Arabic Learning courses.</p>

      {error && <p className="error-banner">{error}</p>}

      <div className="illuminated-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Create a course</h3>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Title (e.g. Arabic Fundamentals)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            placeholder={`Slug (auto: ${slugify(title) || "arabic-fundamentals"})`}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <textarea
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <button type="submit" disabled={creating || !title}>
            {creating ? "Creating…" : "Create course"}
          </button>
        </form>
      </div>

      {courses === null && !error && <p className="muted">Loading courses…</p>}

      {courses && courses.length === 0 && (
        <div className="illuminated-card" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 0 }}>No courses yet — create the first one above.</p>
        </div>
      )}

      {courses &&
        courses.map((c) => (
          <div
            key={c.id}
            className="illuminated-card"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12 }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {c.title} <span className="muted" style={{ fontWeight: 400 }}>/{c.slug}</span>
              </p>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {c.lesson_count} lessons · {c.level} ·{" "}
                <span className={`pill ${c.is_published ? "status-memorized" : "status-new"}`}>
                  {c.is_published ? "Published" : "Draft"}
                </span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Link href={`/admin/courses/${c.id}`}>
                <button type="button" className="secondary">Edit</button>
              </Link>
              <button type="button" className="secondary" onClick={() => togglePublish(c)}>
                {c.is_published ? "Unpublish" : "Publish"}
              </button>
              <button type="button" className="danger" onClick={() => handleDelete(c)}>
                Delete
              </button>
            </div>
          </div>
        ))}
    </main>
  );
}
