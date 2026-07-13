"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Nav from "../../components/Nav";
import { api, setToken } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await api.login(email, password);
      setToken(access_token);
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="page" style={{ maxWidth: 460, paddingTop: 64 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div className="ayah-arabic" style={{ fontSize: 30, marginBottom: 4 }}>
              مفتاح
            </div>
            <h1 className="page-title" style={{ fontSize: 30, marginBottom: 6 }}>
              Welcome back
            </h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Pick up your recitation and hifz where you left off.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="illuminated-card">
            {error && <div className="error-banner">{error}</div>}

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "Logging in…" : "Log in"}
            </button>

            <p className="muted" style={{ textAlign: "center", marginTop: 18, marginBottom: 0 }}>
              No account?{" "}
              <Link href="/register" style={{ color: "var(--gold-soft)", fontWeight: 700 }}>
                Register
              </Link>
            </p>
          </form>
        </motion.div>
      </main>
    </>
  );
}
