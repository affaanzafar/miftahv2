"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../components/Nav";
import { api } from "../lib/api";

export default function HomePage() {
  const [surahs, setSurahs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listSurahs().then(setSurahs).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Surahs</h1>
        <p className="page-subtitle">Pick a surah to start a recitation session.</p>

        {error && <div className="error-banner">{error}</div>}

        {surahs.map((s) => (
          <Link key={s.id} href={`/recite/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card card-row">
              <div>
                <h3>
                  {s.id}. {s.name_transliteration} — {s.name_translation}
                </h3>
                <span className="muted">{s.ayah_count} ayahs</span>
              </div>
              <span className="ayah-arabic" style={{ fontSize: 22 }}>
                {s.name_arabic}
              </span>
            </div>
          </Link>
        ))}

        {surahs.length === 0 && !error && <p className="muted">Loading…</p>}
      </main>
    </>
  );
}
