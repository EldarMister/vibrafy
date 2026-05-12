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

function DownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5.5 8.5 6.5 6.7 6.5-6.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6.4c0-.4.46-.64.8-.42l8.6 5.58a.52.52 0 0 1 0 .88l-8.6 5.58A.52.52 0 0 1 7 17.6V6.4Z" fill="currentColor" />
      <rect x="4" y="6" width="2.1" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 6.4c0-.4-.46-.64-.8-.42l-8.6 5.58a.52.52 0 0 0 0 .88l8.6 5.58a.52.52 0 0 0 .8-.42V6.4Z" fill="currentColor" />
      <rect x="17.9" y="6" width="2.1" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6.2" y="5.2" width="4.1" height="13.6" rx="1.2" fill="currentColor" />
      <rect x="13.7" y="5.2" width="4.1" height="13.6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5c0-.4.43-.65.78-.45l9.05 5.48a.53.53 0 0 1 0 .94l-9.05 5.48A.52.52 0 0 1 8 17.5v-11Z" fill="currentColor" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h2.7c1.8 0 2.8.5 3.7 1.8l4.2 6.4c.6.9 1.2 1.3 2.3 1.3H19" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="m16 5 3 2-3 2M5 17h2.6c1.6 0 2.5-.5 3.4-1.6l1-1.4M16 15l3 2-3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7h8.2c1.6 0 2.8 1.2 2.8 2.8V11" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="m14.8 4.8 2.8 2.2-2.8 2.2M17 17H8.8A2.8 2.8 0 0 1 6 14.2V13" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="m9.2 19.2-2.8-2.2 2.8-2.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function HeartIcon({ filled = false }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.3 4.8 13.2a4.7 4.7 0 0 1 6.6-6.7l.6.6.6-.6a4.7 4.7 0 0 1 6.6 6.7L12 20.3Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.3 4.8 13.2a4.7 4.7 0 0 1 6.6-6.7l.6.6.6-.6a4.7 4.7 0 0 1 6.6 6.7L12 20.3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h11M5 12h9M5 17h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="m16 15 3 2-3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h10M7 10h7M7 14h10M7 18h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function EffectsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 14V10M10 18V6M14 16V8M18 13v-2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 19h8M19 10.5c1.1.6 1.8 1.7 1.8 3s-.7 2.4-1.8 3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
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
  const repeatBadge = repeatMode === "one" ? "1" : "";

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
          <button type="button" onClick={onPrev} aria-label="Предыдущий трек">
            <PrevIcon />
          </button>
          <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? "Пауза" : "Играть"}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" onClick={onNext} aria-label="Следующий трек">
            <NextIcon />
          </button>
        </div>

        <div className="mini-player__timeline" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      {isExpanded ? (
        <section
          className="full-player"
          role="dialog"
          aria-modal="true"
          style={{ "--player-cover": `url("${track.cover || ""}")` }}
        >
          <div className="full-player__backdrop" />

          <header className="full-player__header">
            <button className="full-player__header-button" type="button" onClick={onClose} aria-label="Закрыть плеер">
              <DownIcon />
            </button>
            <div className="full-player__header-copy">
              <strong>Сейчас играет</strong>
              <span>
                {queuePosition || 1} из {queueLength || 1}
              </span>
            </div>
            <button className="full-player__header-button" type="button" aria-label="Меню">
              <MoreIcon />
            </button>
          </header>

          <div className="full-player__body">
            <div className="full-player__cover">
              {track.cover ? <img src={track.cover} alt="" /> : <span>{track.title[0]}</span>}
            </div>

            <div className="full-player__title-row">
              <div className="full-player__copy">
                <h2>{track.title}</h2>
                <p>{track.artist}</p>
              </div>
              <button
                className={`full-player__like ${isFavorite ? "full-player__like--active" : ""}`}
                type="button"
                onClick={onToggleFavorite}
                aria-label="Избранное"
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
              <button
                className={`full-player__transport-button ${isShuffled ? "full-player__transport-button--active" : ""}`}
                type="button"
                onClick={onToggleShuffle}
                aria-label="Перемешать"
              >
                <ShuffleIcon />
              </button>
              <button className="full-player__transport-button" type="button" onClick={onPrev} aria-label="Предыдущий">
                <PrevIcon />
              </button>
              <button
                className="full-player__transport-button full-player__transport-button--primary"
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? "Пауза" : "Играть"}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button className="full-player__transport-button" type="button" onClick={onNext} aria-label="Следующий">
                <NextIcon />
              </button>
              <button
                className={`full-player__transport-button ${repeatMode !== "off" ? "full-player__transport-button--active" : ""}`}
                type="button"
                onClick={onToggleRepeat}
                aria-label="Повтор"
              >
                <RepeatIcon />
                {repeatBadge ? <span className="full-player__badge">{repeatBadge}</span> : null}
              </button>
            </div>

            <div className="full-player__actions">
              <button type="button">
                <QueueIcon />
                <span>Очередь</span>
              </button>
              <button type="button">
                <TextIcon />
                <span>Текст</span>
              </button>
              <button type="button">
                <EffectsIcon />
                <span>Эффекты</span>
              </button>
              <button type="button">
                <DeviceIcon />
                <span>Устройства</span>
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
