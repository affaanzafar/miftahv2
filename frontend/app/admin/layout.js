"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken } from "../../lib/api";

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/users", label: "Users" },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState("checking"); // checking | ok | unauthorized | signedout

  useEffect(() => {
    if (!getToken()) {
      setStatus("signedout");
      return;
    }
    api
      .adminWhoAmI()
      .then(() => setStatus("ok"))
      .catch(() => setStatus("unauthorized"));
  }, []);

  if (status === "checking") {
    return (
      <main className="page">
        <p className="muted">Checking access…</p>
      </main>
    );
  }

  if (status === "signedout") {
    return (
      <main className="page">
        <div className="illuminated-card" style={{ textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Sign in required</h2>
          <p className="muted">You need to sign in with an admin account to reach the Admin Studio.</p>
          <button type="button" onClick={() => router.push("/miftah/login")}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  if (status === "unauthorized") {
    return (
      <main className="page">
        <div className="illuminated-card" style={{ textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Not authorized</h2>
          <p className="muted">
            Your account doesn't have Admin Studio access. If this seems wrong, check with whoever manages
            the <code>admin_users</code> table.
          </p>
          <Link href="/">
            <button type="button" className="secondary">Back to Journey to Jannah</button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-brand-group" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="nav-brand" style={{ fontSize: 18 }}>J2J Admin</span>
        </span>
        <div className="nav-links">
          {ADMIN_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link"
              style={pathname === l.href ? { color: "var(--forest)", fontWeight: 700 } : undefined}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
