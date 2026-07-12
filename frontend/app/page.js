"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Nav from "../components/Nav";
import { api } from "../lib/api";

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

  useEffect(() => {
    api.listSurahs().then(setSurahs).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Nav />
      <main className="page">
        <motion.h1
          className="page-title"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          Surahs
        </motion.h1>
        <motion.p
          className="page-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Browse the Quran, recite with real-time correction, and build your hifz with the Miftah Method.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          whileHover={{ y: -3 }}
        >
          <Link href="/miftah-method" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="illuminated-card" style={{ marginBottom: 32 }}>
              <h3 style={{ marginTop: 0, fontFamily: "Amiri, serif", fontSize: 22 }}>The Miftah Method</h3>
              <p className="muted" style={{ marginBottom: 0 }}>
                Repeat each ayah aloud four times, recite it from memory until it's fluent, then recite it
                together with every ayah before it — the way memorization is meant to build.
              </p>
            </div>
          </Link>
        </motion.div>

        {error && <div className="error-banner">{error}</div>}

        <motion.div variants={container} initial="hidden" animate="show">
          {surahs.map((s) => (
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
      </main>
    </>
  );
}
