import Link from "next/link";
import LogoMark from "../components/LogoMark";

export default function JourneyToJannahHome() {
  return (
    <>
      <nav className="nav">
        <span className="nav-brand-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={34} />
          <span className="nav-brand">Journey to Jannah</span>
        </span>
        <div className="nav-links">
          <Link href="/miftah" className="nav-link">Miftah</Link>
          <Link href="/arabic" className="nav-link">Arabic Learning</Link>
          <a href="#experiences" className="nav-link">Explore</a>
          <Link href="/miftah/login" className="nav-link">Sign in</Link>
        </div>
      </nav>

      <main className="page j2j-landing">
        <div className="j2j-landing-bg" aria-hidden="true" />

        {/* -------------------------------- Hero -------------------------------- */}
        <div className="j2j-hero" style={{ marginBottom: 40 }}>
          <img src="/hero-bg.jpg" alt="" className="j2j-hero-photo" aria-hidden="true" />
          <svg className="j2j-hero-arch" viewBox="0 0 400 260" aria-hidden="true">
            <path d="M20 260 V110 a180 180 0 0 1 360 0 V260" fill="none" stroke="#dcae5b" strokeWidth="1.5" />
          </svg>
          <div className="j2j-hero-content">
            <p className="eyebrow" style={{ color: "var(--gold-soft)" }}>Journey to Jannah</p>
            <h1 className="j2j-hero-title">
              <span className="j2j-hero-serif">Building the</span>
              <span className="j2j-hero-sans">unhurried path</span>
            </h1>
            <p className="muted" style={{ marginBottom: 28, fontSize: 16, maxWidth: 520, color: "var(--parchment)" }}>
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
        </div>

        {/* ------------------------------ Experiences ----------------------------- */}
        <h2
          id="experiences"
          className="j2j-section-title"
          style={{ scrollMarginTop: 90 }}
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
                Quizzes, progress tracking, free courses, and resources — structured Arabic study,
                live now.
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
          <h2 className="j2j-section-title" style={{ marginBottom: 16 }}>
            Begin your journey today.
          </h2>
          <Link href="/miftah/register">
            <button type="button">Create your free account</button>
          </Link>
        </div>

        <p className="muted" style={{ textAlign: "center", fontSize: 13, marginTop: 24 }}>
          Journey to Jannah · <Link href="/miftah">Miftah</Link> · <Link href="/arabic">Arabic Learning</Link> live now.
        </p>
      </main>
    </>
  );
}
