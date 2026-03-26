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

export function makeAbsoluteUrl(url) {
  if (!url) {
    return null;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return new URL(url, SEFON_BASE_URL).toString();
}

function makeCacheKey(prefix, value) {
  return `${prefix}:${value}`;
}

async function fetchHtml(url, cacheKey) {
  const cached = cacheKey ? cache.get(cacheKey) : null;

  if (cached) {
    return cached;
  }

  const response = await axios.get(makeAbsoluteUrl(url), {
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    },
  });

  if (cacheKey) {
    cache.set(cacheKey, response.data);
  }

  return response.data;
}

function parseArtistSlug(href) {
  const match = href.match(/\/artist\/([^/]+)\//i);
  return match ? match[1] : null;
}

function parseGenreSlug(href) {
  const match = href.match(/\/genres\/([^/]+)\//i);
  return match ? match[1] : null;
}

function parseTrack($, element, pageContext = {}) {
  const container = $(element);
  const protectedNode = container.find(".url_protected").first();
  const encodedUrl = protectedNode.attr("data-url");
  const key = protectedNode.attr("data-key");
  const coverNode = container.find("img").first();
  const artistLinks = container
    .find(".artist_name a")
    .toArray()
    .map((anchor) => {
      const href = $(anchor).attr("href");
      const name = normalizeText($(anchor).text());

      if (!href || !name) {
        return null;
      }

      return {
        name,
        slug: parseArtistSlug(href),
        url: makeAbsoluteUrl(href),
      };
    })
    .filter(Boolean);

  const track = {
    source_track_id: container.attr("data-mp3_id") || null,
    title: normalizeText(container.find(".song_name").first().text()),
    artist: normalizeText(container.find(".artist_name").first().text()),
    audio_url: decodeProtectedUrl(encodedUrl, key),
    cover: makeAbsoluteUrl(coverNode.attr("src") || coverNode.attr("data-src") || null),
    catalog_artist_name:
      pageContext.artist?.name || artistLinks[0]?.name || null,
    catalog_artist_slug:
      pageContext.artist?.slug || artistLinks[0]?.slug || null,
    catalog_artist_link:
      pageContext.artist?.url || artistLinks[0]?.url || null,
    genre_name: pageContext.genre?.name || null,
    genre_slug: pageContext.genre?.slug || null,
    genre_link: pageContext.genre?.url || null,
    source_page_url: pageContext.sourcePageUrl || null,
    source_section: pageContext.section || null,
  };

  if (!track.title || !track.artist || !track.audio_url) {
    return null;
  }

  return track;
}

function parseTracksPage(html, pageContext = {}) {
  const $ = cheerio.load(html);
  const tracks = $(".mp3")
    .toArray()
    .map((element) => parseTrack($, element, pageContext))
    .filter(Boolean);

  return { $, tracks };
}

function parseArtistLinksFromPage(html) {
  const $ = cheerio.load(html);
  const map = new Map();

  $("a[href*='/artist/']").each((_, anchor) => {
    const href = $(anchor).attr("href");
    const slug = href ? parseArtistSlug(href) : null;
    const name = normalizeText($(anchor).text()) || normalizeText($(anchor).attr("alt") || "");

    if (!href || !slug || !name || map.has(slug)) {
      return;
    }

    map.set(slug, {
      slug,
      name,
      url: makeAbsoluteUrl(href),
    });
  });

  return [...map.values()];
}

function parseGenresFromPage(html) {
  const $ = cheerio.load(html);
  const map = new Map();

  $("a[href*='/genres/']").each((_, anchor) => {
    const href = $(anchor).attr("href");
    const slug = href ? parseGenreSlug(href) : null;
    const name = normalizeText($(anchor).text()).replace(/^#\s*/, "");

    if (!href || !slug || !name || slug === "genres" || map.has(slug)) {
      return;
    }

    map.set(slug, {
      slug,
      name,
      url: makeAbsoluteUrl(href),
    });
  });

  return [...map.values()];
}

export function buildPagedPath(path, page) {
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;

  if (page <= 1) {
    return normalizedPath;
  }

  return `${normalizedPath}${page}/`;
}

export async function fetchTracksFromSource(query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const cacheKey = makeCacheKey("search", normalizedQuery);
  const cachedResult = cache.get(cacheKey);

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

  const parsed = parseTracksPage(response.data);
  cache.set(cacheKey, parsed.tracks);

  return parsed.tracks;
}

export async function discoverGenres() {
  const html = await fetchHtml("/genres/", makeCacheKey("page", "/genres/"));
  return parseGenresFromPage(html);
}

export async function discoverArtists() {
  const html = await fetchHtml("/artists/", makeCacheKey("page", "/artists/"));
  return parseArtistLinksFromPage(html);
}

export async function fetchCatalogPage(path, pageContext = {}) {
  const pageUrl = buildPagedPath(path, pageContext.page || 1);
  const html = await fetchHtml(pageUrl, makeCacheKey("page", pageUrl));
  const parsed = parseTracksPage(html, {
    ...pageContext,
    sourcePageUrl: makeAbsoluteUrl(pageUrl),
  });

  return {
    pageUrl: makeAbsoluteUrl(pageUrl),
    tracks: parsed.tracks,
    artistLinks: parseArtistLinksFromPage(html),
  };
}

export const searchTracks = fetchTracksFromSource;
