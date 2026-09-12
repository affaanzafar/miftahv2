import Link from "next/link";
import LogoMark from "../components/LogoMark";

/**
 * Journey to Jannah — the platform-level front door.
 *
 * Miftah is the only real, live product today, so every CTA here is honest
 * about that: "Explore Miftah" and "Open Miftah" go straight into a working
 * app, while Arabic Learning / Halaqahs / Majlis are shown as named,
 * non-clickable "Coming soon" cards rather than dead links — the rest of
 * the ecosystem is planned, not pretended into existing yet.
 *
 * No "use client" needed — this page has no state or API calls, so it
 * renders as a plain server component.
 */
export default function JourneyToJannahHome() {
  return (
    <>
      <nav className="nav">
        <span className="nav-brand-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={34} />
          <span className="nav-brand">Journey to Jannah</span>
        </span>
        <div className="nav-links">
          <a href="#experiences" className="nav-link">
            Explore
          </a>
          <Link href="/miftah/login" className="nav-link">
            Sign in
          </Link>
        </div>
      </nav>

      <main className="page j2j-landing">
        <div className="j2j-landing-bg" aria-hidden="true" />
        {/* -------------------------------- Hero -------------------------------- */}
        <div className="hero-panel" style={{ marginBottom: 32 }}>
          <p className="eyebrow">Journey to Jannah</p>
          <h1 style={{ fontFamily: "Space Grotesk, serif", fontSize: 34, margin: "0 0 10px" }}>
            Learn. Memorize. Connect. Grow.
          </h1>
          <p className="muted" style={{ marginBottom: 24, fontSize: 16, maxWidth: 560 }}>
            A Muslim learning and community ecosystem — starting with Miftah, a Qur'an
            memorization practice that actually listens as you recite, not just a plan for one.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/miftah/register">
              <button type="button">Begin your journey</button>
            </Link>
            <Link href="/miftah">
              <button
                type="button"
                className="secondary"
                style={{ color: "var(--parchment)", borderColor: "rgba(244,239,226,0.35)" }}
              >
                Explore Miftah
              </button>
            </Link>
          </div>
        </div>

        {/* ------------------------------ Experiences ----------------------------- */}
        <h2
          id="experiences"
          style={{ fontFamily: "Space Grotesk, serif", color: "var(--forest)", fontSize: 26, margin: "8px 0 4px", scrollMarginTop: 90 }}
        >
          What you can do here
        </h2>
        <p className="page-subtitle">Built progressively — one piece done properly before the next begins.</p>

        <div className="shortcut-grid">
          <Link href="/miftah" className="shortcut-card">
            <div className="card">
              <h3>مفتاح Miftah</h3>
              <p className="muted" style={{ marginBottom: 0 }}>
                Recite, get corrected in real time, and build a hifz you actually keep. Live now —
                no account required to try it.
              </p>
            </div>
          </Link>

          <Link href="/arabic" className="shortcut-card">
            <div className="card">
              <h3 style={{ margin: 0 }}>Arabic Learning</h3>
              <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
                Structured lessons from the alphabet through grammar and vocabulary. Live now.
              </p>
            </div>
          </Link>

          <div className="card" style={{ cursor: "default" }} aria-disabled="true">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Halaqahs</h3>
              <span className="pill status-new">Coming soon</span>
            </div>
            <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
              Structured group learning with a teacher, a schedule, and shared progress.
            </p>
          </div>

          <div className="card" style={{ cursor: "default" }} aria-disabled="true">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0 }}>Majlis</h3>
              <span className="pill status-new">Coming soon</span>
            </div>
            <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
              Share progress, discuss, and learn alongside other Muslims doing the same work.
            </p>
          </div>
        </div>

        {/* ------------------------------ Miftah spotlight ------------------------- */}
        <div className="dark-section">
          <p className="eyebrow">مفتاح · Miftah</p>
          <h2>The first thing we built — properly, before anything else</h2>
          <p className="muted" style={{ fontSize: 16, maxWidth: 640, lineHeight: 1.7 }}>
            Miftah listens to your recitation and checks it word by word against the actual
            Arabic text. The method: repeat a passage while looking at it, then recall it from
            memory until it's genuinely fluent, then fold it into everything you've memorized so
            far. Weak spots get flagged and revisited on their own schedule, not lost in a general
            "review sometime" pile.
          </p>
          <div style={{ marginTop: 20 }}>
            <Link href="/miftah">
              <button type="button">Open Miftah →</button>
            </Link>
          </div>
        </div>

        {/* --------------------------------- Closing -------------------------------- */}
        <div style={{ textAlign: "center", padding: "56px 0 24px" }}>
          <h2 style={{ fontFamily: "Space Grotesk, serif", color: "var(--forest)", fontSize: 24, marginBottom: 16 }}>
            Begin your journey today.
          </h2>
          <Link href="/miftah/register">
            <button type="button">Create your free account</button>
          </Link>
        </div>

        <p className="muted" style={{ textAlign: "center", fontSize: 13, marginTop: 24 }}>
          Journey to Jannah · <Link href="/miftah">Miftah</Link> is live now.
        </p>
      </main>
    </>
  );
}
