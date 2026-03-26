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

function DownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m6.7 9.2 5.3 5.4 5.3-5.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
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
      <path
        d="M8 6.5c0-.38.4-.62.73-.43l9.02 5.3c.34.2.34.69 0 .88l-9.02 5.3A.5.5 0 0 1 8 17.12V6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7h2.6c1.8 0 2.8.5 3.7 1.7l4.3 6.6c.6.9 1.1 1.3 2.3 1.3H19"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m16 5 3 2-3 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M5 17h2.6c1.6 0 2.5-.5 3.4-1.6l1-1.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m16 15 3 2-3 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 7h8.2c1.6 0 2.8 1.2 2.8 2.8V11"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m14.8 4.8 2.8 2.2-2.8 2.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M17 17H8.8A2.8 2.8 0 0 1 6 14.2V13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m9.2 19.2-2.8-2.2 2.8-2.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HeartIcon({ filled = false }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20.4 4.8 13.3a4.7 4.7 0 0 1 6.6-6.7L12 7.2l.6-.6a4.7 4.7 0 1 1 6.6 6.7L12 20.4Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.4 4.8 13.3a4.7 4.7 0 0 1 6.6-6.7L12 7.2l.6-.6a4.7 4.7 0 1 1 6.6 6.7L12 20.4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function stopPropagation(event) {
  event.stopPropagation();
}

export function Player({
  track,
  isPlaying,
  currentTime,
  duration,
  isExpanded,
  isFavorite,
  isShuffled,
  onClose,
  onNext,
  onOpen,
  onPrev,
  onSeek,
  onToggleFavorite,
  onTogglePlay,
  onToggleShuffle,
  onToggleRepeat,
  queueLength,
  queuePosition,
  repeatMode,
}) {
  if (!track) {
    return null;
  }

  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const repeatBadge = repeatMode === "one" ? "1" : repeatMode === "all" ? "•" : "";

  return (
    <>
      <section
        className={`mini-player ${isExpanded ? "mini-player--hidden" : ""}`}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
      >
        <div className="mini-player__meta">
          <div className="mini-player__cover" aria-hidden="true">
            {track.cover ? <img src={track.cover} alt="" /> : <span>{track.title[0]}</span>}
          </div>

          <div className="mini-player__copy">
            <h2>{track.title}</h2>
            <p>{track.artist}</p>
          </div>
        </div>

        <div className="mini-player__controls" onClick={stopPropagation}>
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
      </section>

      {isExpanded ? (
        <section className="full-player" role="dialog" aria-modal="true">
          <header className="full-player__header">
            <button className="full-player__header-button" type="button" onClick={onClose} aria-label="Close player">
              <DownIcon />
            </button>
            <div className="full-player__header-copy">
              <strong>Music Player</strong>
              <span>
                {queuePosition} / {queueLength}
              </span>
            </div>
            <div className="full-player__header-spacer" aria-hidden="true" />
          </header>

          <div className="full-player__body">
            <div className="full-player__cover">
              {track.cover ? <img src={track.cover} alt="" /> : <span>{track.title[0]}</span>}
            </div>

            <div className="full-player__copy">
              <h2>{track.title}</h2>
              <p>{track.artist}</p>
            </div>

            <div className="full-player__utility">
              <button
                className={`full-player__utility-button ${isShuffled ? "full-player__utility-button--active" : ""}`}
                type="button"
                onClick={onToggleShuffle}
                aria-label="Shuffle"
              >
                <ShuffleIcon />
              </button>
              <button
                className={`full-player__utility-button ${repeatMode !== "off" ? "full-player__utility-button--active" : ""}`}
                type="button"
                onClick={onToggleRepeat}
                aria-label="Repeat"
              >
                <RepeatIcon />
                {repeatBadge ? <span className="full-player__utility-badge">{repeatBadge}</span> : null}
              </button>
              <button
                className={`full-player__utility-button ${isFavorite ? "full-player__utility-button--active" : ""}`}
                type="button"
                onClick={onToggleFavorite}
                aria-label="Favorite"
              >
                <HeartIcon filled={isFavorite} />
              </button>
            </div>

            <div className="full-player__timeline-block">
              <input
                className="full-player__range"
                type="range"
                min="0"
                max={Math.max(duration, 0)}
                step="1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => onSeek(Number(event.target.value))}
              />
              <div className="full-player__times">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="full-player__transport">
              <button className="full-player__transport-button" type="button" onClick={onPrev} aria-label="Previous">
                <PrevIcon />
              </button>
              <button
                className="full-player__transport-button full-player__transport-button--primary"
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button className="full-player__transport-button" type="button" onClick={onNext} aria-label="Next">
                <NextIcon />
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
