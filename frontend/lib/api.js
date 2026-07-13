const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("miftah_token");
}

export function setToken(token) {
  localStorage.setItem("miftah_token", token);
}

export function clearToken() {
  localStorage.removeItem("miftah_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  register: (email, password, display_name) =>
    request("/auth/register", { method: "POST", body: { email, password, display_name }, auth: false }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/auth/me"),

  listSurahs: () => request("/quran/surahs"),
  getSurah: (surahId) => request(`/quran/surahs/${surahId}`),

  startSession: (surah_id, start_ayah_number, end_ayah_number, is_review = false) =>
    request("/recitation/sessions", {
      method: "POST",
      body: { surah_id, start_ayah_number, end_ayah_number, is_review },
    }),
  submitAttempt: (sessionId, ayah_id, recognized_text) =>
    request(`/recitation/sessions/${sessionId}/attempts`, {
      method: "POST",
      body: { ayah_id, recognized_text },
    }),
  completeSession: (sessionId) =>
    request(`/recitation/sessions/${sessionId}/complete`, { method: "POST" }),

  getDueReviews: () => request("/hifz/due"),
  getDueReviewsGrouped: () => request("/hifz/due/grouped"),
  getProgress: () => request("/hifz/progress"),
  markLearning: (ayahId) => request(`/hifz/ayahs/${ayahId}/mark-learning`, { method: "POST" }),
  applyReview: (sessionId) => request(`/hifz/sessions/${sessionId}/apply-review`, { method: "POST" }),
  createGoal: (payload) => request("/hifz/goals", { method: "POST", body: payload }),
  listGoals: () => request("/hifz/goals"),
  deleteGoal: (goalId) => request(`/hifz/goals/${goalId}`, { method: "DELETE" }),

  listCircles: () => request("/community/circles"),
  discoverCircles: (q = "") => request(`/community/circles/discover${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createCircle: (payload) => request("/community/circles", { method: "POST", body: payload }),
  joinCircle: (circleId) => request(`/community/circles/${circleId}/join`, { method: "POST" }),
  circleProgress: (circleId) => request(`/community/circles/${circleId}/progress`),
  inviteToCircle: (circleId, email) =>
    request(`/community/circles/${circleId}/invite`, { method: "POST", body: { email } }),
  reportMember: (circleId, payload) =>
    request(`/community/circles/${circleId}/report`, { method: "POST", body: payload }),
  sendCircleMessage: (circleId, body) =>
    request(`/community/circles/${circleId}/messages`, { method: "POST", body: { body } }),
  listCircleMessages: (circleId, afterId = 0) =>
    request(`/community/circles/${circleId}/messages?after_id=${afterId}`),

  updateDisplayName: (display_name) => request("/auth/me", { method: "PATCH", body: { display_name } }),
  myProfile: () => request("/social/me/profile"),
  searchUsers: (q) => request(`/social/users/search?q=${encodeURIComponent(q)}`),
  followUser: (userId) => request(`/social/users/${userId}/follow`, { method: "POST" }),
  unfollowUser: (userId) => request(`/social/users/${userId}/unfollow`, { method: "POST" }),
  listFollowers: (userId) => request(`/social/users/${userId}/followers`),
  listFollowing: (userId) => request(`/social/users/${userId}/following`),

  startMiftahMethod: (surah_id, start_ayah_number, end_ayah_number) =>
    request("/miftah-method/sessions", {
      method: "POST",
      body: { surah_id, start_ayah_number, end_ayah_number },
    }),
  getMiftahMethodSession: (sessionId) => request(`/miftah-method/sessions/${sessionId}`),
  listMiftahMethodSessions: () => request("/miftah-method/sessions"),
  submitMiftahMethodAttempt: (sessionId, recognized_text) =>
    request(`/miftah-method/sessions/${sessionId}/attempt`, {
      method: "POST",
      body: { recognized_text },
    }),
};
