function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 11.2 12 5l7.5 6.2v7.2a1.2 1.2 0 0 1-1.2 1.2h-4.1v-5.4H9.8v5.4H5.7a1.2 1.2 0 0 1-1.2-1.2v-7.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.2 4.9 13.1a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5L12 20.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlaylistIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 6.8h10.2v1.8H5V6.8Zm0 4.6h10.2v1.8H5v-1.8Zm0 4.6h7.4v1.8H5V16Zm12.6-9.8 1.8-.3V14a2.4 2.4 0 1 1-1.8-2.3V6.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.4 5.2A1.2 1.2 0 0 1 7.6 4h2.1a1.2 1.2 0 0 1 1.2 1.2v13.6A1.2 1.2 0 0 1 9.7 20H7.6a1.2 1.2 0 0 1-1.2-1.2V5.2Zm6 0A1.2 1.2 0 0 1 13.6 4h2.1a1.2 1.2 0 0 1 1.2 1.2v13.6a1.2 1.2 0 0 1-1.2 1.2h-2.1a1.2 1.2 0 0 1-1.2-1.2V5.2Zm6 2.2h.5a1 1 0 0 1 1 1v10.4a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1V8.4a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

const ICONS = {
  home: HomeIcon,
  "for-you": HeartIcon,
  playlists: PlaylistIcon,
  mine: LibraryIcon,
};

const ITEMS = [
  { id: "home", label: "Главная" },
  { id: "for-you", label: "Для вас" },
  { id: "playlists", label: "Плейлисты" },
  { id: "mine", label: "Моё" },
];

export function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {ITEMS.map((item) => {
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
