import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "./components/BottomNav.jsx";
import { Player } from "./components/Player.jsx";
import { SearchBar } from "./components/SearchBar.jsx";
import { TrackList } from "./components/TrackList.jsx";
import { apiRequest } from "./lib/api.js";
import { useTelegram } from "./hooks/useTelegram.js";

const STORAGE_KEYS = {
  favorites: "vibrafy-favorites",
  playlists: "vibrafy-playlists",
  recent: "vibrafy-recent",
  sleepTimerEndsAt: "vibrafy-sleep-timer-ends-at",
  tracks: "vibrafy-tracks",
};

const MAX_RECENT_TRACKS = 20;
const INITIAL_CATALOG_PAGE_SIZE = 180;
const BACKGROUND_CATALOG_PAGE_SIZE = 1000;
const PUBLIC_CATALOG_MAX_TRACKS = 10000;
const REMOTE_CATALOG_CACHE_MIN_TRACKS = 500;
const SEARCH_DEBOUNCE_MS = 280;
const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60];
const HAS_REMOTE_API = Boolean(import.meta.env.VITE_API_BASE_URL);

const DEFAULT_SHOWCASE_TRACKS = [
  ["demo-1", "OnlyFans", "Isam Ft Koorosh", "vibrafy-onlyfans"],
  ["demo-2", "Redbull", "Arta Ft Koorosh & Smokepurpp", "vibrafy-redbull"],
  ["demo-3", "Nakhla", "Hidden & Khalse & Sijal", "vibrafy-nakhla"],
  ["demo-4", "Baadpooli", "Hiphopologist x Kagan", "vibrafy-baadpooli"],
  ["demo-5", "tttpttt", "Poori", "vibrafy-tttpttt"],
  ["demo-6", "First Class", "Koorosh 420VII", "vibrafy-first-class"],
  ["demo-7", "Faze Sekte", "CatchyBeats Ft 021KId", "vibrafy-faze-sekte"],
  ["demo-8", "Ma", "Koorosh Ft Sami Low", "vibrafy-ma"],
  ["demo-9", "Dobareh", "Gogoosh Ft Sogand & Leila Forohar", "vibrafy-dobareh"],
  ["demo-10", "Inja Irane", "021KID Ft Putak", "vibrafy-inja-irane"],
].map(([id, title, artist, seed], index) => ({
  id,
  title,
  artist,
  audio_url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${index + 1}.mp3`,
  cover: `https://picsum.photos/seed/${seed}/160/160`,
}));

const DEFAULT_COVER_POOL = DEFAULT_SHOWCASE_TRACKS.map((track) => track.cover);

function getTrackKey(track) {
  if (!track) {
    return "";
  }

  return String(
    track.id || track.source_track_id || track.audio_url || `${track.title}-${track.artist}`,
  );
}

function hashString(value) {
  return [...String(value || "vibrafy")].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
}

function getFallbackCover(track) {
  if (DEFAULT_COVER_POOL.length === 0) {
    return "";
  }

  const index =
    hashString(getTrackKey(track) || track?.title || track?.artist) % DEFAULT_COVER_POOL.length;

  return DEFAULT_COVER_POOL[index];
}

function normalizeTrack(track) {
  if (!track) {
    return null;
  }

  return {
    ...track,
    cover: track.cover || getFallbackCover(track),
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

function normalizePlaylists(playlists) {
  return (playlists || []).map((playlist) => ({
    ...playlist,
    tracks: uniqueTracks(playlist.tracks || []),
  }));
}

function upsertRecentTrack(tracks, nextTrack) {
  return uniqueTracks([nextTrack, ...tracks]).slice(0, MAX_RECENT_TRACKS);
}

function createPlaylistId() {
  return `playlist-${Date.now()}`;
}

function splitArtistNames(artist) {
  return String(artist || "")
    .split(/\s*(?:,|&|feat\.?|ft\.?|x|\/)\s*/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTrackPopularityScore(track) {
  const sectionBoost = {
    best: 30,
    best_month: 26,
    best_week: 24,
    top: 22,
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

function buildTasteProfile({ currentTrack, favorites, playlists, recentTracks }) {
  const profile = new Map();

  const addWeight = (artistName, weight) => {
    const key = artistName.toLowerCase();
    profile.set(key, (profile.get(key) || 0) + weight);
  };

  favorites.forEach((track) => {
    splitArtistNames(track.artist).forEach((artistName) => addWeight(artistName, 5));
  });

  recentTracks.forEach((track, index) => {
    const weight = Math.max(1, 4 - Math.floor(index / 3));
    splitArtistNames(track.artist).forEach((artistName) => addWeight(artistName, weight));
  });

  playlists.forEach((playlist) => {
    playlist.tracks.forEach((track) => {
      splitArtistNames(track.artist).forEach((artistName) => addWeight(artistName, 2));
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

function shuffleTracks(collection, currentTrackKey) {
  const currentTrack = collection.find((track) => getTrackKey(track) === currentTrackKey) || null;
  const rest = collection.filter((track) => getTrackKey(track) !== currentTrackKey);

  for (let index = rest.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [rest[index], rest[randomIndex]] = [rest[randomIndex], rest[index]];
  }

  return currentTrack ? [currentTrack, ...rest] : rest;
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
    return 90;
  }

  if (normalizedValue.includes(normalizedQuery)) {
    return 60;
  }

  return 0;
}

function getSearchScore(track, normalizedQuery, tasteProfile, favoriteTrackKeys, recentTrackKeys) {
  const titleScore = scoreField(track.title, normalizedQuery) * 2.3;
  const artistScore = scoreField(track.artist, normalizedQuery) * 1.9;
  const catalogArtistScore = scoreField(track.catalog_artist_name, normalizedQuery) * 1.5;
  const genreScore = scoreField(track.genre_name, normalizedQuery);
  const combinedScore = scoreField(`${track.title} ${track.artist}`, normalizedQuery) * 0.8;

  if (
    titleScore === 0 &&
    artistScore === 0 &&
    catalogArtistScore === 0 &&
    genreScore === 0 &&
    combinedScore === 0
  ) {
    return 0;
  }

  return (
    titleScore +
    artistScore +
    catalogArtistScore +
    genreScore +
    combinedScore +
    getCatalogScore(track, tasteProfile, favoriteTrackKeys, recentTrackKeys) * 0.35
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

  return {
    items,
    total,
  };
}

function formatSleepRemaining(sleepEndsAt, now) {
  const remainingMs = Math.max(sleepEndsAt - now, 0);
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  if (remainingMinutes >= 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return minutes > 0 ? `${hours}ч ${minutes}м` : `${hours}ч`;
  }

  return `${remainingMinutes}м`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="5.4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="m15.2 15.2 3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.8" fill="currentColor" />
    </svg>
  );
}

function ScreenButton({ children, label, onClick }) {
  return (
    <button className="screen-icon-button" type="button" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

function ScreenSection({ action, children, title }) {
  return (
    <section className="collection-section">
      <div className="collection-section__header">
        <h2>{title}</h2>
        {action || null}
      </div>
      {children}
    </section>
  );
}

function getInitialCatalogTracks() {
  const cachedTracks = uniqueTracks(readStoredJson(STORAGE_KEYS.tracks, []));

  if (!HAS_REMOTE_API) {
    return cachedTracks;
  }

  return cachedTracks.length >= REMOTE_CATALOG_CACHE_MIN_TRACKS ? cachedTracks : [];
}

export function ClientApp() {
  const telegram = useTelegram();
  const audioRef = useRef(null);
  const playbackIntentRef = useRef(false);
  const catalogLoadedRef = useRef(false);
  const searchRequestRef = useRef(0);

  const [activeTab, setActiveTab] = useState("home");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState(() => getInitialCatalogTracks());
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState(() =>
    uniqueTracks(readStoredJson(STORAGE_KEYS.favorites, [])),
  );
  const [recentTracks, setRecentTracks] = useState(() =>
    uniqueTracks(readStoredJson(STORAGE_KEYS.recent, [])),
  );
  const [playlists, setPlaylists] = useState(() =>
    normalizePlaylists(readStoredJson(STORAGE_KEYS.playlists, [])),
  );
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
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [selectedTrackKey, setSelectedTrackKey] = useState("");
  const [sleepEndsAt, setSleepEndsAt] = useState(() => {
    const storedValue = readStoredNumber(STORAGE_KEYS.sleepTimerEndsAt, 0);
    return storedValue > Date.now() ? storedValue : 0;
  });
  const [sleepNow, setSleepNow] = useState(Date.now());

  const currentTrack =
    currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  const catalogTracks = useMemo(() => {
    if (tracks.length > 0) {
      return tracks;
    }

    return HAS_REMOTE_API ? [] : DEFAULT_SHOWCASE_TRACKS;
  }, [tracks]);

  const localSearchBase = useMemo(
    () =>
      uniqueTracks([
        ...catalogTracks,
        ...favorites,
        ...recentTracks,
        ...playlists.flatMap((playlist) => playlist.tracks),
        currentTrack,
      ]),
    [catalogTracks, favorites, recentTracks, playlists, currentTrack],
  );

  const favoriteTrackKeys = useMemo(
    () => new Set(favorites.map((track) => getTrackKey(track))),
    [favorites],
  );
  const recentTrackKeys = useMemo(
    () => new Set(recentTracks.map((track) => getTrackKey(track))),
    [recentTracks],
  );
  const tasteProfile = useMemo(
    () => buildTasteProfile({ currentTrack, favorites, playlists, recentTracks }),
    [currentTrack, favorites, playlists, recentTracks],
  );
  const rankedCatalogTracks = useMemo(
    () => rankCatalogTracks(catalogTracks, tasteProfile, favoriteTrackKeys, recentTrackKeys),
    [catalogTracks, tasteProfile, favoriteTrackKeys, recentTrackKeys],
  );
  const allKnownTracks = useMemo(
    () => uniqueTracks([...localSearchBase, ...searchResults]),
    [localSearchBase, searchResults],
  );
  const homeTracks = useMemo(
    () => (query.trim() ? searchResults : rankedCatalogTracks),
    [query, searchResults, rankedCatalogTracks],
  );

  function buildPlaybackState(collection, currentTrackKey, shuffled = isShuffled) {
    const normalizedCollection = uniqueTracks(collection);

    if (normalizedCollection.length === 0) {
      return { currentKey: "", nextIndex: -1, nextQueue: [], normalizedCollection };
    }

    const fallbackKey = getTrackKey(normalizedCollection[0]);
    const resolvedCurrentKey =
      normalizedCollection.some((track) => getTrackKey(track) === currentTrackKey)
        ? currentTrackKey
        : fallbackKey;
    const nextQueue = shuffled
      ? shuffleTracks(normalizedCollection, resolvedCurrentKey)
      : normalizedCollection;
    const nextIndex = Math.max(
      nextQueue.findIndex((track) => getTrackKey(track) === resolvedCurrentKey),
      0,
    );

    return {
      currentKey: resolvedCurrentKey,
      nextIndex,
      nextQueue,
      normalizedCollection,
    };
  }

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
    if (!selectedPlaylistId && playlists.length > 0) {
      setSelectedPlaylistId(playlists[0].id);
    }

    if (playlists.every((playlist) => playlist.id !== selectedPlaylistId)) {
      setSelectedPlaylistId(playlists[0]?.id || "");
    }
  }, [playlists, selectedPlaylistId]);

  useEffect(() => {
    if (!selectedTrackKey && allKnownTracks.length > 0) {
      setSelectedTrackKey(getTrackKey(allKnownTracks[0]));
    }

    if (allKnownTracks.every((track) => getTrackKey(track) !== selectedTrackKey)) {
      setSelectedTrackKey(allKnownTracks[0] ? getTrackKey(allKnownTracks[0]) : "");
    }
  }, [allKnownTracks, selectedTrackKey]);

  useEffect(() => {
    if (!telegram) {
      return;
    }

    telegram.ready();
    telegram.expand();

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
    if (!HAS_REMOTE_API || catalogLoading || catalogLoadedRef.current) {
      return undefined;
    }

    let isCancelled = false;

    async function loadCatalog() {
      catalogLoadedRef.current = true;
      setCatalogLoading(tracks.length === 0);
      setError("");

      try {
        const initialCatalog = await loadCatalogTracksFromApi(INITIAL_CATALOG_PAGE_SIZE, 0);

        if (!isCancelled) {
          const initialItems = initialCatalog.items.slice(0, PUBLIC_CATALOG_MAX_TRACKS);
          setTracks(initialItems);
          setCatalogTotal(initialCatalog.total || initialItems.length);
          setCatalogLoading(false);

          let collectedTracks = initialItems;
          let offset = initialItems.length;
          const total = initialCatalog.total || initialItems.length;

          while (!isCancelled && offset < total && collectedTracks.length < PUBLIC_CATALOG_MAX_TRACKS) {
            const nextCatalog = await loadCatalogTracksFromApi(BACKGROUND_CATALOG_PAGE_SIZE, offset);

            if (nextCatalog.items.length === 0) {
              break;
            }

            collectedTracks = uniqueTracks([...collectedTracks, ...nextCatalog.items]).slice(
              0,
              PUBLIC_CATALOG_MAX_TRACKS,
            );
            offset += nextCatalog.items.length;
            setTracks(collectedTracks);
          }
        }
      } catch (requestError) {
        if (!isCancelled) {
          if (tracks.length === 0) {
            setTracks([]);
            setCatalogTotal(0);
          }
          setError(
            requestError instanceof Error
              ? `Не удалось загрузить каталог: ${requestError.message}`
              : "Не удалось загрузить каталог.",
          );
        }
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
  }, [catalogLoading, tracks.length]);

  useEffect(() => {
    if (currentTrack || rankedCatalogTracks.length === 0) {
      return;
    }

    const { nextIndex, nextQueue, normalizedCollection } = buildPlaybackState(
      rankedCatalogTracks,
      getTrackKey(rankedCatalogTracks[0]),
    );

    setQueueSource(normalizedCollection);
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
  }, [currentTrack, rankedCatalogTracks]);

  useEffect(() => {
    if (queueSource.length === 0) {
      return;
    }

    const { nextIndex, nextQueue } = buildPlaybackState(queueSource, getTrackKey(currentTrack));
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
  }, [isShuffled]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setSearchResults([]);
      setIsSearchLoading(false);
      setError("");
      return undefined;
    }

    const localMatches = rankTracksBySearch(
      localSearchBase,
      normalizedQuery,
      tasteProfile,
      favoriteTrackKeys,
      recentTrackKeys,
    );

    setSearchResults(localMatches);
    setError("");

    if (!HAS_REMOTE_API || normalizedQuery.length < 2) {
      setIsSearchLoading(false);
      return undefined;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setIsSearchLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const remoteTracks = uniqueTracks(
          await apiRequest(`/search?q=${encodeURIComponent(normalizedQuery)}`),
        );

        if (requestId !== searchRequestRef.current) {
          return;
        }

        setSearchResults(
          rankTracksBySearch(
            uniqueTracks([...remoteTracks, ...localMatches]),
            normalizedQuery,
            tasteProfile,
            favoriteTrackKeys,
            recentTrackKeys,
          ),
        );
      } catch (requestError) {
        if (requestId !== searchRequestRef.current || localMatches.length > 0) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Не удалось выполнить поиск.",
        );
      } finally {
        if (requestId === searchRequestRef.current) {
          setIsSearchLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, localSearchBase, tasteProfile, favoriteTrackKeys, recentTrackKeys]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {
          setIsPlaying(false);
        });
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

      const audio = audioRef.current;
      audio?.pause();
      setSleepEndsAt(0);
      setMenuOpen(false);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sleepEndsAt]);

  function rememberTrack(track) {
    if (!track) {
      return;
    }

    setRecentTracks((value) => upsertRecentTrack(value, track));
  }

  function playTrackFromCollection(collection, index) {
    if (!collection.length || index < 0 || index >= collection.length) {
      return;
    }

    const normalizedCollection = uniqueTracks(collection);
    const targetTrack = normalizedCollection[index];
    const { nextIndex, nextQueue } = buildPlaybackState(
      normalizedCollection,
      getTrackKey(targetTrack),
    );

    playbackIntentRef.current = true;
    setQueueSource(normalizedCollection);
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
    setSearchOpen(false);
    setMenuOpen(false);
    setIsFullPlayerOpen(true);
    rememberTrack(targetTrack);
  }

  function handleTogglePlay() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!currentTrack && homeTracks.length > 0) {
      playTrackFromCollection(homeTracks, 0);
      return;
    }

    if (audio.paused) {
      audio.play();
      rememberTrack(currentTrack);
      return;
    }

    audio.pause();
  }

  function handlePrev() {
    const audio = audioRef.current;

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
    setIsShuffled((value) => !value);
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
  }

  function toggleFavorite(track) {
    const trackKey = getTrackKey(track);

    setFavorites((value) =>
      value.some((item) => getTrackKey(item) === trackKey)
        ? value.filter((item) => getTrackKey(item) !== trackKey)
        : uniqueTracks([track, ...value]),
    );
  }

  function handleCreatePlaylist(event) {
    event.preventDefault();
    const name = newPlaylistName.trim();

    if (!name) {
      return;
    }

    setPlaylists((value) => [{ id: createPlaylistId(), name, tracks: [] }, ...value]);
    setNewPlaylistName("");
  }

  function addTrackToPlaylist(playlistId, track) {
    setPlaylists((value) =>
      value.map((playlist) =>
        playlist.id !== playlistId
          ? playlist
          : { ...playlist, tracks: uniqueTracks([track, ...playlist.tracks]) },
      ),
    );
  }

  function removeTrackFromPlaylist(playlistId, trackKey) {
    setPlaylists((value) =>
      value.map((playlist) =>
        playlist.id !== playlistId
          ? playlist
          : {
              ...playlist,
              tracks: playlist.tracks.filter((track) => getTrackKey(track) !== trackKey),
            },
      ),
    );
  }

  function removePlaylist(playlistId) {
    setPlaylists((value) => value.filter((playlist) => playlist.id !== playlistId));
  }

  function handleQuickAddTrack(event) {
    event.preventDefault();

    const track = allKnownTracks.find((item) => getTrackKey(item) === selectedTrackKey);

    if (track && selectedPlaylistId) {
      addTrackToPlaylist(selectedPlaylistId, track);
    }
  }

  function handleSleepTimerSelect(minutes) {
    setSleepEndsAt(Date.now() + minutes * 60 * 1000);
    setMenuOpen(false);
  }

  function clearSleepTimer() {
    setSleepEndsAt(0);
    setMenuOpen(false);
  }

  function handleSearchToggle() {
    setSearchOpen((value) => !value);
    setMenuOpen(false);
  }

  const renderHomeTab = () => (
    <section className="player-screen">
      <header className="player-screen__header">
        <div className="player-screen__leading">
          <div className="player-screen__title-group">
            <h1>Музыка</h1>
          </div>
        </div>

        <div className="player-screen__actions">
          <ScreenButton label="Поиск" onClick={handleSearchToggle}>
            <SearchIcon />
          </ScreenButton>

          <div className="screen-menu">
            <ScreenButton
              label="Меню"
              onClick={() => {
                setMenuOpen((value) => !value);
                setSearchOpen(false);
              }}
            >
              <MoreIcon />
            </ScreenButton>

            {menuOpen ? (
              <div className="screen-menu__panel">
                <div className="screen-menu__section">
                  <strong>Таймер сна</strong>
                  <span>
                    {sleepEndsAt
                      ? `Выключится через ${formatSleepRemaining(sleepEndsAt, sleepNow)}`
                      : "Сейчас выключен"}
                  </span>
                </div>

                <div className="screen-menu__options">
                  {SLEEP_TIMER_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className="screen-menu__option"
                      onClick={() => handleSleepTimerSelect(minutes)}
                    >
                      {minutes} мин
                    </button>
                  ))}
                </div>

                <button
                  className="screen-menu__clear"
                  type="button"
                  onClick={clearSleepTimer}
                >
                  Выключить таймер
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {searchOpen ? (
        <SearchBar
          value={query}
          onChange={(value) => {
            setQuery(value);
            setActiveTab("home");
          }}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

      <div className="catalog-toolbar">
        <div className="catalog-toolbar__copy">
          <strong>Главная</strong>
        </div>

        {query.trim() ? (
          <button
            className="catalog-toolbar__reset"
            type="button"
            onClick={() => {
              setQuery("");
              setSearchResults([]);
            }}
          >
            Сбросить
          </button>
        ) : null}
      </div>

      {error ? <div className="inline-error">{error}</div> : null}

      <div className="player-screen__content">
        <TrackList
          tracks={homeTracks}
          activeTrackId={getTrackKey(currentTrack)}
          onPlay={(index) => playTrackFromCollection(homeTracks, index)}
          favoriteTrackKeys={favoriteTrackKeys}
          onToggleFavorite={toggleFavorite}
          showFavoriteAction
          emptyMessage={
            catalogLoading
              ? "Загружаю каталог..."
              : query.trim()
                ? "По этому запросу ничего не найдено."
                : "Каталог пока пуст."
          }
        />
      </div>
    </section>
  );

  const renderMineTab = () => (
    <section className="stack-screen">
      <header className="stack-screen__header">
        <button type="button" onClick={() => setActiveTab("home")}>
          Назад
        </button>
        <h1>Мое</h1>
        <button type="button" onClick={() => setActiveTab("playlists")}>
          Плейлисты
        </button>
      </header>

      <div className="stack-screen__body">
        <ScreenSection title="Недавно слушал">
          <TrackList
            tracks={recentTracks}
            activeTrackId={getTrackKey(currentTrack)}
            onPlay={(index) => playTrackFromCollection(recentTracks, index)}
            onToggleFavorite={toggleFavorite}
            favoriteTrackKeys={favoriteTrackKeys}
            showFavoriteAction
            emptyMessage="История прослушивания пока пуста."
          />
        </ScreenSection>

        <ScreenSection title="Избранные треки">
          <TrackList
            tracks={favorites}
            activeTrackId={getTrackKey(currentTrack)}
            onPlay={(index) => playTrackFromCollection(favorites, index)}
            onToggleFavorite={toggleFavorite}
            favoriteTrackKeys={favoriteTrackKeys}
            showFavoriteAction
            emptyMessage="Добавляй треки в избранное прямо из каталога."
          />
        </ScreenSection>

        <ScreenSection
          title="Плейлисты"
          action={
            <button type="button" onClick={() => setActiveTab("playlists")}>
              Открыть
            </button>
          }
        >
          {playlists.length > 0 ? (
            <div className="playlist-stack">
              {playlists.map((playlist) => (
                <article key={playlist.id} className="playlist-card">
                  <div className="playlist-card__header">
                    <div>
                      <h2>{playlist.name}</h2>
                      <p>{playlist.tracks.length} треков</p>
                    </div>
                    <button type="button" onClick={() => setActiveTab("playlists")}>
                      Смотреть
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state--flat">
              <p>Плейлистов пока нет.</p>
            </div>
          )}
        </ScreenSection>
      </div>
    </section>
  );

  const renderPlaylistsTab = () => (
    <section className="stack-screen">
      <header className="stack-screen__header">
        <button type="button" onClick={() => setActiveTab("home")}>
          Назад
        </button>
        <h1>Плейлисты</h1>
        <span>{playlists.length}</span>
      </header>

      <div className="stack-screen__body">
        <form className="playlist-builder" onSubmit={handleCreatePlaylist}>
          <input
            className="search-inline__input"
            type="text"
            value={newPlaylistName}
            onChange={(event) => setNewPlaylistName(event.target.value)}
            placeholder="Название нового плейлиста"
          />
          <button className="search-inline__submit" type="submit">
            Создать
          </button>
        </form>

        {playlists.length > 0 ? (
          <form className="playlist-builder playlist-builder--secondary" onSubmit={handleQuickAddTrack}>
            <select
              className="search-inline__input"
              value={selectedPlaylistId}
              onChange={(event) => setSelectedPlaylistId(event.target.value)}
            >
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </select>

            <select
              className="search-inline__input"
              value={selectedTrackKey}
              onChange={(event) => setSelectedTrackKey(event.target.value)}
            >
              {allKnownTracks.map((track) => (
                <option key={getTrackKey(track)} value={getTrackKey(track)}>
                  {track.title} - {track.artist}
                </option>
              ))}
            </select>

            <button className="search-inline__submit" type="submit">
              Добавить
            </button>
          </form>
        ) : null}

        <div className="playlist-stack">
          {playlists.length > 0 ? (
            playlists.map((playlist) => (
              <article key={playlist.id} className="playlist-card">
                <div className="playlist-card__header">
                  <div>
                    <h2>{playlist.name}</h2>
                    <p>{playlist.tracks.length} треков</p>
                  </div>

                  <div className="playlist-card__actions">
                    {currentTrack ? (
                      <button type="button" onClick={() => addTrackToPlaylist(playlist.id, currentTrack)}>
                        Текущий
                      </button>
                    ) : null}
                    <button type="button" onClick={() => removePlaylist(playlist.id)}>
                      Удалить
                    </button>
                  </div>
                </div>

                {playlist.tracks.length > 0 ? (
                  <div className="playlist-card__tracks">
                    {playlist.tracks.map((track, index) => (
                      <div key={getTrackKey(track)} className="playlist-track">
                        <button
                          className="playlist-track__main"
                          type="button"
                          onClick={() => playTrackFromCollection(playlist.tracks, index)}
                        >
                          <div className="library-row__cover" aria-hidden="true">
                            {track.cover ? <img src={track.cover} alt="" /> : <span>♪</span>}
                          </div>

                          <div className="library-row__copy">
                            <h3>{track.title}</h3>
                            <p>{track.artist}</p>
                          </div>
                        </button>

                        <div className="playlist-track__actions">
                          <button type="button" onClick={() => toggleFavorite(track)}>
                            {favoriteTrackKeys.has(getTrackKey(track)) ? "♥" : "♡"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTrackFromPlaylist(playlist.id, getTrackKey(track))}
                          >
                            Убрать
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state empty-state--flat">
                    <p>Плейлист пуст. Добавь в него первый трек.</p>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="empty-state empty-state--flat">
              <p>Создай первый плейлист, чтобы собирать музыку для себя.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <main className="app-shell app-shell--client redesign-shell">
      <audio ref={audioRef} preload="none" />

      {activeTab === "home" && renderHomeTab()}
      {activeTab === "mine" && renderMineTab()}
      {activeTab === "playlists" && renderPlaylistsTab()}

      <Player
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
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

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}
