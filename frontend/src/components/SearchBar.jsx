export function SearchBar({
  value,
  onChange,
  onClose,
}) {
  const hasValue = value.trim().length > 0;

  return (
    <div className="search-inline" role="search">
      <input
        className="search-inline__input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Найти трек, исполнителя или жанр"
        autoComplete="off"
        autoFocus
      />

      {hasValue ? (
        <button className="search-inline__close" type="button" onClick={() => onChange("")}>
          Очистить
        </button>
      ) : null}

      {onClose ? (
        <button className="search-inline__close" type="button" onClick={onClose}>
          Скрыть
        </button>
      ) : null}
    </div>
  );
}
