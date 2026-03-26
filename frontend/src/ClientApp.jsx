import { useEffect, useRef, useState } from "react";
import { Player } from "./components/Player.jsx";
import { SearchBar } from "./components/SearchBar.jsx";
import { TrackList } from "./components/TrackList.jsx";
import { apiRequest } from "./lib/api.js";
import { useTelegram } from "./hooks/useTelegram.js";

export function ClientApp() {
  const telegram = useTelegram();
  const audioRef = useRef(null);

  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const currentTrack =
    currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

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

    setIsLoading(true);
    setError("");
    setHasSearched(true);

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

  function handlePlayTrack(index) {
    setQueue(tracks);
    setCurrentIndex(index);
  }

  function handleTogglePlay() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!currentTrack && tracks.length > 0) {
      setQueue(tracks);
      setCurrentIndex(0);
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

  return (
    <main className="app-shell">
      <audio ref={audioRef} preload="none" />

      <section className="hero">
        <p className="hero__badge">Telegram Mini App</p>
        <h1>Ищи музыку, слушай треки и собирай свою библиотеку.</h1>
        <p className="hero__text">
          Поиск читает данные из PostgreSQL, а парсер может автоматически
          пополнять базу, если нужного трека еще нет.
        </p>
      </section>

      <SearchBar
        value={query}
        onChange={setQuery}
        onSubmit={handleSearch}
        isLoading={isLoading}
      />

      {error ? <div className="error-box">{error}</div> : null}

      {hasSearched ? (
        <TrackList
          tracks={tracks}
          activeTrackId={currentTrack?.id ?? null}
          onPlay={handlePlayTrack}
        />
      ) : (
        <div className="empty-state">
          <p>Введите запрос, чтобы получить список треков из базы.</p>
        </div>
      )}

      <Player
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </main>
  );
}

