import { useEffect, useRef, useState } from "react";
import { BottomNav } from "./components/BottomNav.jsx";
import { Player } from "./components/Player.jsx";
import { SearchBar } from "./components/SearchBar.jsx";
import { TrackList } from "./components/TrackList.jsx";
import { apiRequest } from "./lib/api.js";
import { useTelegram } from "./hooks/useTelegram.js";

const STORAGE_KEYS = {
  favorites: "vibrafy-favorites",
  playlists: "vibrafy-playlists",
  query: "vibrafy-query",
  recent: "vibrafy-recent",
  tracks: "vibrafy-tracks",
};

const MAX_RECENT_TRACKS = 20;

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
  const favoriteTrackKeys = new Set(favorites.map((track) => getTrackKey(track)));
  const allKnownTracks = uniqueTracks([
    ...tracks,
    ...favorites,
    ...recentTracks,
    ...playlists.flatMap((playlist) => playlist.tracks),
    currentTrack,
  ]);

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

  async function handleSearch(event) {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

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

  function playTrackFromCollection(collection, index) {
    if (!collection.length) {
      return;
    }

    setQueue(collection);
    setCurrentIndex(index);
  }

  function handleTogglePlay() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!currentTrack && tracks.length > 0) {
      playTrackFromCollection(tracks, 0);
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

  function renderHomeTab() {
    return (
      <section className="phone-shell">
        <MiniHeader
          title="Vibrafy"
          subtitle="Главная"
          actionLabel="Треки"
          onAction={() => setActiveTab("tracks")}
        />

        <section className="hero-card">
          <p className="hero-card__eyebrow">Мини-плеер для Telegram</p>
          <h2>Поиск, избранное, последние треки и свои плейлисты в одном экране.</h2>
          <p>
            Нижняя навигация ведет на главную, треки, мои подборки и страницу
            создания собственных плейлистов.
          </p>
        </section>

        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={handleSearch}
          isLoading={isLoading}
        />

        {error ? <div className="error-box">{error}</div> : null}

        <section className="quick-grid">
          <button className="summary-card" type="button" onClick={() => setActiveTab("tracks")}>
            <span className="summary-card__label">Треки</span>
            <strong>{tracks.length}</strong>
            <p>В последней выдаче поиска</p>
          </button>

          <button className="summary-card" type="button" onClick={() => setActiveTab("mine")}>
            <span className="summary-card__label">Избранное</span>
            <strong>{favorites.length}</strong>
            <p>Треки, которые сохранены для себя</p>
          </button>

          <button
            className="summary-card"
            type="button"
            onClick={() => setActiveTab("playlists")}
          >
            <span className="summary-card__label">Плейлисты</span>
            <strong>{playlists.length}</strong>
            <p>Личные подборки с собственным порядком</p>
          </button>

          <button className="summary-card" type="button" onClick={() => setActiveTab("mine")}>
            <span className="summary-card__label">Недавние</span>
            <strong>{recentTracks.length}</strong>
            <p>Последние прослушанные треки</p>
          </button>
        </section>

        <Section title="Продолжить прослушивание" actionLabel="Мои" onAction={() => setActiveTab("mine")}>
          <TrackList
            tracks={recentTracks.slice(0, 4)}
            activeTrackId={getTrackKey(currentTrack)}
            onPlay={(index) => playTrackFromCollection(recentTracks.slice(0, 4), index)}
            onToggleFavorite={toggleFavorite}
            favoriteTrackKeys={favoriteTrackKeys}
            emptyMessage="Пока нет последних треков. Запусти любой трек, и он появится здесь."
          />
        </Section>
      </section>
    );
  }

  function renderTracksTab() {
    const trackFeed = tracks.length > 0 ? tracks : recentTracks;

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
