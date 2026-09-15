/**
 * Extracts a YouTube video ID from common URL shapes:
 * watch?v=, youtu.be/, embed/, shorts/. Returns null for anything else
 * (e.g. a direct Cloudinary/mp4 URL), so callers can fall back to <video>.
 */
export function youtubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}
