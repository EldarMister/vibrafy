import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { hashBuffer } from "../utils/hashFile.js";

const UPLOADS_ROOT = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
const PUBLIC_UPLOADS_PATH = "/uploads";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.BACKEND_PUBLIC_URL || "").replace(/\/$/, "");
const DOWNLOAD_TIMEOUT_MS = Number(process.env.STORAGE_DOWNLOAD_TIMEOUT_MS || 20000);
const DOWNLOAD_RETRIES = Number(process.env.STORAGE_DOWNLOAD_RETRIES || 2);
const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_FILE_BYTES || 60 * 1024 * 1024);
const MAX_COVER_BYTES = Number(process.env.MAX_COVER_FILE_BYTES || 8 * 1024 * 1024);

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  Accept: "*/*",
};

export function getUploadsRoot() {
  return UPLOADS_ROOT;
}

export async function ensureStorageReady() {
  await Promise.all([
    fs.mkdir(path.join(UPLOADS_ROOT, "audio"), { recursive: true }),
    fs.mkdir(path.join(UPLOADS_ROOT, "covers"), { recursive: true }),
  ]);
}

function getExtension(contentType, url, type) {
  const pathname = new URL(url).pathname;
  const sourceExtension = path.extname(pathname).toLowerCase();

  if (sourceExtension && sourceExtension.length <= 6) {
    return sourceExtension;
  }

  if (type === "audio") {
    if (contentType.includes("mpeg") || contentType.includes("mp3")) {
      return ".mp3";
    }

    if (contentType.includes("wav")) {
      return ".wav";
    }

    return ".mp3";
  }

  if (contentType.includes("png")) {
    return ".png";
  }

  if (contentType.includes("webp")) {
    return ".webp";
  }

  return ".jpg";
}

function assertMimeType(contentType, type, url) {
  if (type === "audio") {
    const isAudio =
      contentType.startsWith("audio/") ||
      contentType.includes("mpeg") ||
      contentType.includes("octet-stream") ||
      url.toLowerCase().includes(".mp3");

    if (!isAudio) {
      throw new Error(`Unexpected audio mime type: ${contentType || "unknown"}`);
    }

    return;
  }

  const isImage =
    contentType.startsWith("image/") ||
    url.toLowerCase().match(/\.(jpg|jpeg|png|webp)(\?|$)/);

  if (!isImage) {
    throw new Error(`Unexpected cover mime type: ${contentType || "unknown"}`);
  }
}

async function downloadBuffer(url, { type }) {
  const maxBytes = type === "audio" ? MAX_AUDIO_BYTES : MAX_COVER_BYTES;
  let lastError;

  for (let attempt = 0; attempt <= DOWNLOAD_RETRIES; attempt += 1) {
    try {
      const response = await axios.get(url, {
        headers: REQUEST_HEADERS,
        maxBodyLength: maxBytes,
        maxContentLength: maxBytes,
        responseType: "arraybuffer",
        timeout: DOWNLOAD_TIMEOUT_MS,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      const buffer = Buffer.from(response.data);

      if (buffer.length > maxBytes) {
        throw new Error(`${type} file is too large: ${buffer.length} bytes`);
      }

      assertMimeType(contentType, type, url);

      return {
        buffer,
        contentType,
      };
    } catch (error) {
      lastError = error;

      if (attempt < DOWNLOAD_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function saveRemoteFile({ url, type, trackId }) {
  if (!url) {
    return null;
  }

  await ensureStorageReady();

  const { buffer, contentType } = await downloadBuffer(url, { type });
  const hash = hashBuffer(buffer);
  const extension = getExtension(contentType, url, type);
  const folder = type === "audio" ? "audio" : "covers";
  const fileName = `${trackId}-${hash.slice(0, 16)}${extension}`;
  const storagePath = path.join(folder, fileName).replaceAll("\\", "/");
  const absolutePath = path.join(UPLOADS_ROOT, storagePath);

  await fs.writeFile(absolutePath, buffer);

  return {
    hash,
    fileSize: buffer.length,
    mimeType: contentType,
    publicUrl: `${PUBLIC_BASE_URL}${PUBLIC_UPLOADS_PATH}/${storagePath}`,
    storagePath,
  };
}
