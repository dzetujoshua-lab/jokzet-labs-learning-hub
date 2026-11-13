/**
 * Rules for instructional resource links. Pure (no database, no server-only imports) so the curriculum validators, the
 * server and the browser all share one definition.
 *
 * Only https links to an approved host are accepted. Embedding is limited to YouTube through its privacy-enhanced host
 * (youtube-nocookie.com); every other resource is shown as an external link. Adding a host is a reviewed code change.
 */

type HostInfo = { provider: string };

/** Hosts an approved resource may point to. Official documentation and a video provider; extend by pull request. */
export const ALLOWED_RESOURCE_HOSTS: Record<string, HostInfo> = {
  "www.youtube.com": { provider: "youtube" },
  "youtube.com": { provider: "youtube" },
  "m.youtube.com": { provider: "youtube" },
  "youtu.be": { provider: "youtube" },
  "developer.mozilla.org": { provider: "mdn" },
  "docs.github.com": { provider: "github-docs" },
  "owasp.org": { provider: "owasp" },
  "cheatsheetseries.owasp.org": { provider: "owasp" },
  "docs.aws.amazon.com": { provider: "aws-docs" },
  "learn.microsoft.com": { provider: "microsoft-learn" },
  "cloud.google.com": { provider: "google-cloud-docs" },
  "docs.python.org": { provider: "python-docs" },
  "nextjs.org": { provider: "nextjs-docs" },
  "react.dev": { provider: "react-docs" },
  "www.w3.org": { provider: "w3c" },
  "web.dev": { provider: "web-dev" },
};

export const EMBED_HOST = "www.youtube-nocookie.com";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

export type ResourceLink =
  | { ok: true; canonicalUrl: string; provider: string; host: string; kind: "video" | "playlist" | "page"; embedUrl: string | null }
  | { ok: false; error: string };

/**
 * Validates a resource URL and returns its canonical form, provider and (for YouTube videos and playlists) the
 * privacy-enhanced embed URL. Rejects non-https, credentials, unknown hosts and malformed video or playlist ids.
 */
export function parseResourceUrl(input: string): ResourceLink {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, error: "Not a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Only https links are allowed." };
  if (url.username || url.password) return { ok: false, error: "Links must not contain credentials." };
  if (url.port) return { ok: false, error: "Links must not use a custom port." };
  const info = ALLOWED_RESOURCE_HOSTS[url.hostname.toLowerCase()];
  if (!info) return { ok: false, error: `${url.hostname} is not an approved resource host.` };

  if (info.provider === "youtube") {
    const host = url.hostname.toLowerCase();
    let videoId: string | null = null;
    let playlistId: string | null = null;
    if (host === "youtu.be") videoId = url.pathname.slice(1).split("/")[0] || null;
    else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
      playlistId = url.searchParams.get("list");
    } else if (url.pathname.startsWith("/embed/")) videoId = url.pathname.slice("/embed/".length).split("/")[0] || null;
    else if (url.pathname === "/playlist") playlistId = url.searchParams.get("list");
    else return { ok: false, error: "Use a YouTube watch, youtu.be, embed or playlist link." };

    if (videoId !== null && videoId !== "videoseries") {
      if (!VIDEO_ID.test(videoId)) return { ok: false, error: "That YouTube video id is not valid." };
      return {
        ok: true, provider: "youtube", host, kind: "video",
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        embedUrl: `https://${EMBED_HOST}/embed/${videoId}?rel=0`,
      };
    }
    if (playlistId !== null) {
      if (!PLAYLIST_ID.test(playlistId)) return { ok: false, error: "That YouTube playlist id is not valid." };
      return {
        ok: true, provider: "youtube", host, kind: "playlist",
        canonicalUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        embedUrl: `https://${EMBED_HOST}/embed/videoseries?list=${playlistId}&rel=0`,
      };
    }
    return { ok: false, error: "That YouTube link has no video or playlist id." };
  }

  // Any other approved host: an external page. Drop the fragment so the same page is not catalogued twice.
  url.hash = "";
  return { ok: true, provider: info.provider, host: url.hostname.toLowerCase(), kind: "page", canonicalUrl: url.toString(), embedUrl: null };
}

/** The only thing the browser is allowed to load into a frame from us. */
export const isAllowedEmbedUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === EMBED_HOST && (url.pathname.startsWith("/embed/")) && !url.username && !url.password;
  } catch {
    return false;
  }
};
