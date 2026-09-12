"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

const LEVELS = ["all", "beginner", "intermediate", "advanced"];

export default function ArabicCoursesPage() {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState("");
  const [level, setLevel] = useState("all");

  useEffect(() => {
    api
      .listArabicCourses()
      .then(setCourses)
      .catch((e) => setError(e.message));
  }, []);

  const visible = (courses || []).filter((c) => level === "all" || c.level === level);

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Arabic Learning</h1>
        <p className="page-subtitle">Learn Arabic step by step — free, and open to browse without an account.</p>

        {error && <p className="error-banner">{error}</p>}

        <div className="tabs" role="tablist" aria-label="Filter by level">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              className={`tab-button ${level === l ? "active" : ""}`}
              onClick={() => setLevel(l)}
            >
              {l === "all" ? "All" : l[0].toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>

        {courses === null && !error && <p className="muted">Loading courses…</p>}

        {courses !== null && visible.length === 0 && (
          <div className="illuminated-card" style={{ marginTop: 20, textAlign: "center" }}>
            <p style={{ marginBottom: 4 }}>
              {courses.length === 0 ? "Your first course is coming soon." : "No courses at this level yet."}
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>Check back shortly.</p>
          </div>
        )}

        <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
          {visible.map((c) => (
            <Link key={c.id} href={`/arabic/${c.slug}`} className="shortcut-card">
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <h3 style={{ margin: 0 }}>{c.title}</h3>
                  <span className="pill status-new">{c.level}</span>
                </div>
                <p className="muted" style={{ marginTop: 8, marginBottom: c.enrolled ? 10 : 0 }}>
                  {c.description || `${c.lesson_count} lessons`}
                </p>
                {c.enrolled && (
                  <div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: "var(--parchment-deep)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${c.progress_pct}%`,
                          background: "var(--forest)",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    <p className="muted" style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                      {c.progress_pct}% complete
                    </p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
