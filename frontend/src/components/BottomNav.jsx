function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 11.2 12 5l7.5 6.2v7.1a1.2 1.2 0 0 1-1.2 1.2h-4.1v-5.3h-4.4v5.3H5.7a1.2 1.2 0 0 1-1.2-1.2v-7.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 5.2A1.2 1.2 0 0 1 7.2 4h2.2a1.2 1.2 0 0 1 1.2 1.2v13.6A1.2 1.2 0 0 1 9.4 20H7.2A1.2 1.2 0 0 1 6 18.8V5.2Zm7-1.2h2.2a1.2 1.2 0 0 1 1.2 1.2v13.6a1.2 1.2 0 0 1-1.2 1.2H13a1.2 1.2 0 0 1-1.2-1.2V5.2A1.2 1.2 0 0 1 13 4Zm5.8 2.2.2 12.6a1.2 1.2 0 0 1-1.2 1.2h-.7a1.2 1.2 0 0 1-1.2-1.2V6.4a1.2 1.2 0 0 1 1.2-1.2h.5a1.2 1.2 0 0 1 1.2 1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlaylistIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7.2h10.5v1.8H5V7.2Zm0 4h10.5V13H5v-1.8Zm0 4h7.4V17H5v-1.8Zm12.6-8.7 1.8-.3v7.8a2.4 2.4 0 1 1-1.8-2.3V6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

const ICONS = {
  home: HomeIcon,
  mine: LibraryIcon,
  playlists: PlaylistIcon,
};

export function BottomNav({ activeTab, onChange }) {
  const items = [
    { id: "home", label: "Главная" },
    { id: "mine", label: "Мое" },
    { id: "playlists", label: "Плейлисты" },
  ];

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map((item) => {
        const Icon = ICONS[item.id];
        const isActive = item.id === activeTab;

        return (
          <button
            key={item.id}
            className={`bottom-nav__item ${isActive ? "bottom-nav__item--active" : ""}`}
            type="button"
            onClick={() => onChange(item.id)}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
