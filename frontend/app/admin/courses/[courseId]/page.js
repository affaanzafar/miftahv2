"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";

export default function AdminCourseEditorPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);

  const [lessonForms, setLessonForms] = useState({}); // moduleId -> { title, content_type, content_url, body }

  const [quizTitle, setQuizTitle] = useState("");
  const [quizQuestions, setQuizQuestions] = useState([
    { prompt: "", options: ["", ""], correct_index: 0 },
  ]);
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  function refresh() {
    api
      .adminGetCourseDetail(courseId)
      .then(setCourse)
      .catch((e) => setError(e.message));
  }

  useEffect(refresh, [courseId]);

  async function handleAddModule(e) {
    e.preventDefault();
    setAddingModule(true);
    try {
      await api.adminCreateModule(courseId, { title: newModuleTitle, order: course.modules.length });
      setNewModuleTitle("");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingModule(false);
    }
  }

  async function handleDeleteModule(moduleId) {
    if (!window.confirm("Delete this module and all its lessons?")) return;
    try {
      await api.adminDeleteModule(moduleId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function lessonFormFor(moduleId) {
    return lessonForms[moduleId] || { title: "", content_type: "text", content_url: "", body: "" };
  }

  function updateLessonForm(moduleId, patch) {
    setLessonForms((prev) => ({ ...prev, [moduleId]: { ...lessonFormFor(moduleId), ...patch } }));
  }

  async function handleAddLesson(moduleId, order) {
    const form = lessonFormFor(moduleId);
    if (!form.title) return;
    try {
      await api.adminCreateLesson(moduleId, {
        title: form.title,
        content_type: form.content_type,
        content_url: form.content_url || null,
        body: form.body || null,
        order,
      });
      setLessonForms((prev) => ({ ...prev, [moduleId]: { title: "", content_type: "text", content_url: "", body: "" } }));
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteLesson(lessonId) {
    if (!window.confirm("Delete this lesson?")) return;
    try {
      await api.adminDeleteLesson(lessonId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function updateQuestion(qi, patch) {
    setQuizQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }
  function updateOption(qi, oi, value) {
    setQuizQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q))
    );
  }
  function addOption(qi) {
    setQuizQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, options: [...q.options, ""] } : q)));
  }
  function addQuestion() {
    setQuizQuestions((prev) => [...prev, { prompt: "", options: ["", ""], correct_index: 0 }]);
  }
  function removeQuestion(qi) {
    setQuizQuestions((prev) => prev.filter((_, i) => i !== qi));
  }

  async function handleCreateQuiz(e) {
    e.preventDefault();
    setCreatingQuiz(true);
    setError("");
    try {
      await api.adminCreateQuiz(courseId, {
        title: quizTitle,
        questions: quizQuestions.map((q, i) => ({ ...q, order: i, options: q.options.filter(Boolean) })),
      });
      setQuizTitle("");
      setQuizQuestions([{ prompt: "", options: ["", ""], correct_index: 0 }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingQuiz(false);
    }
  }

  if (error) {
    return (
      <main className="page">
        <p className="error-banner">{error}</p>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="page">
        <p className="muted">Loading course…</p>
      </main>
    );
  }

  return (
    <main className="page">
      <Link href="/admin/courses" className="muted" style={{ textDecoration: "none" }}>
        ← Courses
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{course.title}</h1>
        <span className={`pill ${course.is_published ? "status-memorized" : "status-new"}`}>
          {course.is_published ? "Published" : "Draft"}
        </span>
      </div>
      <p className="page-subtitle">/{course.slug} · {course.level}</p>

      {course.modules.map((m) => (
        <div key={m.id} className="illuminated-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{m.title}</h3>
            <button type="button" className="danger" onClick={() => handleDeleteModule(m.id)}>
              Delete module
            </button>
          </div>

          {m.lessons.length > 0 && (
            <div style={{ marginTop: 12, marginBottom: 16 }}>
              {m.lessons.map((l, li) => (
                <div
                  key={l.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: li === 0 ? "none" : "1px solid var(--glass-border)",
                  }}
                >
                  <span>
                    {li + 1}. {l.title} <span className="muted">({l.content_type})</span>
                  </span>
                  <button type="button" className="danger" onClick={() => handleDeleteLesson(l.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <details>
            <summary style={{ cursor: "pointer", color: "var(--forest)", fontWeight: 700 }}>
              + Add a lesson
            </summary>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input
                placeholder="Lesson title"
                value={lessonFormFor(m.id).title}
                onChange={(e) => updateLessonForm(m.id, { title: e.target.value })}
              />
              <select
                value={lessonFormFor(m.id).content_type}
                onChange={(e) => updateLessonForm(m.id, { content_type: e.target.value })}
              >
                <option value="text">Text</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
              {lessonFormFor(m.id).content_type !== "text" && (
                <input
                  placeholder={
                    lessonFormFor(m.id).content_type === "video"
                      ? "YouTube link or direct video URL"
                      : `${lessonFormFor(m.id).content_type} URL`
                  }
                  value={lessonFormFor(m.id).content_url}
                  onChange={(e) => updateLessonForm(m.id, { content_url: e.target.value })}
                />
              )}
              <textarea
                placeholder="Lesson text / notes"
                rows={3}
                value={lessonFormFor(m.id).body}
                onChange={(e) => updateLessonForm(m.id, { body: e.target.value })}
              />
              <button
                type="button"
                onClick={() => handleAddLesson(m.id, m.lessons.length)}
                disabled={!lessonFormFor(m.id).title}
              >
                Add lesson
              </button>
            </div>
          </details>
        </div>
      ))}

      <div className="illuminated-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Add a quiz</h3>
        <form onSubmit={handleCreateQuiz} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Quiz title"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            required
          />
          {quizQuestions.map((q, qi) => (
            <div key={qi} style={{ border: "1px solid var(--glass-border)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input
                  placeholder={`Question ${qi + 1}`}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                  style={{ flex: 1 }}
                />
                {quizQuestions.length > 1 && (
                  <button type="button" className="danger" onClick={() => removeQuestion(qi)}>Remove</button>
                )}
              </div>
              {q.options.map((opt, oi) => (
                <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={q.correct_index === oi}
                    onChange={() => updateQuestion(qi, { correct_index: oi })}
                  />
                  <input
                    placeholder={`Option ${oi + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              ))}
              <button type="button" className="secondary" onClick={() => addOption(qi)}>+ Option</button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={addQuestion}>+ Add question</button>
          <button type="submit" disabled={creatingQuiz || !quizTitle || quizQuestions.some((q) => !q.prompt)}>
            {creatingQuiz ? "Saving…" : "Save quiz"}
          </button>
        </form>
      </div>

      <div className="illuminated-card">
        <h3 style={{ marginTop: 0 }}>Add a module</h3>
        <form onSubmit={handleAddModule} style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="Module title (e.g. The Alphabet)"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            style={{ flex: 1 }}
            required
          />
          <button type="submit" disabled={addingModule || !newModuleTitle}>
            {addingModule ? "Adding…" : "Add module"}
          </button>
        </form>
      </div>
    </main>
  );
}
