"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import LogoMark from "./LogoMark";
import { motion } from "framer-motion";
import { clearToken, getToken } from "../lib/api";

const LINKS = [
  { href: "/miftah", label: "Home" },
  { href: "/miftah/hifz", label: "Hifz" },
  { href: "/miftah/miftah-method", label: "Miftah Method" },
  { href: "/miftah/circles", label: "Circles" },
  { href: "/miftah/account", label: "Account" },
];

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const loggedIn = typeof window !== "undefined" && !!getToken();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Narrow screens (Android/portrait) render the links as a dropdown
  // instead of a row — close it whenever the route changes so it doesn't
  // stay open over the new page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function logout() {
    clearToken();
    setMenuOpen(false);
    router.push("/miftah/login");
  }

  return (
    <nav className={`nav${scrolled ? " nav-scrolled" : ""}`}>
      <div className="nav-brand-group">
        <Link href="/" className="nav-j2j-link" title="Back to Journey to Jannah">
          <LogoMark size={20} />
          Journey to Jannah
        </Link>
        <Link href="/miftah" className="nav-brand">
          مفتاح Miftah
        </Link>
      </div>
      <button
        type="button"
        className="nav-toggle"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      <div className={`nav-links${menuOpen ? " nav-links-open" : ""}`}>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} className="nav-link" onClick={() => setMenuOpen(false)}>
              {link.label}
              {active && (
                <motion.div
                  layoutId="nav-underline"
                  className="nav-underline"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
        {loggedIn ? (
          <button className="secondary" onClick={logout}>
            Log out
          </button>
        ) : (
          <>
            <Link href="/miftah/login" className="nav-link" onClick={() => setMenuOpen(false)}>
              Log in
            </Link>
            <Link href="/miftah/register" onClick={() => setMenuOpen(false)}>
              <button type="button">Sign up</button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
