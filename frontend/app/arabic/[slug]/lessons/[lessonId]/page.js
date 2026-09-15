"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../../../components/Nav";
import { api, getToken } from "../../../../../lib/api";
import { youtubeId } from "../../../../../lib/youtube";

export default function LessonPage() {
  const { slug, lessonId } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  const loggedIn = typeof window !== "undefined" && !!getToken();

  useEffect(() => {
    api
      .getArabicCourse(slug)
      .then(setCourse)
      .catch((e) => setError(e.message));
  }, [slug]);

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
          <p className="muted">Loading lesson…</p>
        </main>
      </>
    );
  }

  const flatLessons = course.modules.flatMap((m) => m.lessons);
  const idx = flatLessons.findIndex((l) => l.id === lessonId);
  const lesson = flatLessons[idx];
  const prevLesson = idx > 0 ? flatLessons[idx - 1] : null;
  const nextLesson = idx >= 0 && idx < flatLessons.length - 1 ? flatLessons[idx + 1] : null;

  if (!lesson) {
    return (
      <>
        <Nav />
        <main className="page">
          <p className="error-banner">We couldn't find this lesson. It may have been removed.</p>
          <Link href={`/arabic/${slug}`}>
            <button type="button" className="secondary">Back to course</button>
          </Link>
        </main>
      </>
    );
  }

  async function handleComplete() {
    if (!loggedIn) {
      router.push("/miftah/login");
      return;
    }
    setCompleting(true);
    try {
      await api.completeLesson(lesson.id);
      if (nextLesson) {
        router.push(`/arabic/${slug}/lessons/${nextLesson.id}`);
      } else {
        router.push(`/arabic/${slug}`);
      }
    } catch (e) {
      setError(e.message);
      setCompleting(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="page">
        <Link href={`/arabic/${slug}`} className="muted" style={{ textDecoration: "none" }}>
          ← {course.title}
        </Link>
        <p className="muted" style={{ marginTop: 4 }}>
          Lesson {idx + 1} of {flatLessons.length}
        </p>

        <h1 className="page-title">{lesson.title}</h1>

        {error && <p className="error-banner">{error}</p>}

        <div className="illuminated-card">
          {lesson.content_type === "video" && lesson.content_url && youtubeId(lesson.content_url) && (
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, marginBottom: 16, borderRadius: 12, overflow: "hidden" }}>
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId(lesson.content_url)}`}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          )}
          {lesson.content_type === "video" && lesson.content_url && !youtubeId(lesson.content_url) && (
            <video controls style={{ width: "100%", borderRadius: 12, marginBottom: 16 }} src={lesson.content_url} />
          )}
          {lesson.content_type === "audio" && lesson.content_url && (
            <audio controls style={{ width: "100%", marginBottom: 16 }} src={lesson.content_url} />
          )}
          {lesson.body && (
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, marginBottom: 0 }}>{lesson.body}</p>
          )}
          {!lesson.body && !lesson.content_url && (
            <p className="muted" style={{ marginBottom: 0 }}>This lesson doesn't have any content yet.</p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          {prevLesson ? (
            <Link href={`/arabic/${slug}/lessons/${prevLesson.id}`}>
              <button type="button" className="secondary">← Previous</button>
            </Link>
          ) : (
            <span />
          )}

          {lesson.completed ? (
            nextLesson ? (
              <Link href={`/arabic/${slug}/lessons/${nextLesson.id}`}>
                <button type="button">Next →</button>
              </Link>
            ) : (
              <Link href={`/arabic/${slug}`}>
                <button type="button">Back to course</button>
              </Link>
            )
          ) : (
            <button type="button" onClick={handleComplete} disabled={completing}>
              {completing ? "Saving…" : "Mark complete"}
            </button>
          )}
        </div>
      </main>
    </>
  );
}
