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
}) {
  if (!track) {
    return (
      <section className="player player--empty">
        <p>Выберите трек, чтобы начать воспроизведение.</p>
      </section>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section className="player">
      <div className="player__header">
        <div>
          <p className="player__eyebrow">Сейчас играет</p>
          <h2 className="player__title">{track.title}</h2>
          <p className="player__artist">{track.artist}</p>
        </div>

        <div className="player__actions">
          <button type="button" onClick={onPrev}>
            Назад
          </button>
          <button type="button" onClick={onTogglePlay}>
            {isPlaying ? "Пауза" : "Слушать"}
          </button>
          <button type="button" onClick={onNext}>
            Далее
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
