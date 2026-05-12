const NOISE_WORDS = /\b(mp3|download|скачать|sefon|сефон)\b/gi;

export function normalizeTrackText(value) {
  return String(value || "")
    .replace(NOISE_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTrackKey(value) {
  return normalizeTrackText(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "");
}

export function normalizeParsedTrack(track) {
  const title = normalizeTrackText(track.title);
  const artist = normalizeTrackText(track.artist);
  const sourceName = track.source_name || "sefon";
  const sourceUrl = track.track_page_url || track.source_page_url || track.audio_url || null;
  const sourceId = track.source_id || track.source_track_id || sourceUrl;

  return {
    ...track,
    title,
    artist,
    source_name: sourceName,
    source_url: sourceUrl,
    source_id: sourceId ? String(sourceId) : null,
    audio_source_url: track.audio_source_url || track.audio_url || null,
    cover_source_url: track.cover_source_url || track.cover || track.catalog_artist_cover || null,
    normalized_title: normalizeTrackKey(title),
    normalized_artist: normalizeTrackKey(artist),
    genre_name: track.genre_name || null,
    mood: Array.isArray(track.mood) ? track.mood : [],
    tags: Array.isArray(track.tags)
      ? track.tags
      : [track.genre_name, track.genre_slug].filter(Boolean),
  };
}
