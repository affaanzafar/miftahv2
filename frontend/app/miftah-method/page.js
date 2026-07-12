"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default function MiftahMethodPage() {
  const router = useRouter();
  const [surahs, setSurahs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [surahId, setSurahId] = useState("");
  const [startAyah, setStartAyah] = useState(1);
  const [endAyah, setEndAyah] = useState(3);

  useEffect(() => {
    api.listSurahs().then(setSurahs).catch((e) => setError(e.message));
    api.listMiftahMethodSessions().then(setSessions).catch(() => {});
  }, []);

  const selectedSurah = surahs.find((s) => String(s.id) === String(surahId));
  const activeSessions = sessions.filter((s) => s.status === "active");

  async function handleStart(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await api.startMiftahMethod(Number(surahId), Number(startAyah), Number(endAyah));
      router.push(`/miftah-method/session/${session.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">The Miftah Method</h1>
        <p className="page-subtitle">
          A forced-cadence way to memorize, one ayah at a time — never marked done until it's fluent
          on its own <em>and</em> fluent alongside everything before it.
        </p>

        <div className="card" style={{ marginBottom: 28 }}>
          <h3 style={{ marginTop: 0 }}>How it works</h3>
          <ol style={{ margin: 0, paddingLeft: 20, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            <li><strong>Repeat.</strong> With the ayah's text visible, recite it aloud 4 times.</li>
            <li><strong>Recall.</strong> The text is hidden — recite that ayah alone from memory, and repeat until it's fluent.</li>
            <li>
              <strong>Combine.</strong> Once it's fluent alone, recite it together with every ayah
              already mastered in this session, from memory, until that's fluent too.
            </li>
            <li>Only then does the method move on to the next ayah — and the cycle repeats, each new ayah tested with the full set behind it.</li>
          </ol>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {activeSessions.length > 0 && (
          <>
            <h3>Continue a session</h3>
            {activeSessions.map((s) => {
              const surah = surahs.find((sur) => sur.id === s.surah_id);
              return (
                <div key={s.id} className="card card-row">
                  <div>
                    <h3>{surah ? surah.name_transliteration : `Surah ${s.surah_id}`}</h3>
                    <span className="muted">
                      Ayahs {s.start_ayah_number}–{s.end_ayah_number} · now on ayah {s.current_ayah_number} · {s.phase}
                    </span>
                  </div>
                  <button onClick={() => router.push(`/miftah-method/session/${s.id}`)}>Continue</button>
                </div>
              );
            })}
          </>
        )}

        <h3 style={{ marginTop: activeSessions.length ? 32 : 0 }}>Start a new session</h3>
        <form onSubmit={handleStart} className="card">
          <label htmlFor="surah">Surah</label>
          <select
            id="surah"
            value={surahId}
            onChange={(e) => setSurahId(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--parchment-deep)",
              borderRadius: "var(--radius)",
              marginBottom: 18,
              fontSize: 15,
              fontFamily: "inherit",
              background: "#fff",
              color: "var(--ink)",
            }}
          >
            <option value="" disabled>Choose a surah…</option>
            {surahs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}. {s.name_transliteration} ({s.ayah_count} ayahs)
              </option>
            ))}
          </select>

          <label htmlFor="startAyah">From ayah</label>
          <input
            id="startAyah"
            type="number"
            min={1}
            max={selectedSurah?.ayah_count || 999}
            value={startAyah}
            onChange={(e) => setStartAyah(e.target.value)}
            required
          />

          <label htmlFor="endAyah">To ayah</label>
          <input
            id="endAyah"
            type="number"
            min={startAyah || 1}
            max={selectedSurah?.ayah_count || 999}
            value={endAyah}
            onChange={(e) => setEndAyah(e.target.value)}
            required
          />
          <p className="muted" style={{ marginTop: -10, marginBottom: 18 }}>
            Start with a small range — 3 to 5 ayahs works well while you get used to the method.
          </p>

          <button type="submit" disabled={loading || !surahId}>
            {loading ? "Starting…" : "Start memorizing"}
          </button>
        </form>
      </main>
    </>
  );
}
