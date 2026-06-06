import './SearchBar.css';

function SearchBar({ ref, searchQuery, setSearchQuery, placeholder = 'Search...' }) {
  return (
    <div class="search-bar">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="6.5" cy="6.5" r="4.5"/>
        <line x1="10.5" y1="10.5" x2="14" y2="14"/>
      </svg>
      <input
        ref={ref}
        type="text"
        class="search-input"
        placeholder={placeholder}
        value={searchQuery}
        onInput={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
        }}
        autocomplete="off"
        spellcheck={false}
      />
    </div>
  );
}

export default SearchBar;
