import { useEffect, useMemo, useRef, useState } from "react";
import { adminRequest } from "./lib/api.js";

const PAGE_SIZE = 30;

const emptyTrackForm = {
  id: "",
  title: "",
  artist: "",
  catalog_artist_name: "",
  genre_name: "",
  audio_url: "",
  cover: "",
  is_active: true,
};

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function StatCard({ label, value, hint }) {
  return (
    <article className="desktop-stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}

function JobBadge({ status }) {
  return (
    <span className={`job-badge job-badge--${status || "idle"}`}>
      {status || "idle"}
    </span>
  );
}

export function AdminApp() {
  const latestDashboardParamsRef = useRef({
    activeOnly: true,
    artistFilter: "",
    page: 0,
    selectedJobId: "",
    trackSearch: "",
    genreFilter: "",
  });
  const [adminKey, setAdminKey] = useState(
    () => window.localStorage.getItem("music-admin-key") || "",
  );
  const [stats, setStats] = useState(null);
  const [parserData, setParserData] = useState(null);
  const [tracksData, setTracksData] = useState({ items: [], total: 0 });
  const [artistsData, setArtistsData] = useState({ items: [], total: 0 });
  const [genresData, setGenresData] = useState({ items: [], total: 0 });
  const [jobEvents, setJobEvents] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [trackSearch, setTrackSearch] = useState("");
  const [artistFilter, setArtistFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [trackForm, setTrackForm] = useState(emptyTrackForm);
  const [parserForm, setParserForm] = useState({
    enabled: true,
    auto_import_on_search: true,
    hourly_limit: 1000,
    request_delay_ms: 0,
    worker_concurrency: 3,
  });

  const selectedJob = useMemo(
    () => parserData?.jobs?.find((job) => job.id === selectedJobId) || null,
    [parserData, selectedJobId],
  );

  useEffect(() => {
    latestDashboardParamsRef.current = {
      activeOnly,
      artistFilter,
      page,
      selectedJobId,
      trackSearch,
      genreFilter,
    };
  }, [activeOnly, artistFilter, page, selectedJobId, trackSearch, genreFilter]);

  useEffect(() => {
    if (!adminKey) {
      return;
    }

    window.localStorage.setItem("music-admin-key", adminKey);
  }, [adminKey]);

  async function loadDashboard(options = {}) {
    const nextPage = options.page ?? page;
    const nextSearch = options.trackSearch ?? trackSearch;
    const nextArtist = options.artistFilter ?? artistFilter;
    const nextGenre = options.genreFilter ?? genreFilter;
    const nextActiveOnly = options.activeOnly ?? activeOnly;

    if (!adminKey) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [statsResponse, parserResponse, tracksResponse, artistsResponse, genresResponse] =
        await Promise.all([
          adminRequest("/admin/stats", adminKey),
          adminRequest("/admin/parser", adminKey),
          adminRequest(
            `/admin/tracks?search=${encodeURIComponent(nextSearch)}&artist=${encodeURIComponent(nextArtist)}&genre=${encodeURIComponent(nextGenre)}&active=${String(nextActiveOnly)}&limit=${PAGE_SIZE}&offset=${nextPage * PAGE_SIZE}`,
            adminKey,
          ),
          adminRequest("/admin/artists?limit=20", adminKey),
          adminRequest("/admin/genres?limit=20", adminKey),
        ]);

      setStats(statsResponse);
      setParserData(parserResponse);
      setTracksData(tracksResponse);
      setArtistsData(artistsResponse);
      setGenresData(genresResponse);
      setParserForm({
        enabled: parserResponse.settings.enabled,
        auto_import_on_search: parserResponse.settings.auto_import_on_search,
        hourly_limit: parserResponse.settings.hourly_limit,
        request_delay_ms: parserResponse.settings.request_delay_ms,
        worker_concurrency: parserResponse.settings.worker_concurrency ?? 3,
      });

      const preferredJobId =
        options.selectedJobId ||
        selectedJobId ||
        parserResponse.jobs?.[0]?.id ||
        "";
      setSelectedJobId(preferredJobId);

      if (preferredJobId) {
        const events = await adminRequest(
          `/admin/parser/jobs/${preferredJobId}/events?limit=200`,
          adminKey,
        );
        setJobEvents(events.reverse());
      } else {
        setJobEvents([]);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить админ-панель",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!adminKey) {
      return;
    }

    loadDashboard();
    const timer = window.setInterval(() => {
      loadDashboard(latestDashboardParamsRef.current);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [adminKey]);

  useEffect(() => {
    if (!adminKey) {
      return;
    }

    loadDashboard({ page });
  }, [page]);

  function handleTrackFormChange(field, value) {
    setTrackForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveTrack(event) {
    event?.preventDefault();

    if (!adminKey) {
      return;
    }

    setError("");
    setMessage("");

    const payload = {
      title: trackForm.title.trim(),
      artist: trackForm.artist.trim(),
      catalog_artist_name: trackForm.catalog_artist_name.trim(),
      genre_name: trackForm.genre_name.trim(),
      audio_url: trackForm.audio_url.trim(),
      cover: trackForm.cover.trim(),
      is_active: trackForm.is_active,
    };

    try {
      if (trackForm.id) {
        await adminRequest(`/admin/tracks/${trackForm.id}`, adminKey, {
          method: "PUT",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
        setMessage("Трек обновлен.");
      } else {
        await adminRequest("/admin/tracks", adminKey, {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
        setMessage("Трек добавлен.");
      }

      setTrackForm(emptyTrackForm);
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось сохранить трек",
      );
    }
  }

  async function handleDeleteTrack(id) {
    if (!adminKey) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await adminRequest(`/admin/tracks/${id}`, adminKey, {
        method: "DELETE",
      });
      setMessage("Трек отключен.");
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось удалить трек",
      );
    }
  }

  async function handleParserSave(event) {
    event?.preventDefault();

    if (!adminKey) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await adminRequest("/admin/parser", adminKey, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: parserForm.enabled,
          auto_import_on_search: parserForm.auto_import_on_search,
          hourly_limit: Number(parserForm.hourly_limit),
          request_delay_ms: Number(parserForm.request_delay_ms),
          worker_concurrency: Number(parserForm.worker_concurrency),
        }),
        headers: { "Content-Type": "application/json" },
      });

      setMessage("Настройки парсера сохранены.");
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось сохранить настройки парсера",
      );
    }
  }

  async function handleRunParser(event) {
    event.preventDefault();

    if (!adminKey || !manualQuery.trim()) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const result = await adminRequest("/admin/parser/run", adminKey, {
        method: "POST",
        body: JSON.stringify({ query: manualQuery.trim() }),
        headers: { "Content-Type": "application/json" },
      });

      setMessage(
        `Поисковый импорт завершен. Найдено: ${result.parsedCount ?? 0}, импортировано: ${result.importedCount ?? 0}.`,
      );
      setManualQuery("");
      await loadDashboard({ selectedJobId: result.jobId || "" });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось запустить поисковый импорт",
      );
    }
  }

  async function handleStartCatalogRun() {
    if (!adminKey) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const job = await adminRequest("/admin/parser/catalog/start", adminKey, {
        method: "POST",
      });
      setMessage("Полный обход запущен.");
      await loadDashboard({ selectedJobId: job.id });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось запустить полный обход",
      );
    }
  }

  async function handleStopCatalogRun() {
    if (!adminKey) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await adminRequest("/admin/parser/catalog/stop", adminKey, {
        method: "POST",
      });
      setMessage("Отправлен сигнал на остановку парсера.");
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось остановить парсер",
      );
    }
  }

  async function handleApplyFilters(event) {
    event.preventDefault();
    setPage(0);
    await loadDashboard({
      page: 0,
      trackSearch,
      artistFilter,
      genreFilter,
      activeOnly,
    });
  }

  async function handleSelectJob(jobId) {
    setSelectedJobId(jobId);
    await loadDashboard({ selectedJobId: jobId });
  }

  const totalPages = Math.max(1, Math.ceil((tracksData.total || 0) / PAGE_SIZE));

  return (
    <main className="app-shell app-shell--admin admin-desktop">
      <section className="admin-toolbar">
        <div>
          <p className="hero__badge">Desktop Admin</p>
          <h1>Каталог, полный crawl Sefon и live-логи импорта</h1>
          <p className="hero__text">
            Здесь видны все доступные треки проекта, каталог по артистам и жанрам,
            а также фоновый обход источника с логами в реальном времени.
          </p>
        </div>

        <div className="admin-toolbar__auth">
          <label htmlFor="admin-key">Admin key</label>
          <div className="search-panel__controls">
            <input
              id="admin-key"
              className="search-panel__input"
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Введите x-admin-key"
            />
            <button
              className="search-panel__button"
              type="button"
              onClick={() => loadDashboard()}
            >
              Обновить
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      {stats ? (
        <section className="desktop-stats-grid">
          <StatCard
            label="Пользователи"
            value={stats.users}
            hint="Открывали Mini App"
          />
          <StatCard
            label="Все треки"
            value={stats.tracks.total}
            hint={`Активных: ${stats.tracks.active}`}
          />
          <StatCard
            label="Артисты"
            value={stats.catalog.artists}
            hint="Группировка каталога"
          />
          <StatCard
            label="Жанры"
            value={stats.catalog.genres}
            hint="Заполнены в каталоге"
          />
          <StatCard
            label="Лимит в час"
            value={stats.parser.hourly_limit}
            hint={`Уже обработано: ${stats.parser.items_processed_this_hour}`}
          />
          <StatCard
            label="Парсер"
            value={stats.parser.enabled ? "включен" : "выключен"}
            hint={`Concurrency: ${stats.parser.worker_concurrency ?? 3}`}
          />
        </section>
      ) : null}

      <section className="admin-desktop-grid">
        <section className="admin-surface">
          <div className="admin-surface__header">
            <h2>Управление парсером</h2>
            <span>{loading ? "загрузка..." : "online"}</span>
          </div>

          <div className="admin-form-grid admin-form-grid--desktop">
            <label className="admin-check">
              <input
                type="checkbox"
                checked={parserForm.enabled}
                onChange={(event) =>
                  setParserForm((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              <span>Парсер включен</span>
            </label>

            <label className="admin-check">
              <input
                type="checkbox"
                checked={parserForm.auto_import_on_search}
                onChange={(event) =>
                  setParserForm((current) => ({
                    ...current,
                    auto_import_on_search: event.target.checked,
                  }))
                }
              />
              <span>Автоимпорт при поиске</span>
            </label>

            <label>
              <span>Лимит треков в час</span>
              <input
                className="search-panel__input"
                type="number"
                min="1"
                value={parserForm.hourly_limit}
                onChange={(event) =>
                  setParserForm((current) => ({
                    ...current,
                    hourly_limit: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Задержка запроса, мс</span>
              <input
                className="search-panel__input"
                type="number"
                min="0"
                value={parserForm.request_delay_ms}
                onChange={(event) =>
                  setParserForm((current) => ({
                    ...current,
                    request_delay_ms: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Параллельных workers</span>
              <input
                className="search-panel__input"
                type="number"
                min="1"
                max="8"
                value={parserForm.worker_concurrency}
                onChange={(event) =>
                  setParserForm((current) => ({
                    ...current,
                    worker_concurrency: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="admin-toolbar-buttons">
            <button
              className="search-panel__button"
              type="button"
              onClick={handleParserSave}
            >
              Сохранить настройки
            </button>
            <button
              className="search-panel__button search-panel__button--secondary"
              type="button"
              onClick={handleStartCatalogRun}
            >
              Запустить полный обход
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleStopCatalogRun}
            >
              Остановить parser
            </button>
          </div>

          <form className="admin-inline-form" onSubmit={handleRunParser}>
            <input
              className="search-panel__input"
              value={manualQuery}
              onChange={(event) => setManualQuery(event.target.value)}
              placeholder="Быстрый импорт по поисковому запросу"
            />
            <button className="search-panel__button" type="submit">
              Импортировать
            </button>
          </form>
        </section>

        <section className="admin-surface">
          <div className="admin-surface__header">
            <h2>Jobs и live-логи</h2>
            <span>{selectedJob ? `job #${selectedJob.id}` : "нет job"}</span>
          </div>

          <div className="job-list">
            {(parserData?.jobs || []).map((job) => (
              <button
                key={job.id}
                type="button"
                className={`job-list__item ${
                  selectedJobId === job.id ? "job-list__item--active" : ""
                }`}
                onClick={() => handleSelectJob(job.id)}
              >
                <div>
                  <strong>{job.job_kind}</strong>
                  <p>{job.query}</p>
                </div>
                <div className="job-list__meta">
                  <JobBadge status={job.status} />
                  <span>{formatDateTime(job.created_at)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="job-summary">
            <div>
              <span>Парсинг</span>
              <strong>{selectedJob?.parsed_count ?? 0}</strong>
            </div>
            <div>
              <span>Импорт</span>
              <strong>{selectedJob?.imported_count ?? 0}</strong>
            </div>
            <div>
              <span>Страницы</span>
              <strong>{selectedJob?.processed_pages ?? 0}</strong>
            </div>
            <div>
              <span>Артисты</span>
              <strong>{selectedJob?.discovered_artists ?? 0}</strong>
            </div>
          </div>

          <div className="job-log-list">
            {jobEvents.length > 0 ? (
              jobEvents.map((event) => (
                <article key={event.id} className={`job-log job-log--${event.level}`}>
                  <div className="job-log__meta">
                    <strong>{event.level}</strong>
                    <span>{formatDateTime(event.created_at)}</span>
                  </div>
                  <p>{event.message}</p>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <p>Логи появятся после запуска parser job.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="admin-desktop-grid admin-desktop-grid--catalog">
        <section className="admin-surface">
          <div className="admin-surface__header">
            <h2>Каталог треков</h2>
            <span>
              {tracksData.total} записей, страница {page + 1} / {totalPages}
            </span>
          </div>

          <form className="admin-filter-bar" onSubmit={handleApplyFilters}>
            <input
              className="search-panel__input"
              value={trackSearch}
              onChange={(event) => setTrackSearch(event.target.value)}
              placeholder="Поиск по названию, артисту, жанру"
            />
            <input
              className="search-panel__input"
              value={artistFilter}
              onChange={(event) => setArtistFilter(event.target.value)}
              placeholder="Фильтр по артисту"
            />
            <input
              className="search-panel__input"
              value={genreFilter}
              onChange={(event) => setGenreFilter(event.target.value)}
              placeholder="Фильтр по жанру"
            />
            <label className="admin-check">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
              />
              <span>Только активные</span>
            </label>
            <button className="search-panel__button" type="submit">
              Применить
            </button>
          </form>

          <div className="desktop-table-wrap">
            <table className="desktop-table">
              <thead>
                <tr>
                  <th>Трек</th>
                  <th>Каталог артист</th>
                  <th>Жанр</th>
                  <th>Источник</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tracksData.items.map((track) => (
                  <tr key={track.id}>
                    <td>
                      <strong>{track.title}</strong>
                      <p>{track.artist}</p>
                    </td>
                    <td>{track.catalog_artist_name || "—"}</td>
                    <td>{track.genre_name || "—"}</td>
                    <td>{track.source_section || track.source_name}</td>
                    <td>{track.is_active ? "active" : "hidden"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() => setTrackForm(track)}
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrack(track.id)}
                        >
                          Отключить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-row">
            <button
              className="ghost-button"
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
            >
              Назад
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() =>
                setPage((current) => Math.min(current + 1, totalPages - 1))
              }
            >
              Вперед
            </button>
          </div>
        </section>

        <section className="admin-side-stack">
          <form className="admin-surface" onSubmit={handleSaveTrack}>
            <div className="admin-surface__header">
              <h2>{trackForm.id ? "Редактирование трека" : "Ручное добавление"}</h2>
              <span>{trackForm.id ? `ID ${trackForm.id}` : "new"}</span>
            </div>

            <div className="admin-form-grid admin-form-grid--desktop">
              <label>
                <span>Название</span>
                <input
                  className="search-panel__input"
                  value={trackForm.title}
                  onChange={(event) =>
                    handleTrackFormChange("title", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Artist raw</span>
                <input
                  className="search-panel__input"
                  value={trackForm.artist}
                  onChange={(event) =>
                    handleTrackFormChange("artist", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Каталог артист</span>
                <input
                  className="search-panel__input"
                  value={trackForm.catalog_artist_name || ""}
                  onChange={(event) =>
                    handleTrackFormChange("catalog_artist_name", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Жанр</span>
                <input
                  className="search-panel__input"
                  value={trackForm.genre_name || ""}
                  onChange={(event) =>
                    handleTrackFormChange("genre_name", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Audio URL</span>
                <input
                  className="search-panel__input"
                  value={trackForm.audio_url}
                  onChange={(event) =>
                    handleTrackFormChange("audio_url", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Cover URL</span>
                <input
                  className="search-panel__input"
                  value={trackForm.cover}
                  onChange={(event) =>
                    handleTrackFormChange("cover", event.target.value)
                  }
                />
              </label>

              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={trackForm.is_active}
                  onChange={(event) =>
                    handleTrackFormChange("is_active", event.target.checked)
                  }
                />
                <span>Трек активен</span>
              </label>
            </div>

            <div className="admin-toolbar-buttons">
              <button className="search-panel__button" type="submit">
                Сохранить
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setTrackForm(emptyTrackForm)}
              >
                Сбросить
              </button>
            </div>
          </form>

          <section className="admin-surface">
            <div className="admin-surface__header">
              <h2>Артисты каталога</h2>
              <span>{artistsData.total}</span>
            </div>
            <div className="mini-table">
              {artistsData.items.map((artist) => (
                <button
                  key={`${artist.slug}-${artist.name}`}
                  type="button"
                  className="mini-table__row"
                  onClick={() => {
                    setArtistFilter(artist.name);
                    setPage(0);
                    loadDashboard({
                      page: 0,
                      artistFilter: artist.name,
                    });
                  }}
                >
                  <div>
                    <strong>{artist.name}</strong>
                    <p>{artist.active_tracks} активных</p>
                  </div>
                  <span>{artist.total_tracks}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-surface">
            <div className="admin-surface__header">
              <h2>Жанры каталога</h2>
              <span>{genresData.total}</span>
            </div>
            <div className="mini-table">
              {genresData.items.map((genre) => (
                <button
                  key={`${genre.slug}-${genre.name}`}
                  type="button"
                  className="mini-table__row"
                  onClick={() => {
                    setGenreFilter(genre.name);
                    setPage(0);
                    loadDashboard({
                      page: 0,
                      genreFilter: genre.name,
                    });
                  }}
                >
                  <div>
                    <strong>{genre.name}</strong>
                    <p>{genre.active_tracks} активных</p>
                  </div>
                  <span>{genre.total_tracks}</span>
                </button>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
