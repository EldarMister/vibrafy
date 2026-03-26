function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${rest}`;
}

export function Player({
  track,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  isFavorite,
  onToggleFavorite,
}) {
  if (!track) {
    return null;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section className="player">
      <div className="player__progress-line" style={{ width: `${progress}%` }} />

      <div className="player__header">
        <div className="player__track">
          <div className="player__cover" aria-hidden="true">
            {track.cover ? <img src={track.cover} alt="" /> : <span>♪</span>}
          </div>

          <div className="player__copy">
            <p className="player__eyebrow">Сейчас играет</p>
            <h2 className="player__title">{track.title}</h2>
            <p className="player__artist">{track.artist}</p>
          </div>
        </div>

        <div className="player__actions">
          <button type="button" onClick={onPrev}>
            ‹‹
          </button>
          <button type="button" onClick={onTogglePlay}>
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button type="button" onClick={onNext}>
            ››
          </button>
          <button
            className={`player__favorite ${isFavorite ? "player__favorite--active" : ""}`}
            type="button"
            onClick={onToggleFavorite}
          >
            ♥
          </button>
        </div>
      </div>

      <div className="player__timeline">
        <span>{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatTime(duration)}</span>
      </div>
    </section>
  );
}
