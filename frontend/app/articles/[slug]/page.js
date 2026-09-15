"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import LogoMark from "../../../components/LogoMark";
import { api } from "../../../lib/api";

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getArticle(slug).then(setArticle).catch((e) => setError(e.message));
  }, [slug]);

  return (
    <>
      <nav className="nav">
        <span className="nav-brand-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={34} />
          <Link href="/" className="nav-brand" style={{ textDecoration: "none" }}>Journey to Jannah</Link>
        </span>
        <div className="nav-links">
          <Link href="/articles" className="nav-link">Articles</Link>
        </div>
      </nav>

      <main className="page">
        <Link href="/articles" className="muted" style={{ textDecoration: "none" }}>← Weekly Article</Link>

        {error && <p className="error-banner" style={{ marginTop: 16 }}>{error}</p>}
        {!article && !error && <p className="muted" style={{ marginTop: 16 }}>Loading…</p>}

        {article && (
          <div style={{ marginTop: 8 }}>
            <h1 className="page-title">{article.title}</h1>
            <p className="page-subtitle">
              {new Date(article.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              {" · "}
              {article.word_count.toLocaleString()} words
            </p>

            {article.pdf_url && (
              <div className="illuminated-card" style={{ marginBottom: 20 }}>
                <a href={article.pdf_url} target="_blank" rel="noreferrer">
                  <button type="button">Download PDF ↓</button>
                </a>
              </div>
            )}

            <div className="illuminated-card">
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, marginBottom: 0 }}>{article.body}</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
