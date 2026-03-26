import axios from "axios";
import * as cheerio from "cheerio";
import { ExpiringCache } from "../utils/cache.js";
import { decodeProtectedUrl } from "../utils/decodeProtectedUrl.js";

const SEFON_BASE_URL = process.env.SEFON_BASE_URL || "https://sefon.pro";
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 300000);

const cache = new ExpiringCache(CACHE_TTL_MS);

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function makeAbsoluteUrl(url) {
  if (!url) {
    return null;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return new URL(url, SEFON_BASE_URL).toString();
}

function parseTrack($, element) {
  const container = $(element);
  const protectedNode = container.find(".url_protected").first();
  const encodedUrl = protectedNode.attr("data-url");
  const key = protectedNode.attr("data-key");
  const coverNode = container.find("img").first();
  const track = {
    source_track_id: container.attr("data-mp3_id") || null,
    title: normalizeText(container.find(".song_name").first().text()),
    artist: normalizeText(container.find(".artist_name").first().text()),
    audio_url: decodeProtectedUrl(encodedUrl, key),
    cover: makeAbsoluteUrl(coverNode.attr("src") || coverNode.attr("data-src") || null),
  };

  if (!track.title || !track.artist || !track.audio_url) {
    return null;
  }

  return track;
}

function parseSearchPage(html) {
  const $ = cheerio.load(html);
  const tracks = $(".mp3")
    .toArray()
    .map((element) => parseTrack($, element))
    .filter(Boolean);

  return tracks;
}

export async function fetchTracksFromSource(query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const cachedResult = cache.get(normalizedQuery);

  if (cachedResult) {
    return cachedResult;
  }

  const response = await axios.get(`${SEFON_BASE_URL}/search/`, {
    params: { q: query },
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    },
  });

  const tracks = parseSearchPage(response.data);
  cache.set(normalizedQuery, tracks);

  return tracks;
}

export const searchTracks = fetchTracksFromSource;
