"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .adminDashboard()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="page">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">A quick read on how the platform is doing.</p>

      {error && <p className="error-banner">{error}</p>}

      {stats && (
        <div className="card-row" style={{ marginTop: 16 }}>
          <div className="card">
            <p className="muted" style={{ marginBottom: 4 }}>Total users</p>
            <h2 style={{ margin: 0 }}>{stats.total_users}</h2>
          </div>
          <div className="card">
            <p className="muted" style={{ marginBottom: 4 }}>Published courses</p>
            <h2 style={{ margin: 0 }}>{stats.active_courses}</h2>
          </div>
          <div className="card">
            <p className="muted" style={{ marginBottom: 4 }}>Total enrollments</p>
            <h2 style={{ margin: 0 }}>{stats.total_enrollments}</h2>
          </div>
          <div className="card">
            <p className="muted" style={{ marginBottom: 4 }}>Published announcements</p>
            <h2 style={{ margin: 0 }}>{stats.published_announcements}</h2>
          </div>
        </div>
      )}
    </main>
  );
}
