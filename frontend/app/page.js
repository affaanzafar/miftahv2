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
        <p className="page-subtitle">
          Browse the Quran, recite with real-time correction, and build your hifz with the Miftah Method.
        </p>

        <Link href="/miftah-method" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="illuminated-card" style={{ marginBottom: 32 }}>
            <h3 style={{ marginTop: 0, fontFamily: "Amiri, serif", fontSize: 22 }}>The Miftah Method</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Repeat each ayah aloud four times, recite it from memory until it's fluent, then recite it
              together with every ayah before it — the way memorization is meant to build.
            </p>
          </div>
        </Link>

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
