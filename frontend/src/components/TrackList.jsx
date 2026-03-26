export function TrackList({ tracks, activeTrackId, onPlay }) {
  if (!tracks.length) {
    return (
      <div className="empty-state">
        <p>Ничего не найдено. Попробуйте другой запрос.</p>
      </div>
    );
  }

  return (
    <div className="track-list">
      {tracks.map((track, index) => {
        const isActive = track.id === activeTrackId;

        return (
          <article
            key={track.id || `${track.title}-${index}`}
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

            <button className="track-card__button" type="button" onClick={() => onPlay(index)}>
              {isActive ? "Играет" : "Слушать"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
