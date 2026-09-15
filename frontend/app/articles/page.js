"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoMark from "../../components/LogoMark";
import { api } from "../../lib/api";

export default function ArticlesPage() {
  const [articles, setArticles] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listArticles().then(setArticles).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <nav className="nav">
        <span className="nav-brand-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={34} />
          <Link href="/" className="nav-brand" style={{ textDecoration: "none" }}>Journey to Jannah</Link>
        </span>
        <div className="nav-links">
          <Link href="/miftah" className="nav-link">Miftah</Link>
          <Link href="/arabic" className="nav-link">Arabic Learning</Link>
          <Link href="/articles" className="nav-link">Articles</Link>
        </div>
      </nav>

      <main className="page">
        <h1 className="page-title">Weekly Article</h1>
        <p className="page-subtitle">Reflections and writing from Journey to Jannah.</p>

        {error && <p className="error-banner">{error}</p>}
        {articles === null && !error && <p className="muted">Loading articles…</p>}

        {articles && articles.length === 0 && (
          <div className="illuminated-card" style={{ textAlign: "center" }}>
            <p style={{ marginBottom: 0 }}>The first article is coming soon.</p>
          </div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          {articles &&
            articles.map((a) => (
              <Link key={a.id} href={`/articles/${a.slug}`} className="shortcut-card">
                <div className="card">
                  <h3 style={{ margin: 0 }}>{a.title}</h3>
                  <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                    {new Date(a.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                    {" · "}
                    {a.word_count.toLocaleString()} words
                    {a.pdf_url && " · PDF available"}
                  </p>
                </div>
              </Link>
            ))}
        </div>
      </main>
    </>
  );
}
