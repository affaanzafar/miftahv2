"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "../lib/api";

export default function Nav() {
  const router = useRouter();
  const loggedIn = typeof window !== "undefined" && !!getToken();

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        مفتاح Miftah
      </Link>
      <div className="nav-links">
        <Link href="/">Surahs</Link>
        <Link href="/hifz">Hifz</Link>
        <Link href="/miftah-method">Miftah Method</Link>
        <Link href="/circles">Circles</Link>
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
