"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import { api, getToken } from "../../../lib/api";

export default function CourseDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const loggedIn = typeof window !== "undefined" && !!getToken();

  function refresh() {
    api
      .getArabicCourse(slug)
      .then(setCourse)
      .catch((e) => setError(e.message));
  }

  useEffect(refresh, [slug]);

  async function handleEnroll() {
    if (!loggedIn) {
      router.push("/miftah/login");
      return;
    }
    setEnrolling(true);
    try {
      await api.enrollInCourse(slug);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnrolling(false);
    }
  }

  if (error) {
    return (
      <>
        <Nav />
        <main className="page">
          <p className="error-banner">{error}</p>
        </main>
      </>
    );
  }

  if (!course) {
    return (
      <>
        <Nav />
        <main className="page">
          <p className="muted">Loading course…</p>
        </main>
      </>
    );
  }

  const firstIncomplete = course.modules.flatMap((m) => m.lessons).find((l) => !l.completed);

  return (
    <>
      <Nav />
      <main className="page">
        <Link href="/arabic" className="muted" style={{ textDecoration: "none" }}>
          ← Arabic Learning
        </Link>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{course.title}</h1>
          <span className="pill status-new">{course.level}</span>
        </div>
        {course.description && <p className="page-subtitle">{course.description}</p>}

        {course.enrolled && (
          <div style={{ margin: "16px 0" }}>
            <div style={{ height: 8, borderRadius: 999, background: "var(--parchment-deep)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${course.progress_pct}%`,
                  background: "var(--forest)",
                  borderRadius: 999,
                }}
              />
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{course.progress_pct}% complete</p>
          </div>
        )}

        <div style={{ margin: "16px 0" }}>
          {course.enrolled && firstIncomplete ? (
            <Link href={`/arabic/${slug}/lessons/${firstIncomplete.id}`}>
              <button type="button">Continue course</button>
            </Link>
          ) : course.enrolled ? (
            <p className="success-banner">You've completed every lesson in this course.</p>
          ) : (
            <button type="button" onClick={handleEnroll} disabled={enrolling}>
              {enrolling ? "Enrolling…" : "Enroll"}
            </button>
          )}
        </div>

        {course.modules.length === 0 && (
          <div className="illuminated-card" style={{ textAlign: "center" }}>
            <p style={{ marginBottom: 0 }}>Lessons for this course are coming soon.</p>
          </div>
        )}

        {course.modules.map((m, mi) => (
          <div key={m.id} style={{ marginBottom: 20 }}>
            <p className="muted" style={{ fontWeight: 700, marginBottom: 8, textTransform: "uppercase", fontSize: 13 }}>
              Module {mi + 1}: {m.title}
            </p>
            <div className="illuminated-card" style={{ padding: 0, overflow: "hidden" }}>
              {m.lessons.map((l, li) => (
                <Link
                  key={l.id}
                  href={`/arabic/${slug}/lessons/${l.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 20px",
                    textDecoration: "none",
                    color: "inherit",
                    borderTop: li === 0 ? "none" : "1px solid var(--glass-border)",
                  }}
                >
                  <span>{l.completed ? "✓ " : `${li + 1}. `}{l.title}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{l.content_type}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
