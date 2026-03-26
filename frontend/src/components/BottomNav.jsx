const TABS = [
  { id: "home", label: "Главная" },
  { id: "tracks", label: "Треки" },
  { id: "mine", label: "Мои" },
  { id: "playlists", label: "Плейлисты" },
];

export function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav__item ${
            activeTab === tab.id ? "bottom-nav__item--active" : ""
          }`}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          <span className="bottom-nav__dot" aria-hidden="true" />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
