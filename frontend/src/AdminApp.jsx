import { useEffect, useState } from "react";
import { adminRequest } from "./lib/api.js";

const emptyTrackForm = {
  id: "",
  title: "",
  artist: "",
  audio_url: "",
  cover: "",
  is_active: true,
};

function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <p className="stat-card__label">{label}</p>
      <strong className="stat-card__value">{value}</strong>
      {hint ? <p className="stat-card__hint">{hint}</p> : null}
    </article>
  );
}

export function AdminApp() {
  const [adminKey, setAdminKey] = useState(
    () => window.localStorage.getItem("music-admin-key") || "",
  );
  const [stats, setStats] = useState(null);
  const [parserData, setParserData] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [search, setSearch] = useState("");
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
  });

  useEffect(() => {
    if (!adminKey) {
      return;
    }

    window.localStorage.setItem("music-admin-key", adminKey);
  }, [adminKey]);

  useEffect(() => {
    if (!adminKey) {
      return;
    }

    loadDashboard();
  }, []);

  async function loadDashboard(trackSearch = search) {
    if (!adminKey) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [statsResponse, parserResponse, tracksResponse] = await Promise.all([
        adminRequest("/admin/stats", adminKey),
        adminRequest("/admin/parser", adminKey),
        adminRequest(
          `/admin/tracks?search=${encodeURIComponent(trackSearch)}`,
          adminKey,
        ),
      ]);

      setStats(statsResponse);
      setParserData(parserResponse);
      setTracks(tracksResponse);
      setParserForm(parserResponse.settings);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить admin-панель",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleTrackFormChange(field, value) {
    setTrackForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveTrack(event) {
    event.preventDefault();

    if (!adminKey) {
      return;
    }

    setError("");
    setMessage("");

    const payload = {
      title: trackForm.title.trim(),
      artist: trackForm.artist.trim(),
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
      setMessage("Трек отключен из выдачи.");
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
    event.preventDefault();

    if (!adminKey) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const updated = await adminRequest("/admin/parser", adminKey, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: parserForm.enabled,
          auto_import_on_search: parserForm.auto_import_on_search,
          hourly_limit: Number(parserForm.hourly_limit),
          request_delay_ms: Number(parserForm.request_delay_ms),
        }),
        headers: { "Content-Type": "application/json" },
      });

      setParserForm(updated);
      setMessage("Настройки парсера обновлены.");
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
        `Парсер завершен. Найдено: ${result.parsedCount ?? 0}, импортировано: ${result.importedCount ?? 0}.`,
      );
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось запустить парсер",
      );
    }
  }

  return (
    <main className="app-shell app-shell--admin">
      <section className="hero">
        <p className="hero__badge">Admin Panel</p>
        <h1>Управление каталогом, парсером и статистикой Mini App.</h1>
        <p className="hero__text">
          Здесь можно смотреть число пользователей, вручную добавлять треки,
          выключать парсер и задавать лимиты импорта.
        </p>
      </section>

      <section className="admin-block">
        <label className="search-panel__label" htmlFor="admin-key">
          Admin key
        </label>
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
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      {stats ? (
        <section className="stats-grid">
          <StatCard
            label="Пользователи"
            value={stats.users}
            hint="Количество пользователей, которые открывали Mini App"
          />
          <StatCard
            label="Всего треков"
            value={stats.tracks.total}
            hint={`Активных: ${stats.tracks.active}`}
          />
          <StatCard
            label="Лимит в час"
            value={stats.parser.hourly_limit}
            hint={`Уже обработано: ${stats.parser.items_processed_this_hour}`}
          />
          <StatCard
            label="Парсер"
            value={stats.parser.enabled ? "Вкл" : "Выкл"}
            hint={
              stats.parser.auto_import_on_search
                ? "Автоимпорт при поиске включен"
                : "Автоимпорт при поиске выключен"
            }
          />
        </section>
      ) : null}

      <section className="admin-grid">
        <form className="admin-block" onSubmit={handleParserSave}>
          <div className="admin-block__header">
            <h2>Настройки парсера</h2>
            <span>{loading ? "Загрузка..." : "Готово"}</span>
          </div>

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
            <span>Автоимпорт при пустом поиске в базе</span>
          </label>

          <div className="admin-form-grid">
            <label>
              <span>Лимит песен в час</span>
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
          </div>

          <button className="search-panel__button" type="submit">
            Сохранить настройки
          </button>
        </form>

        <form className="admin-block" onSubmit={handleRunParser}>
          <div className="admin-block__header">
            <h2>Ручной запуск парсера</h2>
          </div>

          <label>
            <span>Поисковый запрос</span>
            <input
              className="search-panel__input"
              type="text"
              value={manualQuery}
              onChange={(event) => setManualQuery(event.target.value)}
              placeholder="Например, Eminem"
            />
          </label>

          <button className="search-panel__button" type="submit">
            Запустить парсер
          </button>

          <div className="job-list">
            <h3>Последние запуски</h3>
            {(parserData?.jobs || []).map((job) => (
              <div key={job.id} className="job-item">
                <strong>{job.query}</strong>
                <span>
                  {job.status} | parsed {job.parsed_count} | imported {job.imported_count}
                </span>
              </div>
            ))}
          </div>
        </form>
      </section>

      <section className="admin-grid">
        <form className="admin-block" onSubmit={handleSaveTrack}>
          <div className="admin-block__header">
            <h2>{trackForm.id ? "Редактирование трека" : "Ручное добавление"}</h2>
            {trackForm.id ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setTrackForm(emptyTrackForm)}
              >
                Сбросить
              </button>
            ) : null}
          </div>

          <div className="admin-form-grid">
            <label>
              <span>Название</span>
              <input
                className="search-panel__input"
                type="text"
                value={trackForm.title}
                onChange={(event) => handleTrackFormChange("title", event.target.value)}
              />
            </label>

            <label>
              <span>Артист</span>
              <input
                className="search-panel__input"
                type="text"
                value={trackForm.artist}
                onChange={(event) => handleTrackFormChange("artist", event.target.value)}
              />
            </label>
          </div>

          <label>
            <span>Ссылка на mp3</span>
            <input
              className="search-panel__input"
              type="text"
              value={trackForm.audio_url}
              onChange={(event) => handleTrackFormChange("audio_url", event.target.value)}
            />
          </label>

          <label>
            <span>Обложка</span>
            <input
              className="search-panel__input"
              type="text"
              value={trackForm.cover}
              onChange={(event) => handleTrackFormChange("cover", event.target.value)}
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
            <span>Показывать трек в поиске</span>
          </label>

          <button className="search-panel__button" type="submit">
            {trackForm.id ? "Сохранить изменения" : "Добавить трек"}
          </button>
        </form>

        <section className="admin-block">
          <div className="admin-block__header">
            <h2>Каталог треков</h2>
          </div>

          <div className="search-panel__controls">
            <input
              className="search-panel__input"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по каталогу"
            />
            <button
              className="search-panel__button"
              type="button"
              onClick={() => loadDashboard(search)}
            >
              Найти
            </button>
          </div>

          <div className="admin-track-list">
            {tracks.map((track) => (
              <article key={track.id} className="admin-track-card">
                <div>
                  <h3>{track.title}</h3>
                  <p>{track.artist}</p>
                  <small>
                    {track.is_manual ? "manual" : track.source_name} |{" "}
                    {track.is_active ? "active" : "hidden"}
                  </small>
                </div>

                <div className="admin-track-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setTrackForm({
                        id: track.id,
                        title: track.title,
                        artist: track.artist,
                        audio_url: track.audio_url,
                        cover: track.cover || "",
                        is_active: track.is_active,
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost-button ghost-button--danger"
                    onClick={() => handleDeleteTrack(track.id)}
                  >
                    Hide
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
