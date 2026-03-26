import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "./components/BottomNav.jsx";
import { Player } from "./components/Player.jsx";
import { SearchBar } from "./components/SearchBar.jsx";
import { TrackList } from "./components/TrackList.jsx";
import { apiRequest } from "./lib/api.js";
import { useTelegram } from "./hooks/useTelegram.js";

const STORAGE_KEYS = {
  discovery: "vibrafy-discovery",
  favorites: "vibrafy-favorites",
  playlists: "vibrafy-playlists",
  query: "vibrafy-query",
  recent: "vibrafy-recent",
  tracks: "vibrafy-tracks",
};

const MAX_RECENT_TRACKS = 20;
const DISCOVERY_QUERIES = ["MiyaGi", "Bakr", "Бек Борбиев"];
const DEFAULT_PLAYER_TRACK_INDEX = 2;
const HAS_REMOTE_API = Boolean(import.meta.env.VITE_API_BASE_URL);
const HOME_MODES = [
  { id: "songs", label: "Песни" },
  { id: "artists", label: "Исполнители" },
  { id: "playlist", label: "Плейлисты" },
  { id: "albums", label: "Альбомы" },
  { id: "folder", label: "Папки" },
];

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

function getTrackKey(track) {
  if (!track) return "";
  return String(track.id || track.source_track_id || track.audio_url || `${track.title}-${track.artist}`);
}

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

function readStoredText(key, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}

function writeStoredText(key, value) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, value);
}

function uniqueTracks(tracks) {
  const map = new Map();
  for (const track of tracks) {
    if (track) map.set(getTrackKey(track), track);
  }
  return [...map.values()];
}

function upsertRecentTrack(tracks, nextTrack) {
  return uniqueTracks([nextTrack, ...tracks]).slice(0, MAX_RECENT_TRACKS);
}

function createPlaylistId() {
  return `playlist-${Date.now()}`;
}

function splitArtistNames(artist) {
  return artist.split(/\s*(?:,|&|feat\.?|ft\.?|x|\/)\s*/i).map((item) => item.trim()).filter(Boolean);
}

function buildTasteProfile({ recentTracks, favorites, playlists, currentTrack }) {
  const profile = new Map();
  const addWeight = (artistName, weight) => {
    const key = artistName.toLowerCase();
    profile.set(key, (profile.get(key) || 0) + weight);
  };

  favorites.forEach((track) => splitArtistNames(track.artist).forEach((name) => addWeight(name, 5)));
  recentTracks.forEach((track, index) => {
    const weight = Math.max(1, 4 - Math.floor(index / 3));
    splitArtistNames(track.artist).forEach((name) => addWeight(name, weight));
  });
  playlists.forEach((playlist) => {
    playlist.tracks.forEach((track) => splitArtistNames(track.artist).forEach((name) => addWeight(name, 2)));
  });
  if (currentTrack) splitArtistNames(currentTrack.artist).forEach((name) => addWeight(name, 3));

  return profile;
}

function buildArtistCards(tracks, tasteProfile) {
  const artists = new Map();

  tracks.forEach((track) => {
    splitArtistNames(track.artist).forEach((artistName) => {
      const key = artistName.toLowerCase();
      const current = artists.get(key) || { id: key, name: artistName, score: 0, cover: track.cover || null, tracks: [] };
      current.score += 1 + (tasteProfile.get(key) || 0);
      current.cover = current.cover || track.cover || null;
      current.tracks = uniqueTracks([track, ...current.tracks]).slice(0, 8);
      artists.set(key, current);
    });
  });

  return [...artists.values()].sort((left, right) => right.score - left.score);
}

function buildTrackRanking(tracks, tasteProfile, favoriteTrackKeys, recentTrackKeys) {
  const scoreTrack = (track) => {
    const artistScore = splitArtistNames(track.artist).reduce(
      (sum, artistName) => sum + (tasteProfile.get(artistName.toLowerCase()) || 0),
      0,
    );
    return artistScore + (favoriteTrackKeys.has(getTrackKey(track)) ? 8 : 0) + (recentTrackKeys.has(getTrackKey(track)) ? 4 : 0);
  };

  return [...tracks].sort((left, right) => scoreTrack(right) - scoreTrack(left));
}

function buildMixCards(playlists, rankedTracks) {
  const playlistCards = playlists.slice(0, 6).map((playlist) => ({
    id: playlist.id,
    title: playlist.name,
    subtitle: playlist.tracks.slice(0, 3).map((track) => track.artist).join(", ") || "Пустой плейлист",
    cover: playlist.tracks[0]?.cover || null,
    tracks: playlist.tracks,
  }));

  if (playlistCards.length > 0) return playlistCards;

  return rankedTracks.slice(0, 6).map((track) => ({
    id: `mix-${getTrackKey(track)}`,
    title: `Микс: ${track.title}`,
    subtitle: track.artist,
    cover: track.cover || null,
    tracks: rankedTracks.filter((item) =>
      splitArtistNames(item.artist).some((artistName) =>
        splitArtistNames(track.artist).includes(artistName),
      ),
    ),
  }));
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14v1.8H5zM5 11.1h9.8v1.8H5zM5 15.2h14v1.8H5z" fill="currentColor" /></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="5.4" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="m15.2 15.2 3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7.5h3.1c1.7 0 2.6.4 3.6 1.5l5.5 6c.5.5 1 .8 1.9.8h1.9M20 7v4h-4M4.5 16.5h3.1c1.2 0 1.8-.2 2.5-.9l1.5-1.5M20 13v4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7.5h9.5M5 12h9.5M5 16.5h9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18.2" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M18.2 8.5v2.1M18.2 13.4v2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ScreenButton({ children, onClick, label }) {
  return <button className="screen-icon-button" type="button" onClick={onClick} aria-label={label}>{children}</button>;
}

function ScreenSection({ title, actionLabel, onAction, children }) {
  return (
    <section className="collection-section">
      <div className="collection-section__header">
        <h2>{title}</h2>
        {actionLabel && onAction ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}
      </div>
      {children}
    </section>
  );
}

function EntityList({ items, onSelect, emptyMessage }) {
  if (!items.length) {
    return <div className="empty-state empty-state--flat"><p>{emptyMessage}</p></div>;
  }

  return (
    <div className="entity-list">
      {items.map((item) => (
        <button key={item.id} className="entity-list__row" type="button" onClick={() => onSelect(item)}>
          <div className="entity-list__cover" aria-hidden="true">
            {item.cover ? <img src={item.cover} alt="" /> : <span>{item.title[0]}</span>}
          </div>
          <div className="entity-list__copy">
            <strong>{item.title}</strong>
            <p>{item.subtitle}</p>
          </div>
          <span className="entity-list__arrow">›</span>
        </button>
      ))}
    </div>
  );
}

export function ClientApp() {
  const telegram = useTelegram();
  const audioRef = useRef(null);
  const playbackIntentRef = useRef(false);
  const [activeTab, setActiveTab] = useState("home");
  const [homeMode, setHomeMode] = useState("songs");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(() => readStoredText(STORAGE_KEYS.query, ""));
  const [tracks, setTracks] = useState(() => readStoredJson(STORAGE_KEYS.tracks, []));
  const [favorites, setFavorites] = useState(() => readStoredJson(STORAGE_KEYS.favorites, []));
  const [recentTracks, setRecentTracks] = useState(() => readStoredJson(STORAGE_KEYS.recent, []));
  const [playlists, setPlaylists] = useState(() => readStoredJson(STORAGE_KEYS.playlists, []));
  const [discoveryTracks, setDiscoveryTracks] = useState(() => {
    const storedDiscovery = readStoredJson(STORAGE_KEYS.discovery, []);
    return storedDiscovery.length > 0 ? storedDiscovery : DEFAULT_SHOWCASE_TRACKS;
  });
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [queue, setQueue] = useState(DEFAULT_SHOWCASE_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(DEFAULT_PLAYER_TRACK_INDEX);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [selectedTrackKey, setSelectedTrackKey] = useState("");

  const currentTrack = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
  const allKnownTracks = useMemo(
    () => uniqueTracks([...tracks, ...favorites, ...recentTracks, ...playlists.flatMap((playlist) => playlist.tracks), ...discoveryTracks, currentTrack]),
    [tracks, favorites, recentTracks, playlists, discoveryTracks, currentTrack],
  );
  const favoriteTrackKeys = useMemo(() => new Set(favorites.map((track) => getTrackKey(track))), [favorites]);
  const recentTrackKeys = useMemo(() => new Set(recentTracks.map((track) => getTrackKey(track))), [recentTracks]);
  const tasteProfile = useMemo(() => buildTasteProfile({ recentTracks, favorites, playlists, currentTrack }), [recentTracks, favorites, playlists, currentTrack]);
  const artistCards = useMemo(() => buildArtistCards(allKnownTracks, tasteProfile), [allKnownTracks, tasteProfile]);
  const rankedTracks = useMemo(() => buildTrackRanking(allKnownTracks, tasteProfile, favoriteTrackKeys, recentTrackKeys), [allKnownTracks, tasteProfile, favoriteTrackKeys, recentTrackKeys]);
  const mixCards = useMemo(() => buildMixCards(playlists, rankedTracks), [playlists, rankedTracks]);
  const homeTracks = useMemo(() => (tracks.length > 0 ? tracks : rankedTracks.length > 0 ? rankedTracks : discoveryTracks), [tracks, rankedTracks, discoveryTracks]);
  const folderCards = useMemo(
    () => [
      { id: "folder-recent", title: "Недавние", subtitle: `${recentTracks.length} треков`, cover: recentTracks[0]?.cover || null },
      { id: "folder-favorites", title: "Избранное", subtitle: `${favorites.length} треков`, cover: favorites[0]?.cover || null },
      { id: "folder-library", title: "Каталог", subtitle: `${homeTracks.length} треков`, cover: homeTracks[0]?.cover || null },
    ],
    [recentTracks, favorites, homeTracks],
  );

  useEffect(() => writeStoredText(STORAGE_KEYS.query, query), [query]);
  useEffect(() => writeStoredJson(STORAGE_KEYS.tracks, tracks), [tracks]);
  useEffect(() => writeStoredJson(STORAGE_KEYS.favorites, favorites), [favorites]);
  useEffect(() => writeStoredJson(STORAGE_KEYS.recent, recentTracks), [recentTracks]);
  useEffect(() => writeStoredJson(STORAGE_KEYS.playlists, playlists), [playlists]);
  useEffect(() => writeStoredJson(STORAGE_KEYS.discovery, discoveryTracks), [discoveryTracks]);
  useEffect(() => {
    if (!HAS_REMOTE_API && discoveryTracks.length === 0) setDiscoveryTracks(DEFAULT_SHOWCASE_TRACKS);
  }, [discoveryTracks]);
  useEffect(() => {
    if (!selectedPlaylistId && playlists.length > 0) setSelectedPlaylistId(playlists[0].id);
    if (playlists.every((playlist) => playlist.id !== selectedPlaylistId)) setSelectedPlaylistId(playlists[0]?.id || "");
  }, [playlists, selectedPlaylistId]);
  useEffect(() => {
    if (!selectedTrackKey && allKnownTracks.length > 0) setSelectedTrackKey(getTrackKey(allKnownTracks[0]));
    if (allKnownTracks.every((track) => getTrackKey(track) !== selectedTrackKey)) setSelectedTrackKey(allKnownTracks[0] ? getTrackKey(allKnownTracks[0]) : "");
  }, [allKnownTracks, selectedTrackKey]);

  useEffect(() => {
    if (!telegram) return;
    telegram.ready();
    telegram.expand();
    const theme = telegram.themeParams;
    if (theme.bg_color) document.documentElement.style.setProperty("--tg-bg", theme.bg_color);
    if (theme.text_color) document.documentElement.style.setProperty("--tg-text", theme.text_color);
  }, [telegram]);

  useEffect(() => {
    const user = telegram?.initDataUnsafe?.user;
    if (!HAS_REMOTE_API || !user?.id) return;
    apiRequest("/users/seen", {
      method: "POST",
      body: JSON.stringify({ user }),
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  }, [telegram]);

  useEffect(() => {
    if (!HAS_REMOTE_API || discoveryTracks.length > 0 || discoveryLoading) return;
    let isCancelled = false;

    async function loadDiscovery() {
      setDiscoveryLoading(true);
      try {
        const batches = await Promise.all(DISCOVERY_QUERIES.map((discoveryQuery) => apiRequest(`/search?q=${encodeURIComponent(discoveryQuery)}`)));
        if (!isCancelled) setDiscoveryTracks(uniqueTracks(batches.flatMap((result) => result.slice(0, 6))));
      } catch {
        if (!isCancelled) setDiscoveryTracks(DEFAULT_SHOWCASE_TRACKS);
      } finally {
        if (!isCancelled) setDiscoveryLoading(false);
      }
    }

    loadDiscovery();
    return () => {
      isCancelled = true;
    };
  }, [discoveryTracks, discoveryLoading]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (currentIndex < queue.length - 1) {
        playbackIntentRef.current = true;
        setCurrentIndex((value) => value + 1);
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
  }, [currentIndex, queue.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.src = currentTrack.audio_url;
    audio.load();
    setCurrentTime(0);
    setRecentTracks((value) => upsertRecentTrack(value, currentTrack));

    if (!playbackIntentRef.current) {
      setIsPlaying(false);
      return;
    }

    audio.play().then(() => {
      setIsPlaying(true);
      playbackIntentRef.current = false;
    }).catch(() => {
      setIsPlaying(false);
      playbackIntentRef.current = false;
    });
  }, [currentTrack]);

  async function runSearch(searchValue) {
    const normalizedQuery = searchValue.trim();
    if (!normalizedQuery) return;

    setQuery(normalizedQuery);
    setActiveTab("home");
    setHomeMode("songs");
    setIsLoading(true);
    setError("");

    if (!HAS_REMOTE_API) {
      const loweredQuery = normalizedQuery.toLowerCase();
      const localCatalog = uniqueTracks([...allKnownTracks, ...DEFAULT_SHOWCASE_TRACKS]);
      setTracks(localCatalog.filter((track) => `${track.title} ${track.artist}`.toLowerCase().includes(loweredQuery)));
      setSearchOpen(false);
      setIsLoading(false);
      return;
    }

    try {
      setTracks(await apiRequest(`/search?q=${encodeURIComponent(normalizedQuery)}`));
      setSearchOpen(false);
    } catch (requestError) {
      setTracks([]);
      setError(requestError instanceof Error ? requestError.message : "Не удалось выполнить поиск");
    } finally {
      setIsLoading(false);
    }
  }

  const handleSearch = async (event) => {
    event.preventDefault();
    await runSearch(query);
  };

  const playTrackFromCollection = (collection, index) => {
    if (!collection.length) return;
    playbackIntentRef.current = true;
    setQueue(collection);
    setCurrentIndex(index);
  };

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentTrack && homeTracks.length > 0) {
      playTrackFromCollection(homeTracks, 0);
      return;
    }
    if (audio.paused) {
      audio.play();
      return;
    }
    audio.pause();
  };

  const handlePrev = () => {
    playbackIntentRef.current = true;
    setCurrentIndex((value) => Math.max(value - 1, 0));
  };

  const handleNext = () => {
    playbackIntentRef.current = true;
    setCurrentIndex((value) => Math.min(value + 1, queue.length - 1));
  };

  const handleShufflePlay = () => {
    if (!homeTracks.length) return;
    playTrackFromCollection(homeTracks, Math.floor(Math.random() * homeTracks.length));
  };

  const toggleFavorite = (track) => {
    const trackKey = getTrackKey(track);
    setFavorites((value) => (value.some((item) => getTrackKey(item) === trackKey) ? value.filter((item) => getTrackKey(item) !== trackKey) : uniqueTracks([track, ...value])));
  };

  const handleCreatePlaylist = (event) => {
    event.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    setPlaylists((value) => [{ id: createPlaylistId(), name, tracks: [] }, ...value]);
    setNewPlaylistName("");
  };

  const addTrackToPlaylist = (playlistId, track) => {
    setPlaylists((value) => value.map((playlist) => (playlist.id !== playlistId ? playlist : { ...playlist, tracks: uniqueTracks([track, ...playlist.tracks]) })));
  };

  const removeTrackFromPlaylist = (playlistId, trackKey) => {
    setPlaylists((value) => value.map((playlist) => (playlist.id !== playlistId ? playlist : { ...playlist, tracks: playlist.tracks.filter((track) => getTrackKey(track) !== trackKey) })));
  };

  const removePlaylist = (playlistId) => setPlaylists((value) => value.filter((playlist) => playlist.id !== playlistId));

  const handleQuickAddTrack = (event) => {
    event.preventDefault();
    const track = allKnownTracks.find((item) => getTrackKey(item) === selectedTrackKey);
    if (track && selectedPlaylistId) addTrackToPlaylist(selectedPlaylistId, track);
  };

  const handleSelectArtist = (item) => void runSearch(item.title);
  const handleSelectMix = (item) => playTrackFromCollection(item.tracks || [], 0);
  const handleSelectFolder = (item) => {
    if (item.id === "folder-library") {
      setHomeMode("songs");
      setActiveTab("home");
      return;
    }
    setActiveTab("mine");
  };

  const renderDrawer = () => drawerOpen ? (
    <div className="screen-drawer-backdrop" role="presentation" onClick={() => setDrawerOpen(false)}>
      <aside className="screen-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <p className="screen-drawer__eyebrow">Меню</p>
        <button type="button" onClick={() => { setActiveTab("home"); setDrawerOpen(false); }}>Главная</button>
        <button type="button" onClick={() => { setActiveTab("mine"); setDrawerOpen(false); }}>Мое</button>
        <button type="button" onClick={() => { setActiveTab("playlists"); setDrawerOpen(false); }}>Плейлисты</button>
      </aside>
    </div>
  ) : null;

  const renderHomeContent = () => {
    if (homeMode === "artists") {
      return <EntityList items={artistCards.slice(0, 20).map((artist) => ({ id: artist.id, title: artist.name, subtitle: `${artist.tracks.length} треков в каталоге`, cover: artist.cover, tracks: artist.tracks }))} onSelect={handleSelectArtist} emptyMessage={discoveryLoading ? "Загружаю исполнителей..." : "Исполнители появятся после первой загрузки каталога."} />;
    }
    if (homeMode === "playlist") {
      return <EntityList items={mixCards} onSelect={handleSelectMix} emptyMessage="Создай плейлисты или послушай больше музыки." />;
    }
    if (homeMode === "albums") {
      return <EntityList items={mixCards.slice(0, 10)} onSelect={handleSelectMix} emptyMessage="Альбомы и миксы появятся здесь." />;
    }
    if (homeMode === "folder") {
      return <EntityList items={folderCards} onSelect={handleSelectFolder} emptyMessage="Здесь появятся твои подборки." />;
    }
    return <TrackList tracks={homeTracks} activeTrackId={getTrackKey(currentTrack)} onPlay={(index) => playTrackFromCollection(homeTracks, index)} favoriteTrackKeys={favoriteTrackKeys} emptyMessage={isLoading ? "Загружаю треки..." : query ? "По этому запросу ничего не найдено." : "Популярные треки появятся после импорта."} />;
  };

  const renderHomeTab = () => (
    <section className="player-screen">
      <header className="player-screen__header">
        <div className="player-screen__leading">
          <ScreenButton label="Меню" onClick={() => setDrawerOpen(true)}><MenuIcon /></ScreenButton>
          <h1>Музыка</h1>
        </div>
        <ScreenButton label="Поиск" onClick={() => setSearchOpen((value) => !value)}><SearchIcon /></ScreenButton>
      </header>

      {searchOpen ? <SearchBar value={query} onChange={setQuery} onSubmit={handleSearch} isLoading={isLoading} onClose={() => setSearchOpen(false)} /> : null}

      <div className="library-toolbar">
        <div className="library-toolbar__tabs">
          {HOME_MODES.map((mode) => (
            <button key={mode.id} type="button" className={`library-toolbar__tab ${homeMode === mode.id ? "library-toolbar__tab--active" : ""}`} onClick={() => setHomeMode(mode.id)}>
              {mode.label}
            </button>
          ))}
        </div>
        <div className="library-toolbar__actions">
          <ScreenButton label="Перемешать" onClick={handleShufflePlay}><ShuffleIcon /></ScreenButton>
          <ScreenButton label="Моя музыка" onClick={() => setActiveTab("mine")}><QueueIcon /></ScreenButton>
        </div>
      </div>

      {error ? <div className="inline-error">{error}</div> : null}
      <div className="player-screen__content">{renderHomeContent()}</div>
    </section>
  );

  const renderMineTab = () => (
    <section className="stack-screen">
      <header className="stack-screen__header">
        <button type="button" onClick={() => setActiveTab("home")}>Назад</button>
        <h1>Мое</h1>
        <button type="button" onClick={() => setActiveTab("playlists")}>Плейлисты</button>
      </header>
      <ScreenSection title="Недавно слушал">
        <TrackList tracks={recentTracks} activeTrackId={getTrackKey(currentTrack)} onPlay={(index) => playTrackFromCollection(recentTracks, index)} onToggleFavorite={toggleFavorite} favoriteTrackKeys={favoriteTrackKeys} showFavoriteAction emptyMessage="История прослушивания пока пуста." />
      </ScreenSection>
      <ScreenSection title="Избранные треки">
        <TrackList tracks={favorites} activeTrackId={getTrackKey(currentTrack)} onPlay={(index) => playTrackFromCollection(favorites, index)} onToggleFavorite={toggleFavorite} favoriteTrackKeys={favoriteTrackKeys} showFavoriteAction emptyMessage="Добавляй треки в избранное прямо из плеера." />
      </ScreenSection>
      <ScreenSection title="Твои плейлисты" actionLabel="Открыть" onAction={() => setActiveTab("playlists")}>
        <EntityList items={mixCards} onSelect={() => setActiveTab("playlists")} emptyMessage="Плейлистов пока нет." />
      </ScreenSection>
    </section>
  );

  const renderPlaylistsTab = () => (
    <section className="stack-screen">
      <header className="stack-screen__header">
        <button type="button" onClick={() => setActiveTab("home")}>Назад</button>
        <h1>Плейлисты</h1>
        <span>{playlists.length}</span>
      </header>
      <form className="playlist-builder" onSubmit={handleCreatePlaylist}>
        <input className="search-inline__input" type="text" value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.target.value)} placeholder="Название нового плейлиста" />
        <button className="search-inline__submit" type="submit">Создать</button>
      </form>
      {playlists.length > 0 ? (
        <form className="playlist-builder playlist-builder--secondary" onSubmit={handleQuickAddTrack}>
          <select className="search-inline__input" value={selectedPlaylistId} onChange={(event) => setSelectedPlaylistId(event.target.value)}>
            {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
          </select>
          <select className="search-inline__input" value={selectedTrackKey} onChange={(event) => setSelectedTrackKey(event.target.value)}>
            {allKnownTracks.map((track) => <option key={getTrackKey(track)} value={getTrackKey(track)}>{track.title} - {track.artist}</option>)}
          </select>
          <button className="search-inline__submit" type="submit">Добавить</button>
        </form>
      ) : null}
      <div className="playlist-stack">
        {playlists.length > 0 ? playlists.map((playlist) => (
          <article key={playlist.id} className="playlist-card">
            <div className="playlist-card__header">
              <div><h2>{playlist.name}</h2><p>{playlist.tracks.length} треков</p></div>
              <div className="playlist-card__actions">
                {currentTrack ? <button type="button" onClick={() => addTrackToPlaylist(playlist.id, currentTrack)}>Текущий</button> : null}
                <button type="button" onClick={() => removePlaylist(playlist.id)}>Удалить</button>
              </div>
            </div>
            {playlist.tracks.length > 0 ? (
              <div className="playlist-card__tracks">
                {playlist.tracks.map((track, index) => (
                  <div key={getTrackKey(track)} className="playlist-track">
                    <button className="playlist-track__main" type="button" onClick={() => playTrackFromCollection(playlist.tracks, index)}>
                      <div className="library-row__cover" aria-hidden="true">{track.cover ? <img src={track.cover} alt="" /> : <span>♪</span>}</div>
                      <div className="library-row__copy"><h3>{track.title}</h3><p>{track.artist}</p></div>
                    </button>
                    <div className="playlist-track__actions">
                      <button type="button" onClick={() => toggleFavorite(track)}>{favoriteTrackKeys.has(getTrackKey(track)) ? "♥" : "♡"}</button>
                      <button type="button" onClick={() => removeTrackFromPlaylist(playlist.id, getTrackKey(track))}>Убрать</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state empty-state--flat"><p>Плейлист пуст. Добавь в него первый трек.</p></div>}
          </article>
        )) : <div className="empty-state empty-state--flat"><p>Создай первый плейлист, чтобы собирать музыку для себя.</p></div>}
      </div>
    </section>
  );

  return (
    <main className="app-shell app-shell--client redesign-shell">
      <audio ref={audioRef} preload="none" />
      {renderDrawer()}
      {activeTab === "mine" && renderMineTab()}
      {activeTab === "playlists" && renderPlaylistsTab()}
      {activeTab === "home" && renderHomeTab()}
      <Player track={currentTrack} isPlaying={isPlaying} currentTime={currentTime} duration={duration} onTogglePlay={handleTogglePlay} onPrev={handlePrev} onNext={handleNext} />
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}
