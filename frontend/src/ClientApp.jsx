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
const CARD_COLORS = ["#ffa37b", "#98e5a8", "#c7a0ff", "#f6a7d7", "#93d7ff", "#ffd975"];

function getTrackKey(track) {
  if (!track) {
    return "";
  }

  return String(
    track.id ||
      track.source_track_id ||
      track.audio_url ||
      `${track.title}-${track.artist}`,
  );
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
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function readStoredText(key, fallback = "") {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem(key) || fallback;
}

function writeStoredText(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, value);
}

function uniqueTracks(tracks) {
  const map = new Map();

  for (const track of tracks) {
    if (!track) {
      continue;
    }

    map.set(getTrackKey(track), track);
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
  return artist
    .split(/\s*(?:,|&|feat\.?|ft\.?|x|\/)\s*/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTasteProfile({ recentTracks, favorites, playlists, currentTrack }) {
  const profile = new Map();

  function addWeight(artistName, weight) {
    const key = artistName.toLowerCase();
    profile.set(key, (profile.get(key) || 0) + weight);
  }

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

function buildArtistCards(tracks, tasteProfile) {
  const artists = new Map();

  tracks.forEach((track) => {
    splitArtistNames(track.artist).forEach((artistName) => {
      const key = artistName.toLowerCase();
      const current = artists.get(key) || {
        id: key,
        name: artistName,
        score: 0,
        cover: track.cover || null,
        tracks: [],
      };

      current.score += 1 + (tasteProfile.get(key) || 0);
      current.cover = current.cover || track.cover || null;
      current.tracks = uniqueTracks([track, ...current.tracks]).slice(0, 5);
      artists.set(key, current);
    });
  });

  return [...artists.values()].sort((left, right) => right.score - left.score);
}

function scoreTrack(track, tasteProfile, favoriteTrackKeys, recentTrackKeys) {
  const artistScore = splitArtistNames(track.artist).reduce(
    (sum, artistName) => sum + (tasteProfile.get(artistName.toLowerCase()) || 0),
    0,
  );

  return (
    artistScore +
    (favoriteTrackKeys.has(getTrackKey(track)) ? 8 : 0) +
    (recentTrackKeys.has(getTrackKey(track)) ? 4 : 0)
  );
}

function buildTrackRanking(tracks, tasteProfile, favoriteTrackKeys, recentTrackKeys) {
  return [...tracks].sort(
    (left, right) =>
      scoreTrack(right, tasteProfile, favoriteTrackKeys, recentTrackKeys) -
      scoreTrack(left, tasteProfile, favoriteTrackKeys, recentTrackKeys),
  );
}

function buildStationCards(artists, rankedTracks) {
  return artists.slice(0, 6).map((artist, index) => {
    const relatedTracks = artist.tracks.length > 0 ? artist.tracks : rankedTracks.slice(0, 3);

    return {
      id: artist.id,
      title: artist.name,
      subtitle: relatedTracks
        .slice(0, 3)
        .map((track) => track.artist)
        .join(", "),
      covers: relatedTracks.slice(0, 3).map((track) => track.cover).filter(Boolean),
      color: CARD_COLORS[index % CARD_COLORS.length],
      tracks: relatedTracks,
    };
  });
}

function buildMixCards(playlists, rankedTracks) {
  const playlistCards = playlists.slice(0, 3).map((playlist, index) => ({
    id: playlist.id,
    title: playlist.name,
    subtitle:
      playlist.tracks.slice(0, 3).map((track) => track.artist).join(", ") || "Добавьте треки",
    color: CARD_COLORS[(index + 2) % CARD_COLORS.length],
    tracks: playlist.tracks,
  }));

  if (playlistCards.length > 0) {
    return playlistCards;
  }

  return rankedTracks.slice(0, 3).map((track, index) => ({
    id: `mix-${getTrackKey(track)}`,
    title: `${track.title} Mix`,
    subtitle: track.artist,
    color: CARD_COLORS[(index + 3) % CARD_COLORS.length],
    tracks: rankedTracks.filter((item) =>
      splitArtistNames(item.artist).some((artistName) =>
        splitArtistNames(track.artist).includes(artistName),
      ),
    ),
  }));
}

function MiniHeader({ title, subtitle, actionLabel, onAction }) {
  return (
    <header className="mobile-header">
      <div>
        <p className="mobile-header__eyebrow">{subtitle}</p>
        <h1>{title}</h1>
      </div>

      {onAction ? (
        <button className="mobile-header__button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </header>
  );
}

function Section({ title, actionLabel, onAction, children }) {
  return (
    <section className="section-block">
      <div className="section-block__header">
        <h2>{title}</h2>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ClientApp() {
  const telegram = useTelegram();
  const audioRef = useRef(null);

  const [activeTab, setActiveTab] = useState("home");
  const [homeFilter, setHomeFilter] = useState("all");
  const [query, setQuery] = useState(() => readStoredText(STORAGE_KEYS.query, ""));
  const [tracks, setTracks] = useState(() => readStoredJson(STORAGE_KEYS.tracks, []));
  const [favorites, setFavorites] = useState(() =>
    readStoredJson(STORAGE_KEYS.favorites, []),
  );
  const [recentTracks, setRecentTracks] = useState(() =>
    readStoredJson(STORAGE_KEYS.recent, []),
  );
  const [playlists, setPlaylists] = useState(() =>
    readStoredJson(STORAGE_KEYS.playlists, []),
  );
  const [discoveryTracks, setDiscoveryTracks] = useState(() =>
    readStoredJson(STORAGE_KEYS.discovery, []),
  );
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [selectedTrackKey, setSelectedTrackKey] = useState("");

  const currentTrack =
    currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
  const allKnownTracks = useMemo(
    () =>
      uniqueTracks([
        ...tracks,
        ...favorites,
        ...recentTracks,
        ...playlists.flatMap((playlist) => playlist.tracks),
        ...discoveryTracks,
        currentTrack,
      ]),
    [tracks, favorites, recentTracks, playlists, discoveryTracks, currentTrack],
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
    () => buildTasteProfile({ recentTracks, favorites, playlists, currentTrack }),
    [recentTracks, favorites, playlists, currentTrack],
  );
  const artistCards = useMemo(
    () => buildArtistCards(allKnownTracks, tasteProfile),
    [allKnownTracks, tasteProfile],
  );
  const rankedTracks = useMemo(
    () => buildTrackRanking(allKnownTracks, tasteProfile, favoriteTrackKeys, recentTrackKeys),
    [allKnownTracks, tasteProfile, favoriteTrackKeys, recentTrackKeys],
  );
  const recommendedStations = useMemo(
    () => buildStationCards(artistCards, rankedTracks),
    [artistCards, rankedTracks],
  );
  const mixCards = useMemo(
    () => buildMixCards(playlists, rankedTracks),
    [playlists, rankedTracks],
  );
  const featuredItems = useMemo(() => {
    const popularArtists = artistCards.slice(0, 2).map((artist, index) => ({
      id: `artist-${artist.id}`,
      type: "artist",
      title: artist.name,
      subtitle: `${artist.tracks.length} треков в подборке`,
      cover: artist.cover,
      queryValue: artist.name,
      color: CARD_COLORS[index % CARD_COLORS.length],
    }));
    const popularTracks = rankedTracks.slice(0, 2).map((track, index) => ({
      id: `track-${getTrackKey(track)}`,
      type: "track",
      title: track.title,
      subtitle: track.artist,
      cover: track.cover,
      track,
      color: CARD_COLORS[(index + 3) % CARD_COLORS.length],
    }));

    return [...popularArtists, ...popularTracks].slice(0, 4);
  }, [artistCards, rankedTracks]);

  useEffect(() => {
    writeStoredText(STORAGE_KEYS.query, query);
  }, [query]);

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.tracks, tracks);
  }, [tracks]);

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.favorites, favorites);
  }, [favorites]);

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.recent, recentTracks);
  }, [recentTracks]);

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.playlists, playlists);
  }, [playlists]);

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.discovery, discoveryTracks);
  }, [discoveryTracks]);

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

    if (!user?.id) {
      return;
    }

    apiRequest("/users/seen", {
      method: "POST",
      body: JSON.stringify({ user }),
      headers: {
        "Content-Type": "application/json",
      },
    }).catch(() => {});
  }, [telegram]);

  useEffect(() => {
    if (discoveryTracks.length > 0 || discoveryLoading) {
      return;
    }

    let isCancelled = false;

    async function loadDiscovery() {
      setDiscoveryLoading(true);

      try {
        const batches = await Promise.all(
          DISCOVERY_QUERIES.map((discoveryQuery) =>
            apiRequest(`/search?q=${encodeURIComponent(discoveryQuery)}`),
          ),
        );

        if (!isCancelled) {
          setDiscoveryTracks(uniqueTracks(batches.flatMap((result) => result.slice(0, 4))));
        }
      } catch {
        if (!isCancelled) {
          setDiscoveryTracks([]);
        }
      } finally {
        if (!isCancelled) {
          setDiscoveryLoading(false);
        }
      }
    }

    loadDiscovery();

    return () => {
      isCancelled = true;
    };
  }, [discoveryTracks, discoveryLoading]);

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
      if (currentIndex < queue.length - 1) {
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

    if (!audio || !currentTrack) {
      return;
    }

    audio.src = currentTrack.audio_url;
    audio.load();
    setCurrentTime(0);
    setRecentTracks((value) => upsertRecentTrack(value, currentTrack));

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [currentTrack]);

  async function runSearch(searchValue) {
    const normalizedQuery = searchValue.trim();

    if (!normalizedQuery) {
      return;
    }

    setQuery(normalizedQuery);
    setActiveTab("tracks");
    setIsLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        `/search?q=${encodeURIComponent(normalizedQuery)}`,
      );
      setTracks(data);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Ошибка при выполнении поиска";

      setTracks([]);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    await runSearch(query);
  }

  function playTrackFromCollection(collection, index) {
    if (!collection.length) {
      return;
    }

    setQueue(collection);
    setCurrentIndex(index);
  }

  function playTrackImmediately(track) {
    playTrackFromCollection([track], 0);
  }

  function runArtistCard(artistName) {
    void runSearch(artistName);
  }

  function handleFeaturedItemClick(item) {
    if (item.type === "artist") {
      runArtistCard(item.queryValue);
      return;
    }

    if (item.track) {
      playTrackImmediately(item.track);
    }
  }

  function handleTogglePlay() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!currentTrack && rankedTracks.length > 0) {
      playTrackFromCollection(rankedTracks, 0);
      return;
    }

    if (audio.paused) {
      audio.play();
      return;
    }

    audio.pause();
  }

  function handleSeek(nextProgress) {
    const audio = audioRef.current;

    if (!audio || !duration) {
      return;
    }

    audio.currentTime = (nextProgress / 100) * duration;
    setCurrentTime(audio.currentTime);
  }

  function handlePrev() {
    setCurrentIndex((value) => Math.max(value - 1, 0));
  }

  function handleNext() {
    setCurrentIndex((value) => Math.min(value + 1, queue.length - 1));
  }

  function toggleFavorite(track) {
    const trackKey = getTrackKey(track);

    setFavorites((value) => {
      if (value.some((item) => getTrackKey(item) === trackKey)) {
        return value.filter((item) => getTrackKey(item) !== trackKey);
      }

      return uniqueTracks([track, ...value]);
    });
  }

  function handleCreatePlaylist(event) {
    event.preventDefault();

    const name = newPlaylistName.trim();

    if (!name) {
      return;
    }

    setPlaylists((value) => [
      {
        id: createPlaylistId(),
        name,
        tracks: [],
      },
      ...value,
    ]);
    setNewPlaylistName("");
    setActiveTab("playlists");
  }

  function addTrackToPlaylist(playlistId, track) {
    setPlaylists((value) =>
      value.map((playlist) => {
        if (playlist.id !== playlistId) {
          return playlist;
        }

        return {
          ...playlist,
          tracks: uniqueTracks([track, ...playlist.tracks]),
        };
      }),
    );
  }

  function removeTrackFromPlaylist(playlistId, trackKey) {
    setPlaylists((value) =>
      value.map((playlist) => {
        if (playlist.id !== playlistId) {
          return playlist;
        }

        return {
          ...playlist,
          tracks: playlist.tracks.filter(
            (track) => getTrackKey(track) !== trackKey,
          ),
        };
      }),
    );
  }

  function removePlaylist(playlistId) {
    setPlaylists((value) => value.filter((playlist) => playlist.id !== playlistId));
  }

  function handleQuickAddTrack(event) {
    event.preventDefault();

    const track = allKnownTracks.find(
      (item) => getTrackKey(item) === selectedTrackKey,
    );

    if (!track || !selectedPlaylistId) {
      return;
    }

    addTrackToPlaylist(selectedPlaylistId, track);
  }

  function renderStationScroller(items, onPick) {
    if (!items.length) {
      return (
        <div className="empty-state">
          <p>Пока не хватает данных. Послушайте несколько треков, и подборка станет точнее.</p>
        </div>
      );
    }

    return (
      <div className="station-scroller">
        {items.map((item, index) => (
          <button
            key={item.id}
            className="station-card"
            type="button"
            style={{ background: item.color || CARD_COLORS[index % CARD_COLORS.length] }}
            onClick={() => onPick(item)}
          >
            <div className="station-card__badge">РАДИО</div>
            <div className="station-card__covers">
              {(item.covers || item.tracks?.map((track) => track.cover) || [])
                .filter(Boolean)
                .slice(0, 3)
                .map((cover, coverIndex) => (
                  <span
                    key={`${item.id}-${coverIndex}`}
                    className={`station-card__cover station-card__cover--${coverIndex}`}
                  >
                    <img src={cover} alt="" />
                  </span>
                ))}
            </div>
            <strong>{item.title}</strong>
            <p>{item.subtitle}</p>
          </button>
        ))}
      </div>
    );
  }

  function renderArtistsGrid() {
    if (!artistCards.length) {
      return (
        <div className="empty-state">
          <p>
            {discoveryLoading
              ? "Загружаем популярных исполнителей..."
              : "Исполнители появятся после первых данных."}
          </p>
        </div>
      );
    }

    return (
      <div className="artist-grid">
        {artistCards.slice(0, 6).map((artist, index) => (
          <button
            key={artist.id}
            className="artist-card"
            type="button"
            style={{ background: CARD_COLORS[(index + 1) % CARD_COLORS.length] }}
            onClick={() => runArtistCard(artist.name)}
          >
            <div className="artist-card__avatar">
              {artist.cover ? <img src={artist.cover} alt="" /> : <span>{artist.name[0]}</span>}
            </div>
            <strong>{artist.name}</strong>
            <p>{artist.tracks.length} треков</p>
          </button>
        ))}
      </div>
    );
  }

  function renderHomeTab() {
    const showAll = homeFilter === "all";
    const showMusic = homeFilter === "music";
    const showForYou = homeFilter === "for-you";

    return (
      <section className="phone-shell">
        <MiniHeader title="Vibrafy" subtitle="Главная" />

        <div className="home-filter-bar">
          <button
            type="button"
            className={`home-filter-bar__item ${
              homeFilter === "for-you" ? "home-filter-bar__item--active" : ""
            }`}
            onClick={() => setHomeFilter("for-you")}
          >
            Для тебя
          </button>
          <button
            type="button"
            className={`home-filter-bar__item ${
              homeFilter === "all" ? "home-filter-bar__item--active" : ""
            }`}
            onClick={() => setHomeFilter("all")}
          >
            Все
          </button>
          <button
            type="button"
            className={`home-filter-bar__item ${
              homeFilter === "music" ? "home-filter-bar__item--active" : ""
            }`}
            onClick={() => setHomeFilter("music")}
          >
            Музыка
          </button>
        </div>

        <div className="featured-grid">
          {featuredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="featured-card"
              style={{ background: item.color }}
              onClick={() => handleFeaturedItemClick(item)}
            >
              <div className="featured-card__cover">
                {item.cover ? <img src={item.cover} alt="" /> : <span>{item.title[0]}</span>}
              </div>
              <div>
                <strong>{item.title}</strong>
                <p>{item.subtitle}</p>
              </div>
            </button>
          ))}
        </div>

        {(showAll || showForYou) && (
          <Section title="Рекомендуемые станции">
            {renderStationScroller(recommendedStations, (station) =>
              playTrackFromCollection(station.tracks, 0),
            )}
          </Section>
        )}

        {(showAll || showMusic) && (
          <Section title="Популярные треки" actionLabel="Треки" onAction={() => setActiveTab("tracks")}>
            <TrackList
              tracks={rankedTracks.slice(0, 6)}
              activeTrackId={getTrackKey(currentTrack)}
              onPlay={(index) => playTrackFromCollection(rankedTracks.slice(0, 6), index)}
              onToggleFavorite={toggleFavorite}
              favoriteTrackKeys={favoriteTrackKeys}
              emptyMessage={
                discoveryLoading
                  ? "Загружаем популярные треки..."
                  : "Треки появятся, как только библиотека наполнится."
              }
            />
          </Section>
        )}

        {(showAll || showForYou) && (
          <Section title="Популярные исполнители" actionLabel="Треки" onAction={() => setActiveTab("tracks")}>
            {renderArtistsGrid()}
          </Section>
        )}

        {(showAll || showForYou) && (
          <Section title="Твои лучшие миксы">
            {renderStationScroller(mixCards, (mix) =>
              playTrackFromCollection(mix.tracks, 0),
            )}
          </Section>
        )}
      </section>
    );
  }

  function renderTracksTab() {
    const trackFeed = tracks.length > 0 ? tracks : rankedTracks;

    return (
      <section className="phone-shell">
        <MiniHeader
          title="Music Player"
          subtitle="Треки"
          actionLabel="Главная"
          onAction={() => setActiveTab("home")}
        />

        <div className="top-filter-bar">
          <button type="button" className="top-filter-bar__item top-filter-bar__item--active">
            Songs
          </button>
          <button type="button" className="top-filter-bar__item">
            Artists
          </button>
          <button type="button" className="top-filter-bar__item">
            Playlist
          </button>
          <button type="button" className="top-filter-bar__item">
            Albums
          </button>
        </div>

        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={handleSearch}
          isLoading={isLoading}
        />

        {error ? <div className="error-box">{error}</div> : null}

        <TrackList
          tracks={trackFeed}
          activeTrackId={getTrackKey(currentTrack)}
          onPlay={(index) => playTrackFromCollection(trackFeed, index)}
          onToggleFavorite={toggleFavorite}
          favoriteTrackKeys={favoriteTrackKeys}
          emptyMessage="Сделайте поиск, чтобы увидеть список треков."
        />
      </section>
    );
  }

  function renderMineTab() {
    return (
      <section className="phone-shell">
        <MiniHeader
          title="Моя музыка"
          subtitle="Мои"
          actionLabel="Плейлисты"
          onAction={() => setActiveTab("playlists")}
        />

        <section className="quick-grid quick-grid--three">
          <div className="summary-card summary-card--static">
            <span className="summary-card__label">Недавние</span>
            <strong>{recentTracks.length}</strong>
            <p>Последние прослушивания</p>
          </div>

          <div className="summary-card summary-card--static">
            <span className="summary-card__label">Избранные</span>
            <strong>{favorites.length}</strong>
            <p>Быстрый доступ к любимым трекам</p>
          </div>

          <div className="summary-card summary-card--static">
            <span className="summary-card__label">Плейлисты</span>
            <strong>{playlists.length}</strong>
            <p>Личные подборки пользователя</p>
          </div>
        </section>

        <Section title="Последние прослушанные">
          <TrackList
            tracks={recentTracks}
            activeTrackId={getTrackKey(currentTrack)}
            onPlay={(index) => playTrackFromCollection(recentTracks, index)}
            onToggleFavorite={toggleFavorite}
            favoriteTrackKeys={favoriteTrackKeys}
            emptyMessage="Пока нет истории прослушивания."
          />
        </Section>

        <Section title="Избранные треки">
          <TrackList
            tracks={favorites}
            activeTrackId={getTrackKey(currentTrack)}
            onPlay={(index) => playTrackFromCollection(favorites, index)}
            onToggleFavorite={toggleFavorite}
            favoriteTrackKeys={favoriteTrackKeys}
            emptyMessage="Добавьте треки в избранное сердцем на странице треков."
          />
        </Section>

        <Section title="Мои плейлисты" actionLabel="Создать" onAction={() => setActiveTab("playlists")}>
          <div className="playlist-chip-grid">
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  className="playlist-chip"
                  type="button"
                  onClick={() => setActiveTab("playlists")}
                >
                  <strong>{playlist.name}</strong>
                  <span>{playlist.tracks.length} треков</span>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <p>Плейлистов пока нет. Создайте первый на соседней вкладке.</p>
              </div>
            )}
          </div>
        </Section>
      </section>
    );
  }

  function renderPlaylistsTab() {
    return (
      <section className="phone-shell">
        <MiniHeader title="Конструктор плейлистов" subtitle="Плейлисты" />

        <form className="builder-card" onSubmit={handleCreatePlaylist}>
          <label className="search-panel__label" htmlFor="playlist-name">
            Новый плейлист
          </label>
          <div className="search-panel__controls">
            <input
              id="playlist-name"
              className="search-panel__input"
              type="text"
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder="Например, Ночной вайб"
            />
            <button className="search-panel__button" type="submit">
              Создать
            </button>
          </div>
        </form>

        {playlists.length > 0 ? (
          <form className="builder-card builder-card--compact" onSubmit={handleQuickAddTrack}>
            <h2>Быстро добавить трек</h2>
            <div className="builder-card__grid">
              <select
                className="search-panel__input"
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
                className="search-panel__input"
                value={selectedTrackKey}
                onChange={(event) => setSelectedTrackKey(event.target.value)}
              >
                {allKnownTracks.map((track) => (
                  <option key={getTrackKey(track)} value={getTrackKey(track)}>
                    {track.title} - {track.artist}
                  </option>
                ))}
              </select>
            </div>

            <button className="search-panel__button" type="submit">
              Добавить в плейлист
            </button>
          </form>
        ) : null}

        <div className="playlist-board">
          {playlists.length > 0 ? (
            playlists.map((playlist) => (
              <article key={playlist.id} className="playlist-panel">
                <div className="playlist-panel__header">
                  <div>
                    <h2>{playlist.name}</h2>
                    <p>{playlist.tracks.length} треков</p>
                  </div>

                  <div className="playlist-panel__actions">
                    {currentTrack ? (
                      <button
                        type="button"
                        onClick={() => addTrackToPlaylist(playlist.id, currentTrack)}
                      >
                        Текущий трек
                      </button>
                    ) : null}
                    <button type="button" onClick={() => removePlaylist(playlist.id)}>
                      Удалить
                    </button>
                  </div>
                </div>

                {playlist.tracks.length > 0 ? (
                  <div className="playlist-track-list">
                    {playlist.tracks.map((track, index) => (
                      <div key={getTrackKey(track)} className="playlist-track-row">
                        <button
                          className="playlist-track-row__main"
                          type="button"
                          onClick={() => playTrackFromCollection(playlist.tracks, index)}
                        >
                          <div className="track-card__cover" aria-hidden="true">
                            {track.cover ? <img src={track.cover} alt="" /> : <span>♪</span>}
                          </div>
                          <div>
                            <strong>{track.title}</strong>
                            <p>{track.artist}</p>
                          </div>
                        </button>

                        <div className="playlist-track-row__actions">
                          <button type="button" onClick={() => toggleFavorite(track)}>
                            {favoriteTrackKeys.has(getTrackKey(track)) ? "♥" : "♡"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              removeTrackFromPlaylist(playlist.id, getTrackKey(track))
                            }
                          >
                            Убрать
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>Плейлист пока пуст. Добавьте текущий или любой известный трек.</p>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="empty-state">
              <p>Создайте первый плейлист, чтобы собирать музыку под себя.</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderActiveTab() {
    if (activeTab === "tracks") {
      return renderTracksTab();
    }

    if (activeTab === "mine") {
      return renderMineTab();
    }

    if (activeTab === "playlists") {
      return renderPlaylistsTab();
    }

    return renderHomeTab();
  }

  return (
    <main className="app-shell app-shell--client">
      <audio ref={audioRef} preload="none" />

      {renderActiveTab()}

      <Player
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onPrev={handlePrev}
        onNext={handleNext}
        isFavorite={favoriteTrackKeys.has(getTrackKey(currentTrack))}
        onToggleFavorite={() => currentTrack && toggleFavorite(currentTrack)}
      />

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}

