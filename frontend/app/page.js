"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api, getToken } from "../lib/api";

const NOTICE_DISMISS_KEY = "miftah_guest_notice_dismissed";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function HomePage() {
  const [surahs, setSurahs] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(true); // default true so it never flashes for logged-in users
  const [stats, setStats] = useState(null); // { memorizedCount, dueAyahCount, circleCount } — logged-in only

  useEffect(() => {
    const signedIn = !!getToken();
    setLoggedIn(signedIn);
    if (!signedIn) {
      setNoticeDismissed(sessionStorage.getItem(NOTICE_DISMISS_KEY) === "1");
    } else {
      Promise.all([api.getProgress(), api.getDueReviewsGrouped(), api.listCircles()])
        .then(([progress, dueGroups, circles]) => {
          setStats({
            memorizedCount: progress.filter((p) => p.status === "memorized").length,
            dueAyahCount: dueGroups.reduce((sum, g) => sum + g.ayah_count, 0),
            circleCount: circles.length,
          });
        })
        .catch(() => {}); // dashboard stats are a nice-to-have, don't block the page on them
    }
  }, []);

  useEffect(() => {
    api.listSurahs().then(setSurahs).catch((e) => setError(e.message));
  }, []);

  const filteredSurahs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter((s) => {
      return (
        String(s.id).includes(q) ||
        s.name_transliteration?.toLowerCase().includes(q) ||
        s.name_translation?.toLowerCase().includes(q) ||
        s.name_arabic?.includes(query.trim())
      );
    });
  }, [surahs, query]);

  function dismissNotice() {
    sessionStorage.setItem(NOTICE_DISMISS_KEY, "1");
    setNoticeDismissed(true);
  }

  return (
    <>
      <Nav />
      <main className="page">
        {!loggedIn && !noticeDismissed && (
          <div className="notice-banner">
            <span>
              <strong>You're browsing as a guest.</strong> You can recite and get live correction
              right now — but nothing is saved until you create an account.
            </span>
            <div className="notice-banner-actions">
              <Link href="/register">
                <button type="button">Sign up free</button>
              </Link>
              <button
                type="button"
                className="notice-banner-dismiss"
                aria-label="Dismiss"
                onClick={dismissNotice}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* -------------------------------- Hero -------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="hero-panel"
          style={{ marginBottom: 32 }}
        >
          <p className="eyebrow">مفتاح · Miftah</p>
          {loggedIn && stats ? (
            <>
              <h1 style={{ fontFamily: "Space Grotesk, serif", fontSize: 32, margin: "0 0 10px" }}>
                Welcome back.
              </h1>
              <p className="muted" style={{ marginBottom: 24, fontSize: 16 }}>
                {stats.memorizedCount} ayah{stats.memorizedCount === 1 ? "" : "s"} memorized ·{" "}
                {stats.dueAyahCount} due for review
                {stats.circleCount > 0 && ` · ${stats.circleCount} circle${stats.circleCount === 1 ? "" : "s"}`}
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/hifz">
                  <button type="button">Continue hifz</button>
                </Link>
                <Link href="#surahs">
                  <button type="button" className="secondary" style={{ color: "var(--parchment)", borderColor: "rgba(244,239,226,0.35)" }}>
                    Browse surahs
                  </button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "Space Grotesk, serif", fontSize: 32, margin: "0 0 10px" }}>
                Recite with confidence. Remember for life.
              </h1>
              <p className="muted" style={{ marginBottom: 24, fontSize: 16, maxWidth: 520 }}>
                Miftah listens as you recite, corrects you in real time, and turns memorization into
                a practice you keep — alongside a community reciting with you.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="#surahs">
                  <button type="button">Start reciting</button>
                </Link>
                <Link href="/register">
                  <button type="button" className="secondary" style={{ color: "var(--parchment)", borderColor: "rgba(244,239,226,0.35)" }}>
                    Create free account
                  </button>
                </Link>
              </div>
            </>
          )}
        </motion.div>

        {/* ---------------------------- Shortcuts grid ---------------------------- */}
        <motion.div className="shortcut-grid" variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <Link href="/hifz" className="shortcut-card">
              <div className="card">
                <h3>Hifz</h3>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {loggedIn
                    ? "Track memorized ayahs and review what's due before you forget it."
                    : "Track your memorization ayah by ayah, with spaced review timed before you'd naturally forget."}
                </p>
              </div>
            </Link>
          </motion.div>
          <motion.div variants={item}>
            <Link href="/circles" className="shortcut-card">
              <div className="card">
                <h3>Circles</h3>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Join a group memorizing alongside you — streaks, milestones, and shared accountability.
                </p>
              </div>
            </Link>
          </motion.div>
          <motion.div variants={item}>
            <Link href="/miftah-method" className="shortcut-card">
              <div className="card">
                <h3>The Miftah Method</h3>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Repeat, recall, then combine — the guided cadence memorization is built on.
                </p>
              </div>
            </Link>
          </motion.div>
          <motion.div variants={item}>
            <a href="#surahs" className="shortcut-card">
              <div className="card">
                <h3>Surahs</h3>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Browse all 114 surahs and recite any of them right now — no account required.
                </p>
              </div>
            </a>
          </motion.div>
        </motion.div>

        {/* ------------------------------ Surah browser ---------------------------- */}
        <h2 id="surahs" style={{ fontFamily: "Space Grotesk, serif", color: "var(--forest)", fontSize: 26, margin: "8px 0 4px", scrollMarginTop: 90 }}>
          Browse the Quran
        </h2>
        <p className="page-subtitle">Recite any surah with real-time correction — sign up any time to save your progress.</p>

        {error && <div className="error-banner">{error}</div>}

        <motion.div
          className="search-row"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <input
            type="text"
            placeholder="Search by name or number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search surahs"
          />
        </motion.div>

        {query && (
          <p className="muted" style={{ marginTop: -12, marginBottom: 16 }}>
            {filteredSurahs.length === 0
              ? "No surahs match that search."
              : `${filteredSurahs.length} surah${filteredSurahs.length === 1 ? "" : "s"} found`}
          </p>
        )}

        <motion.div variants={container} initial="hidden" animate="show">
          {filteredSurahs.map((s) => (
            <motion.div key={s.id} variants={item} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Link href={`/recite/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
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
            </motion.div>
          ))}
        </motion.div>

        {surahs.length === 0 && !error && <p className="muted">Loading…</p>}

        {/* --------------------------- About / goals section ------------------------
            Deliberately on the dark surface (.dark-section) rather than the
            parchment used everywhere else — set apart the way this page's
            "why" is meant to stand apart from its "what."
            Placeholder copy below — written generically since only you can
            speak to your own story and intentions; swap it for your own words.
        ------------------------------------------------------------------------- */}
        <div className="dark-section">
          <p className="eyebrow">Why Miftah exists</p>
          <h2>Goals, and the person behind them</h2>
          <p className="muted" style={{ fontSize: 16, maxWidth: 640, lineHeight: 1.7 }}>
            {/* TODO: replace with your own words — this is placeholder copy. */}
            Miftah started from a simple frustration: memorizing Qur'an alone is hard to sustain,
            and most tools either gatekeep basic practice behind a signup or don't actually listen
            to what you recite. The goal here is narrow on purpose — recitation, memorization, and
            a community to keep you honest — done properly, before anything else gets added.
          </p>
          <p className="muted" style={{ fontSize: 16, maxWidth: 640, lineHeight: 1.7, marginTop: 16 }}>
            {/* TODO: replace with your own bio / ideology in your own words. */}
            This is built and maintained by one person, in the open, as an ongoing project rather
            than a finished product — features ship as they're actually needed, not on a roadmap
            written in advance.
          </p>
          <p className="muted" style={{ marginTop: 20, fontSize: 14 }}>
            — Affaan Zafar, creator of Miftah
          </p>
        </div>
      </main>
    </>
  );
}
