import { useEffect, useMemo, useRef, useState } from "react";
import { adminRequest } from "./lib/api.js";

const PAGE_SIZE = 30;
const API_BASE_LABEL = import.meta.env.VITE_API_BASE_URL || "текущий домен";

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

const defaultParserForm = {
  enabled: true,
  auto_import_on_search: true,
  hourly_limit: 1000,
  request_delay_ms: 0,
  worker_concurrency: 3,
};

const JOB_STATUS_LABELS = {
  completed: "Завершен",
  disabled: "Выключен",
  failed: "Ошибка",
  idle: "Ожидание",
  limit_reached: "Лимит",
  running: "В работе",
  stopped: "Остановлен",
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

function normalizeParserForm(settings) {
  return {
    enabled: settings?.enabled ?? true,
    auto_import_on_search: settings?.auto_import_on_search ?? true,
    hourly_limit: settings?.hourly_limit ?? 1000,
    request_delay_ms: settings?.request_delay_ms ?? 0,
    worker_concurrency: settings?.worker_concurrency ?? 3,
  };
}

function StatCard({ label, value, hint }) {
  return (
    <article className="admin-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function JobBadge({ status }) {
  const normalized = status || "idle";
  return (
    <span className={`job-badge job-badge--${normalized}`}>
      {JOB_STATUS_LABELS[normalized] || normalized}
    </span>
  );
}

function AdminNotice({ kind, children }) {
  return <div className={`admin-notice admin-notice--${kind}`}>{children}</div>;
}

export function AdminApp() {
  const latestParamsRef = useRef({
    activeOnly: true,
    artistFilter: "",
    genreFilter: "",
    page: 0,
    selectedJobId: "",
    trackSearch: "",
  });

  const [adminKey, setAdminKey] = useState(
    () => window.localStorage.getItem("music-admin-key") || "",
  );
  const [stats, setStats] = useState(null);
  const [parserData, setParserData] = useState({ settings: defaultParserForm, jobs: [] });
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
  const [parserForm, setParserForm] = useState(defaultParserForm);

  const selectedJob = useMemo(
    () => parserData.jobs.find((job) => job.id === selectedJobId) || null,
    [parserData.jobs, selectedJobId],
  );

  const totalPages = Math.max(1, Math.ceil((tracksData.total || 0) / PAGE_SIZE));

  useEffect(() => {
    latestParamsRef.current = {
      activeOnly,
      artistFilter,
      genreFilter,
      page,
      selectedJobId,
      trackSearch,
    };
  }, [activeOnly, artistFilter, genreFilter, page, selectedJobId, trackSearch]);

  useEffect(() => {
    if (!adminKey) {
      window.localStorage.removeItem("music-admin-key");
      return;
    }

    window.localStorage.setItem("music-admin-key", adminKey);
  }, [adminKey]);

  async function loadJobEvents(jobId) {
    if (!jobId || !adminKey) {
      setJobEvents([]);
      return;
    }

    const events = await adminRequest(`/admin/parser/jobs/${jobId}/events?limit=200`, adminKey);
    setJobEvents([...events].reverse());
  }

  async function loadDashboard(options = {}) {
    if (!adminKey) {
      setError("Введите ADMIN_KEY для входа в админ-панель.");
      return;
    }

    const nextPage = options.page ?? page;
    const nextTrackSearch = options.trackSearch ?? trackSearch;
    const nextArtistFilter = options.artistFilter ?? artistFilter;
    const nextGenreFilter = options.genreFilter ?? genreFilter;
    const nextActiveOnly = options.activeOnly ?? activeOnly;

    setLoading(true);
    setError("");

    try {
      const [statsResponse, parserResponse, tracksResponse, artistsResponse, genresResponse] =
        await Promise.all([
          adminRequest("/admin/stats", adminKey),
          adminRequest("/admin/parser", adminKey),
          adminRequest(
            `/admin/tracks?search=${encodeURIComponent(nextTrackSearch)}&artist=${encodeURIComponent(nextArtistFilter)}&genre=${encodeURIComponent(nextGenreFilter)}&active=${String(nextActiveOnly)}&limit=${PAGE_SIZE}&offset=${nextPage * PAGE_SIZE}`,
            adminKey,
          ),
          adminRequest("/admin/artists?limit=20", adminKey),
          adminRequest("/admin/genres?limit=20", adminKey),
        ]);

      setStats(statsResponse);
      setParserData({
        settings: parserResponse.settings || defaultParserForm,
        jobs: parserResponse.jobs || [],
      });
      setTracksData(tracksResponse);
      setArtistsData(artistsResponse);
      setGenresData(genresResponse);
      setParserForm(normalizeParserForm(parserResponse.settings));

      const preferredJobId = options.selectedJobId ?? selectedJobId ?? parserResponse.jobs?.[0]?.id ?? "";
      setSelectedJobId(preferredJobId);
      await loadJobEvents(preferredJobId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить данные админ-панели.",
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
      void loadDashboard(latestParamsRef.current);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [adminKey]);

  useEffect(() => {
    if (!adminKey) {
      return;
    }

    void loadDashboard({ page });
  }, [page]);

  function handleTrackFormChange(field, value) {
    setTrackForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveTrack(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const payload = {
        title: trackForm.title.trim(),
        artist: trackForm.artist.trim(),
        catalog_artist_name: trackForm.catalog_artist_name.trim(),
        genre_name: trackForm.genre_name.trim(),
        audio_url: trackForm.audio_url.trim(),
        cover: trackForm.cover.trim(),
        is_active: trackForm.is_active,
      };

      if (!payload.title || !payload.artist || !payload.audio_url) {
        setError("Заполни название, исполнителя и audio URL.");
        return;
      }

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
        setMessage("Трек добавлен в каталог.");
      }

      setTrackForm(emptyTrackForm);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить трек.");
    }
  }

  async function handleDeleteTrack(id) {
    setError("");
    setMessage("");

    try {
      await adminRequest(`/admin/tracks/${id}`, adminKey, { method: "DELETE" });
      setMessage("Трек скрыт из каталога.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось отключить трек.");
    }
  }

  async function handleParserSave() {
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
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить настройки парсера.");
    }
  }

  async function handleRunParser(event) {
    event.preventDefault();
    if (!manualQuery.trim()) {
      setError("Укажи поисковый запрос для ручного импорта.");
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
      setMessage(`Ручной импорт завершен. Найдено ${result.parsedCount ?? 0}, добавлено ${result.importedCount ?? 0}.`);
      setManualQuery("");
      await loadDashboard({ selectedJobId: result.jobId || "" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось запустить ручной импорт.");
    }
  }

  async function handleStartCatalogRun() {
    setError("");
    setMessage("");

    try {
      const job = await adminRequest("/admin/parser/catalog/start", adminKey, {
        method: "POST",
      });
      setMessage("Полный обход источника запущен.");
      await loadDashboard({ selectedJobId: job.id });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось запустить полный обход.");
    }
  }

  async function handleStopCatalogRun() {
    setError("");
    setMessage("");

    try {
      await adminRequest("/admin/parser/catalog/stop", adminKey, {
        method: "POST",
      });
      setMessage("Остановочный сигнал отправлен парсеру.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось остановить парсер.");
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
    await loadJobEvents(jobId);
  }

  return (
    <main className="app-shell app-shell--admin admin-shell">
      <section className="admin-hero">
        <div className="admin-hero__copy">
          <span className="hero__badge">Админ-панель</span>
          <h1>Управление каталогом Vibrafy</h1>
          <p>
            Здесь доступны все треки проекта, управление полным обходом источника, live-логи,
            фильтры по артистам и жанрам, а также ручное добавление и редактирование музыки.
          </p>
        </div>

        <section className="admin-auth-card">
          <label htmlFor="admin-key">ADMIN_KEY</label>
          <input
            id="admin-key"
            className="search-panel__input"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="Введи x-admin-key"
          />
          <div className="admin-inline-actions">
            <button className="search-panel__button" type="button" onClick={() => loadDashboard()}>
              Подключиться
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setAdminKey("");
                setError("");
                setMessage("");
              }}
            >
              Сбросить
            </button>
          </div>
          <p>API: {API_BASE_LABEL}</p>
        </section>
      </section>

      {error ? <AdminNotice kind="error">{error}</AdminNotice> : null}
      {message ? <AdminNotice kind="success">{message}</AdminNotice> : null}

      {stats ? (
        <section className="admin-metric-grid">
          <StatCard label="Пользователи" value={stats.users} hint="Открывали Mini App" />
          <StatCard label="Треки" value={stats.tracks.total} hint={`Активных: ${stats.tracks.active}`} />
          <StatCard label="Исполнители" value={stats.catalog.artists} hint="Каталог по артистам" />
          <StatCard label="Жанры" value={stats.catalog.genres} hint="Каталог по жанрам" />
          <StatCard label="Лимит в час" value={stats.parser.hourly_limit} hint={`Уже обработано: ${stats.parser.items_processed_this_hour}`} />
          <StatCard label="Парсер" value={stats.parser.enabled ? "Включен" : "Выключен"} hint={`Потоков: ${stats.parser.worker_concurrency ?? 3}`} />
        </section>
      ) : null}

      <section className="admin-layout">
        <div className="admin-main-stack">
          <section className="admin-card">
            <div className="admin-card__header">
              <div>
                <h2>Управление парсером</h2>
                <p>Включение, лимиты, ручной импорт и полный обход источника.</p>
              </div>
              <span>{loading ? "Обновляю..." : "Готово"}</span>
            </div>

            <div className="admin-field-grid">
              <label className="admin-check admin-check--boxed">
                <input type="checkbox" checked={parserForm.enabled} onChange={(event) => setParserForm((current) => ({ ...current, enabled: event.target.checked }))} />
                <span>Парсер включен</span>
              </label>
              <label className="admin-check admin-check--boxed">
                <input type="checkbox" checked={parserForm.auto_import_on_search} onChange={(event) => setParserForm((current) => ({ ...current, auto_import_on_search: event.target.checked }))} />
                <span>Автоимпорт при поиске</span>
              </label>
              <label>
                <span>Лимит треков в час</span>
                <input className="search-panel__input" type="number" min="1" value={parserForm.hourly_limit} onChange={(event) => setParserForm((current) => ({ ...current, hourly_limit: event.target.value }))} />
              </label>
              <label>
                <span>Задержка запроса, мс</span>
                <input className="search-panel__input" type="number" min="0" value={parserForm.request_delay_ms} onChange={(event) => setParserForm((current) => ({ ...current, request_delay_ms: event.target.value }))} />
              </label>
              <label>
                <span>Параллельных потоков</span>
                <input className="search-panel__input" type="number" min="1" max="8" value={parserForm.worker_concurrency} onChange={(event) => setParserForm((current) => ({ ...current, worker_concurrency: event.target.value }))} />
              </label>
            </div>

            <div className="admin-inline-actions admin-inline-actions--wrap">
              <button className="search-panel__button" type="button" onClick={handleParserSave}>Сохранить настройки</button>
              <button className="search-panel__button search-panel__button--secondary" type="button" onClick={handleStartCatalogRun}>Запустить полный обход</button>
              <button className="ghost-button" type="button" onClick={handleStopCatalogRun}>Остановить обход</button>
            </div>

            <form className="admin-query-form" onSubmit={handleRunParser}>
              <input className="search-panel__input" value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder="Запрос для ручного импорта" />
              <button className="search-panel__button" type="submit">Импортировать</button>
            </form>
          </section>

          <section className="admin-card">
            <div className="admin-card__header">
              <div>
                <h2>Каталог треков</h2>
                <p>{tracksData.total} записей, страница {page + 1} из {totalPages}</p>
              </div>
            </div>

            <form className="admin-filter-grid" onSubmit={handleApplyFilters}>
              <input className="search-panel__input" value={trackSearch} onChange={(event) => setTrackSearch(event.target.value)} placeholder="Поиск по названию, артисту или жанру" />
              <input className="search-panel__input" value={artistFilter} onChange={(event) => setArtistFilter(event.target.value)} placeholder="Фильтр по артисту" />
              <input className="search-panel__input" value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)} placeholder="Фильтр по жанру" />
              <label className="admin-check admin-check--inline">
                <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
                <span>Только активные</span>
              </label>
              <div className="admin-inline-actions">
                <button className="search-panel__button" type="submit">Применить</button>
                <button className="ghost-button" type="button" onClick={() => {
                  setTrackSearch("");
                  setArtistFilter("");
                  setGenreFilter("");
                  setActiveOnly(true);
                  setPage(0);
                  void loadDashboard({ page: 0, trackSearch: "", artistFilter: "", genreFilter: "", activeOnly: true });
                }}>Сбросить</button>
              </div>
            </form>

            <div className="admin-table-wrap">
              <table className="admin-track-table">
                <thead>
                  <tr>
                    <th>Трек</th>
                    <th>Каталоговый артист</th>
                    <th>Жанр</th>
                    <th>Источник</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {tracksData.items.length > 0 ? tracksData.items.map((track) => (
                    <tr key={track.id}>
                      <td>
                        <strong>{track.title}</strong>
                        <p>{track.artist}</p>
                      </td>
                      <td>{track.catalog_artist_name || "—"}</td>
                      <td>{track.genre_name || "—"}</td>
                      <td>{track.source_section || track.source_name || "manual"}</td>
                      <td>{track.is_active ? "Активен" : "Скрыт"}</td>
                      <td>
                        <div className="admin-inline-actions admin-inline-actions--wrap">
                          <button className="admin-text-button" type="button" onClick={() => setTrackForm({ ...emptyTrackForm, ...track })}>Редактировать</button>
                          <button className="admin-text-button admin-text-button--danger" type="button" onClick={() => handleDeleteTrack(track.id)}>Скрыть</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="admin-empty-row" colSpan="6">Треки не найдены по текущим фильтрам.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <button className="ghost-button" type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(current - 1, 0))}>Назад</button>
              <button className="ghost-button" type="button" disabled={page >= totalPages - 1} onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}>Вперед</button>
            </div>
          </section>
        </div>

        <div className="admin-side-stack">
          <section className="admin-card">
            <div className="admin-card__header">
              <div>
                <h2>Jobs и live-логи</h2>
                <p>{selectedJob ? `Текущая задача: #${selectedJob.id}` : "Выбери задачу для просмотра логов"}</p>
              </div>
              <JobBadge status={selectedJob?.status || "idle"} />
            </div>

            <div className="admin-job-list">
              {parserData.jobs.length > 0 ? parserData.jobs.map((job) => (
                <button key={job.id} type="button" className={`admin-job-list__item ${selectedJobId === job.id ? "admin-job-list__item--active" : ""}`} onClick={() => handleSelectJob(job.id)}>
                  <div>
                    <strong>{job.job_kind}</strong>
                    <p>{job.query || "Полный обход каталога"}</p>
                  </div>
                  <div className="admin-job-list__meta">
                    <JobBadge status={job.status} />
                    <span>{formatDateTime(job.created_at)}</span>
                  </div>
                </button>
              )) : <div className="empty-state empty-state--flat"><p>Задачи парсера еще не запускались.</p></div>}
            </div>

            <div className="admin-job-stats">
              <article><span>Парсинг</span><strong>{selectedJob?.parsed_count ?? 0}</strong></article>
              <article><span>Импорт</span><strong>{selectedJob?.imported_count ?? 0}</strong></article>
              <article><span>Страницы</span><strong>{selectedJob?.processed_pages ?? 0}</strong></article>
              <article><span>Исполнители</span><strong>{selectedJob?.discovered_artists ?? 0}</strong></article>
            </div>

            <div className="admin-log-list">
              {jobEvents.length > 0 ? jobEvents.map((event) => (
                <article key={event.id} className={`admin-log-item admin-log-item--${event.level}`}>
                  <div className="admin-log-item__meta">
                    <strong>{event.level}</strong>
                    <span>{formatDateTime(event.created_at)}</span>
                  </div>
                  <p>{event.message}</p>
                </article>
              )) : <div className="empty-state empty-state--flat"><p>Логи появятся после запуска задачи парсера.</p></div>}
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-card__header">
              <div>
                <h2>{trackForm.id ? "Редактирование трека" : "Ручное добавление"}</h2>
                <p>{trackForm.id ? `ID ${trackForm.id}` : "Новый трек в каталоге"}</p>
              </div>
            </div>

            <form className="admin-field-grid" onSubmit={handleSaveTrack}>
              <label>
                <span>Название</span>
                <input className="search-panel__input" value={trackForm.title} onChange={(event) => handleTrackFormChange("title", event.target.value)} />
              </label>
              <label>
                <span>Исполнитель</span>
                <input className="search-panel__input" value={trackForm.artist} onChange={(event) => handleTrackFormChange("artist", event.target.value)} />
              </label>
              <label>
                <span>Каталоговый артист</span>
                <input className="search-panel__input" value={trackForm.catalog_artist_name || ""} onChange={(event) => handleTrackFormChange("catalog_artist_name", event.target.value)} />
              </label>
              <label>
                <span>Жанр</span>
                <input className="search-panel__input" value={trackForm.genre_name || ""} onChange={(event) => handleTrackFormChange("genre_name", event.target.value)} />
              </label>
              <label>
                <span>Audio URL</span>
                <input className="search-panel__input" value={trackForm.audio_url} onChange={(event) => handleTrackFormChange("audio_url", event.target.value)} />
              </label>
              <label>
                <span>Cover URL</span>
                <input className="search-panel__input" value={trackForm.cover} onChange={(event) => handleTrackFormChange("cover", event.target.value)} />
              </label>
              <label className="admin-check admin-check--boxed">
                <input type="checkbox" checked={trackForm.is_active} onChange={(event) => handleTrackFormChange("is_active", event.target.checked)} />
                <span>Трек активен</span>
              </label>
              <div className="admin-inline-actions admin-inline-actions--wrap">
                <button className="search-panel__button" type="submit">Сохранить</button>
                <button className="ghost-button" type="button" onClick={() => setTrackForm(emptyTrackForm)}>Очистить</button>
              </div>
            </form>
          </section>

          <section className="admin-card">
            <div className="admin-card__header">
              <div>
                <h2>Исполнители каталога</h2>
                <p>{artistsData.total} записей</p>
              </div>
            </div>

            <div className="admin-quick-list">
              {artistsData.items.map((artist) => (
                <button key={`${artist.slug}-${artist.name}`} type="button" className="admin-quick-list__item" onClick={() => {
                  setArtistFilter(artist.name);
                  setPage(0);
                  void loadDashboard({ page: 0, artistFilter: artist.name });
                }}>
                  <div>
                    <strong>{artist.name}</strong>
                    <p>{artist.active_tracks} активных</p>
                  </div>
                  <span>{artist.total_tracks}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-card__header">
              <div>
                <h2>Жанры каталога</h2>
                <p>{genresData.total} записей</p>
              </div>
            </div>

            <div className="admin-quick-list">
              {genresData.items.map((genre) => (
                <button key={`${genre.slug}-${genre.name}`} type="button" className="admin-quick-list__item" onClick={() => {
                  setGenreFilter(genre.name);
                  setPage(0);
                  void loadDashboard({ page: 0, genreFilter: genre.name });
                }}>
                  <div>
                    <strong>{genre.name}</strong>
                    <p>{genre.active_tracks} активных</p>
                  </div>
                  <span>{genre.total_tracks}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
