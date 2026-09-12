"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  function refresh(q) {
    api
      .adminListUsers(q)
      .then(setUsers)
      .catch((e) => setError(e.message));
  }

  useEffect(() => refresh(""), []);

  function handleSearch(e) {
    e.preventDefault();
    refresh(query);
  }

  async function handleToggleSuspend(u) {
    try {
      await api.adminSuspendUser(u.id, u.is_active);
      refresh(query);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">Users</h1>
      <p className="page-subtitle">Search by email, and suspend accounts if needed.</p>

      {error && <p className="error-banner">{error}</p>}

      <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          placeholder="Search by email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit">Search</button>
      </form>

      {users === null && !error && <p className="muted">Loading users…</p>}
      {users && users.length === 0 && <p className="muted">No users match that search.</p>}

      {users &&
        users.map((u) => (
          <div
            key={u.id}
            className="illuminated-card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{u.display_name || u.email}</p>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {u.email} · joined {new Date(u.created_at).toLocaleDateString()} ·{" "}
                <span className={`pill ${u.is_active ? "status-memorized" : "status-new"}`}>
                  {u.is_active ? "Active" : "Suspended"}
                </span>
              </p>
            </div>
            <button
              type="button"
              className={u.is_active ? "danger" : "secondary"}
              onClick={() => handleToggleSuspend(u)}
            >
              {u.is_active ? "Suspend" : "Reactivate"}
            </button>
          </div>
        ))}
    </main>
  );
}
