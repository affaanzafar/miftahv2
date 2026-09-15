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
  guestCheckAttempt: (ayah_id, recognized_text) =>
    request("/recitation/guest-check", {
      method: "POST",
      body: { ayah_id, recognized_text },
      auth: false,
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
  setGoalCompletion: (goalId, is_completed) =>
    request(`/hifz/goals/${goalId}/completion`, { method: "PATCH", body: { is_completed } }),

  listCircles: () => request("/community/circles"),
  discoverCircles: (q = "") => request(`/community/circles/discover${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createCircle: (payload) => request("/community/circles", { method: "POST", body: payload }),
  joinCircle: (circleId) => request(`/community/circles/${circleId}/join`, { method: "POST" }),
  circleProgress: (circleId) => request(`/community/circles/${circleId}/progress`),
  inviteToCircle: (circleId, email) =>
    request(`/community/circles/${circleId}/invite`, { method: "POST", body: { email } }),
  reportMember: (circleId, payload) =>
    request(`/community/circles/${circleId}/report`, { method: "POST", body: payload }),
  sendCircleMessage: (circleId, body, media_url = null, media_type = null) =>
    request(`/community/circles/${circleId}/messages`, {
      method: "POST",
      body: { body, media_url, media_type },
    }),
  listCircleMessages: (circleId, afterId = 0) =>
    request(`/community/circles/${circleId}/messages?after_id=${afterId}`),
  getUploadSignature: () => request("/media/upload-signature"),

  updateDisplayName: (display_name) => request("/auth/me", { method: "PATCH", body: { display_name } }),
  myProfile: () => request("/social/me/profile"),
  searchUsers: (q) => request(`/social/users/search?q=${encodeURIComponent(q)}`),
  followUser: (userId) => request(`/social/users/${userId}/follow`, { method: "POST" }),
  unfollowUser: (userId) => request(`/social/users/${userId}/unfollow`, { method: "POST" }),
  listFollowers: (userId) => request(`/social/users/${userId}/followers`),
  listFollowing: (userId) => request(`/social/users/${userId}/following`),

  startMiftahMethod: (surah_id, start_ayah_number, end_ayah_number, skip_repeat = false) =>
    request("/miftah-method/sessions", {
      method: "POST",
      body: { surah_id, start_ayah_number, end_ayah_number, skip_repeat },
    }),
  getMiftahMethodSession: (sessionId) => request(`/miftah-method/sessions/${sessionId}`),
  listMiftahMethodSessions: () => request("/miftah-method/sessions"),
  submitMiftahMethodAttempt: (sessionId, recognized_text) =>
    request(`/miftah-method/sessions/${sessionId}/attempt`, {
      method: "POST",
      body: { recognized_text },
    }),

  transcribeAudio: (blob) => transcribeAudioRequest(blob),

  // --- Arabic Learning (guest-browsable; personalized when logged in) ---
  listArabicCourses: () => request("/arabic/courses"),
  getArabicCourse: (slug) => request(`/arabic/courses/${slug}`),
  enrollInCourse: (slug) => request(`/arabic/courses/${slug}/enroll`, { method: "POST" }),
  completeLesson: (lessonId) => request(`/arabic/lessons/${lessonId}/complete`, { method: "POST" }),
  listQuizzes: () => request("/arabic/quizzes"),
  getQuiz: (quizId) => request(`/arabic/quizzes/${quizId}`),
  submitQuiz: (quizId, answers) => request(`/arabic/quizzes/${quizId}/submit`, { method: "POST", body: { answers } }),
  myQuizResults: () => request("/arabic/my-quiz-results"),
  listArticles: () => request("/articles"),
  getArticle: (slug) => request(`/articles/${slug}`),

  // --- Admin Studio (all admin-gated server-side via AdminUser) ---
  adminWhoAmI: () => request("/admin/me"),
  adminDashboard: () => request("/admin/dashboard"),
  adminListCourses: () => request("/admin/courses"),
  adminGetCourseDetail: (id) => request(`/admin/courses/${id}/detail`),
  adminCreateCourse: (payload) => request("/admin/courses", { method: "POST", body: payload }),
  adminUpdateCourse: (id, payload) => request(`/admin/courses/${id}`, { method: "PATCH", body: payload }),
  adminPublishCourse: (id, publish) =>
    request(`/admin/courses/${id}/publish?publish=${publish}`, { method: "POST" }),
  adminDeleteCourse: (id) => request(`/admin/courses/${id}`, { method: "DELETE" }),
  adminCreateModule: (courseId, payload) =>
    request(`/admin/courses/${courseId}/modules`, { method: "POST", body: payload }),
  adminDeleteModule: (moduleId) => request(`/admin/modules/${moduleId}`, { method: "DELETE" }),
  adminCreateLesson: (moduleId, payload) =>
    request(`/admin/modules/${moduleId}/lessons`, { method: "POST", body: payload }),
  adminDeleteLesson: (lessonId) => request(`/admin/lessons/${lessonId}`, { method: "DELETE" }),
  adminCreateQuiz: (courseId, payload) =>
    request(`/admin/courses/${courseId}/quizzes`, { method: "POST", body: payload }),
  adminListArticles: () => request("/admin/articles"),
  adminCreateArticle: (payload) => request("/admin/articles", { method: "POST", body: payload }),
  adminPublishArticle: (id, publish) =>
    request(`/admin/articles/${id}/publish?publish=${publish}`, { method: "PATCH" }),
  adminDeleteArticle: (id) => request(`/admin/articles/${id}`, { method: "DELETE" }),
  adminListAnnouncements: () => request("/admin/announcements"),
  adminCreateAnnouncement: (payload) => request("/admin/announcements", { method: "POST", body: payload }),
  adminPublishAnnouncement: (id, publish) =>
    request(`/admin/announcements/${id}/publish?publish=${publish}`, { method: "PATCH" }),
  adminDeleteAnnouncement: (id) => request(`/admin/announcements/${id}`, { method: "DELETE" }),
  adminListUsers: (q) => request(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  adminSuspendUser: (userId, suspend) =>
    request(`/admin/users/${userId}/suspend?suspend=${suspend}`, { method: "POST" }),
};

/**
 * Sends one recorded audio chunk to the server-side STT endpoint
 * (tarteel-ai/whisper-base-ar-quran) and returns the recognized text.
 * A separate path from `request()` above because this is a multipart
 * upload, not JSON — must NOT set a Content-Type header manually, or the
 * browser won't attach the multipart boundary and the server can't parse it.
 */
async function transcribeAudioRequest(blob) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const formData = new FormData();
  formData.append("file", blob, "chunk.webm");

  const res = await fetch(`${API_URL}/stt/transcribe`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Transcription failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Uploads a file directly from the browser to Cloudinary, using a
 * short-lived signature fetched from our backend. The file itself never
 * touches our server — this keeps Render's free-tier bandwidth/memory out
 * of the picture entirely for media.
 */
export async function uploadToCloudinary(file, folder) {
  const sig = folder ? await request(`/media/upload-signature?folder=${encodeURIComponent(folder)}`) : await api.getUploadSignature();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sig.api_key);
  formData.append("timestamp", sig.timestamp);
  formData.append("signature", sig.signature);
  formData.append("folder", sig.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error?.message || "Upload failed");
  }

  const data = await res.json();
  // Cloudinary's resource_type is "image" | "video" | "raw" — collapse
  // video into a generic "file" bucket for simpler UI handling, since a
  // study circle chat isn't expected to be full of video attachments.
  const media_type = data.resource_type === "image" ? "image" : "file";
  return { url: data.secure_url, media_type, original_filename: data.original_filename };
}
