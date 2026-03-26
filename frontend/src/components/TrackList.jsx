function getTrackKey(track) {
  if (!track) {
    return "";
  }

  return String(track.id || track.source_track_id || track.audio_url);
}

function WaveIndicator() {
  return (
    <span className="wave-indicator" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export function TrackList({
  tracks,
  activeTrackId,
  onPlay,
  onToggleFavorite,
  favoriteTrackKeys,
  emptyMessage = "Ничего не найдено.",
  showFavoriteAction = false,
}) {
  if (!tracks.length) {
    return (
      <div className="empty-state empty-state--flat">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="library-list">
      {tracks.map((track, index) => {
        const trackKey = getTrackKey(track);
        const isActive = track.id === activeTrackId || trackKey === activeTrackId;
        const isFavorite = favoriteTrackKeys?.has(trackKey);

        return (
          <article
            key={trackKey || `${track.title}-${index}`}
            className={`library-row ${isActive ? "library-row--active" : ""}`}
          >
            <button
              className="library-row__main"
              type="button"
              onClick={() => onPlay(index)}
            >
              <div className="library-row__cover" aria-hidden="true">
                {track.cover ? (
                  <img src={track.cover} alt="" />
                ) : (
                  <span>{track.title.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className="library-row__copy">
                <h3>{track.title}</h3>
                <p>{track.artist}</p>
              </div>
            </button>

            <div className="library-row__side">
              {showFavoriteAction && onToggleFavorite ? (
                <button
                  className={`library-row__favorite ${
                    isFavorite ? "library-row__favorite--active" : ""
                  }`}
                  type="button"
                  onClick={() => onToggleFavorite(track)}
                >
                  {isFavorite ? "♥" : "♡"}
                </button>
              ) : isActive ? (
                <WaveIndicator />
              ) : (
                <span className="library-row__index">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
