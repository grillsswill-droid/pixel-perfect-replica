const DIRECT_VIDEO_EXTENSION = /\.(?:mp4|m4v|webm)$/i;

const UNSUPPORTED_VIDEO_LINK =
  "Use a direct HTTPS MP4, M4V or WebM link, or a Streamable video link.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getStreamableVideoId(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["streamable.com", "www.streamable.com"].includes(url.hostname.toLowerCase()) ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.pathname.match(/^\/(?:e\/|o\/)?([a-z0-9]+)\/?$/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isDirectGalleryVideoUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      DIRECT_VIDEO_EXTENSION.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isGalleryVideoUrl(value: string) {
  return isDirectGalleryVideoUrl(value) || Boolean(getStreamableVideoId(value));
}

export async function resolveGalleryVideoUrl(value: string, signal?: AbortSignal) {
  if (isDirectGalleryVideoUrl(value)) return new URL(value).href;

  const id = getStreamableVideoId(value);
  if (!id) throw new Error(UNSUPPORTED_VIDEO_LINK);

  const response = await fetch(`https://api.streamable.com/videos/${id}`, {
    credentials: "omit",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("This Streamable video could not be reached. Check the link.");

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload["status"] !== 2 || !isRecord(payload["files"])) {
    throw new Error("This Streamable video is not ready to play. Check the link and try again.");
  }

  const mp4 = payload["files"]["mp4"];
  const mediaUrl = isRecord(mp4) ? mp4["url"] : null;
  if (typeof mediaUrl !== "string") {
    throw new Error("This Streamable video has no playable MP4. Try another video link.");
  }

  let url: URL;
  try {
    url = new URL(mediaUrl);
  } catch {
    throw new Error("Streamable returned an invalid video link. Try again later.");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.toLowerCase().endsWith(".streamable.com") ||
    !DIRECT_VIDEO_EXTENSION.test(url.pathname)
  ) {
    throw new Error("Streamable returned an unsupported video link. Try again later.");
  }

  return url.href;
}

export function getGalleryVideoUrlError() {
  return UNSUPPORTED_VIDEO_LINK;
}
