export const CURSE_WORDS = ["fuck", "shit", "bitch", "asshole", "fucking", "ass", "sucks", "shit", "bitch"];
export function getFileExtension(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",

    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/aac": "aac",
    "audio/flac": "flac",

    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "video/x-msvideo": "avi",
    "video/quicktime": "mov",

    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/json": "json",
    "text/plain": "txt",
    "text/html": "html",
    "text/css": "css",
    "text/javascript": "js",
  };

  return map[mimeType] || null; // returns null if unknown
}
