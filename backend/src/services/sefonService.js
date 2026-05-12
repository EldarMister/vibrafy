import axios from "axios";
import * as cheerio from "cheerio";
import { ExpiringCache } from "../utils/cache.js";
import { decodeProtectedUrl } from "../utils/decodeProtectedUrl.js";

const SEFON_BASE_URL = process.env.SEFON_BASE_URL || "https://sefon.pro";
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 300000);
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
};

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
    headers: REQUEST_HEADERS,
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

function normalizeBadgeText(value) {
  return normalizeText(value).replace(/^#\s*/, "");
}

function parseGenreFromAnchor($, anchor) {
  const href = $(anchor).attr("href");
  const slug = href ? parseGenreSlug(href) : null;
  const name = normalizeBadgeText($(anchor).text());

  if (!href || !slug || !name || slug === "genres" || /^\d{4}$/.test(name)) {
    return null;
  }

  return {
    name,
    slug,
    url: makeAbsoluteUrl(href),
  };
}

function extractPrimaryGenre($, scope) {
  const genreAnchors = scope.find("a[href*='/genres/']").toArray();

  for (const anchor of genreAnchors) {
    const genre = parseGenreFromAnchor($, anchor);

    if (genre) {
      return genre;
    }
  }

  return null;
}

function extractArtistCover($, scope = $.root()) {
  const cover =
    scope.find(".b_artist_info meta[itemprop='image']").attr("content") ||
    scope.find(".b_artist_info .photo img").first().attr("src") ||
    scope.find(".ya-share2").attr("data-image") ||
    scope.find("meta[itemprop='image']").attr("content") ||
    null;

  return makeAbsoluteUrl(cover);
}

function parseArtistProfile(html, fallbackArtist = null) {
  const $ = cheerio.load(html);
  const name =
    normalizeText($(".b_artist_info h1, h1[itemprop='name']").first().text()) ||
    fallbackArtist?.name ||
    null;
  const genre = extractPrimaryGenre($, $(".b_artist_info").first());
  const cover = extractArtistCover($, $(".b_artist_info").first());

  return {
    name,
    slug: fallbackArtist?.slug || null,
    url: fallbackArtist?.url || null,
    cover,
    genre_name: genre?.name || null,
    genre_slug: genre?.slug || null,
    genre_link: genre?.url || null,
  };
}

function parseTrackDetails(html) {
  const $ = cheerio.load(html);
  const genre = extractPrimaryGenre($, $(".box_right, .b_badges, body").first());
  const cover = extractArtistCover($, $("body"));

  return {
    cover,
    genre_name: genre?.name || null,
    genre_slug: genre?.slug || null,
    genre_link: genre?.url || null,
  };
}

function parseTrack($, element, pageContext = {}) {
  const container = $(element);
  const protectedNode = container.find(".url_protected").first();
  const encodedUrl = protectedNode.attr("data-url");
  const key = protectedNode.attr("data-key");
  const coverNode = container.find("img").first();
  const trackPageNode = container.find(".song_name a, a[href*='/mp3/']").first();
  const trackPageHref = trackPageNode.attr("href");
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
    cover:
      pageContext.artist?.cover ||
      makeAbsoluteUrl(coverNode.attr("src") || coverNode.attr("data-src") || null),
    catalog_artist_name:
      pageContext.artist?.name || artistLinks[0]?.name || null,
    catalog_artist_slug:
      pageContext.artist?.slug || artistLinks[0]?.slug || null,
    catalog_artist_link:
      pageContext.artist?.url || artistLinks[0]?.url || null,
    catalog_artist_cover: pageContext.artist?.cover || null,
    genre_name: pageContext.genre?.name || null,
    genre_slug: pageContext.genre?.slug || null,
    genre_link: pageContext.genre?.url || null,
    source_page_url: pageContext.sourcePageUrl || null,
    source_section: pageContext.section || null,
    track_page_url: makeAbsoluteUrl(trackPageHref),
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
    const genre = parseGenreFromAnchor($, anchor);

    if (!genre || map.has(genre.slug)) {
      return;
    }

    map.set(genre.slug, genre);
  });

  return [...map.values()];
}

async function fetchTrackDetails(trackPageUrl) {
  if (!trackPageUrl) {
    return null;
  }

  const html = await fetchHtml(trackPageUrl, makeCacheKey("track", trackPageUrl));
  return parseTrackDetails(html);
}

async function enrichTracksForSearch(tracks) {
  return Promise.all(
    tracks.map(async (track) => {
      if (!track?.track_page_url) {
        return track;
      }

      try {
        const details = await fetchTrackDetails(track.track_page_url);

        if (!details) {
          return track;
        }

        return {
          ...track,
          cover: details.cover || track.cover || null,
          catalog_artist_cover: details.cover || track.catalog_artist_cover || null,
          genre_name: details.genre_name || track.genre_name || null,
          genre_slug: details.genre_slug || track.genre_slug || null,
          genre_link: details.genre_link || track.genre_link || null,
        };
      } catch {
        return track;
      }
    }),
  );
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
    headers: REQUEST_HEADERS,
  });

  const parsed = parseTracksPage(response.data);
  const enrichedTracks = await enrichTracksForSearch(parsed.tracks);
  cache.set(cacheKey, enrichedTracks);

  return enrichedTracks;
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
  const artistProfile = pageContext.artist
    ? parseArtistProfile(html, pageContext.artist)
    : null;
  const resolvedArtist = artistProfile
    ? {
        ...pageContext.artist,
        ...artistProfile,
      }
    : pageContext.artist;
  const resolvedGenre =
    pageContext.genre ||
    (artistProfile?.genre_name
      ? {
          name: artistProfile.genre_name,
          slug: artistProfile.genre_slug,
          url: artistProfile.genre_link,
        }
      : null);
  const parsed = parseTracksPage(html, {
    ...pageContext,
    artist: resolvedArtist,
    genre: resolvedGenre,
    sourcePageUrl: makeAbsoluteUrl(pageUrl),
  });

  return {
    pageUrl: makeAbsoluteUrl(pageUrl),
    tracks: parsed.tracks,
    artistLinks: parseArtistLinksFromPage(html),
    artistProfile: resolvedArtist || null,
  };
}

export const searchTracks = fetchTracksFromSource;
