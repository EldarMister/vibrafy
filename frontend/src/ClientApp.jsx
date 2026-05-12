import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "./components/BottomNav.jsx";
import { Player } from "./components/Player.jsx";
import { apiRequest } from "./lib/api.js";
import { useTelegram } from "./hooks/useTelegram.js";

const STORAGE_KEYS = {
  favorites: "vibrafy-favorites",
  playlists: "vibrafy-playlists",
  recent: "vibrafy-recent",
  sleepTimerEndsAt: "vibrafy-sleep-timer-ends-at",
  tracks: "vibrafy-tracks",
};

const MAX_RECENT_TRACKS = 24;
const INITIAL_CATALOG_PAGE_SIZE = 1000;
const BACKGROUND_CATALOG_PAGE_SIZE = 1000;
const PUBLIC_CATALOG_MAX_TRACKS = 10000;
const REMOTE_CATALOG_CACHE_MIN_TRACKS = 100;
const SEARCH_DEBOUNCE_MS = 260;
const HAS_REMOTE_API = Boolean(import.meta.env.VITE_API_BASE_URL);
const USE_DEV_FALLBACK = import.meta.env.DEV;

const MOCK_COVERS = {
  hills: "https://picsum.photos/seed/vibrafy-memories/900/900",
  swim: "https://picsum.photos/seed/vibrafy-deep-vibe/900/900",
  portrait: "https://picsum.photos/seed/vibrafy-pop-mood/900/900",
  road: "https://picsum.photos/seed/vibrafy-road/900/900",
  snow: "https://picsum.photos/seed/vibrafy-snow/900/900",
  forest: "https://picsum.photos/seed/vibrafy-forest/900/900",
  dusk: "https://picsum.photos/seed/vibrafy-dusk/900/900",
  candles: "https://picsum.photos/seed/vibrafy-candles/900/900",
};

const DEFAULT_SHOWCASE_TRACKS = [
  {
    id: "demo-1",
    title: "Memories",
    artist: "Xcho & Macan",
    cover: MOCK_COVERS.hills,
    genre_name: "pop",
    mood: ["Вайб", "Релакс"],
  },
  {
    id: "demo-2",
    title: "Зачарованная",
    artist: "Xcho & Ayni",
    cover: MOCK_COVERS.swim,
    genre_name: "lyric",
    mood: ["Грусть", "Релакс"],
  },
  {
    id: "demo-3",
    title: "Dance",
    artist: "Xcho",
    cover: MOCK_COVERS.snow,
    genre_name: "dance",
    mood: ["Энергия", "Вайб"],
  },
  {
    id: "demo-4",
    title: "OnlyFans",
    artist: "Isam Ft Koorosh",
    cover: "https://picsum.photos/seed/vibrafy-onlyfans/900/900",
    genre_name: "rap",
    mood: ["Энергия"],
  },
  {
    id: "demo-5",
    title: "Redbull",
    artist: "Arta Ft Koorosh & Smokepurpp",
    cover: "https://picsum.photos/seed/vibrafy-redbull/900/900",
    genre_name: "hip-hop",
    mood: ["Энергия", "Фокус"],
  },
  {
    id: "demo-6",
    title: "Nakhla",
    artist: "Hidden & Khalse & Sijal",
    cover: "https://picsum.photos/seed/vibrafy-nakhla/900/900",
    genre_name: "rap",
    mood: ["Вайб"],
  },
  {
    id: "demo-7",
    title: "Baadpooli",
    artist: "Hiphopologist x Kagan",
    cover: "https://picsum.photos/seed/vibrafy-baadpooli/900/900",
    genre_name: "hip-hop",
    mood: ["Фокус"],
  },
  {
    id: "demo-8",
    title: "tttpttt",
    artist: "Poori",
    cover: "https://picsum.photos/seed/vibrafy-tttpttt/900/900",
    genre_name: "rap",
    mood: ["Вайб"],
  },
  {
    id: "demo-9",
    title: "First Class",
    artist: "Koorosh 420VII",
    cover: "https://picsum.photos/seed/vibrafy-first-class/900/900",
    genre_name: "rap",
    mood: ["Энергия"],
  },
  {
    id: "demo-10",
    title: "Faze Sekte",
    artist: "CatchyBeats Ft 021KId",
    cover: "https://picsum.photos/seed/vibrafy-faze-sekte/900/900",
    genre_name: "trap",
    mood: ["Фокус"],
  },
  {
    id: "demo-11",
    title: "Ma",
    artist: "Koorosh Ft Sami Low",
    cover: "https://picsum.photos/seed/vibrafy-ma/900/900",
    genre_name: "lyric",
    mood: ["Грусть"],
  },
  {
    id: "demo-12",
    title: "Dobareh",
    artist: "Gogoosh Ft Sogand & Leila Forohar",
    cover: "https://picsum.photos/seed/vibrafy-dobareh/900/900",
    genre_name: "pop",
    mood: ["Релакс"],
  },
  {
    id: "demo-13",
    title: "Inja Irane",
    artist: "021KID Ft Putak",
    cover: "https://picsum.photos/seed/vibrafy-inja-irane/900/900",
    genre_name: "rap",
    mood: ["Энергия"],
  },
  {
    id: "demo-14",
    title: "So Much Beauty (Around Us)",
    artist: "Lost Frequencies & Nathan Nicholson",
    cover: "https://picsum.photos/seed/vibrafy-beauty/900/900",
    genre_name: "electronic",
    mood: ["Релакс", "Фокус"],
  },
  {
    id: "demo-15",
    title: "STREET OF PSYCHOS",
    artist: "SHINING BREEZZE & STILLINDOPE",
    cover: "https://picsum.photos/seed/vibrafy-psychos/900/900",
    genre_name: "trap",
    mood: ["Энергия", "Фокус"],
  },
].map((track, index) => ({
  ...track,
  audio_url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${index + 1}.mp3`,
  duration: [551, 218, 252, 180, 206, 232, 198, 173, 221, 247, 194, 263, 219, 304, 188][index],
  source_section: index < 6 ? "best" : "manual",
}));

const DEFAULT_COVER_POOL = DEFAULT_SHOWCASE_TRACKS.map((track) => track.cover);

const MOOD_CHIPS = [
  { id: "Релакс", icon: "leaf" },
  { id: "Вайб", icon: "spark" },
  { id: "Фокус", icon: "focus" },
  { id: "Грусть", icon: "rain" },
  { id: "Энергия", icon: "bolt" },
];

const SEARCH_FILTERS = [
  { id: "all", label: "Все" },
  { id: "tracks", label: "Треки" },
  { id: "artists", label: "Артисты" },
  { id: "playlists", label: "Плейлисты" },
];

const PLAYLIST_FILTERS = [
  { id: "all", label: "Все" },
  { id: "my", label: "Мои" },
  { id: "saved", label: "Сохранённые" },
  { id: "liked", label: "Любимые" },
];

function getTrackKey(track) {
  if (!track) {
    return "";
  }

  return String(
    track.id ||
      track.source_track_id ||
      track.audio_url ||
      track.audioUrl ||
      `${track.title || ""}-${track.artist || ""}`,
  );
}

function hashString(value) {
  return [...String(value || "vibrafy")].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
}

function getFallbackCover(track) {
  if (!DEFAULT_COVER_POOL.length) {
    return "";
  }

  const index = hashString(getTrackKey(track) || track?.title || track?.artist) % DEFAULT_COVER_POOL.length;
  return DEFAULT_COVER_POOL[index];
}

function normalizeTrack(track) {
  if (!track) {
    return null;
  }

  return {
    ...track,
    id: getTrackKey(track),
    title: track.title || "Без названия",
    artist: track.artist || track.catalog_artist_name || "Неизвестный артист",
    audio_url: track.audio_url || track.audioUrl || "",
    cover: track.cover || track.catalog_artist_cover || getFallbackCover(track),
    duration: Number(track.duration || track.duration_seconds || 0),
    mood: Array.isArray(track.mood) ? track.mood : [],
  };
}

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function readStoredNumber(key, fallback = 0) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = Number(window.localStorage.getItem(key) || fallback);
  return Number.isFinite(raw) ? raw : fallback;
}

function uniqueTracks(tracks) {
  const map = new Map();

  for (const track of tracks) {
    const normalizedTrack = normalizeTrack(track);

    if (normalizedTrack) {
      map.set(getTrackKey(normalizedTrack), normalizedTrack);
    }
  }

  return [...map.values()];
}

function splitArtistNames(artist) {
  return String(artist || "")
    .split(/\s*(?:,|&|feat\.?|ft\.?| x |\/)\s*/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function upsertRecentTrack(tracks, nextTrack) {
  return uniqueTracks([nextTrack, ...tracks]).slice(0, MAX_RECENT_TRACKS);
}

function createPlaylistId() {
  return `playlist-${Date.now()}`;
}

function normalizePlaylists(playlists) {
  return (playlists || []).map((playlist) => {
    const rawTracks = playlist.tracks || [];
    const trackIds = rawTracks
      .map((track) => (typeof track === "string" ? track : getTrackKey(track)))
      .filter(Boolean);

    return {
      id: playlist.id || createPlaylistId(),
      title: playlist.title || playlist.name || "Новый плейлист",
      description: playlist.description || "",
      cover: playlist.cover || "",
      tracks: [...new Set(trackIds)],
      type: playlist.type || "my",
      isSaved: Boolean(playlist.isSaved),
    };
  });
}

function buildDefaultPlaylists() {
  const byIndex = (indexes) => indexes.map((index) => getTrackKey(DEFAULT_SHOWCASE_TRACKS[index])).filter(Boolean);

  return normalizePlaylists([
    {
      id: "mix-memories",
      title: "Memories",
      description: "Xcho & Macan",
      cover: MOCK_COVERS.hills,
      tracks: byIndex([0, 1, 2, 5, 10, 13]),
      type: "mix",
      isSaved: true,
    },
    {
      id: "mix-deep-vibe",
      title: "Глубокий вайб",
      description: "Атмосферно и спокойно",
      cover: MOCK_COVERS.swim,
      tracks: byIndex([1, 5, 7, 10, 13, 14]),
      type: "saved",
      isSaved: true,
    },
    {
      id: "mix-focus",
      title: "Расслабление и фокус",
      description: "Треки для ровного темпа",
      cover: MOCK_COVERS.forest,
      tracks: byIndex([4, 6, 9, 13, 14]),
      type: "saved",
      isSaved: true,
    },
    {
      id: "mix-road",
      title: "Путешествие",
      description: "Музыка для дороги",
      cover: MOCK_COVERS.road,
      tracks: byIndex([0, 2, 3, 8, 11, 12]),
      type: "mix",
      isSaved: true,
    },
  ]);
}

function getTrackPopularityScore(track) {
  const sectionBoost = {
    best: 32,
    best_month: 28,
    best_week: 26,
    top: 24,
    news: 18,
    manual: 8,
  };

  return (
    (sectionBoost[track?.source_section] || 12) +
    (track?.is_manual ? 2 : 0) +
    (track?.genre_name ? 1 : 0) +
    (track?.catalog_artist_name ? 1 : 0)
  );
}

function buildTasteProfile({ currentTrack, favorites, playlists, recentTracks, trackMap }) {
  const profile = new Map();

  const addWeight = (artistName, weight) => {
    const key = artistName.toLowerCase();
    profile.set(key, (profile.get(key) || 0) + weight);
  };

  favorites.forEach((track) => {
    splitArtistNames(track.artist).forEach((artistName) => addWeight(artistName, 5));
  });

  recentTracks.forEach((track, index) => {
    const weight = Math.max(1, 4 - Math.floor(index / 4));
    splitArtistNames(track.artist).forEach((artistName) => addWeight(artistName, weight));
  });

  playlists.forEach((playlist) => {
    playlist.tracks.forEach((trackId) => {
      const track = trackMap.get(trackId);
      if (track) {
        splitArtistNames(track.artist).forEach((artistName) => addWeight(artistName, 2));
      }
    });
  });

  if (currentTrack) {
    splitArtistNames(currentTrack.artist).forEach((artistName) => addWeight(artistName, 3));
  }

  return profile;
}

function getCatalogScore(track, tasteProfile, favoriteTrackKeys, recentTrackKeys) {
  const artistTasteScore = splitArtistNames(track.artist).reduce(
    (sum, artistName) => sum + (tasteProfile.get(artistName.toLowerCase()) || 0),
    0,
  );

  return (
    getTrackPopularityScore(track) +
    artistTasteScore +
    (favoriteTrackKeys.has(getTrackKey(track)) ? 8 : 0) +
    (recentTrackKeys.has(getTrackKey(track)) ? 4 : 0)
  );
}

function rankCatalogTracks(tracks, tasteProfile, favoriteTrackKeys, recentTrackKeys) {
  return [...tracks].sort((left, right) => {
    const diff =
      getCatalogScore(right, tasteProfile, favoriteTrackKeys, recentTrackKeys) -
      getCatalogScore(left, tasteProfile, favoriteTrackKeys, recentTrackKeys);

    if (diff !== 0) {
      return diff;
    }

    return String(left.title).localeCompare(String(right.title), "ru");
  });
}

function scoreField(value, normalizedQuery) {
  const normalizedValue = String(value || "").toLowerCase();

  if (!normalizedValue || !normalizedQuery) {
    return 0;
  }

  if (normalizedValue === normalizedQuery) {
    return 120;
  }

  if (normalizedValue.startsWith(normalizedQuery)) {
    return 92;
  }

  if (normalizedValue.includes(normalizedQuery)) {
    return 64;
  }

  return 0;
}

function getSearchScore(track, normalizedQuery, tasteProfile, favoriteTrackKeys, recentTrackKeys) {
  const titleScore = scoreField(track.title, normalizedQuery) * 2.4;
  const artistScore = scoreField(track.artist, normalizedQuery) * 2;
  const genreScore = scoreField(track.genre_name, normalizedQuery);
  const combinedScore = scoreField(`${track.title} ${track.artist}`, normalizedQuery);

  if (titleScore === 0 && artistScore === 0 && genreScore === 0 && combinedScore === 0) {
    return 0;
  }

  return (
    titleScore +
    artistScore +
    genreScore +
    combinedScore * 0.8 +
    getCatalogScore(track, tasteProfile, favoriteTrackKeys, recentTrackKeys) * 0.25
  );
}

function rankTracksBySearch(tracks, query, tasteProfile, favoriteTrackKeys, recentTrackKeys) {
  const normalizedQuery = String(query || "").trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return [...tracks]
    .map((track) => ({
      score: getSearchScore(track, normalizedQuery, tasteProfile, favoriteTrackKeys, recentTrackKeys),
      track,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.track);
}

async function loadCatalogTracksFromApi(limit, offset = 0) {
  const response = await apiRequest(`/catalog?limit=${limit}&offset=${offset}`);
  const items = uniqueTracks(response.items || []);
  const total = Number(response.total || items.length);

  return { items, total };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${rest}`;
}

function formatSleepRemaining(sleepEndsAt, now) {
  const remainingMs = Math.max(sleepEndsAt - now, 0);
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  if (remainingMinutes >= 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return minutes > 0 ? `${hours} ч ${minutes} м` : `${hours} ч`;
  }

  return `${remainingMinutes} м`;
}

function getInitialCatalogTracks() {
  const cachedTracks = uniqueTracks(readStoredJson(STORAGE_KEYS.tracks, []));

  if (!HAS_REMOTE_API && USE_DEV_FALLBACK) {
    return cachedTracks.length > 0 ? cachedTracks : DEFAULT_SHOWCASE_TRACKS;
  }

  return cachedTracks.length >= REMOTE_CATALOG_CACHE_MIN_TRACKS ? cachedTracks : [];
}

function createArtistResults(tracks, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const artistMap = new Map();

  if (!normalizedQuery) {
    return [];
  }

  tracks.forEach((track) => {
    splitArtistNames(track.artist).forEach((artistName) => {
      const key = artistName.toLowerCase();
      if (!key.includes(normalizedQuery)) {
        return;
      }

      const current = artistMap.get(key) || {
        id: key,
        name: artistName,
        cover: track.cover,
        tracks: [],
      };

      current.tracks = uniqueTracks([...current.tracks, track]);
      artistMap.set(key, current);
    });
  });

  return [...artistMap.values()].sort((left, right) => right.tracks.length - left.tracks.length);
}

function getPlaylistTrackObjects(playlist, trackMap) {
  return playlist.tracks.map((trackId) => trackMap.get(trackId)).filter(Boolean);
}

function getPlaylistCover(playlist, trackMap) {
  const firstTrack = getPlaylistTrackObjects(playlist, trackMap)[0];
  return playlist.cover || firstTrack?.cover || MOCK_COVERS.hills;
}

function getPlaylistTrackCount(playlist) {
  return playlist.tracks.length;
}

function Icon({ name }) {
  if (name === "search") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m15.5 15.5 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === "sliders") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <circle cx="16" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="8" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === "x") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "play") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6.5c0-.4.43-.65.78-.45l9.05 5.48a.53.53 0 0 1 0 .94l-9.05 5.48A.52.52 0 0 1 8 17.5v-11Z" fill="currentColor" />
      </svg>
    );
  }

  if (name === "heart") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.3 4.8 13.2a4.7 4.7 0 0 1 6.6-6.7l.6.6.6-.6a4.7 4.7 0 0 1 6.6 6.7L12 20.3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    );
  }

  if (name === "heart-filled") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.3 4.8 13.2a4.7 4.7 0 0 1 6.6-6.7l.6.6.6-.6a4.7 4.7 0 0 1 6.6 6.7L12 20.3Z" fill="currentColor" />
      </svg>
    );
  }

  if (name === "chevron") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "more") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" fill="currentColor" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        <circle cx="19" cy="12" r="1.8" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function BrandHeader({ title = "Telegram Music", right = null }) {
  return (
    <header className="tm-header">
      <div className="tm-brand">
        <span className="tm-brand__wave" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span>{title}</span>
      </div>
      {right ? <div className="tm-header__right">{right}</div> : null}
    </header>
  );
}

function HomeSearch({ value, onChange }) {
  const hasValue = value.trim().length > 0;

  return (
    <div className="tm-search" role="search">
      <Icon name="search" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Исполнитель, трек или плейлист"
        autoComplete="off"
      />
      <button
        className="tm-search__action"
        type="button"
        onClick={() => (hasValue ? onChange("") : undefined)}
        aria-label={hasValue ? "Очистить поиск" : "Фильтры"}
      >
        <Icon name={hasValue ? "x" : "sliders"} />
      </button>
    </div>
  );
}

function MoodIcon({ icon }) {
  return <span className={`mood-icon mood-icon--${icon}`} aria-hidden="true" />;
}

function MoodChips({ selectedMood, onSelect }) {
  return (
    <div className="tm-chip-row" aria-label="Настроение">
      {MOOD_CHIPS.map((chip) => {
        const isActive = selectedMood === chip.id;

        return (
          <button
            key={chip.id}
            type="button"
            className={`tm-mood-chip ${isActive ? "tm-mood-chip--active" : ""}`}
            onClick={() => onSelect(isActive ? "" : chip.id)}
          >
            <MoodIcon icon={chip.icon} />
            {chip.id}
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ title, meta, action, onAction }) {
  return (
    <div className="tm-section-header">
      <div>
        <h2>{title}</h2>
        {meta ? <p>{meta}</p> : null}
      </div>
      {action ? (
        <button type="button" onClick={onAction}>
          {action}
          <Icon name="chevron" />
        </button>
      ) : null}
    </div>
  );
}

function HeroMixCard({ track, isLiked, onPlay, onLike }) {
  return (
    <article className="tm-hero-card" style={{ "--hero-cover": `url("${track.cover}")` }}>
      <div className="tm-hero-card__shade" />
      <div className="tm-hero-card__content">
        <span className="tm-hero-card__badge">МИКС ДНЯ</span>
        <div>
          <h1>{track.title}</h1>
          <p>{track.artist}</p>
          <span>Лёгкий вайб для начала дня</span>
        </div>
        <div className="tm-hero-card__actions">
          <button className="tm-play-pill" type="button" onClick={onPlay}>
            <Icon name="play" />
            <span>
              Слушать микс
              <small>Обновлен сегодня</small>
            </span>
          </button>
          <button className={`tm-round-action ${isLiked ? "tm-round-action--active" : ""}`} type="button" onClick={onLike}>
            <Icon name={isLiked ? "heart-filled" : "heart"} />
          </button>
        </div>
      </div>
    </article>
  );
}

function RecommendationCard({ item, onPlay }) {
  return (
    <button className="tm-rec-card" type="button" onClick={onPlay}>
      <img src={item.cover} alt="" />
      <strong>{item.title}</strong>
      <span>{item.subtitle}</span>
    </button>
  );
}

function TasteCard({ item, onPlay }) {
  return (
    <button className="tm-taste-card" type="button" onClick={onPlay}>
      <img src={item.cover} alt="" />
      <span className="tm-taste-card__play">
        <Icon name="play" />
      </span>
      <strong>{item.title}</strong>
      <p>{item.subtitle}</p>
    </button>
  );
}

function TrackRow({
  track,
  index,
  isActive,
  isLiked,
  onPlay,
  onLike,
  onMore,
  progress,
  compact = false,
}) {
  return (
    <article className={`tm-track-row ${isActive ? "tm-track-row--active" : ""} ${compact ? "tm-track-row--compact" : ""}`}>
      <button className="tm-track-row__main" type="button" onClick={onPlay}>
        <img src={track.cover || getFallbackCover(track)} alt="" />
        <span>
          <strong>{track.title}</strong>
          <small>{track.artist}</small>
          {Number.isFinite(progress) ? (
            <span className="tm-track-row__progress" aria-hidden="true">
              <i style={{ width: `${Math.max(6, Math.min(progress, 100))}%` }} />
            </span>
          ) : null}
        </span>
      </button>
      <div className="tm-track-row__side">
        {isActive ? <span className="tm-equalizer" aria-hidden="true" /> : <small>{formatTime(track.duration)}</small>}
        {onLike ? (
          <button className={isLiked ? "is-active" : ""} type="button" onClick={() => onLike(track)} aria-label="Избранное">
            <Icon name={isLiked ? "heart-filled" : "heart"} />
          </button>
        ) : null}
        {onMore ? (
          <button type="button" onClick={() => onMore(track)} aria-label="Меню">
            <Icon name="more" />
          </button>
        ) : null}
        {!onLike && !onMore && !isActive ? <span className="tm-track-row__index">{String(index + 1).padStart(2, "0")}</span> : null}
      </div>
    </article>
  );
}

function PlaylistCard({ playlist, trackMap, onOpen, onMenu }) {
  const cover = getPlaylistCover(playlist, trackMap);
  const count = getPlaylistTrackCount(playlist);

  return (
    <article className="tm-playlist-card">
      <button type="button" className="tm-playlist-card__main" onClick={onOpen}>
        <img src={cover} alt="" />
        <span>
          <strong>{playlist.title}</strong>
          {playlist.description ? <small>{playlist.description}</small> : null}
          <em>{count} {count === 1 ? "трек" : "треков"}</em>
        </span>
      </button>
      <button className="tm-card-menu" type="button" onClick={onMenu} aria-label="Меню плейлиста">
        <Icon name="more" />
      </button>
    </article>
  );
}

function SearchResultsInline({
  query,
  filter,
  onFilterChange,
  tracks,
  artists,
  playlists,
  trackMap,
  currentTrack,
  favoriteTrackKeys,
  onPlayTracks,
  onPlayArtist,
  onOpenPlaylist,
  onToggleFavorite,
  isLoading,
}) {
  const showTracks = filter === "all" || filter === "tracks";
  const showArtists = filter === "all" || filter === "artists";
  const showPlaylists = filter === "all" || filter === "playlists";
  const bestTrack = tracks[0];
  const isEmpty = !isLoading && tracks.length === 0 && artists.length === 0 && playlists.length === 0;

  return (
    <section className="tm-search-mode">
      <div className="tm-filter-row">
        {SEARCH_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "is-active" : ""}
            onClick={() => onFilterChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? <div className="tm-empty-state">Ищу в каталоге...</div> : null}

      {isEmpty ? <div className="tm-empty-state">Ничего не найдено</div> : null}

      {filter === "all" && bestTrack ? (
        <div className="tm-best-match">
          <p>Лучшее совпадение</p>
          <TrackRow
            track={bestTrack}
            index={0}
            isActive={getTrackKey(bestTrack) === getTrackKey(currentTrack)}
            isLiked={favoriteTrackKeys.has(getTrackKey(bestTrack))}
            onPlay={() => onPlayTracks(0)}
            onLike={onToggleFavorite}
          />
        </div>
      ) : null}

      {showTracks && tracks.length > 0 ? (
        <div className="tm-result-group">
          <SectionHeader title="Треки" meta={`${tracks.length} по запросу “${query}”`} />
          <div className="tm-list">
            {tracks.map((track, index) => (
              <TrackRow
                key={getTrackKey(track)}
                track={track}
                index={index}
                isActive={getTrackKey(track) === getTrackKey(currentTrack)}
                isLiked={favoriteTrackKeys.has(getTrackKey(track))}
                onPlay={() => onPlayTracks(index)}
                onLike={onToggleFavorite}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showArtists && artists.length > 0 ? (
        <div className="tm-result-group">
          <SectionHeader title="Артисты" />
          <div className="tm-artist-grid">
            {artists.map((artist) => (
              <button key={artist.id} type="button" className="tm-artist-card" onClick={() => onPlayArtist(artist)}>
                <img src={artist.cover} alt="" />
                <strong>{artist.name}</strong>
                <span>{artist.tracks.length} треков</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showPlaylists && playlists.length > 0 ? (
        <div className="tm-result-group">
          <SectionHeader title="Плейлисты" />
          <div className="tm-list">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                trackMap={trackMap}
                onOpen={() => onOpenPlaylist(playlist.id)}
                onMenu={() => onOpenPlaylist(playlist.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ClientApp() {
  const telegram = useTelegram();
  const audioRef = useRef(null);
  const playbackIntentRef = useRef(false);
  const catalogLoadedRef = useRef(false);
  const searchRequestRef = useRef(0);

  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [activeSearchFilter, setActiveSearchFilter] = useState("all");
  const [selectedMood, setSelectedMood] = useState("");
  const [playlistFilter, setPlaylistFilter] = useState("all");
  const [openedPlaylistId, setOpenedPlaylistId] = useState("");
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAddTracksOpen, setIsAddTracksOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [tracks, setTracks] = useState(() => getInitialCatalogTracks());
  const [remoteSearchResults, setRemoteSearchResults] = useState([]);
  const [favorites, setFavorites] = useState(() => uniqueTracks(readStoredJson(STORAGE_KEYS.favorites, [])));
  const [recentTracks, setRecentTracks] = useState(() => uniqueTracks(readStoredJson(STORAGE_KEYS.recent, [])));
  const [playlists, setPlaylists] = useState(() => {
    const stored = normalizePlaylists(readStoredJson(STORAGE_KEYS.playlists, []));
    return stored.length > 0 ? stored : buildDefaultPlaylists();
  });
  const [queueSource, setQueueSource] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(() => getInitialCatalogTracks().length);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sleepEndsAt, setSleepEndsAt] = useState(() => {
    const storedValue = readStoredNumber(STORAGE_KEYS.sleepTimerEndsAt, 0);
    return storedValue > Date.now() ? storedValue : 0;
  });
  const [sleepNow, setSleepNow] = useState(Date.now());

  const currentTrack = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  const catalogTracks = useMemo(() => {
    if (tracks.length > 0) {
      return uniqueTracks(tracks);
    }

    return USE_DEV_FALLBACK ? DEFAULT_SHOWCASE_TRACKS : [];
  }, [tracks]);

  const allKnownTracks = useMemo(
    () => uniqueTracks([...catalogTracks, ...favorites, ...recentTracks, ...remoteSearchResults, currentTrack]),
    [catalogTracks, favorites, recentTracks, remoteSearchResults, currentTrack],
  );

  const trackMap = useMemo(() => {
    const map = new Map();
    allKnownTracks.forEach((track) => map.set(getTrackKey(track), track));
    return map;
  }, [allKnownTracks]);

  const favoriteTrackKeys = useMemo(() => new Set(favorites.map((track) => getTrackKey(track))), [favorites]);
  const recentTrackKeys = useMemo(() => new Set(recentTracks.map((track) => getTrackKey(track))), [recentTracks]);

  const tasteProfile = useMemo(
    () => buildTasteProfile({ currentTrack, favorites, playlists, recentTracks, trackMap }),
    [currentTrack, favorites, playlists, recentTracks, trackMap],
  );

  const rankedCatalogTracks = useMemo(
    () => rankCatalogTracks(catalogTracks, tasteProfile, favoriteTrackKeys, recentTrackKeys),
    [catalogTracks, tasteProfile, favoriteTrackKeys, recentTrackKeys],
  );

  const moodFilteredTracks = useMemo(() => {
    if (!selectedMood) {
      return rankedCatalogTracks;
    }

    return rankedCatalogTracks.filter((track) => track.mood?.includes(selectedMood));
  }, [rankedCatalogTracks, selectedMood]);

  const recommendationCards = useMemo(() => {
    const sources = [
      {
        id: "hits",
        title: "Сегодняшние хиты",
        subtitle: `${Math.min(50, rankedCatalogTracks.length || 50)} треков`,
        cover: MOCK_COVERS.portrait,
        tracks: rankedCatalogTracks.slice(0, 50),
      },
      {
        id: "deep",
        title: "Глубокий вайб",
        subtitle: "41 трек",
        cover: MOCK_COVERS.swim,
        tracks: rankedCatalogTracks.filter((track) => track.mood?.includes("Вайб")).slice(0, 41),
      },
      {
        id: "focus",
        title: "Расслабление и фокус",
        subtitle: "32 трека",
        cover: MOCK_COVERS.forest,
        tracks: rankedCatalogTracks.filter((track) => track.mood?.includes("Фокус") || track.mood?.includes("Релакс")).slice(0, 32),
      },
      {
        id: "road",
        title: "Путешествия и настроение",
        subtitle: "28 треков",
        cover: MOCK_COVERS.road,
        tracks: rankedCatalogTracks.slice(8, 36),
      },
    ];

    return sources.map((item) => ({
      ...item,
      tracks: item.tracks.length > 0 ? item.tracks : rankedCatalogTracks.slice(0, 12),
    }));
  }, [rankedCatalogTracks]);

  const tasteCards = useMemo(
    () =>
      recommendationCards.map((item, index) => ({
        ...item,
        title: ["Инди-фолк", "Глубокий вайб", "Поп-настроение", "Дорога"][index] || item.title,
        subtitle: ["Тёплый, как утро в горах", "Атмосферно и медитативно", "Лёгкие хиты для отличного дня", "Свободный плейлист"][index] || item.subtitle,
      })),
    [recommendationCards],
  );

  const searchTracks = useMemo(() => {
    const localResults = rankTracksBySearch(
      allKnownTracks,
      debouncedSearchQuery,
      tasteProfile,
      favoriteTrackKeys,
      recentTrackKeys,
    );

    return uniqueTracks([...localResults, ...remoteSearchResults]);
  }, [allKnownTracks, debouncedSearchQuery, tasteProfile, favoriteTrackKeys, recentTrackKeys, remoteSearchResults]);

  const searchArtists = useMemo(
    () => createArtistResults(allKnownTracks, debouncedSearchQuery),
    [allKnownTracks, debouncedSearchQuery],
  );

  const searchPlaylists = useMemo(() => {
    const normalizedQuery = debouncedSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return playlists.filter((playlist) =>
      `${playlist.title} ${playlist.description}`.toLowerCase().includes(normalizedQuery),
    );
  }, [playlists, debouncedSearchQuery]);

  const openedPlaylist = playlists.find((playlist) => playlist.id === openedPlaylistId) || null;
  const homeHeroTrack =
    allKnownTracks.find((track) => String(track.title).toLowerCase() === "memories") ||
    DEFAULT_SHOWCASE_TRACKS[0];
  const heroQueue = useMemo(
    () => uniqueTracks([homeHeroTrack, ...rankedCatalogTracks]),
    [homeHeroTrack, rankedCatalogTracks],
  );
  const isSearchMode = searchQuery.trim().length > 0;

  function haptic(style = "light") {
    try {
      telegram?.HapticFeedback?.impactOccurred?.(style);
    } catch {
      // Telegram haptics are optional outside Mini Apps.
    }
  }

  function buildPlaybackState(collection, currentTrackKey, shuffled = isShuffled) {
    const normalizedCollection = uniqueTracks(collection).filter((track) => track.audio_url);

    if (!normalizedCollection.length) {
      return { currentKey: "", nextIndex: -1, nextQueue: [], normalizedCollection };
    }

    const fallbackKey = getTrackKey(normalizedCollection[0]);
    const resolvedCurrentKey = normalizedCollection.some((track) => getTrackKey(track) === currentTrackKey)
      ? currentTrackKey
      : fallbackKey;
    const rest = normalizedCollection.filter((track) => getTrackKey(track) !== resolvedCurrentKey);

    if (shuffled) {
      for (let index = rest.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [rest[index], rest[randomIndex]] = [rest[randomIndex], rest[index]];
      }
    }

    const current = normalizedCollection.find((track) => getTrackKey(track) === resolvedCurrentKey);
    const nextQueue = current ? [current, ...rest] : normalizedCollection;
    const nextIndex = Math.max(
      nextQueue.findIndex((track) => getTrackKey(track) === resolvedCurrentKey),
      0,
    );

    return { currentKey: resolvedCurrentKey, nextIndex, nextQueue, normalizedCollection };
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!HAS_REMOTE_API) {
      writeStoredJson(STORAGE_KEYS.tracks, tracks);
      return;
    }

    if (tracks.length >= REMOTE_CATALOG_CACHE_MIN_TRACKS) {
      writeStoredJson(STORAGE_KEYS.tracks, tracks);
    }
  }, [tracks]);

  useEffect(() => writeStoredJson(STORAGE_KEYS.favorites, favorites), [favorites]);
  useEffect(() => writeStoredJson(STORAGE_KEYS.recent, recentTracks), [recentTracks]);
  useEffect(() => writeStoredJson(STORAGE_KEYS.playlists, playlists), [playlists]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sleepEndsAt > Date.now()) {
      window.localStorage.setItem(STORAGE_KEYS.sleepTimerEndsAt, String(sleepEndsAt));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.sleepTimerEndsAt);
  }, [sleepEndsAt]);

  useEffect(() => {
    if (!telegram) {
      return;
    }

    telegram.ready();
    telegram.expand();

    telegram.setHeaderColor?.("#070709");
    telegram.setBackgroundColor?.("#070709");
    telegram.disableVerticalSwipes?.();

    const theme = telegram.themeParams;
    if (theme.bg_color) {
      document.documentElement.style.setProperty("--tg-bg", theme.bg_color);
    }

    if (theme.text_color) {
      document.documentElement.style.setProperty("--tg-text", theme.text_color);
    }
  }, [telegram]);

  useEffect(() => {
    const user = telegram?.initDataUnsafe?.user;

    if (!HAS_REMOTE_API || !user?.id) {
      return;
    }

    apiRequest("/users/seen", {
      method: "POST",
      body: JSON.stringify({ user }),
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  }, [telegram]);

  useEffect(() => {
    if (!HAS_REMOTE_API || catalogLoadedRef.current) {
      return undefined;
    }

    catalogLoadedRef.current = true;
    let isCancelled = false;
    const hadCachedTracks = getInitialCatalogTracks().length > 0;

    async function loadCatalog() {
      setCatalogLoading(!hadCachedTracks);
      setError("");

      try {
        const initialCatalog = await loadCatalogTracksFromApi(INITIAL_CATALOG_PAGE_SIZE, 0);

        if (isCancelled) {
          return;
        }

        const initialItems = initialCatalog.items.slice(0, PUBLIC_CATALOG_MAX_TRACKS);
        setTracks(initialItems);
        setCatalogTotal(initialCatalog.total || initialItems.length);
        setCatalogLoading(false);

        let collectedTracks = initialItems;
        let offset = initialItems.length;
        const total = initialCatalog.total || initialItems.length;

        while (!isCancelled && offset < total && collectedTracks.length < PUBLIC_CATALOG_MAX_TRACKS) {
          const nextCatalog = await loadCatalogTracksFromApi(BACKGROUND_CATALOG_PAGE_SIZE, offset);

          if (!nextCatalog.items.length) {
            break;
          }

          collectedTracks = uniqueTracks([...collectedTracks, ...nextCatalog.items]).slice(0, PUBLIC_CATALOG_MAX_TRACKS);
          offset += nextCatalog.items.length;
          setTracks(collectedTracks);
        }
      } catch (requestError) {
        if (isCancelled) {
          return;
        }

        if (USE_DEV_FALLBACK) {
          setTracks(DEFAULT_SHOWCASE_TRACKS);
          setCatalogTotal(DEFAULT_SHOWCASE_TRACKS.length);
          setError("");
          return;
        }

        if (!hadCachedTracks) {
          setTracks([]);
          setCatalogTotal(0);
        }

        setError(
          requestError instanceof Error
            ? `Не удалось загрузить каталог: ${requestError.message}`
            : "Не удалось загрузить каталог.",
        );
      } finally {
        if (!isCancelled) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = debouncedSearchQuery.trim();

    if (!HAS_REMOTE_API || !query) {
      setRemoteSearchResults([]);
      setIsSearchLoading(false);
      return undefined;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    let isCancelled = false;

    async function runSearch() {
      setIsSearchLoading(true);

      try {
        const response = await apiRequest(`/search?q=${encodeURIComponent(query)}`);

        if (!isCancelled && searchRequestRef.current === requestId) {
          setRemoteSearchResults(uniqueTracks(response));
        }
      } catch {
        if (!isCancelled && searchRequestRef.current === requestId) {
          setRemoteSearchResults([]);
        }
      } finally {
        if (!isCancelled && searchRequestRef.current === requestId) {
          setIsSearchLoading(false);
        }
      }
    }

    void runSearch();

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearchQuery]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
        return;
      }

      if (currentIndex < queue.length - 1) {
        playbackIntentRef.current = true;
        setCurrentIndex((value) => value + 1);
        return;
      }

      if (repeatMode === "all" && queue.length > 0) {
        playbackIntentRef.current = true;
        setCurrentIndex(0);
        return;
      }

      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentIndex, queue.length, repeatMode]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    audio.src = currentTrack.audio_url;
    audio.load();
    setCurrentTime(0);
    setDuration(currentTrack.duration || 0);

    if (!playbackIntentRef.current) {
      setIsPlaying(false);
      return;
    }

    audio
      .play()
      .then(() => {
        setRecentTracks((value) => upsertRecentTrack(value, currentTrack));
        setIsPlaying(true);
        playbackIntentRef.current = false;
      })
      .catch(() => {
        setIsPlaying(false);
        playbackIntentRef.current = false;
      });
  }, [currentTrack]);

  useEffect(() => {
    if (!sleepEndsAt) {
      setSleepNow(Date.now());
      return undefined;
    }

    const timer = window.setInterval(() => {
      const now = Date.now();
      setSleepNow(now);

      if (now < sleepEndsAt) {
        return;
      }

      audioRef.current?.pause();
      setSleepEndsAt(0);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sleepEndsAt]);

  function rememberTrack(track) {
    if (track) {
      setRecentTracks((value) => upsertRecentTrack(value, track));
    }
  }

  function playTrackFromCollection(collection, index, options = {}) {
    if (!collection.length || index < 0 || index >= collection.length) {
      return;
    }

    const normalizedCollection = uniqueTracks(collection);
    const targetTrack = normalizedCollection[index];
    const { nextIndex, nextQueue, normalizedCollection: queueCollection } = buildPlaybackState(
      normalizedCollection,
      getTrackKey(targetTrack),
    );

    if (!nextQueue.length) {
      return;
    }

    playbackIntentRef.current = true;
    setQueueSource(queueCollection);
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
    rememberTrack(targetTrack);
    haptic("light");

    if (options.openPlayer) {
      setIsFullPlayerOpen(true);
    }
  }

  function playPlaylist(playlist) {
    const playlistTracks = getPlaylistTrackObjects(playlist, trackMap);
    playTrackFromCollection(playlistTracks, 0);
  }

  function playArtist(artist) {
    playTrackFromCollection(artist.tracks, 0);
  }

  function handleTogglePlay() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!currentTrack && rankedCatalogTracks.length > 0) {
      playTrackFromCollection(rankedCatalogTracks, 0);
      return;
    }

    haptic("light");

    if (audio.paused) {
      audio.play().then(() => rememberTrack(currentTrack)).catch(() => setIsPlaying(false));
      return;
    }

    audio.pause();
  }

  function handlePrev() {
    const audio = audioRef.current;
    haptic("light");

    if (audio && currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    playbackIntentRef.current = true;
    setCurrentIndex((value) => {
      if (value > 0) {
        return value - 1;
      }

      if (repeatMode === "all" && queue.length > 0) {
        return queue.length - 1;
      }

      return 0;
    });
  }

  function handleNext() {
    haptic("light");
    playbackIntentRef.current = true;
    setCurrentIndex((value) => {
      if (value < queue.length - 1) {
        return value + 1;
      }

      if (repeatMode === "all" && queue.length > 0) {
        return 0;
      }

      return Math.max(queue.length - 1, 0);
    });
  }

  function handleSeek(nextTime) {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function handleToggleShuffle() {
    const nextShuffled = !isShuffled;
    const currentKey = getTrackKey(currentTrack);
    const { nextIndex, nextQueue } = buildPlaybackState(queueSource.length ? queueSource : queue, currentKey, nextShuffled);

    setIsShuffled(nextShuffled);
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
    haptic("light");
  }

  function handleToggleRepeat() {
    setRepeatMode((value) => {
      if (value === "off") {
        return "all";
      }

      if (value === "all") {
        return "one";
      }

      return "off";
    });
    haptic("light");
  }

  function toggleFavorite(track) {
    if (!track) {
      return;
    }

    const trackKey = getTrackKey(track);

    setFavorites((value) =>
      value.some((item) => getTrackKey(item) === trackKey)
        ? value.filter((item) => getTrackKey(item) !== trackKey)
        : uniqueTracks([track, ...value]),
    );
    haptic("medium");
  }

  function handleCreatePlaylist(event) {
    event.preventDefault();
    const title = newPlaylistName.trim();

    if (!title) {
      return;
    }

    const playlist = {
      id: createPlaylistId(),
      title,
      description: "Личный плейлист",
      cover: "",
      tracks: [],
      type: "my",
      isSaved: false,
    };

    setPlaylists((value) => [playlist, ...value]);
    setOpenedPlaylistId(playlist.id);
    setNewPlaylistName("");
    setIsCreatePlaylistOpen(false);
    haptic("medium");
  }

  function removePlaylist(playlistId) {
    setPlaylists((value) => value.filter((playlist) => playlist.id !== playlistId));
    if (openedPlaylistId === playlistId) {
      setOpenedPlaylistId("");
    }
  }

  function addTrackToPlaylist(playlistId, track) {
    if (!track) {
      return;
    }

    setPlaylists((value) =>
      value.map((playlist) =>
        playlist.id !== playlistId
          ? playlist
          : {
              ...playlist,
              cover: playlist.cover || track.cover,
              tracks: [...new Set([getTrackKey(track), ...playlist.tracks])],
            },
      ),
    );
    haptic("light");
  }

  function removeTrackFromPlaylist(playlistId, trackKey) {
    setPlaylists((value) =>
      value.map((playlist) =>
        playlist.id !== playlistId
          ? playlist
          : {
              ...playlist,
              tracks: playlist.tracks.filter((item) => item !== trackKey),
            },
      ),
    );
  }

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    haptic("light");
  }

  function handleSleepTimerSelect(minutes) {
    setSleepEndsAt(Date.now() + minutes * 60 * 1000);
    haptic("light");
  }

  const renderHomePage = () => (
    <section className="tm-page tm-page--home">
      <BrandHeader />
      <HomeSearch value={searchQuery} onChange={setSearchQuery} />

      {isSearchMode ? (
        <SearchResultsInline
          query={debouncedSearchQuery || searchQuery}
          filter={activeSearchFilter}
          onFilterChange={setActiveSearchFilter}
          tracks={searchTracks}
          artists={searchArtists}
          playlists={searchPlaylists}
          trackMap={trackMap}
          currentTrack={currentTrack}
          favoriteTrackKeys={favoriteTrackKeys}
          onPlayTracks={(index) => playTrackFromCollection(searchTracks, index)}
          onPlayArtist={playArtist}
          onOpenPlaylist={(playlistId) => {
            setOpenedPlaylistId(playlistId);
            setActiveTab("playlists");
          }}
          onToggleFavorite={toggleFavorite}
          isLoading={isSearchLoading}
        />
      ) : (
        <>
          <MoodChips selectedMood={selectedMood} onSelect={setSelectedMood} />

          <HeroMixCard
            track={homeHeroTrack}
            isLiked={favoriteTrackKeys.has(getTrackKey(homeHeroTrack))}
            onPlay={() => playTrackFromCollection(heroQueue, 0)}
            onLike={() => toggleFavorite(homeHeroTrack)}
          />

          <section className="tm-section">
            <SectionHeader title="Для вас" action="Ещё" onAction={() => setActiveTab("for-you")} />
            <div className="tm-horizontal">
              {recommendationCards.map((item) => (
                <RecommendationCard key={item.id} item={item} onPlay={() => playTrackFromCollection(item.tracks, 0)} />
              ))}
            </div>
          </section>

          <section className="tm-section">
            <SectionHeader title="Недавно слушали" action={recentTracks.length ? "Очистить" : ""} onAction={() => setRecentTracks([])} />
            <div className="tm-recent-row">
              {(recentTracks.length ? recentTracks : rankedCatalogTracks.slice(0, 6)).map((track, index) => (
                <button key={getTrackKey(track)} type="button" className="tm-recent-card" onClick={() => playTrackFromCollection(recentTracks.length ? recentTracks : rankedCatalogTracks, index)}>
                  <img src={track.cover} alt="" />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                  <Icon name="play" />
                </button>
              ))}
            </div>
          </section>

          <section className="tm-section">
            <SectionHeader
              title="Каталог"
              meta={catalogLoading ? "Загружаю каталог..." : `${moodFilteredTracks.length || catalogTotal} треков`}
            />
            {error ? <div className="tm-inline-error">{error}</div> : null}
            <div className="tm-list">
              {moodFilteredTracks.map((track, index) => (
                <TrackRow
                  key={getTrackKey(track)}
                  track={track}
                  index={index}
                  isActive={getTrackKey(track) === getTrackKey(currentTrack)}
                  isLiked={favoriteTrackKeys.has(getTrackKey(track))}
                  onPlay={() => playTrackFromCollection(moodFilteredTracks, index)}
                  onLike={toggleFavorite}
                />
              ))}
              {!catalogLoading && moodFilteredTracks.length === 0 ? (
                <div className="tm-empty-state">Каталог пока пуст.</div>
              ) : null}
            </div>
          </section>
        </>
      )}
    </section>
  );

  const renderForYouPage = () => (
    <section className="tm-page">
      <BrandHeader />
      <div className="tm-title-row">
        <div>
          <h1>Для вас</h1>
          <p>На основе вашего вкуса</p>
        </div>
        <span className="tm-taste-badge">Мой вкус</span>
      </div>

      <section className="tm-section">
        <SectionHeader title="Мы обновили рекомендации" action="Ещё" />
        <div className="tm-taste-scroller">
          {tasteCards.map((item) => (
            <TasteCard key={item.id} item={item} onPlay={() => playTrackFromCollection(item.tracks, 0)} />
          ))}
        </div>
      </section>

      <section className="tm-section">
        <SectionHeader title="Продолжить слушать" action="Ещё" />
        <div className="tm-list tm-list--soft">
          {(recentTracks.length ? recentTracks : rankedCatalogTracks.slice(0, 3)).slice(0, 3).map((track, index) => (
            <TrackRow
              key={getTrackKey(track)}
              track={track}
              index={index}
              progress={[58, 78, 42][index] || 36}
              isActive={getTrackKey(track) === getTrackKey(currentTrack)}
              onPlay={() => playTrackFromCollection(recentTracks.length ? recentTracks : rankedCatalogTracks, index)}
              onMore={() => {}}
            />
          ))}
        </div>
      </section>

      <section className="tm-daily-mix">
        <img src={MOCK_COVERS.dusk} alt="" />
        <div>
          <h2>Микс дня</h2>
          <p>Собран специально для вас с учётом настроения и любимых жанров.</p>
        </div>
        <button type="button" onClick={() => playTrackFromCollection(rankedCatalogTracks, 0)}>
          Слушать
          <Icon name="play" />
        </button>
      </section>

      <section className="tm-section">
        <SectionHeader title="Вечернее настроение" meta="Идеально для расслабления" action="Ещё" />
        <div className="tm-horizontal tm-horizontal--wide">
          {[MOCK_COVERS.dusk, MOCK_COVERS.candles, MOCK_COVERS.road, MOCK_COVERS.hills].map((cover, index) => (
            <RecommendationCard
              key={cover}
              item={{
                title: ["Тихий вечер", "Свечи и джаз", "Город после дождя", "Горы"][index],
                subtitle: "Подборка",
                cover,
              }}
              onPlay={() => playTrackFromCollection(rankedCatalogTracks.slice(index), 0)}
            />
          ))}
        </div>
      </section>
    </section>
  );

  const renderPlaylistDetail = (playlist) => {
    const playlistTracks = getPlaylistTrackObjects(playlist, trackMap);

    return (
      <section className="tm-page">
        <BrandHeader
          title="Плейлист"
          right={
            <button className="tm-text-button" type="button" onClick={() => setOpenedPlaylistId("")}>
              Назад
            </button>
          }
        />

        <div className="tm-playlist-hero">
          <img src={getPlaylistCover(playlist, trackMap)} alt="" />
          <h1>{playlist.title}</h1>
          <p>{playlist.description || `${playlistTracks.length} треков`}</p>
          <div className="tm-playlist-hero__actions">
            <button type="button" onClick={() => playPlaylist(playlist)}>
              Перемешать
            </button>
            <button type="button" onClick={() => setIsAddTracksOpen((value) => !value)}>
              Добавить треки
            </button>
          </div>
        </div>

        {isAddTracksOpen ? (
          <div className="tm-add-panel">
            <strong>Добавить в плейлист</strong>
            <div className="tm-list">
              {rankedCatalogTracks.slice(0, 24).map((track, index) => (
                <TrackRow
                  key={getTrackKey(track)}
                  track={track}
                  index={index}
                  compact
                  onPlay={() => addTrackToPlaylist(playlist.id, track)}
                  onMore={() => addTrackToPlaylist(playlist.id, track)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {playlistTracks.length > 0 ? (
          <div className="tm-list">
            {playlistTracks.map((track, index) => (
              <TrackRow
                key={getTrackKey(track)}
                track={track}
                index={index}
                isActive={getTrackKey(track) === getTrackKey(currentTrack)}
                isLiked={favoriteTrackKeys.has(getTrackKey(track))}
                onPlay={() => playTrackFromCollection(playlistTracks, index)}
                onLike={toggleFavorite}
                onMore={() => removeTrackFromPlaylist(playlist.id, getTrackKey(track))}
              />
            ))}
          </div>
        ) : (
          <div className="tm-empty-playlist">
            <span>♪</span>
            <h2>Новый плейлист</h2>
            <p>Пока нет треков</p>
            <button type="button" onClick={() => setIsAddTracksOpen(true)}>
              Добавить треки
            </button>
          </div>
        )}
      </section>
    );
  };

  const renderPlaylistsPage = () => {
    if (openedPlaylist) {
      return renderPlaylistDetail(openedPlaylist);
    }

    const filteredPlaylists = playlists.filter((playlist) => {
      if (playlistFilter === "all") {
        return true;
      }

      if (playlistFilter === "liked") {
        return playlist.type === "liked";
      }

      if (playlistFilter === "saved") {
        return playlist.isSaved || playlist.type === "saved" || playlist.type === "mix";
      }

      return playlist.type === playlistFilter;
    });

    return (
      <section className="tm-page">
        <BrandHeader />
        <div className="tm-title-row tm-title-row--split">
          <h1>Плейлисты</h1>
          <button className="tm-create-button" type="button" onClick={() => setIsCreatePlaylistOpen((value) => !value)}>
            <Icon name="plus" />
            Создать
          </button>
        </div>

        {isCreatePlaylistOpen ? (
          <form className="tm-create-form" onSubmit={handleCreatePlaylist}>
            <input
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder="Название плейлиста"
              autoFocus
            />
            <button type="submit">Готово</button>
          </form>
        ) : null}

        <div className="tm-filter-row tm-filter-row--playlist">
          {PLAYLIST_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={playlistFilter === item.id ? "is-active" : ""}
              onClick={() => setPlaylistFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="tm-list">
          {filteredPlaylists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              trackMap={trackMap}
              onOpen={() => setOpenedPlaylistId(playlist.id)}
              onMenu={() => (playlist.type === "my" ? removePlaylist(playlist.id) : setOpenedPlaylistId(playlist.id))}
            />
          ))}
        </div>

        <div className="tm-quick-sections">
          <button type="button" onClick={() => setActiveTab("mine")}>
            <span>♥</span>
            <strong>Любимые треки</strong>
            <small>{favorites.length} треков</small>
          </button>
          <button type="button">
            <span>↓</span>
            <strong>Скачанное</strong>
            <small>0 треков</small>
          </button>
          <button type="button">
            <span>▰</span>
            <strong>Сохранённые миксы</strong>
            <small>{playlists.filter((playlist) => playlist.isSaved).length} миксов</small>
          </button>
        </div>

        <div className="tm-stats-row">
          <article>
            <strong>{catalogTracks.length}</strong>
            <span>Всего треков</span>
          </article>
          <article>
            <strong>0</strong>
            <span>Скачано</span>
          </article>
          <article>
            <strong>{playlists.length}</strong>
            <span>Плейлистов</span>
          </article>
        </div>
      </section>
    );
  };

  const renderMinePage = () => (
    <section className="tm-page">
      <BrandHeader />
      <div className="tm-title-row">
        <h1>Моё</h1>
        <p>Последние треки, избранное и личные подборки</p>
      </div>

      <section className="tm-section">
        <SectionHeader title="Недавно слушали" />
        <div className="tm-list">
          {(recentTracks.length ? recentTracks : rankedCatalogTracks.slice(0, 5)).map((track, index) => (
            <TrackRow
              key={getTrackKey(track)}
              track={track}
              index={index}
              isActive={getTrackKey(track) === getTrackKey(currentTrack)}
              isLiked={favoriteTrackKeys.has(getTrackKey(track))}
              onPlay={() => playTrackFromCollection(recentTracks.length ? recentTracks : rankedCatalogTracks, index)}
              onLike={toggleFavorite}
            />
          ))}
        </div>
      </section>

      <section className="tm-section">
        <SectionHeader title="Любимые треки" meta={`${favorites.length} треков`} />
        {favorites.length > 0 ? (
          <div className="tm-list">
            {favorites.map((track, index) => (
              <TrackRow
                key={getTrackKey(track)}
                track={track}
                index={index}
                isActive={getTrackKey(track) === getTrackKey(currentTrack)}
                isLiked
                onPlay={() => playTrackFromCollection(favorites, index)}
                onLike={toggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="tm-empty-state">Добавляйте треки в избранное из каталога или плеера.</div>
        )}
      </section>

      <section className="tm-section">
        <SectionHeader title="Таймер сна" meta={sleepEndsAt ? `Остановится через ${formatSleepRemaining(sleepEndsAt, sleepNow)}` : "Сейчас выключен"} />
        <div className="tm-sleep-grid">
          {[15, 30, 45, 60].map((minutes) => (
            <button key={minutes} type="button" onClick={() => handleSleepTimerSelect(minutes)}>
              {minutes} мин
            </button>
          ))}
          {sleepEndsAt ? (
            <button type="button" onClick={() => setSleepEndsAt(0)}>
              Выключить
            </button>
          ) : null}
        </div>
      </section>
    </section>
  );

  return (
    <main className="app-shell app-shell--client tm-app">
      <audio ref={audioRef} preload="none" />

      {activeTab === "home" ? renderHomePage() : null}
      {activeTab === "for-you" ? renderForYouPage() : null}
      {activeTab === "playlists" ? renderPlaylistsPage() : null}
      {activeTab === "mine" ? renderMinePage() : null}

      <Player
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration || currentTrack?.duration || 0}
        isExpanded={isFullPlayerOpen}
        isFavorite={favoriteTrackKeys.has(getTrackKey(currentTrack))}
        isShuffled={isShuffled}
        onClose={() => setIsFullPlayerOpen(false)}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onOpen={() => setIsFullPlayerOpen(true)}
        onSeek={handleSeek}
        onToggleFavorite={() => toggleFavorite(currentTrack)}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        queueLength={queue.length}
        queuePosition={currentIndex + 1}
        repeatMode={repeatMode}
      />

      <BottomNav activeTab={activeTab} onChange={handleTabChange} />
    </main>
  );
}
