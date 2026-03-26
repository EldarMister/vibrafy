export function SearchBar({
  value,
  onChange,
  onSubmit,
  isLoading,
  onClose,
}) {
  return (
    <form className="search-inline" onSubmit={onSubmit}>
      <input
        className="search-inline__input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Найти трек или исполнителя"
        autoComplete="off"
      />

      <button className="search-inline__submit" type="submit" disabled={isLoading}>
        {isLoading ? "..." : "Найти"}
      </button>

      {onClose ? (
        <button className="search-inline__close" type="button" onClick={onClose}>
          Закрыть
        </button>
      ) : null}
    </form>
  );
}
