"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { clearToken, getToken } from "../lib/api";

const LINKS = [
  { href: "/", label: "Surahs" },
  { href: "/hifz", label: "Hifz" },
  { href: "/miftah-method", label: "Miftah Method" },
  { href: "/circles", label: "Circles" },
];

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const loggedIn = typeof window !== "undefined" && !!getToken();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <nav className={`nav${scrolled ? " nav-scrolled" : ""}`}>
      <Link href="/" className="nav-brand">
        مفتاح Miftah
      </Link>
      <div className="nav-links">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} className="nav-link">
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
          <Link href="/login">Log in</Link>
        )}
      </div>
    </nav>
  );
}
