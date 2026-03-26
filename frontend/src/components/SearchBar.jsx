export function SearchBar({ value, onChange, onSubmit, isLoading }) {
  return (
    <form className="search-panel" onSubmit={onSubmit}>
      <label className="search-panel__label" htmlFor="search-input">
        Найти трек
      </label>

      <div className="search-panel__controls">
        <input
          id="search-input"
          className="search-panel__input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Например, MiyaGi Minor"
          autoComplete="off"
        />

        <button className="search-panel__button" type="submit" disabled={isLoading}>
          {isLoading ? "Ищу..." : "Найти"}
        </button>
      </div>
    </form>
  );
}
