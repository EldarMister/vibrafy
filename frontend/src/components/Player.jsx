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

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 6.5c0-.41.46-.65.8-.42l8.4 5.5a.5.5 0 0 1 0 .84l-8.4 5.5A.5.5 0 0 1 7 17.5v-11Z"
        fill="currentColor"
      />
      <rect x="4" y="6" width="2.2" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M17 6.5c0-.41-.46-.65-.8-.42l-8.4 5.5a.5.5 0 0 0 0 .84l8.4 5.5a.5.5 0 0 0 .8-.42v-11Z"
        fill="currentColor"
      />
      <rect x="17.8" y="6" width="2.2" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5c0-.38.4-.62.73-.43l9.02 5.3c.34.2.34.69 0 .88l-9.02 5.3A.5.5 0 0 1 8 17.12V6.5Z" fill="currentColor" />
    </svg>
  );
}

export function Player({
  track,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onNext,
  onPrev,
}) {
  if (!track) {
    return null;
  }

  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <section className="mini-player">
      <div className="mini-player__meta">
        <div className="mini-player__cover" aria-hidden="true">
          {track.cover ? <img src={track.cover} alt="" /> : <span>{track.title[0]}</span>}
        </div>

        <div className="mini-player__copy">
          <h2>{track.title}</h2>
          <p>{track.artist}</p>
        </div>
      </div>

      <div className="mini-player__controls">
        <button type="button" onClick={onPrev} aria-label="Previous">
          <PrevIcon />
        </button>
        <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" onClick={onNext} aria-label="Next">
          <NextIcon />
        </button>
      </div>

      <div className="mini-player__timeline" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="mini-player__times" aria-hidden="true">
        <small>{formatTime(currentTime)}</small>
        <small>{formatTime(duration)}</small>
      </div>
    </section>
  );
}
