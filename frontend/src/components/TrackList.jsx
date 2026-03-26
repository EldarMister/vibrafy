function getTrackKey(track) {
  if (!track) {
    return "";
  }

  return String(track.id || track.source_track_id || track.audio_url);
}

export function TrackList({
  tracks,
  activeTrackId,
  onPlay,
  onToggleFavorite,
  favoriteTrackKeys,
  emptyMessage = "Ничего не найдено.",
}) {
  if (!tracks.length) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="track-list">
      {tracks.map((track, index) => {
        const trackKey = getTrackKey(track);
        const isActive = track.id === activeTrackId || trackKey === activeTrackId;
        const isFavorite = favoriteTrackKeys?.has(trackKey);

        return (
          <article
            key={trackKey || `${track.title}-${index}`}
            className={`track-card ${isActive ? "track-card--active" : ""}`}
          >
            <div className="track-card__meta">
              <div className="track-card__cover" aria-hidden="true">
                {track.cover ? (
                  <img src={track.cover} alt="" />
                ) : (
                  <span>{track.title.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div>
                <h3 className="track-card__title">{track.title}</h3>
                <p className="track-card__artist">{track.artist}</p>
              </div>
            </div>

            <div className="track-card__actions">
              {onToggleFavorite ? (
                <button
                  className={`track-card__icon-button ${
                    isFavorite ? "track-card__icon-button--active" : ""
                  }`}
                  type="button"
                  onClick={() => onToggleFavorite(track)}
                >
                  ♥
                </button>
              ) : null}

              <button className="track-card__button" type="button" onClick={() => onPlay(index)}>
                {isActive ? "Играет" : "Play"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
